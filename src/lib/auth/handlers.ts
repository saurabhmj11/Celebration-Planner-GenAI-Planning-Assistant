/**
 * Cloud-sync account handlers (register / login / logout / session).
 *
 * Factory-injected dbs keep every handler unit-testable without a live
 * database — the same pattern as the AI assist route. The wire contract is
 * deliberately NextAuth-shaped ({ user } | { user: null }) so swapping in a
 * provider-based auth later is a client-side no-op.
 */
import { NextResponse } from "next/server";

import {
  hashPassword,
  passwordIssues,
  verifyPassword,
} from "@/lib/security/passwords";
import {
  newSessionToken,
  readSessionToken,
  resolveSession,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SEC,
  sessionCookieOptions,
  sessionExpiry,
} from "@/lib/auth/session";
import { checkRateLimit, getClientKey } from "@/lib/security/rateLimit";
import { formatZodErrors } from "@/lib/validation/schemas";
import { loginSchema, registerSchema } from "@/lib/validation/syncSchemas";

/** Prisma-like subset the handlers touch — fakes in tests implement exactly this. */
export interface AuthDb {
  user: {
    findUnique: (args: unknown) => Promise<
      { id: string; email: string; name: string | null; passwordHash: string } | null
    >;
    create: (args: unknown) => Promise<{ id: string; email: string; name: string | null }>;
  };
  session: {
    create: (args: unknown) => Promise<unknown>;
    delete: (args: unknown) => Promise<unknown>;
    deleteMany?: (args: unknown) => Promise<unknown>;
    findUnique: (args: unknown) => Promise<unknown>;
  };
}

const REGISTER_RATE = { key: "auth:register", limit: 6, windowMs: 60_000 };
const LOGIN_RATE = { key: "auth:login", limit: 10, windowMs: 60_000 };
const AUTH_MAX_BODY = 4_096;

async function readJsonBody(request: Request, cap = AUTH_MAX_BODY): Promise<unknown> {
  const raw = await request.text();
  if (raw.length > cap) throw new Error("Payload Too Large");
  if (!raw) return {};
  return JSON.parse(raw);
}

function jsonError(message: string, status: number, fields?: Record<string, string>) {
  return NextResponse.json(
    fields ? { error: message, fields } : { error: message },
    { status }
  );
}

function withSessionCookie(body: Record<string, unknown>, token: string) {
  const res = NextResponse.json(body);
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(SESSION_MAX_AGE_SEC));
  return res;
}

export function createRegisterHandler(db: AuthDb) {
  return async function POST(request: Request): Promise<Response> {
    const rate = checkRateLimit(getClientKey(request), REGISTER_RATE);
    if (!rate.allowed) {
      return jsonError("Too many attempts. Please wait a moment.", 429);
    }
    try {
      const body = await readJsonBody(request);
      const parsed = registerSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError("Validation failed", 400, formatZodErrors(parsed.error));
      }
      const email = parsed.data.email.trim().toLowerCase();
      const name = parsed.data.name?.trim() || null;
      const pwIssue = passwordIssues(parsed.data.password);
      if (pwIssue) {
        return jsonError("Validation failed", 400, { password: pwIssue });
      }

      const existing = await db.user.findUnique({ where: { email } });
      if (existing) {
        return jsonError("An account with this email already exists.", 409, {
          email: "Already registered — sign in instead.",
        });
      }

      const user = await db.user.create({
        data: { email, name, passwordHash: hashPassword(parsed.data.password) },
      });

      const token = newSessionToken();
      await db.session.create({
        data: { token, userId: user.id, expiresAt: sessionExpiry() },
      });
      return withSessionCookie(
        { user: { id: user.id, email: user.email, name } },
        token
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      return jsonError(message === "Payload Too Large" ? message : "Could not create account.", message === "Payload Too Large" ? 413 : 500);
    }
  };
}

export function createLoginHandler(db: AuthDb) {
  return async function POST(request: Request): Promise<Response> {
    const rate = checkRateLimit(getClientKey(request), LOGIN_RATE);
    if (!rate.allowed) {
      return jsonError("Too many attempts. Please wait a moment.", 429);
    }
    try {
      const body = await readJsonBody(request);
      const parsed = loginSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError("Validation failed", 400, formatZodErrors(parsed.error));
      }
      const email = parsed.data.email.trim().toLowerCase();

      const user = await db.user.findUnique({ where: { email } });
      // Same generic message for unknown email and bad password — no account
      // enumeration oracle.
      const fail = () => jsonError("Email or password is incorrect.", 401);
      if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
        return fail();
      }

      const token = newSessionToken();
      await db.session.create({
        data: { token, userId: user.id, expiresAt: sessionExpiry() },
      });
      return withSessionCookie(
        { user: { id: user.id, email: user.email, name: user.name } },
        token
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      return jsonError(message === "Payload Too Large" ? message : "Could not sign in.", message === "Payload Too Large" ? 413 : 500);
    }
  };
}

export function createLogoutHandler(db: AuthDb) {
  return async function POST(request: Request): Promise<Response> {
    const token = readSessionToken(request);
    if (token) {
      await db.session.delete({ where: { token } }).catch(() => undefined);
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
    return res;
  };
}

export function createSessionHandler(db: AuthDb) {
  return async function GET(request: Request): Promise<Response> {
    const session = await resolveSession(db as never, readSessionToken(request));
    return NextResponse.json({
      user: session ? { id: session.userId, email: session.email, name: session.name } : null,
    });
  };
}
