/**
 * API route contract tests for POST /api/ai/themes.
 *
 * Uses the handler factory (`createThemesPostHandler`) with a deterministic
 * fake engine, so the FULL pipeline is covered without live LLM calls:
 * rate limiting -> payload caps -> JSON parsing -> schema validation ->
 * prompt assembly -> engine call -> fence-stripping -> JSON extraction ->
 * theme normalization -> response shaping (including retry + 500 paths).
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createThemesPostHandler } from "../../src/app/api/ai/themes/route";
import type { RunEngine, ChatMessage } from "../../src/lib/ai/engine";
import { resetRateLimits } from "../../src/lib/security/rateLimit";

const ENDPOINT = "http://localhost:3000/api/ai/themes";

const GOOD_PAYLOAD = {
  summary: "Mocked vision",
  themes: [
    {
      id: "t1",
      name: "Mock Theme",
      tagline: "Works great",
      palette: ["#8b5cf6", "#ec4899", "#f59e0b", "#06b6d4"],
      paletteNames: ["A", "B", "C", "D"],
      decorHighlights: ["H1", "H2", "H3", "H4"],
      recommendedMusic: "Jazz",
      cateringIdeas: "Grazing table",
      budgetTip: "Book early",
    },
  ],
};

interface FakeEngineState {
  /** Sequence of responses the fake engine serves per call. */
  responses: Array<{ content?: string; model?: string } | Error>;
  /** Captured conversation for prompt-assembly assertions. */
  calls: ChatMessage[][];
}

function makeFakeEngine(state: FakeEngineState): RunEngine {
  let i = 0;
  return async (messages) => {
    state.calls.push(messages);
    const next = state.responses[Math.min(i++, state.responses.length - 1)];
    if (next instanceof Error) throw next;
    return next;
  };
}

const fenced = (obj: unknown) =>
  "```json\n" + JSON.stringify(obj) + "\n```";

const validBody = {
  event: {
    title: "Ava's 7th Birthday",
    type: "birthday" as const,
    date: "2026-12-05",
    time: "14:00",
    location: "Backyard",
    guestCount: 20,
    budget: 1500,
  },
  customPrompt: "butterfly garden vibes",
};

let state: FakeEngineState;
let POST: ReturnType<typeof createThemesPostHandler>;

beforeEach(() => {
  resetRateLimits();
  state = {
    responses: [{ content: fenced(GOOD_PAYLOAD), model: "mock-glm" }],
    calls: [],
  };
  POST = createThemesPostHandler(makeFakeEngine(state));
});

afterEach(() => {
  resetRateLimits();
});

