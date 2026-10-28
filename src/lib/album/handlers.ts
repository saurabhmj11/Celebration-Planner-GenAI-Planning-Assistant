/**
 * Public guest-photo album handlers (GAP 3) — the guest-facing half of the
 * shared album at /album/[token].
 *
 * Unauthenticated by design (guests only hold an unguessable 128-bit token),
 * same discipline as the RSVP portal: every input is Zod-validated, sanitized
 * and rate-limited, and the photo payload is re-validated against the same
 * data-URL allowlist the on-device wall uses (photoModel.validatePhotoDataUrl)
 * so nothing unsafe is ever persisted or rendered back to other guests.
 *
 * Red-team hardening (attack report 2026-10-28):
 *  - request bodies are size-capped BEFORE parsing (V-1: memory DoS)
 *  - per-TOKEN rate limits in addition to per-IP, so spoofing
 *    x-forwarded-for can no longer mint unlimited buckets (V-2)
 *  - the capacity count+create runs inside a per-event serial queue, so a
 *    wall of concurrent uploads can never overflow the 60-photo cap (V-3)
 *  - guests may only upload RASTER images — SVG is rejected outright
 *    instead of denylist-scanned (V-4)
 *
 * Guests may upload up to ALBUM_MAX_PHOTOS_PER_EVENT photos per event; the
 * host imports (and thereby clears) them through the sync API.
 */
import { NextResponse } from "next/server";

import { checkRateLimit, getClientKey } from "@/lib/security/rateLimit";
import { readCappedJsonBody } from "@/lib/security/bodyCap";
import { sanitizeText } from "@/lib/security/sanitize";
import { formatZodErrors } from "@/lib/validation/schemas";
import {
  albumUploadSchema,
  ALBUM_MAX_DATAURL_CHARS,
  ALBUM_MAX_PHOTOS_PER_EVENT,
} from "@/lib/validation/syncSchemas";
import { parseSnapshotJson } from "@/lib/sync/handlers";
import { validateGuestPhotoDataUrl } from "@/lib/photos/photoModel";

export interface AlbumDb {
  syncedEvent: {
    findUnique: (args: unknown) => Promise<{
      id: string;
      snapshot: string;
      title: string;
      eventDate: string | null;
      eventType: string;
    } | null>;
  };
  guestPhoto: {
    count: (args: unknown) => Promise<number>;
    findMany: (args: unknown) => Promise<GuestPhotoRow[]>;
    create: (args: unknown) => Promise<GuestPhotoRow>;
  };
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

export interface PublicAlbumEventInfo {
  title: string;
  date: string;
  type: string;
}

const UPLOAD_RATE = { key: "album:upload", limit: 10, windowMs: 60_000 };
const READ_RATE = { key: "album:read", limit: 60, windowMs: 60_000 };

/**
 * Per-TOKEN ceilings (V-2 fix). x-forwarded-for is client-spoofable, so a
 * determined attacker can rotate "IPs" to mint fresh per-IP buckets. A
 * second limiter keyed on the album token itself cannot be dodged: no
 * single album can absorb more than this much traffic per minute, no
 * matter how many fake identities are behind it. Generous enough that a
 * full reception uploading at once never trips (the album holds 60 photos
 * total, so 120/min is 2× the physical maximum).
 */
const TOKEN_UPLOAD_RATE = { key: "album:upload-t", limit: 120, windowMs: 60_000 };
const TOKEN_READ_RATE = { key: "album:read-t", limit: 240, windowMs: 60_000 };

/** Body cap: 400k dataUrl + JSON/utf16 envelope headroom (V-1 fix). */
const ALBUM_MAX_BODY_CHARS = ALBUM_MAX_DATAURL_CHARS + 16_000;

/**
 * In-process per-key serial queue (V-3 fix).
 *
 * count-then-create is not atomic; under "every guest uploads at the same
 * moment" loads, N in-flight requests can all observe capacity-1 and all
 * create, overflowing the album. Today SQLite's coarse write-locking hides
 * this by accident; the queue turns it into a contract instead. Same
 * single-instance assumption as the in-memory rate limiter (documented
 * there) — multi-instance deployments would move both to Redis.
 */
const eventLocks = new Map<string, Promise<unknown>>();

function runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = eventLocks.get(key) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  eventLocks.set(key, next);
  next.finally(() => {
    // Idle tail — drop the entry so the map never outlives its events.
    if (eventLocks.get(key) === next) eventLocks.delete(key);
  });
  return next;
}

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

/** Look up the shared album by its public token (never leaks the host id). */
export async function findAlbumEvent(
  db: AlbumDb,
  token: string
): Promise<{ id: string; info: PublicAlbumEventInfo } | null> {
  if (typeof token !== "string" || token.length < 10 || token.length > 80) return null;
  const row = await db.syncedEvent.findUnique({ where: { albumToken: token } });
  if (!row) return null;
  const snapshot = parseSnapshotJson(row.snapshot);
  // The snapshot only feeds the title/date labels; a corrupt snapshot must not
  // brick the album — fall back to the synced envelope fields.
  const title =
    (snapshot && typeof snapshot.title === "string" && snapshot.title) || row.title;
  const date =
    (snapshot && typeof snapshot.date === "string" && snapshot.date) ||
    row.eventDate ||
    "";
  const type =
    (snapshot && typeof snapshot.type === "string" && snapshot.type) ||
    row.eventType ||
    "other";
  return { id: row.id, info: { title, date, type } };
}

