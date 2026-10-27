/**
 * Cloud-sync handlers (list / push / pull / delete / share-rsvp / ack).
 *
 * Every handler is a factory over an injected Prisma-subset db so the whole
 * wire contract is unit-testable without a live database. Snapshots are
 * opaque documents to the sync layer — only the envelope is validated here;
 * deep-shape healing happens client-side through the same
 * normalizeImportedEvent pipeline used for file imports.
 */
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";

import { readSessionToken, resolveSession } from "@/lib/auth/session";
import { checkRateLimit, getClientKey } from "@/lib/security/rateLimit";
import { formatZodErrors } from "@/lib/validation/schemas";
import {
  ackPhotosSchema,
  ackResponsesSchema,
  SYNC_COLLECTION_CAP,
  syncPushSchema,
} from "@/lib/validation/syncSchemas";

export interface SyncDb {
  session: {
    findUnique: (args: unknown) => Promise<unknown>;
    delete: (args: unknown) => Promise<unknown>;
  };
  syncedEvent: {
    findUnique: (args: unknown) => Promise<SyncedEventRow | null>;
    findMany: (args: unknown) => Promise<SyncedEventRow[]>;
    create: (args: unknown) => Promise<SyncedEventRow>;
    update: (args: unknown) => Promise<SyncedEventRow>;
    delete: (args: unknown) => Promise<SyncedEventRow>;
  };
  rsvpResponse: {
    count: (args: unknown) => Promise<number>;
    findMany: (args: unknown) => Promise<RsvpRow[]>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
  };
  guestPhoto: {
    count: (args: unknown) => Promise<number>;
    findMany: (args: unknown) => Promise<GuestPhotoRow[]>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
  };
}

