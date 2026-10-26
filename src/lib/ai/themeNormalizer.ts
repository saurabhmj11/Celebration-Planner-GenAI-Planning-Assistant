/**
 * Theme concept normalization.
 *
 * LLM output is untrusted: fields can be missing, mistyped, over-long, or
 * carry hostile strings. This module coercively maps any parsed payload onto a
 * strictly-typed `NormalizedTheme` so the UI can never receive malformed data.
 * Every string is sanitized (control chars stripped) and length-capped.
 */

import { sanitizeText } from "@/lib/security/sanitize";

/** Max length for any user-facing AI string (keeps cards tidy + safe). */
const MAX_FIELD_LEN = 220;
const MAX_LIST_ITEMS = 6;

export interface NormalizedTheme {
  id: string;
  name: string;
  tagline: string;
  palette: string[];
  paletteNames: string[];
  decorHighlights: string[];
  recommendedMusic: string;
  cateringIdeas: string;
  budgetTip: string;
}

/** Palette used when the model omits or malforms its colors. */
export const FALLBACK_PALETTE = ["#8b5cf6", "#ec4899", "#f59e0b", "#06b6d4"];

interface RawTheme {
  id?: unknown;
  name?: unknown;
  tagline?: unknown;
  palette?: unknown;
  paletteNames?: unknown;
  decorHighlights?: unknown;
  recommendedMusic?: unknown;
  cateringIdeas?: unknown;
  budgetTip?: unknown;
}

/** Coerce a single hex color to a safe `#rrggbb`, or null when invalid. */
function safeHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  const hex = v.startsWith("#") ? v : `#${v}`;
  return /^#[0-9a-f]{6}$/.test(hex) ? hex : null;
}

function safeStringList(value: unknown, fallback: string[], limit = MAX_LIST_ITEMS): string[] {
  if (!Array.isArray(value) || value.length === 0) return fallback;
  const items = value
    .map((item) => sanitizeText(item, { maxLength: MAX_FIELD_LEN }))
    .filter((item) => item.length > 0);
  return items.length > 0 ? items.slice(0, limit) : fallback;
}

/** Normalize one raw theme object into the strict NormalizedTheme shape. */
export function normalizeTheme(raw: unknown, idx: number): NormalizedTheme {
  const theme: RawTheme = raw && typeof raw === "object" ? (raw as RawTheme) : {};

  const rawPalette = Array.isArray(theme.palette) ? theme.palette : [];
  const palette = rawPalette
    .map(safeHexColor)
    .filter((c): c is string => c !== null)
    .slice(0, 4);
  // Keep every valid model color; pad with brand fallbacks up to 4 entries
  // so the palette swatch UI always renders a complete row.
  const finalPalette = palette.length > 0
    ? [...palette, ...FALLBACK_PALETTE].slice(0, 4)
    : FALLBACK_PALETTE;

  const fallbackNames = finalPalette.map((_, i) => `Accent ${i + 1}`);

  return {
    id: sanitizeText(theme.id, { maxLength: 64 }) || `ai-theme-${Date.now()}-${idx}`,
    name: sanitizeText(theme.name, { maxLength: 80 }) || `Theme Concept ${idx + 1}`,
    tagline:
      sanitizeText(theme.tagline, { maxLength: MAX_FIELD_LEN }) ||
      "Custom celebration concept crafted by AI",
    palette: finalPalette,
    paletteNames: safeStringList(theme.paletteNames, fallbackNames, 4),
    decorHighlights: safeStringList(theme.decorHighlights, [
      "Custom tailored celebration decor styling",
    ]),
    recommendedMusic:
      sanitizeText(theme.recommendedMusic, { maxLength: MAX_FIELD_LEN }) ||
      "Curated celebration playlist",
    cateringIdeas:
      sanitizeText(theme.cateringIdeas, { maxLength: MAX_FIELD_LEN }) ||
      "Tailored catering and signature drink pairings",
    budgetTip:
      sanitizeText(theme.budgetTip, { maxLength: MAX_FIELD_LEN }) ||
      "Prioritize 35-40% of budget on core venue & ambiance.",
  };
}

/** Normalize the full `{ summary, themes }` payload. Returns null when unusable. */
export function normalizeThemePayload(parsed: Record<string, unknown>): {
  summary: string;
  themes: NormalizedTheme[];
} | null {
  const rawThemes = parsed.themes;
  if (!Array.isArray(rawThemes) || rawThemes.length === 0) return null;

  const themes = rawThemes.slice(0, 3).map((t, idx) => normalizeTheme(t, idx));
  const summary =
    sanitizeText(parsed.summary, { maxLength: 300 }) ||
    `Personalized AI recommendations tailored for your celebration.`;

  return { summary, themes };
}
