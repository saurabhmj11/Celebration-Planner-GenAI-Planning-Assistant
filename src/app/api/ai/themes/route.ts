import { NextResponse } from "next/server";

import { extractAndParseJSON } from "@/lib/ai/jsonExtractor";
import { normalizeThemePayload } from "@/lib/ai/themeNormalizer";
import { runChatCompletion, type RunEngine } from "@/lib/ai/engine";
import { checkRateLimit, getClientKey } from "@/lib/security/rateLimit";
import { sanitizeText } from "@/lib/security/sanitize";
import {
  MAX_BODY_BYTES,
  formatZodErrors,
  themesRequestSchema,
  type EventBrief,
} from "@/lib/validation/schemas";

/**
 * GenAI Theme & Idea Studio backend.
 *
 * POST /api/ai/themes
 * Body: { event: {...}, customPrompt?: string }
 *
 * Uses the z-ai-web-dev-sdk (server-side only) to generate 3 personalized
 * celebration theme concepts — including name, tagline, 4-color palette,
 * decor highlights, music direction, catering ideas, and a budget tip —
 * tailored to the active event's type, venue, guest count, budget and notes.
 *
 * Security layers (outermost first):
 *   1. Method allowlist + payload-size cap (413).
 *   2. Per-client rate limiting (429 + Retry-After).
 *   3. Strict Zod schema validation (400 with field errors).
 *   4. String sanitization before prompt assembly (control chars stripped).
 *   5. Response normalization + sanitization before it reaches the client.
 *
 * Architecture: the handler is produced by a factory so tests can inject a
 * deterministic LLM engine and cover the full pipeline without live calls.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

/** 8 requests / minute / client — generous for humans, hostile to scripts. */
const RATE_LIMIT = { key: "ai:themes", limit: 8, windowMs: 60_000 };

/** 2 attempts: 1 normal + 1 "format your JSON better" retry. */
const MAX_LLM_ATTEMPTS = 2;

const SYSTEM_PROMPT = `You are an elite celebration and luxury event designer with deep expertise in weddings, milestone birthdays, anniversaries, community festivals, charity galas, and baby showers.
You always respond with STRICTLY VALID JSON — no markdown fences, no commentary, no text outside the JSON object.
Your design ideas are creative, cohesive, actionable, and budget-aware.`;

function buildUserPrompt(event: EventBrief, customPrompt: string): string {
  // Every interpolated value has already passed Zod + sanitization upstream,
  // so prompt assembly cannot smuggle control chars or oversized strings.
  return `
Generate 3 distinct, creative, and actionable event theme ideas for:
- Event Type: ${event.type || "celebration"}
- Event Title: ${event.title || "Untitled celebration"}
- Guest Count: ${event.guestCount ?? "Not specified"}
- Location: ${event.location || "Local venue"}
- Total Budget: $${event.budget ?? 5000}
- Additional User Notes/Vibe: ${customPrompt || event.description || "Modern, memorable, and elegant"}

Respond strictly in valid JSON matching exactly this schema:
{
  "summary": "Brief executive vision of these concepts (1-2 sentences)",
  "themes": [
    {
      "id": "unique-slug",
      "name": "Theme Name",
      "tagline": "Catchy evocative 1-sentence tagline",
      "palette": ["#HEX1", "#HEX2", "#HEX3", "#HEX4"],
      "paletteNames": ["Color 1", "Color 2", "Color 3", "Color 4"],
      "decorHighlights": [
        "Specific decor highlight 1",
        "Specific decor highlight 2",
        "Specific decor highlight 3",
        "Specific decor highlight 4"
      ],
      "recommendedMusic": "Atmosphere and music direction",
      "cateringIdeas": "Signature dishes, drinks, or serving style",
      "budgetTip": "Actionable budget optimization advice for this theme"
    }
  ]
}
Rules:
- Exactly 3 themes, each with exactly 4 hex colors (with # prefix) and 4 decor highlights.
- Every string must be concrete and specific to this event type, budget tier, and guest count.
- Keep every string value under 160 characters so the response is never truncated.
- Output raw JSON only. Do not wrap in markdown code fences. The first character of your reply must be "{" and the last must be "}".`;
}

