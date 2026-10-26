/**
 * Sanitization utility tests — the gate every untrusted string passes through.
 */
import { describe, expect, test } from "bun:test";
import {
  sanitizeText,
  sanitizeNumber,
  isSafeDateString,
  stripControlChars,
} from "../../src/lib/security/sanitize";

describe("sanitizeText", () => {
  test("returns empty string for non-string input", () => {
    expect(sanitizeText(undefined, { maxLength: 10 })).toBe("");
    expect(sanitizeText(123, { maxLength: 10 })).toBe("");
    expect(sanitizeText(null, { maxLength: 10 })).toBe("");
    expect(sanitizeText({ evil: true }, { maxLength: 10 })).toBe("");
  });

  test("trims and collapses whitespace", () => {
    expect(sanitizeText("  hello    world  ", { maxLength: 50 })).toBe("hello world");
  });

  test("strips control characters and zero-width smuggle chars", () => {
    const dirty = "vis\u0000ible\u200Btext\u202Ertl";
    expect(sanitizeText(dirty, { maxLength: 50 })).toBe("visibletext" + "rtl");
  });

  test("caps length after normalization", () => {
    expect(sanitizeText("abcdefghij", { maxLength: 5 })).toBe("abcde");
  });

  test("preserves newlines when collapseWhitespace is false", () => {
    expect(sanitizeText("a\r\nb", { maxLength: 10, collapseWhitespace: false })).toBe("a\r\nb");
  });
});

describe("sanitizeNumber", () => {
  test("coerces numeric strings", () => {
    expect(sanitizeNumber("42", { max: 100 })).toBe(42);
  });

  test("returns 0 for non-finite or non-numeric input", () => {
    expect(sanitizeNumber(NaN, { max: 100 })).toBe(0);
    expect(sanitizeNumber("abc", { max: 100 })).toBe(0);
    expect(sanitizeNumber(Infinity, { max: 100 })).toBe(0);
  });

  test("clamps to the min/max range", () => {
    expect(sanitizeNumber(-10, { max: 100 })).toBe(0);
    expect(sanitizeNumber(5000, { max: 100 })).toBe(100);
    expect(sanitizeNumber(50, { max: 100 })).toBe(50);
  });
});

describe("isSafeDateString", () => {
  test("accepts well-formed dates", () => {
    expect(isSafeDateString("2026-10-26")).toBe(true);
    expect(isSafeDateString("1999-01-01")).toBe(true);
  });

  test("rejects malformed or injection attempts", () => {
    expect(isSafeDateString("26-10-2026")).toBe(false);
    expect(isSafeDateString("2026/10/26")).toBe(false);
    expect(isSafeDateString("2026-10-26'; DROP TABLE")).toBe(false);
    expect(isSafeDateString(20261026)).toBe(false);
    expect(isSafeDateString(null)).toBe(false);
  });
});

describe("stripControlChars", () => {
  test("leaves clean text untouched", () => {
    expect(stripControlChars("clean text 123!")).toBe("clean text 123!");
  });
});
