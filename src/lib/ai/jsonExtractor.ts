/**
 * Robust JSON extraction from LLM responses.
 *
 * LLMs occasionally wrap JSON in markdown fences, prepend prose, or append
 * commentary. These pure helpers try three progressively more tolerant
 * strategies so a valid payload is never lost to cosmetic formatting:
 *   1. Direct `JSON.parse` after fence stripping.
 *   2. Balanced-brace scan (respects strings/escapes — immune to nested braces).
 *   3. Greedy regex as a final last resort.
 */

/** Extract the first balanced JSON object from text (respects strings/escapes). */
export function extractBalancedJson(text: string): string | null {
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

/**
 * Robustly extract a JSON object from an LLM response that may contain
 * fences or prose. Throws a descriptive Error when nothing parseable exists.
 */
export function extractAndParseJSON(rawText: string): Record<string, unknown> {
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
  } catch (_err) {
    // fall through
  }

  // 2. Balanced-brace extraction (handles trailing prose or stray chars)
  const balanced = extractBalancedJson(text);
  if (balanced) {
    try {
      const extracted = JSON.parse(balanced);
      if (extracted && typeof extracted === "object") return extracted;
    } catch (_err) {
      // fall through
    }
  }

  // 3. Greedy regex as a last resort
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const extracted = JSON.parse(match[0]);
      if (extracted && typeof extracted === "object") return extracted;
    } catch (_err) {
      // fall through
    }
  }

  throw new Error("AI response did not contain a valid themes JSON structure.");
}