/**
 * Handler factory. `runEngine` is the LLM seam — inject a fake in tests,
 * use the default z-ai-web-dev-sdk engine in production.
 */
export function createThemesPostHandler(runEngine: RunEngine) {
  return async function POST(request: Request): Promise<Response> {
    try {
      // ---- Layer 1: method + payload-size safeguards ----------------------
      if (request.method !== "POST") {
        return NextResponse.json(
          { error: "Method Not Allowed" },
          { status: 405, headers: { Allow: "POST" } }
        );
      }

      // ---- Layer 2: per-client rate limiting ------------------------------
      const rate = checkRateLimit(getClientKey(request), RATE_LIMIT);
      if (!rate.allowed) {
        return NextResponse.json(
          { error: "Too many AI requests. Please wait a moment and try again." },
          {
            status: 429,
            headers: {
              "Retry-After": String(rate.retryAfterSec),
              "X-RateLimit-Limit": String(RATE_LIMIT.limit),
              "X-RateLimit-Remaining": "0",
            },
          }
        );
      }

      const rawBody = await request.text();
      if (rawBody.length > MAX_BODY_BYTES) {
        return NextResponse.json({ error: "Payload Too Large" }, { status: 413 });
      }

      let jsonBody: unknown;
      try {
        jsonBody = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      // ---- Layer 3: strict schema validation ------------------------------
      const parsedRequest = themesRequestSchema.safeParse(jsonBody);
      if (!parsedRequest.success) {
        return NextResponse.json(
          { error: "Validation failed", fields: formatZodErrors(parsedRequest.error) },
          { status: 400 }
        );
      }

      // ---- Layer 4: sanitize free text bound for the prompt ---------------
      const event: EventBrief = parsedRequest.data.event ?? {};
      const customPrompt = sanitizeText(parsedRequest.data.customPrompt ?? "", {
        maxLength: 2000,
      });

      // Call the GenAI engine through the injected seam.
      // Retry once on transient formatting/parse hiccups before surfacing an error.
      const userPrompt = buildUserPrompt(event, customPrompt);
      let lastParseError: unknown = null;

      for (let attempt = 0; attempt < MAX_LLM_ATTEMPTS; attempt++) {
        const completion = await runEngine([
          { role: "assistant", content: SYSTEM_PROMPT },
          {
            role: "user",
            content:
              attempt === 0
                ? userPrompt
                : `${userPrompt}\n\nIMPORTANT: Your previous reply could not be parsed. Return ONLY a raw JSON object — first character "{", last character "}". No prose, no fences.`,
          },
        ]);

        const content = completion?.content;
        if (!content || !content.trim()) {
          lastParseError = new Error("The AI engine returned an empty response.");
          continue;
        }

        try {
          // ---- Layer 5: parse + normalize before it reaches the client -----
          const parsed = extractAndParseJSON(content);
          const payload = normalizeThemePayload(parsed);
          if (!payload) {
            lastParseError = new Error("AI response did not include any theme concepts.");
            continue;
          }
          return NextResponse.json({
            success: true,
            summary: payload.summary,
            themes: payload.themes,
            model: completion.model ?? "GLM",
          });
        } catch (parseErr) {
          lastParseError = parseErr;
        }
      }

      throw lastParseError instanceof Error
        ? lastParseError
        : new Error("The AI engine could not produce valid theme JSON. Please retry.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected AI generation error";
      console.error("[api/ai/themes] Generation failed:", message);
      // Never leak stack traces or provider internals to the client.
      return NextResponse.json(
        { error: `Live AI generation failed: ${message}` },
        { status: 500 }
      );
    }
  };
}

/** Production handler wired to the z-ai-web-dev-sdk engine. */
export const POST = createThemesPostHandler(runChatCompletion);
