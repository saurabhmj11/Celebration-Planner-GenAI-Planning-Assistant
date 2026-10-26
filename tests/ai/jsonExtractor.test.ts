/**
 * AI JSON extractor tests — the parser is the API's first line of defence
 * against malformed LLM output, so every extraction strategy is covered.
 */
import { describe, expect, test } from "bun:test";
import { extractAndParseJSON, extractBalancedJson } from "../../src/lib/ai/jsonExtractor";

describe("extractBalancedJson", () => {
  test("extracts a nested object with braces inside strings", () => {
    const text = 'prefix {"a":"has } brace","b":{"c":1}} suffix';
    const out = extractBalancedJson(text);
    expect(out).toBe('{"a":"has } brace","b":{"c":1}}');
  });

  test("handles escaped quotes inside strings", () => {
    const text = '{"a":"escaped \\" quote","b":2}';
    expect(extractBalancedJson(text)).toBe(text);
  });

  test("returns null when no object exists or braces never close", () => {
    expect(extractBalancedJson("no json here")).toBeNull();
    expect(extractBalancedJson('{"a": "unclosed')).toBeNull();
  });
});

describe("extractAndParseJSON", () => {
  test("parses clean JSON directly", () => {
    const result = extractAndParseJSON('{"themes":[{"name":"Rustic"}]}');
    expect(Array.isArray(result.themes)).toBe(true);
  });

  test("strips ```json fences", () => {
    const fenced = '```json\n{"summary":"hi","themes":[]}\n```';
    const result = extractAndParseJSON(fenced);
    expect(result.summary).toBe("hi");
  });

  test("strips bare ``` fences", () => {
    const result = extractAndParseJSON('```\n{"ok":true}\n```');
    expect(result.ok).toBe(true);
  });

  test("ignores leading prose and trailing commentary", () => {
    const noisy = 'Sure! Here are ideas: {"themes":[]} Hope this helps!';
    const result = extractAndParseJSON(noisy);
    expect(result.themes).toEqual([]);
  });

  test("handles multiline pretty-printed JSON", () => {
    const pretty = `{\n  "summary": "line one",\n  "themes": [\n    { "name": "A" }\n  ]\n}`;
    const result = extractAndParseJSON(pretty);
    expect(result.summary).toBe("line one");
    expect(Array.isArray(result.themes)).toBe(true);
  });

  test("handles JSON strings containing escaped quotes and nested braces", () => {
    const tricky = '{"note":"she said \\"yes\\" {quickly}","themes":[]}';
    const result = extractAndParseJSON(tricky);
    expect(result.note).toBe('she said "yes" {quickly}');
    expect(result.themes).toEqual([]);
  });

  test("throws descriptive errors for empty or invalid payloads", () => {
    // @ts-expect-error — deliberately testing invalid runtime input
    expect(() => extractAndParseJSON(undefined)).toThrow(/Empty response/);
    // @ts-expect-error — deliberately testing invalid runtime input
    expect(() => extractAndParseJSON("")).toThrow(/Empty response/);
    expect(() => extractAndParseJSON("just words, no braces")).toThrow(
      /did not contain a valid themes JSON/
    );
  });
});
