/**
 * Theme normalizer tests — verifies the API can NEVER emit malformed or
 * hostile theme payloads to the client, no matter what the LLM returns.
 */
import { describe, expect, test } from "bun:test";
import { normalizeTheme, normalizeThemePayload, FALLBACK_PALETTE } from "../../src/lib/ai/themeNormalizer";

describe("normalizeTheme", () => {
  test("keeps a fully valid theme intact", () => {
    const raw = {
      id: "garden-lights",
      name: "Garden Lights",
      tagline: "Twilight magic",
      palette: ["#0f766e", "#f59e0b", "#ffffff", "#1e293b"],
      paletteNames: ["Teal", "Amber", "Ivory", "Slate"],
      decorHighlights: ["Fairy strings", "Lanterns"],
      recommendedMusic: "Acoustic folk",
      cateringIdeas: "Grazing tables",
      budgetTip: "DIY florals",
    };
    const t = normalizeTheme(raw, 0);
    expect(t.id).toBe("garden-lights");
    expect(t.name).toBe("Garden Lights");
    expect(t.palette).toEqual(["#0f766e", "#f59e0b", "#ffffff", "#1e293b"]);
    expect(t.decorHighlights).toEqual(["Fairy strings", "Lanterns"]);
  });

  test("fills fallbacks for a garbage object", () => {
    const t = normalizeTheme("nonsense", 2);
    expect(t.id).toContain("ai-theme-");
    expect(t.name).toBe("Theme Concept 3");
    expect(t.palette).toEqual(FALLBACK_PALETTE);
    expect(t.decorHighlights.length).toBeGreaterThan(0);
  });

  test("rejects invalid hex colors, keeps valid ones, and pads the palette to 4", () => {
    const t = normalizeTheme(
      { palette: ["red", "not-hex", "#abc", "javascript:alert(1)", "#aabbcc"] },
      0
    );
    // Valid color preserved, then padded with brand fallbacks to a full 4.
    expect(t.palette[0]).toBe("#aabbcc");
    expect(t.palette).toHaveLength(4);
    expect(FALLBACK_PALETTE).toContain(t.palette[1]);
  });

  test("caps lists at 4 palette names and 6 decor highlights", () => {
    const t = normalizeTheme(
      {
        paletteNames: Array.from({ length: 9 }, (_, i) => `C${i}`),
        decorHighlights: Array.from({ length: 12 }, (_, i) => `H${i}`),
      },
      0
    );
    expect(t.paletteNames.length).toBeLessThanOrEqual(4);
    expect(t.decorHighlights.length).toBeLessThanOrEqual(6);
  });

  test("strips control characters and caps field lengths", () => {
    const evil = "x".repeat(500) + "\u0000\u200B\u202Ehidden";
    const t = normalizeTheme({ name: evil, tagline: evil }, 0);
    expect(t.name.length).toBeLessThanOrEqual(80);
    expect(t.tagline.length).toBeLessThanOrEqual(220);
    expect(t.name).not.toContain("\u0000");
    expect(t.tagline).not.toContain("\u202E");
  });

  test("drops empty-string list items and falls back when all empty", () => {
    const t = normalizeTheme({ decorHighlights: ["", "   ", "\t"] }, 0);
    expect(t.decorHighlights).toEqual(["Custom tailored celebration decor styling"]);
  });
});

describe("normalizeThemePayload", () => {
  test("returns null when themes array is missing or empty", () => {
    expect(normalizeThemePayload({})).toBeNull();
    expect(normalizeThemePayload({ themes: [] })).toBeNull();
    expect(normalizeThemePayload({ themes: "nope" })).toBeNull();
  });

  test("normalizes up to 3 themes and derives a summary", () => {
    const payload = normalizeThemePayload({
      themes: [{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }],
    });
    expect(payload).not.toBeNull();
    expect(payload!.themes).toHaveLength(3);
    expect(payload!.summary.length).toBeGreaterThan(0);
  });

  test("sanitizes a hostile summary string", () => {
    const payload = normalizeThemePayload({
      summary: "Great  ideas!",
      themes: [{ name: "A" }],
    });
    expect(payload!.summary).toBe("Great ideas!");
  });
});