export interface SyncedEventRow {
  id: string;
  userId: string;
  localId: string;
  title: string;
  eventType: string;
  eventDate: string | null;
  snapshot: string;
  version: number;
  rsvpToken: string | null;
  albumToken: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GuestPhotoRow {
  id: string;
  eventId: string;
  uploader: string;
  caption: string | null;
  dataUrl: string;
  imported: boolean;
  createdAt: Date;
}

export interface RsvpRow {
  id: string;
  eventId: string;
  guestKey: string;
  name: string;
  attending: string;
  plusOnes: number;
  meal: string | null;
  note: string | null;
  isNewGuest: boolean;
  submittedAt: Date;
  updatedAt: Date;
}

const SYNC_RATE = { key: "sync:api", limit: 30, windowMs: 60_000 };
const SYNC_MAX_BODY = 3_000_000; // slightly above the 2.5MB snapshot cap

type SyncUser = { userId: string; email: string; name: string | null };

async function requireUser(db: SyncDb, request: Request): Promise<SyncUser | null> {
  return resolveSession(db as never, readSessionToken(request));
}

function unauthorized() {
  return NextResponse.json(
    { error: "Sign in to use cloud sync." },
    { status: 401 }
  );
}

function jsonError(message: string, status: number, fields?: Record<string, string>) {
  return NextResponse.json(
    fields ? { error: message, fields } : { error: message },
    { status }
  );
}

/**
 * Parse + sweep a pushed snapshot. Returns the parsed object, or null when the
 * payload is not a plausible event document:
 *  - must be a JSON object (not array / primitive)
 *  - collection fields must be arrays under a hard cap
 *  - own-keys named __proto__/constructor/prototype are dropped everywhere
 *    (defense-in-depth; JSON.parse makes them own-properties, never pollution,
 *    but the restored object must not carry them at all)
 */
export function parseSnapshotJson(snapshot: string): Record<string, unknown> | null {
  let obj: unknown;
  try {
    obj = JSON.parse(snapshot);
  } catch {
    return null;
  }
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return null;
  return sweep(obj as Record<string, unknown>) as Record<string, unknown>;
}

const COLLECTION_KEYS = [
  "tasks",
  "guests",
  "vendors",
  "expenses",
  "gifts",
  "photos",
  "payments",
  "runSheet",
  "agentRuns",
  "moodTiles",
];

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function sweep(value: unknown, depth = 0): unknown {
  if (depth > 12 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.length > SYNC_COLLECTION_CAP ? null : value.map((v) => sweep(v, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (DANGEROUS_KEYS.has(k)) continue;
    if (Object.keys(out).length > 400) break;
    const swept = sweep(v, depth + 1);
    if (swept === null && Array.isArray(v)) continue; // oversized collection dropped
    out[k] = swept;
  }
  return out;
}

function eventSummaries(
  rows: SyncedEventRow[],
  counts: Map<string, number>,
  photoCounts: Map<string, number>
) {
  return rows.map((row) => ({
    localId: row.localId,
    title: row.title,
    eventType: row.eventType,
    eventDate: row.eventDate,
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
    hasRsvpToken: Boolean(row.rsvpToken),
    hasAlbumToken: Boolean(row.albumToken),
    responseCount: counts.get(row.id) ?? 0,
    guestPhotoCount: photoCounts.get(row.id) ?? 0,
  }));
}

/* GET /api/sync/events — every cloud row for the signed-in user */
export function createSyncListHandler(db: SyncDb) {
  return async function GET(request: Request): Promise<Response> {
    const user = await requireUser(db, request);
    if (!user) return unauthorized();
    const rate = checkRateLimit(getClientKey(request), SYNC_RATE);
    if (!rate.allowed) return jsonError("Too many sync requests. Please wait.", 429);

    const rows = await db.syncedEvent.findMany({
      where: { userId: user.userId },
      orderBy: { updatedAt: "desc" },
    });
    const counts = new Map<string, number>();
    const photoCounts = new Map<string, number>();
    await Promise.all(
      rows.map(async (row) => {
        counts.set(row.id, await db.rsvpResponse.count({ where: { eventId: row.id } }));
        photoCounts.set(
          row.id,
          await db.guestPhoto.count({ where: { eventId: row.id } })
        );
      })
    );
    return NextResponse.json({ events: eventSummaries(rows, counts, photoCounts) });
  };
}

/* POST /api/sync/events — upsert one event snapshot */
export function createSyncPushHandler(db: SyncDb) {
  return async function POST(request: Request): Promise<Response> {
    const user = await requireUser(db, request);
    if (!user) return unauthorized();
    const rate = checkRateLimit(getClientKey(request), SYNC_RATE);
    if (!rate.allowed) return jsonError("Too many sync requests. Please wait.", 429);

    try {
      const raw = await request.text();
      if (raw.length > SYNC_MAX_BODY) {
        return jsonError("Payload Too Large", 413);
      }
      const parsed = syncPushSchema.safeParse(raw ? JSON.parse(raw) : {});
      if (!parsed.success) {
        return jsonError("Validation failed", 400, formatZodErrors(parsed.error));
      }
      const { localId, title, eventType, eventDate, snapshot } = parsed.data;
      const snapshotObj = parseSnapshotJson(snapshot);
      if (!snapshotObj) {
        return jsonError("Snapshot is not a valid event document.", 400, {
          snapshot: "Could not parse the event data.",
        });
      }

      const where = { userId_localId: { userId: user.userId, localId } };
      const existing = await db.syncedEvent.findUnique({ where });
      const row = existing
        ? await db.syncedEvent.update({
            where,
            data: {
              title,
              eventType,
              eventDate: eventDate ?? null,
              snapshot,
              version: { increment: 1 },
            },
          })
        : await db.syncedEvent.create({
            data: {
              userId: user.userId,
              localId,
              title,
              eventType,
              eventDate: eventDate ?? null,
              snapshot,
              version: 1,
            },
          });

      const responseCount = await db.rsvpResponse.count({ where: { eventId: row.id } });
      return NextResponse.json({
        localId: row.localId,
        version: row.version,
        updatedAt: row.updatedAt.toISOString(),
        responseCount,
      });
    } catch {
      return jsonError("Invalid JSON body", 400);
    }
  };
}

interface RouteCtx {
  params: Promise<{ localId: string }>;
}

async function findOwnedEvent(
  db: SyncDb,
  user: SyncUser,
  localId: string
): Promise<SyncedEventRow | null> {
  return db.syncedEvent.findUnique({
    where: { userId_localId: { userId: user.userId, localId } },
  });
}

/* GET /api/sync/events/[localId] — pull snapshot + responses (for restore/import) */
export function createSyncGetHandler(db: SyncDb) {
  return async function GET(request: Request, ctx: RouteCtx): Promise<Response> {
    const user = await requireUser(db, request);
    if (!user) return unauthorized();
    const { localId } = await ctx.params;
    const row = await findOwnedEvent(db, user, localId);
    if (!row) return jsonError("This event is not synced to your cloud.", 404);

    const responses = await db.rsvpResponse.findMany({
      where: { eventId: row.id },
      orderBy: { submittedAt: "asc" },
    });
    return NextResponse.json({
      localId: row.localId,
      version: row.version,
      updatedAt: row.updatedAt.toISOString(),
      hasRsvpToken: Boolean(row.rsvpToken),
      snapshot: parseSnapshotJson(row.snapshot) ?? {},
      responses: responses.map((r) => ({
        guestKey: r.guestKey,
        name: r.name,
        attending: r.attending,
        plusOnes: r.plusOnes,
        meal: r.meal,
        note: r.note,
        isNewGuest: r.isNewGuest,
        submittedAt: r.submittedAt.toISOString(),
      })),
    });
  };
}

/* DELETE /api/sync/events/[localId] — remove one cloud row (cascade responses) */
export function createSyncDeleteHandler(db: SyncDb) {
  return async function DELETE(request: Request, ctx: RouteCtx): Promise<Response> {
    const user = await requireUser(db, request);
    if (!user) return unauthorized();
    const { localId } = await ctx.params;
    try {
      await db.syncedEvent.delete({
        where: { userId_localId: { userId: user.userId, localId } },
      });
      return NextResponse.json({ ok: true });
    } catch {
      return jsonError("This event is not synced to your cloud.", 404);
    }
  };
}

/* POST /api/sync/events/[localId]/share-rsvp — mint (or return) the public token */
export function createShareRsvpHandler(db: SyncDb) {
  return async function POST(request: Request, ctx: RouteCtx): Promise<Response> {
    const user = await requireUser(db, request);
    if (!user) return unauthorized();
    const { localId } = await ctx.params;
    const row = await findOwnedEvent(db, user, localId);
    if (!row) {
      return jsonError(
        "Sync this event to your cloud before sharing an RSVP link.",
        404
      );
    }

    let token = row.rsvpToken;
    if (!token) {
      token = randomBytes(16).toString("hex");
      await db.syncedEvent.update({ where: { id: row.id }, data: { rsvpToken: token } });
    }

    const host =
      request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      "localhost:3000";
    const proto =
      request.headers.get("x-forwarded-proto") ||
      (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
    return NextResponse.json({ token, url: `${proto}://${host}/rsvp/${token}` });
  };
}

/* POST /api/sync/events/[localId]/share-album — mint (or return) the guest-photo token */
export function createShareAlbumHandler(db: SyncDb) {
  return async function POST(request: Request, ctx: RouteCtx): Promise<Response> {
    const user = await requireUser(db, request);
    if (!user) return unauthorized();
    const { localId } = await ctx.params;
    const row = await findOwnedEvent(db, user, localId);
    if (!row) {
      return jsonError(
        "Sync this event to your cloud before sharing a photo album link.",
        404
      );
    }

    let token = row.albumToken;
    if (!token) {
      token = randomBytes(16).toString("hex");
      await db.syncedEvent.update({ where: { id: row.id }, data: { albumToken: token } });
    }

    const host =
      request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      "localhost:3000";
    const proto =
      request.headers.get("x-forwarded-proto") ||
      (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
    return NextResponse.json({ token, url: `${proto}://${host}/album/${token}` });
  };
}

/* GET /api/sync/events/[localId]/photos — the guest-photo inbox (pre-import) */
export function createGuestPhotosHandler(db: SyncDb) {
  return async function GET(request: Request, ctx: RouteCtx): Promise<Response> {
    const user = await requireUser(db, request);
    if (!user) return unauthorized();
    const { localId } = await ctx.params;
    const row = await findOwnedEvent(db, user, localId);
    if (!row) return jsonError("This event is not synced to your cloud.", 404);

    const photos = await db.guestPhoto.findMany({
      where: { eventId: row.id },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({
      photos: photos.map((p) => ({
        id: p.id,
        uploader: p.uploader,
        caption: p.caption,
        dataUrl: p.dataUrl,
        createdAt: p.createdAt.toISOString(),
      })),
      count: photos.length,
    });
  };
}

/* POST /api/sync/events/[localId]/photos/ack — remove imported photos (collect & clear) */
export function createAckPhotosHandler(db: SyncDb) {
  return async function POST(request: Request, ctx: RouteCtx): Promise<Response> {
    const user = await requireUser(db, request);
    if (!user) return unauthorized();
    const { localId } = await ctx.params;
    const row = await findOwnedEvent(db, user, localId);
    if (!row) return jsonError("This event is not synced to your cloud.", 404);

    try {
      const parsed = ackPhotosSchema.safeParse(
        JSON.parse((await request.text()) || "{}")
      );
      if (!parsed.success) {
        return jsonError("Validation failed", 400, formatZodErrors(parsed.error));
      }
      const result = await db.guestPhoto.deleteMany({
        where: { eventId: row.id, id: { in: parsed.data.photoIds } },
      });
      return NextResponse.json({ ok: true, deleted: result.count });
    } catch {
      return jsonError("Invalid JSON body", 400);
    }
  };
}

/* POST /api/sync/events/[localId]/responses/ack — mark imported responses read */
export function createAckResponsesHandler(db: SyncDb) {
  return async function POST(request: Request, ctx: RouteCtx): Promise<Response> {
    const user = await requireUser(db, request);
    if (!user) return unauthorized();
    const { localId } = await ctx.params;
    const row = await findOwnedEvent(db, user, localId);
    if (!row) return jsonError("This event is not synced to your cloud.", 404);

    try {
      const parsed = ackResponsesSchema.safeParse(
        JSON.parse((await request.text()) || "{}")
      );
      if (!parsed.success) {
        return jsonError("Validation failed", 400, formatZodErrors(parsed.error));
      }
      const result = await db.rsvpResponse.deleteMany({
        where: { eventId: row.id, guestKey: { in: parsed.data.guestKeys } },
      });
      return NextResponse.json({ ok: true, deleted: result.count });
    } catch {
      return jsonError("Invalid JSON body", 400);
    }
  };
}
