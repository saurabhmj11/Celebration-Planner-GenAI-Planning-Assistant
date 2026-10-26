/**
 * Server-side input sanitization utilities.
 *
 * Every string that flows from an untrusted request body into an LLM prompt or
 * a database passes through these helpers. The goal is defence-in-depth:
 * 1. Remove control characters that could smuggle invisible prompt injections.
 * 2. Normalize unicode + collapse whitespace so prompts stay predictable.
 * 3. Hard-cap lengths so the endpoint can never be coerced into huge payloads.
 */

/** Strip C0/C1 control chars (except tab/newline/CR) + zero-width/bidi chars. */
export function stripControlChars(input: string): string {
   
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "");
}

export interface SanitizeTextOptions {
  /** Max length after normalization. Excess is truncated (never throws). */
  maxLength: number;
  /** Collapse internal runs of whitespace to single spaces. Default true. */
  collapseWhitespace?: boolean;
}

/**
 * Sanitize a free-text value bound for an LLM prompt or persistence layer.
 * Returns a trimmed, control-char-free, length-capped string ("" if invalid).
 */
export function sanitizeText(value: unknown, { maxLength, collapseWhitespace = true }: SanitizeTextOptions): string {
  if (typeof value !== "string") return "";
  let out = stripControlChars(value);
  if (collapseWhitespace) out = out.replace(/\s+/g, " ");
  out = out.trim();
  return out.slice(0, maxLength);
}

/**
 * Coerce an unknown numeric-ish value into a safe bounded number.
 * Negative and non-finite values collapse to 0.
 */
export function sanitizeNumber(value: unknown, { min = 0, max }: { min?: number; max: number }): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  const clampedBottom = Math.max(min, n);
  return Math.min(max, clampedBottom);
}

/** True when the string is a well-formed YYYY-MM-DD calendar date. */
export function isSafeDateString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}
