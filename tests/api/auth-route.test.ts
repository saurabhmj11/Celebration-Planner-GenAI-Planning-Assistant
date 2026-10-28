/**
 * Auth route contract tests — register / login / logout / session.
 *
 * The full pipeline is covered against an in-memory fake db: validation,
 * password policy, duplicate emails, the login anti-enumeration oracle,
 * HttpOnly session-cookie issuance/clearing, expiry honoring and the
 * NextAuth-shaped { user } responses.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  createLoginHandler,
  createLogoutHandler,
  createRegisterHandler,
  createSessionHandler,
} from "../../src/lib/auth/handlers";
import { verifyPassword } from "../../src/lib/security/passwords";
import { resetRateLimits } from "../../src/lib/security/rateLimit";
import { makeAuthDb, jsonRequest } from "../helpers/fakeCloudDb";

const BASE = "http://localhost:3000";

let fake: ReturnType<typeof makeAuthDb>;
let register: ReturnType<typeof createRegisterHandler>;
let login: ReturnType<typeof createLoginHandler>;
let logout: ReturnType<typeof createLogoutHandler>;
let session: ReturnType<typeof createSessionHandler>;

beforeEach(() => {
  resetRateLimits();
  fake = makeAuthDb();
  register = createRegisterHandler(fake.db as never);
  login = createLoginHandler(fake.db as never);
  logout = createLogoutHandler(fake.db as never);
  session = createSessionHandler(fake.db as never);
});

afterEach(() => {
  resetRateLimits();
});

const cookieOf = (res: Response) => res.headers.get("set-cookie") || "";

describe("POST /api/auth/register", () => {
  test("creates the account, hashes the password, and sets an HttpOnly session cookie", async () => {
    const res = await register(
      jsonRequest(`${BASE}/api/auth/register`, "POST", {
        email: "Host@Example.com",
        name: "  Maya  ",
        password: "party2026",
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe("host@example.com"); // normalized
    expect(body.user.name).toBe("Maya");

    const stored = fake.users.get("host@example.com");
    expect(stored).toBeDefined();
    expect(stored!.passwordHash.startsWith("scrypt$")).toBe(true);
    expect(stored!.passwordHash).not.toContain("party2026");
    expect(verifyPassword("party2026", stored!.passwordHash)).toBe(true);

    const cookie = cookieOf(res);
    expect(cookie).toContain("planner_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
    expect(fake.sessions.size).toBe(1);
  });

  test("rejects a duplicate email with 409 and a friendly field error", async () => {
    await register(
      jsonRequest(`${BASE}/api/auth/register`, "POST", {
        email: "dupe@example.com",
        password: "party2026",
      })
    );
    const res = await register(
      jsonRequest(`${BASE}/api/auth/register`, "POST", {
        email: "DUPE@example.com",
        password: "different1",
      })
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.fields.email).toBeDefined();
  });

  test("enforces the password policy and email format", async () => {
    const weakPw = await register(
      jsonRequest(`${BASE}/api/auth/register`, "POST", {
        email: "ok@example.com",
        password: "short",
      })
    );
    expect(weakPw.status).toBe(400);
    expect((await weakPw.json()).fields.password).toBeDefined();

    const badEmail = await register(
      jsonRequest(`${BASE}/api/auth/register`, "POST", {
        email: "not-an-email",
        password: "party2026",
      })
    );
    expect(badEmail.status).toBe(400);
    expect((await badEmail.json()).fields.email).toBeDefined();
  });

  test("rejects oversized bodies with 413", async () => {
    const res = await register(
      new Request(`${BASE}/api/auth/register`, {
        method: "POST",
        body: JSON.stringify({ email: "a@b.co", password: "x".repeat(5000) }),
        headers: { "content-type": "application/json" },
      })
    );
    expect(res.status).toBe(413);
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await register(
      jsonRequest(`${BASE}/api/auth/register`, "POST", {
        email: "host@example.com",
        name: "Maya",
        password: "party2026",
      })
    );
  });

  test("signs in with the right password and returns the stored name", async () => {
    const res = await login(
      jsonRequest(`${BASE}/api/auth/login`, "POST", {
        email: "HOST@example.com",
        password: "party2026",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.name).toBe("Maya");
    expect(cookieOf(res)).toContain("planner_session=");
  });

  test("wrong password and unknown email return the SAME 401 message (no oracle)", async () => {
    const wrong = await login(
      jsonRequest(`${BASE}/api/auth/login`, "POST", {
        email: "host@example.com",
        password: "nope1234",
      })
    );
    const unknown = await login(
      jsonRequest(`${BASE}/api/auth/login`, "POST", {
        email: "ghost@example.com",
        password: "nope1234",
      })
    );
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect((await wrong.json()).error).toBe((await unknown.json()).error);
  });
});

describe("session lifecycle", () => {
  test("GET /api/auth/session resolves the cookie to the user", async () => {
    await register(
      jsonRequest(`${BASE}/api/auth/register`, "POST", {
        email: "host@example.com",
        password: "party2026",
      })
    );
    const token = [...fake.sessions.keys()][0];
    const res = await session(
      new Request(`${BASE}/api/auth/session`, {
        headers: { cookie: `planner_session=${token}` },
      })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).user.email).toBe("host@example.com");
  });

  test("anonymous requests get { user: null }", async () => {
    const res = await session(new Request(`${BASE}/api/auth/session`));
    expect((await res.json()).user).toBeNull();
  });

  test("expired sessions are purged and resolve to null", async () => {
    await register(
      jsonRequest(`${BASE}/api/auth/register`, "POST", {
        email: "host@example.com",
        password: "party2026",
      })
    );
    const token = [...fake.sessions.keys()][0];
    fake.sessions.get(token)!.expiresAt = new Date(Date.now() - 1000);

    const res = await session(
      new Request(`${BASE}/api/auth/session`, {
        headers: { cookie: `planner_session=${token}` },
      })
    );
    expect((await res.json()).user).toBeNull();
    expect(fake.sessions.has(token)).toBe(false); // purged
  });

  test("logout deletes the session row and clears the cookie", async () => {
    await register(
      jsonRequest(`${BASE}/api/auth/register`, "POST", {
        email: "host@example.com",
        password: "party2026",
      })
    );
    const token = [...fake.sessions.keys()][0];
    const res = await logout(
      new Request(`${BASE}/api/auth/logout`, {
        method: "POST",
        headers: { cookie: `planner_session=${token}` },
      })
    );
    expect(res.status).toBe(200);
    expect(fake.sessions.size).toBe(0);
    const cookie = cookieOf(res);
    expect(cookie).toContain("planner_session=");
    expect(cookie).toContain("Max-Age=0");
  });
});
