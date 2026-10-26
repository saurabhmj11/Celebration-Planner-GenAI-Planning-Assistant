import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

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
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BODY_BYTES = 50 * 1024; // 50KB payload cap

interface EventBrief {
  title?: string;
  type?: string;
  date?: string;
  time?: string;
  location?: string;
  guestCount?: number;
  budget?: number;
  description?: string;
}

interface ThemeConcept {
  id?: string;
  name?: string;
  tagline?: string;
  palette?: unknown;
  paletteNames?: unknown;
  decorHighlights?: unknown;
  recommendedMusic?: string;
  cateringIdeas?: string;
  budgetTip?: string;
}

const SYSTEM_PROMPT = `You are an elite celebration and luxury event designer with deep expertise in weddings, milestone birthdays, anniversaries, community festivals, charity galas, and baby showers.
You always respond with STRICTLY VALID JSON — no markdown fences, no commentary, no text outside the JSON object.
Your design ideas are creative, cohesive, actionable, and budget-aware.`;
function buildUserPrompt(event: EventBrief, customPrompt: string): string {
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

/** Extract the first balanced JSON object from text (respects strings/escapes). */
function extractBalancedJson(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (ch === "\\") {
      esc = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** Robustly extract a JSON object from an LLM response that may contain fences or prose. */
function extractAndParseJSON(rawText: string): Record<string, unknown> {
  if (!rawText || typeof rawText !== "string") {
    throw new Error("Empty response content received from the AI engine.");
  }

  let text = rawText.trim();
  // Strip markdown code fences if present (e.g. ```json ... ```)
  if (text.startsWith("```")) {
    text = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
  }

  // 1. Direct parse attempt
  try {
    const direct = JSON.parse(text);
    if (direct && typeof direct === "object") return direct;
  } catch {
    // fall through
  }

  // 2. Balanced-brace extraction (handles trailing prose or stray characters)
  const balanced = extractBalancedJson(text);
  if (balanced) {
    try {
      const extracted = JSON.parse(balanced);
      if (extracted && typeof extracted === "object") return extracted;
    } catch {
      // fall through
    }
  }

  // 3. Greedy regex as a last resort
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const extracted = JSON.parse(match[0]);
      if (extracted && typeof extracted === "object") return extracted;
    } catch {
      // fall through
    }
  }

  throw new Error("AI response did not contain a valid themes JSON structure.");
}

const FALLBACK_PALETTE = ["#8b5cf6", "#ec4899", "#f59e0b", "#06b6d4"];

function normalizeTheme(t: ThemeConcept, idx: number): ThemeConcept & { id: string; name: string } {
  const theme = t && typeof t === "object" ? t : {};
  const palette = Array.isArray(theme.palette) && theme.palette.length > 0
    ? (theme.palette as string[]).slice(0, 4)
    : FALLBACK_PALETTE;
  return {
    id: typeof theme.id === "string" && theme.id ? theme.id : `ai-theme-${Date.now()}-${idx}`,
    name: typeof theme.name === "string" && theme.name ? theme.name : `Theme Concept #${idx + 1}`,
    tagline: typeof theme.tagline === "string" && theme.tagline ? theme.tagline : "Custom celebration concept crafted by AI",
    palette,
    paletteNames:
      Array.isArray(theme.paletteNames) && theme.paletteNames.length > 0
        ? (theme.paletteNames as string[]).slice(0, 4)
        : ["Primary", "Accent", "Warm Glow", "Highlight"],
    decorHighlights:
      Array.isArray(theme.decorHighlights) && theme.decorHighlights.length > 0
        ? (theme.decorHighlights as string[]).slice(0, 6)
        : ["Custom tailored celebration decor styling"],
    recommendedMusic: typeof theme.recommendedMusic === "string" ? theme.recommendedMusic : "Curated celebration playlist",
    cateringIdeas: typeof theme.cateringIdeas === "string" ? theme.cateringIdeas : "Tailored catering and signature drink pairings",
    budgetTip: typeof theme.budgetTip === "string" ? theme.budgetTip : "Prioritize 35-40% of budget on core venue & ambiance.",
  };
}

export async function POST(request: Request) {
  try {
    // Method + payload-size safeguards
    if (request.method !== "POST") {
      return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
    }
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload Too Large" }, { status: 413 });
    }

    let parsedBody: { event?: EventBrief; customPrompt?: unknown };
    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const event: EventBrief =
      parsedBody.event && typeof parsedBody.event === "object" ? parsedBody.event : {};
    const customPrompt =
      typeof parsedBody.customPrompt === "string" ? parsedBody.customPrompt.slice(0, 2000) : "";

    // Call the GenAI engine (z-ai-web-dev-sdk — server side only).
    // Retry once on transient formatting/parse hiccups before surfacing an error.
    const zai = await ZAI.create();
    const userPrompt = buildUserPrompt(event, customPrompt);

    let content: string | undefined;
    let completion: { choices?: Array<{ message?: { content?: string } }>; model?: string } | null = null;
    let lastParseError: unknown = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      completion = await zai.chat.completions.create({
        messages: [
          { role: "assistant", content: SYSTEM_PROMPT },
          {
            role: "user",
            content:
              attempt === 0
                ? userPrompt
                : `${userPrompt}\n\nIMPORTANT: Your previous reply could not be parsed. Return ONLY a raw JSON object — first character "{", last character "}". No prose, no fences.`,
          },
        ],
        thinking: { type: "disabled" },
      });

      content = completion?.choices?.[0]?.message?.content;
      if (!content || !content.trim()) {
        lastParseError = new Error("The AI engine returned an empty response.");
        continue;
      }

      try {
        const attemptParsed = extractAndParseJSON(content);
        const attemptThemes = Array.isArray(attemptParsed.themes)
          ? (attemptParsed.themes as ThemeConcept[])
          : [];
        if (attemptThemes.length > 0) {
          const themes = attemptThemes.slice(0, 3).map((t, idx) => normalizeTheme(t, idx));
          const summary =
            typeof attemptParsed.summary === "string" && attemptParsed.summary
              ? attemptParsed.summary
              : `Personalized AI recommendations tailored for your ${event.type || "celebration"}.`;
          return NextResponse.json({
            success: true,
            summary,
            themes,
            model: typeof completion.model === "string" ? completion.model : "GLM",
          });
        }
        lastParseError = new Error("AI response did not include any theme concepts.");
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
    return NextResponse.json(
      { error: `Live AI generation failed: ${message}` },
      { status: 500 }
    );
  }
}
