/**
 * Rate limiter tests — verifies the AI endpoint's abuse protection.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { checkRateLimit, resetRateLimits, getClientKey } from "../../src/lib/security/rateLimit";

const opts = { key: "test", limit: 3, windowMs: 1000 };

beforeEach(() => {
  resetRateLimits();
});

describe("checkRateLimit", () => {
  test("allows requests up to the limit and reports remaining slots", () => {
    const first = checkRateLimit("client-a", opts);
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(2);

    const second = checkRateLimit("client-a", opts);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(1);

    const third = checkRateLimit("client-a", opts);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);
  });

  test("blocks the request that exceeds the limit with retry metadata", () => {
    checkRateLimit("client-b", opts);
    checkRateLimit("client-b", opts);
    checkRateLimit("client-b", opts);
    const fourth = checkRateLimit("client-b", opts);
    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
    expect(fourth.retryAfterSec).toBeGreaterThanOrEqual(1);
    expect(fourth.resetAt).toBeGreaterThan(Date.now() - 1);
  });

  test("tracks clients independently", () => {
    checkRateLimit("client-x", opts);
    checkRateLimit("client-x", opts);
    checkRateLimit("client-x", opts);
    expect(checkRateLimit("client-x", opts).allowed).toBe(false);
    expect(checkRateLimit("client-y", opts).allowed).toBe(true);
  });

  test("opens a fresh window after the previous one elapses", async () => {
    const shortOpts = { key: "short", limit: 1, windowMs: 30 };
    expect(checkRateLimit("client-z", shortOpts).allowed).toBe(true);
    expect(checkRateLimit("client-z", shortOpts).allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 40));
    expect(checkRateLimit("client-z", shortOpts).allowed).toBe(true);
  });

  test("uses distinct buckets per key name", () => {
    checkRateLimit("client-w", { key: "ai:themes", limit: 1, windowMs: 1000 });
    const other = checkRateLimit("client-w", { key: "ai:other", limit: 1, windowMs: 1000 });
    expect(other.allowed).toBe(true);
  });
});

describe("getClientKey", () => {
  test("prefers the first x-forwarded-for entry", () => {
    const req = new Request("http://localhost/api", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    });
    expect(getClientKey(req)).toBe("203.0.113.7");
  });

  test("falls back to x-real-ip then a constant", () => {
    const req = new Request("http://localhost/api", {
      headers: { "x-real-ip": "198.51.100.9" },
    });
    expect(getClientKey(req)).toBe("198.51.100.9");
    expect(getClientKey(new Request("http://localhost/api"))).toBe("local-client");
  });
});