function makeRequest(body: unknown, init?: RequestInit): Request {
  return new Request(ENDPOINT, {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
}

describe("POST /api/ai/themes — happy path", () => {
  test("returns normalized themes through the full pipeline", async () => {
    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.model).toBe("mock-glm");
    expect(body.summary).toBe("Mocked vision");
    expect(body.themes).toHaveLength(1);
    expect(body.themes[0].name).toBe("Mock Theme");
    expect(body.themes[0].palette).toHaveLength(4);
    expect(body.themes[0].decorHighlights).toEqual(["H1", "H2", "H3", "H4"]);
  });

  test("accepts a minimal request with no event context", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  test("assembles a personalized prompt from sanitized event context", async () => {
    await POST(makeRequest(validBody));
    const [conversation] = state.calls;
    expect(conversation).toHaveLength(2);
    const userMsg = conversation[1].content;
    expect(userMsg).toContain("Ava's 7th Birthday");
    expect(userMsg).toContain("birthday");
    expect(userMsg).toContain("butterfly garden vibes");
    expect(userMsg).toContain("$1500");
    expect(userMsg).toContain("Guest Count: 20");
  });

  test("falls back to the event description when no custom prompt is given", async () => {
    await POST(
      makeRequest({ event: { title: "T", type: "wedding", description: "elegant vineyard evening" } })
    );
    const userMsg = state.calls[0][1].content;
    expect(userMsg).toContain("elegant vineyard evening");
  });
});

describe("POST /api/ai/themes — LLM resilience", () => {
  test("retries once when the first response is malformed, then succeeds", async () => {
    state.responses = [
      { content: "Sorry, here are ideas: { broken json" }, // unparseable
      { content: fenced(GOOD_PAYLOAD), model: "mock-glm" },
    ];
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    // The retry nudge was appended to the second call.
    expect(state.calls[1][1].content).toContain("could not be parsed");
  });

  test("surfaces a 500 with a clean message when the engine throws", async () => {
    state.responses = [new Error("Simulated upstream LLM outage")];
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("Simulated upstream LLM outage");
  });

  test("surfaces a 500 when the engine returns empty content twice", async () => {
    state.responses = [{ content: "" }];
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/empty response/i);
  });

  test("surfaces a 500 when the engine returns no theme concepts", async () => {
    state.responses = [{ content: fenced({ summary: "no themes", themes: [] }) }];
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/ai/themes — input validation", () => {
  test("rejects an invalid JSON body with 400", async () => {
    const res = await POST(makeRequest("{not-json"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Invalid JSON/i);
  });

  test("rejects schema violations with a 400 field map", async () => {
    const res = await POST(
      makeRequest({
        event: {
          type: "not-an-event-type",
          date: "10/26/2026",
          guestCount: -5,
          budget: "free",
        },
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Validation failed/i);
    const fields = Object.keys(body.fields);
    expect(fields).toContain("event.type");
    expect(fields).toContain("event.date");
    expect(fields).toContain("event.guestCount");
    expect(fields).toContain("event.budget");
    // The engine was never contacted.
    expect(state.calls).toHaveLength(0);
  });

  test("rejects event fields exceeding type bounds", async () => {
    const res = await POST(makeRequest({ event: { guestCount: 999999999 } }));
    expect(res.status).toBe(400);
    expect(state.calls).toHaveLength(0);
  });

  test("returns 413 for oversized payloads without reaching the engine", async () => {
    const huge = { event: { title: "x".repeat(60 * 1024) } };
    const res = await POST(makeRequest(huge));
    expect(res.status).toBe(413);
    expect(state.calls).toHaveLength(0);
  });
});

describe("POST /api/ai/themes — abuse protection", () => {
  test("blocks request floods with 429 and Retry-After header", async () => {
    const responses: Response[] = [];
    for (let i = 0; i < 12; i++) {
      responses.push(await POST(makeRequest({ event: { title: "x" } })));
    }
    const blocked = responses.filter((r) => r.status === 429);
    expect(blocked.length).toBe(4); // 12 requests, 8/min limit -> 4 blocked

    const firstBlock = blocked[0];
    expect(firstBlock.headers.get("Retry-After")).toBeTruthy();
    expect(firstBlock.headers.get("X-RateLimit-Limit")).toBe("8");
    expect((await firstBlock.json()).error).toMatch(/Too many/i);
  });

  test("rate limits are enforced per client", async () => {
    const a = { headers: { "x-forwarded-for": "203.0.113.1" } };
    const b = { headers: { "x-forwarded-for": "203.0.113.2" } };
    for (let i = 0; i < 9; i++) await POST(makeRequest({ event: { title: "x" } }, a));
    expect((await POST(makeRequest({ event: { title: "x" } }, a))).status).toBe(429);
    expect((await POST(makeRequest({ event: { title: "x" } }, b))).status).toBe(200);
  });

  test("rate limiting happens before validation", async () => {
    // Even garbage bodies consume quota — flood with junk, expect 429s, never 400.
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      const r = await POST(makeRequest("garbage-not-even-json"));
      statuses.push(r.status);
    }
    expect(statuses.filter((s) => s === 429).length).toBe(4);
    expect(statuses.filter((s) => s === 400).length).toBe(8);
  });

  test("never leaks stack traces in error responses", async () => {
    const res = await POST(makeRequest("{bad json"));
    const text = await res.text();
    expect(text).not.toContain("node_modules");
    expect(text).not.toMatch(/"at \w/);
  });
});
