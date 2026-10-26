/**
 * GenAI service error-categorization tests.
 * Verifies every failure mode maps to an accurate, user-friendly diagnostic
 * so the UI can guide users instead of showing raw errors.
 */
import { describe, expect, test } from "bun:test";
import {
  geminiService,
  categorizeGeminiError,
  GEMINI_MODEL,
  BUILTIN_AI_ENDPOINT,
} from "../src/services/geminiService.js";

describe("service constants", () => {
  test("exposes a live Gemini model identifier", () => {
    expect(GEMINI_MODEL).toMatch(/^gemini-/);
  });

  test("built-in engine endpoint points at the app's server route", () => {
    expect(BUILTIN_AI_ENDPOINT).toBe("/api/ai/themes");
  });
});

describe("categorizeGeminiError", () => {
  test("maps HTTP 503 as TEMPORARY_HIGH_DEMAND with retry guidance", () => {
    const err = new Error("Service Unavailable");
    (err as Error & { status?: number }).status = 503;
    const res = categorizeGeminiError(err);
    expect(res.type).toBe("TEMPORARY_HIGH_DEMAND");
    expect(res.status).toBe(503);
    expect(res.guidance).toMatch(/15–30 seconds/);
  });

  test("maps high-demand message text even without a status", () => {
    const err = new Error("This model is currently experiencing high demand. Spikes in demand are usually temporary.");
    const res = categorizeGeminiError(err);
    expect(res.type).toBe("TEMPORARY_HIGH_DEMAND");
  });

  test("maps HTTP 429 as QUOTA_EXCEEDED", () => {
    const err = new Error("Resource exhausted: quota exceeded");
    (err as Error & { status?: number }).status = 429;
    const res = categorizeGeminiError(err);
    expect(res.type).toBe("QUOTA_EXCEEDED");
    expect(res.status).toBe(429);
    expect(res.guidance.length).toBeGreaterThan(10);
  });

  test("maps timeouts with a human-readable duration", () => {
    const err = new Error("The operation timed out");
    (err as Error & { isTimeout?: boolean }).isTimeout = true;
    const res = categorizeGeminiError(err);
    expect(res.type).toBe("TIMEOUT");
    expect(res.userMessage).toMatch(/timed out after \d+ seconds/i);
  });

  test("maps AbortError as ABORTED (user cancelled)", () => {
    const err = new Error("The user aborted a request.");
    err.name = "AbortError";
    const res = categorizeGeminiError(err);
    expect(res.type).toBe("ABORTED");
  });

  test("maps network failures", () => {
    expect(categorizeGeminiError(new Error("Failed to fetch")).type).toBe("NETWORK_ERROR");
  });

  test("maps HTTP 401/403 as INVALID_KEY with fix guidance", () => {
    const err = new Error("Unauthorized");
    (err as Error & { status?: number }).status = 401;
    const res = categorizeGeminiError(err);
    expect(res.type).toBe("INVALID_KEY");
    expect(res.guidance).toMatch(/AI Settings/i);
  });

  test("maps HTTP 404 as MODEL_NOT_FOUND naming the model", () => {
    const err = new Error("Not Found");
    (err as Error & { status?: number }).status = 404;
    const res = categorizeGeminiError(err);
    expect(res.type).toBe("MODEL_NOT_FOUND");
    expect(res.userMessage).toContain(GEMINI_MODEL);
  });

  test("maps 5xx as SERVER_ERROR and unknown shapes as UNKNOWN", () => {
    const err500 = new Error("Internal");
    (err500 as Error & { status?: number }).status = 502;
    expect(categorizeGeminiError(err500).type).toBe("SERVER_ERROR");
    expect(categorizeGeminiError(new Error("mystery")).type).toBe("UNKNOWN");
  });

  test("never throws on malformed error input", () => {
    expect(() => categorizeGeminiError(null)).not.toThrow();
    expect(() => categorizeGeminiError("string")).not.toThrow();
    expect(categorizeGeminiError(undefined).type).toBe("UNKNOWN");
  });
});

describe("geminiService.generateFallbackThemes (offline engine)", () => {
  const baseEvent = {
    id: "e1",
    type: "wedding",
    title: "Sophia & Liam",
    budget: 20000,
    guestCount: 120,
  };

  test("returns at least 3 curated themes without network access", () => {
    const result = geminiService.generateFallbackThemes(baseEvent, "");
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  test("adapts fallback themes to the event context", () => {
    const themes = geminiService.generateFallbackThemes(baseEvent, "rustic vineyard");
    for (const t of themes) {
      expect(Array.isArray(t.palette)).toBe(true);
      expect(t.palette.length).toBeGreaterThan(0);
      expect(t.name.length).toBeGreaterThan(0);
      expect(Array.isArray(t.decorHighlights)).toBe(true);
    }
  });

  test("handles empty events gracefully", () => {
    const themes = geminiService.generateFallbackThemes(null, "");
    expect(themes.length).toBeGreaterThanOrEqual(3);
  });
});
