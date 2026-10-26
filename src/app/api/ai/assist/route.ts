import { NextResponse } from "next/server";

import { extractAndParseJSON } from "@/lib/ai/jsonExtractor";
import { runChatCompletion, type RunEngine } from "@/lib/ai/engine";
import {
  ASSIST_TASK_REGISTRY,
  ASSIST_SYSTEM_PROMPT,
  withTimelineCeiling,
  withVenueCandidateIds,
} from "@/lib/ai/assist/tasks";
import { checkRateLimit, getClientKey } from "@/lib/security/rateLimit";
import {
  assistRequestSchema,
  ASSIST_MAX_BODY_BYTES,
} from "@/lib/validation/assistSchemas";
import { formatZodErrors } from "@/lib/validation/schemas";

/**
 * Unified GenAI assist backend.
 *
 * POST /api/ai/assist
 * Body: { task: 'budget-plan' | 'timeline-plan' | 'vendor-plan' |
 *              'vendor-inquiry' | 'venue-recommend' | 'plan-review' |
 *              'assistant-chat',
 *         payload: {...} }
 *
 * One hardened pipeline serves every AI capability in the app:
 *   1. Method allowlist + payload-size cap (413).
 *   2. Per-client rate limiting (429 + Retry-After) — 12/min.
 *   3. Strict Zod discriminated-union validation (400 with field errors).
 *   4. Prompt assembly through per-task builders (all strings sanitized).
 *   5. Response parse + normalize (clamped ints, safe dates, capped strings).
 *
 * Architecture: handler produced by a factory so tests can inject a
 * deterministic engine and cover the pipeline without live model calls.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const RATE_LIMIT = { key: "ai:assist", limit: 12, windowMs: 60_000 };
const MAX_LLM_ATTEMPTS = 2;

export function createAssistPostHandler(runEngine: RunEngine) {
  return async function POST(request: Request): Promise<Response> {
    try {
      // ---- Layer 1: method + size -----------------------------------------
      if (request.method !== "POST") {
        return NextResponse.json(
          { error: "Method Not Allowed" },
          { status: 405, headers: { Allow: "POST" } }
        );
      }

      // ---- Layer 2: rate limit ---------------------------------------------
      const rate = checkRateLimit(getClientKey(request), RATE_LIMIT);
      if (!rate.allowed) {
        return NextResponse.json(
          { error: "Too many AI requests. Please wait a moment and try again." },
          {
            status: 429,
            headers: {
              "Retry-After": String(rate.retryAfterSec),
              "X-RateLimit-Limit": String(RATE_LIMIT.limit),
            },
          }
        );
      }

      const rawBody = await request.text();
      if (rawBody.length > ASSIST_MAX_BODY_BYTES) {
        return NextResponse.json({ error: "Payload Too Large" }, { status: 413 });
      }

      let jsonBody: unknown;
      try {
        jsonBody = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      // ---- Layer 3: strict schema validation -------------------------------
      const parsedRequest = assistRequestSchema.safeParse(jsonBody);
      if (!parsedRequest.success) {
        return NextResponse.json(
          { error: "Validation failed", fields: formatZodErrors(parsedRequest.error) },
          { status: 400 }
        );
      }

      const { task, payload } = parsedRequest.data;
      const registry = ASSIST_TASK_REGISTRY[task];

      // ---- Layer 4: prompt assembly (sanitizing) ---------------------------
      const basePrompt = registry.buildUserPrompt(payload);
      const systemPrompt = `${ASSIST_SYSTEM_PROMPT}\nCurrent capability: ${registry.systemHint}.`;

      let lastParseError: unknown = null;

      for (let attempt = 0; attempt < MAX_LLM_ATTEMPTS; attempt++) {
        const completion = await runEngine([
          { role: "assistant", content: systemPrompt },
          {
            role: "user",
            content:
              attempt === 0
                ? basePrompt
                : `${basePrompt}\n\nIMPORTANT: Your previous reply could not be parsed. Return ONLY a raw JSON object — first character "{", last character "}". No prose, no fences.`,
          },
        ]);

        const content = completion?.content;
        if (!content || !content.trim()) {
          lastParseError = new Error("The AI engine returned an empty response.");
          continue;
        }

        try {
          // ---- Layer 5: parse + normalize ----------------------------------
          let parsedJson = extractAndParseJSON(content);
          if (task === "timeline-plan") {
            parsedJson = withTimelineCeiling(parsedJson, payload.eventDate);
          }
          if (task === "venue-recommend") {
            parsedJson = withVenueCandidateIds(
              parsedJson,
              payload.candidates.map((c) => c.id)
            );
          }
          const data = registry.normalize(parsedJson);
          if (!data) {
            lastParseError = new Error(
              "AI response did not include usable content for this task."
            );
            continue;
          }
          return NextResponse.json({
            success: true,
            task,
            data,
            model: completion.model ?? "GLM",
          });
        } catch (parseErr) {
          lastParseError = parseErr;
        }
      }

      throw lastParseError instanceof Error
        ? lastParseError
        : new Error("The AI engine could not produce valid JSON. Please retry.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected AI generation error";
      console.error(`[api/ai/assist] ${message}`);
      // Never leak stack traces or provider internals to the client.
      return NextResponse.json(
        { error: `Live AI generation failed: ${message}` },
        { status: 500 }
      );
    }
  };
}

/** Production handler wired to the z-ai-web-dev-sdk engine. */
export const POST = createAssistPostHandler(runChatCompletion);
