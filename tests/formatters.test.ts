/**
 * Display formatter tests — consistency contract for dates, currency, and
 * truncation across every UI surface.
 */
import { describe, expect, test } from "bun:test";
import {
  formatEventDate,
  formatShortDate,
  formatCurrency,
  truncateText,
} from "../src/utils/formatters.js";

describe("formatEventDate", () => {
  test("formats a friendly long date", () => {
    // Deterministic: month names are locale-stable in the en-US calendar
    const out = formatEventDate("2026-11-20");
    expect(out).toContain("Nov 20");
    expect(out).toContain("2026");
    expect(out).toMatch(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),/);
  });

  test("falls back on missing or malformed dates", () => {
    expect(formatEventDate("")).toBe("No date set");
    expect(formatEventDate(undefined)).toBe("No date set");
    expect(formatEventDate("20-11-2026")).toBe("No date set");
    expect(formatEventDate("garbage")).toBe("No date set");
  });

  test("supports long weekday option", () => {
    const out = formatEventDate("2026-11-20", { weekday: "long" });
    expect(out).toMatch(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),/);
  });
});

describe("formatShortDate", () => {
  test("formats compact chip dates", () => {
    expect(formatShortDate("2026-11-20")).toBe("Nov 20, 2026");
  });

  test("falls back on bad input", () => {
    expect(formatShortDate("")).toBe("—");
    expect(formatShortDate("nope")).toBe("—");
    expect(formatShortDate(undefined)).toBe("—");
  });
});

describe("formatCurrency", () => {
  test("formats positive amounts with separators", () => {
    expect(formatCurrency(32000)).toBe("$32,000");
    expect(formatCurrency(1250)).toBe("$1,250");
    expect(formatCurrency(0)).toBe("$0");
  });

  test("rounds fractional values and rejects non-numbers", () => {
    expect(formatCurrency(149.6)).toBe("$150");
    expect(formatCurrency("junk")).toBe("$0");
    expect(formatCurrency(NaN)).toBe("$0");
  });
});

describe("truncateText", () => {
  test("passes through short text untouched", () => {
    expect(truncateText("Short title", 20)).toBe("Short title");
    expect(truncateText("", 20)).toBe("");
  });

  test("truncates long text with an ellipsis", () => {
    const out = truncateText("A Very Long Celebration Title Indeed", 15);
    expect(out.length).toBeLessThanOrEqual(16); // 15 chars + ellipsis
    expect(out.endsWith("…")).toBe(true);
  });

  test("prefers word boundaries when reasonable", () => {
    const out = truncateText("Sophia and Liam Sunset Vineyard Wedding", 18);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/ \S$/); // no orphan half-word before ellipsis
  });
});
