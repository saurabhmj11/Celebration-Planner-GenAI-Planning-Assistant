/**
 * Public RSVP handlers — the guest-facing half of the RSVP portal (GAP 1).
 *
 * Unauthenticated by design (guests only hold an unguessable 128-bit token),
 * so every input is Zod-validated, sanitized and rate-limited. The guest list
 * is NEVER exposed: lookup answers name queries server-side and returns only
 * matched names, and submissions are matched against the stored snapshot.
 *
 * Red-team hardening (attack report 2026-10-28):
 *  - bodies are size-capped BEFORE parsing (V-1: memory DoS)
 *  - per-TOKEN rate limits back the spoofable per-IP ones (V-2), capping both
 *    guest-name enumeration through lookup floods and RSVP spam
 */
import { NextResponse } from "next/server";

import { checkRateLimit, getClientKey } from "@/lib/security/rateLimit";
import { readCappedJsonBody } from "@/lib/security/bodyCap";
import { sanitizeText } from "@/lib/security/sanitize";
import { formatZodErrors } from "@/lib/validation/schemas";
import {
  rsvpLookupSchema,
  rsvpSubmitSchema,
} from "@/lib/validation/syncSchemas";
import { parseSnapshotJson } from "@/lib/sync/handlers";

export interface RsvpDb {
  syncedEvent: {
    findUnique: (args: unknown) => Promise<{
      id: string;
      snapshot: string;
      title: string;
    } | null>;
  };
  rsvpResponse: {
    upsert: (args: unknown) => Promise<unknown>;
    count: (args: unknown) => Promise<number>;
  };
}

const LOOKUP_RATE = { key: "rsvp:lookup", limit: 20, windowMs: 60_000 };
const SUBMIT_RATE = { key: "rsvp:submit", limit: 12, windowMs: 60_000 };

/**
 * Per-TOKEN ceilings (V-2 fix) — x-forwarded-for is client-spoofable, so a
 * second limiter keyed on the RSVP token bounds each link's abuse no matter
 * how many fake "IPs" rotate behind it. Lookup 40/min still lets a real
 * household search every family member; enumeration at scale needs far more.
 */
const TOKEN_LOOKUP_RATE = { key: "rsvp:lookup-t", limit: 40, windowMs: 60_000 };
const TOKEN_SUBMIT_RATE = { key: "rsvp:submit-t", limit: 30, windowMs: 60_000 };

/** Small JSON envelopes — 8KB is 10× the schema maximum (V-1 fix). */
const RSVP_MAX_BODY_CHARS = 8_000;

/** Rate-limit a token-scoped request by its token (second, unspoofable key). */
function checkTokenRateLimit(token: string, opts: { key: string; limit: number; windowMs: number }) {
  return checkRateLimit(`t:${token}`, opts);
}

function jsonError(message: string, status: number, fields?: Record<string, string>) {
  return NextResponse.json(
    fields ? { error: message, fields } : { error: message },
    { status }
  );
}

async function findEventByToken(
  db: RsvpDb,
  token: string
): Promise<{ id: string; snapshot: Record<string, unknown> } | null> {
  const row = await db.syncedEvent.findUnique({ where: { rsvpToken: token } });
  if (!row) return null;
  const snapshot = parseSnapshotJson(row.snapshot);
  if (!snapshot) return null;
  return { id: row.id, snapshot };
}