/* GET /api/public/album/[token] — album info + the shared gallery */
export function createAlbumInfoHandler(db: AlbumDb) {
  return async function GET(
    request: Request,
    ctx: { params: Promise<{ token: string }> }
  ): Promise<Response> {
    const rate = checkRateLimit(getClientKey(request), READ_RATE);
    if (!rate.allowed) return jsonError("Too many requests. Please wait a moment.", 429);

    const { token } = await ctx.params;
    const tokenRate = checkTokenRateLimit(token, TOKEN_READ_RATE);
    if (!tokenRate.allowed) return jsonError("Too many requests. Please wait a moment.", 429);
    const event = await findAlbumEvent(db, token);
    if (!event) return jsonError("This album link is not valid.", 404);

    const photos = await db.guestPhoto.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({
      event: event.info,
      photos: photos.map((p) => ({
        id: p.id,
        uploader: p.uploader,
        caption: p.caption,
        dataUrl: p.dataUrl,
        createdAt: p.createdAt.toISOString(),
      })),
      count: photos.length,
      maxPhotos: ALBUM_MAX_PHOTOS_PER_EVENT,
      remaining: Math.max(0, ALBUM_MAX_PHOTOS_PER_EVENT - photos.length),
    });
  };
}

/* POST /api/public/album/[token] — a guest contributes one photo */
export function createAlbumUploadHandler(db: AlbumDb, now: () => Date = () => new Date()) {
  return async function POST(
    request: Request,
    ctx: { params: Promise<{ token: string }> }
  ): Promise<Response> {
    const rate = checkRateLimit(getClientKey(request), UPLOAD_RATE);
    if (!rate.allowed) {
      return jsonError("That's a lot of photos at once — please wait a moment.", 429);
    }

    // V-1 fix: refuse oversized bodies before buffering/parsing them.
    const body = await readCappedJsonBody(request, ALBUM_MAX_BODY_CHARS);
    if (!body.ok) return jsonError(body.message, body.status);

    const parsed = albumUploadSchema.safeParse(body.value);
    if (!parsed.success) {
      return jsonError("Validation failed", 400, formatZodErrors(parsed.error));
    }

    const { token } = await ctx.params;
    if (token !== parsed.data.token) {
      return jsonError("This album link is not valid.", 404);
    }
    // V-2 fix: unspoofable per-token ceiling on top of the per-IP one.
    const tokenRate = checkTokenRateLimit(token, TOKEN_UPLOAD_RATE);
    if (!tokenRate.allowed) {
      return jsonError("That's a lot of photos at once — please wait a moment.", 429);
    }
    const event = await findAlbumEvent(db, token);
    if (!event) return jsonError("This album link is not valid.", 404);

    // V-4 fix: guests upload raster photos only — SVG is refused outright.
    const dataUrl = validateGuestPhotoDataUrl(parsed.data.dataUrl);
    if (!dataUrl) {
      return jsonError("That image could not be accepted.", 400, {
        dataUrl: "Use an optimized JPEG/PNG/WebP/GIF image.",
      });
    }

    const uploader = sanitizeText(parsed.data.uploader, { maxLength: 80 }).trim();
    if (uploader.length < 2) {
      return jsonError("Please share your name.", 400, {
        uploader: "Your name is required.",
      });
    }
    const caption = parsed.data.caption
      ? sanitizeText(parsed.data.caption, { maxLength: 200 }) || null
      : null;

    // V-3 fix: capacity check + create run serialized per event, so a burst
    // of concurrent guests can never interleave past the cap.
    const outcome = await runExclusive(event.id, async () => {
      const existing = await db.guestPhoto.count({ where: { eventId: event.id } });
      if (existing >= ALBUM_MAX_PHOTOS_PER_EVENT) {
        return { full: true as const, existing };
      }
      const row = await db.guestPhoto.create({
        data: {
          eventId: event.id,
          uploader,
          caption,
          dataUrl,
          imported: false,
          createdAt: now(),
        },
      });
      return { full: false as const, row, existing };
    });

    if (outcome.full) {
      return jsonError(
        `This shared album is full (${ALBUM_MAX_PHOTOS_PER_EVENT} photos) — the host will treasure what's already here.`,
        409
      );
    }

    return NextResponse.json({
      ok: true,
      photo: {
        id: outcome.row.id,
        uploader: outcome.row.uploader,
        caption: outcome.row.caption,
        dataUrl: outcome.row.dataUrl,
        createdAt: outcome.row.createdAt.toISOString(),
      },
      count: outcome.existing + 1,
      remaining: Math.max(0, ALBUM_MAX_PHOTOS_PER_EVENT - (outcome.existing + 1)),
    });
  };
}
