/**
 * Session-cookie plumbing for the cloud-sync account layer.
 *
 * DB-backed opaque sessions (random 256-bit token in an HttpOnly cookie) —
 * revocable server-side, no JWT signing key to leak, and the lookup is a
 * single indexed query. Cookie flags follow the OWASP session-cheatsheet:
 * HttpOnly + SameSite=Lax + Path=/, Secure in production.
 */
import { randomBytes } from "crypto";

export const SESSION_COOKIE = "planner_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function newSessionToken(): string {
  // 32 bytes → 64 hex chars, 256 bits of entropy.
  return randomBytes(32).toString("hex");
}

export function sessionExpiry(now = Date.now()): Date {
  return new Date(now + SESSION_TTL_MS);
}

/**
 * Read the session token from a request's Cookie header. Deliberately parses
 * the raw header (rather than NextRequest.cookies) so handlers accept plain
 * Request objects — which is what the route factories receive in unit tests.
 */
export function readSessionToken(request: Request): string | null {
  const header = request.headers.get("cookie") || "";
  const match = /(?:^|;\s*)planner_session=([0-9a-f]{64})(?:;|$)/.exec(header);
  return match ? match[1] : null;
}

export const SESSION_MAX_AGE_SEC = Math.floor(SESSION_TTL_MS / 1000);

export function sessionCookieOptions(maxAgeSec: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: maxAgeSec,
  };
}

/** Minimal shape the auth handlers need from a session row. */
export interface SessionRow {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
}

/** Resolve the signed-in user for a request, or null. Expired sessions are purged. */
export async function resolveSession(
  db: {
    session: {
      findUnique: (args: unknown) => Promise<
        (SessionRow & { user: { id: string; email: string; name: string | null } }) | null
      >;
      delete: (args: unknown) => Promise<unknown>;
    };
  },
  token: string | null
): Promise<{ userId: string; email: string; name: string | null } | null> {
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { token },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  return { userId: session.user.id, email: session.user.email, name: session.user.name };
}