/** Today's date string, injectable for deterministic tests. */
function todayStr(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function readDeadline(snapshot: Record<string, unknown>): string | null {
  const invitation = snapshot.invitation;
  if (typeof invitation !== "object" || invitation === null) return null;
  const raw = (invitation as Record<string, unknown>).rsvpDeadline;
  return typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

export function isRsvpClosed(snapshot: Record<string, unknown>, today: string): boolean {
  const deadline = readDeadline(snapshot);
  return Boolean(deadline && deadline < today);
}

/* POST /api/public/rsvp/lookup — find yourself on the guest list */
export function createRsvpLookupHandler(db: RsvpDb, now: () => Date = () => new Date()) {
  return async function POST(request: Request): Promise<Response> {
    const rate = checkRateLimit(getClientKey(request), LOOKUP_RATE);
    if (!rate.allowed) return jsonError("Too many lookups. Please wait a moment.", 429);

    const body = await readCappedJsonBody(request, RSVP_MAX_BODY_CHARS);
    if (!body.ok) return jsonError(body.message, body.status);
    const parsed = rsvpLookupSchema.safeParse(body.value);
    if (!parsed.success) {
      return jsonError("Validation failed", 400, formatZodErrors(parsed.error));
    }

    const tokenRate = checkTokenRateLimit(parsed.data.token, TOKEN_LOOKUP_RATE);
    if (!tokenRate.allowed) return jsonError("Too many lookups. Please wait a moment.", 429);

    const event = await findEventByToken(db, parsed.data.token);
    if (!event) return jsonError("This RSVP link is not valid.", 404);

    if (isRsvpClosed(event.snapshot, todayStr(now()))) {
      return jsonError("RSVPs are closed for this celebration.", 410);
    }

    const guests = Array.isArray(event.snapshot.guests)
      ? (event.snapshot.guests as unknown[])
      : [];
    const query = parsed.data.nameQuery.trim().toLowerCase();
    const words = query.split(/\s+/).filter(Boolean);

    const scored: { score: number; guestKey: string; name: string }[] = [];
    for (const guest of guests) {
      if (typeof guest !== "object" || guest === null) continue;
      const g = guest as Record<string, unknown>;
      const name = typeof g.name === "string" ? g.name : "";
      const id = typeof g.id === "string" ? g.id : "";
      if (!name || !id) continue;
      const lower = name.toLowerCase();
      if (lower.includes(query)) {
        scored.push({ score: 3, guestKey: id, name });
        continue;
      }
      if (words.length > 0 && words.every((w) => lower.includes(w))) {
        scored.push({ score: 2, guestKey: id, name });
        continue;
      }
      if (words.some((w) => w.length >= 3 && lower.includes(w))) {
        scored.push({ score: 1, guestKey: id, name });
      }
    }
    scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

    return NextResponse.json({
      matches: scored.slice(0, 8).map(({ guestKey, name }) => ({ guestKey, name })),
    });
  };
}

/* POST /api/public/rsvp — submit (or revise) a response */
export function createRsvpSubmitHandler(db: RsvpDb, now: () => Date = () => new Date()) {
  return async function POST(request: Request): Promise<Response> {
    const rate = checkRateLimit(getClientKey(request), SUBMIT_RATE);
    if (!rate.allowed) return jsonError("Too many submissions. Please wait a moment.", 429);

    const body = await readCappedJsonBody(request, RSVP_MAX_BODY_CHARS);
    if (!body.ok) return jsonError(body.message, body.status);
    const parsed = rsvpSubmitSchema.safeParse(body.value);
    if (!parsed.success) {
      return jsonError("Validation failed", 400, formatZodErrors(parsed.error));
    }

    const tokenRate = checkTokenRateLimit(parsed.data.token, TOKEN_SUBMIT_RATE);
    if (!tokenRate.allowed) return jsonError("Too many submissions. Please wait a moment.", 429);

    const event = await findEventByToken(db, parsed.data.token);
    if (!event) return jsonError("This RSVP link is not valid.", 404);

    if (isRsvpClosed(event.snapshot, todayStr(now()))) {
      return jsonError("RSVPs are closed for this celebration.", 410);
    }

    const guests = Array.isArray(event.snapshot.guests)
      ? (event.snapshot.guests as unknown[])
      : [];

    let guestKey: string;
    let name: string;
    let isNewGuest: boolean;

    if (parsed.data.guestKey) {
      const guest = guests.find(
        (g): g is Record<string, unknown> =>
          typeof g === "object" &&
          g !== null &&
          (g as Record<string, unknown>).id === parsed.data.guestKey
      );
      if (!guest) {
        return jsonError("That guest could not be found — search for your name again.", 400);
      }
      guestKey = String(guest.id);
      name = sanitizeText(guest.name, { maxLength: 80 }) || "Guest";
      isNewGuest = false;
    } else {
      const cleanName = sanitizeText(parsed.data.name, { maxLength: 80 })?.trim();
      if (!cleanName || cleanName.length < 2) {
        return jsonError("Please share your name.", 400, {
          name: "Your name is required.",
        });
      }
      const slug = cleanName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);
      guestKey = `new:${slug}`;
      name = cleanName;
      isNewGuest = true;
    }

    const fields = {
      eventId: event.id,
      guestKey,
      name,
      attending: parsed.data.attending,
      plusOnes: parsed.data.plusOnes,
      meal: parsed.data.meal ? sanitizeText(parsed.data.meal, { maxLength: 40 }) : null,
      note: parsed.data.note ? sanitizeText(parsed.data.note, { maxLength: 400 }) : null,
      isNewGuest,
      submittedAt: now(),
      updatedAt: now(),
    };

    await db.rsvpResponse.upsert({
      where: { eventId_guestKey: { eventId: event.id, guestKey } },
      create: fields,
      update: {
        name: fields.name,
        attending: fields.attending,
        plusOnes: fields.plusOnes,
        meal: fields.meal,
        note: fields.note,
        isNewGuest: fields.isNewGuest,
        updatedAt: fields.updatedAt,
      },
    });

    const total = await db.rsvpResponse.count({ where: { eventId: event.id } });
    return NextResponse.json({ ok: true, attending: fields.attending, responseCount: total });
  };
}
