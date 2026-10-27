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
 * Guests may upload up to ALBUM_MAX_PHOTOS_PER_EVENT photos per event; the
 * host imports (and thereby clears) them through the sync API.
 */
import { NextResponse } from "next/server";

import { checkRateLimit, getClientKey } from "@/lib/security/rateLimit";
import { sanitizeText } from "@/lib/security/sanitize";
import { formatZodErrors } from "@/lib/validation/schemas";
import {
  albumUploadSchema,
  ALBUM_MAX_PHOTOS_PER_EVENT,
} from "@/lib/validation/syncSchemas";
import { parseSnapshotJson } from "@/lib/sync/handlers";
import { validatePhotoDataUrl } from "@/lib/photos/photoModel";

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

    let body: unknown;
    try {
      body = JSON.parse((await request.text()) || "{}");
    } catch {
      return jsonError("Invalid JSON body", 400);
    }
    const parsed = albumUploadSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Validation failed", 400, formatZodErrors(parsed.error));
    }

    const { token } = await ctx.params;
    if (token !== parsed.data.token) {
      return jsonError("This album link is not valid.", 404);
    }
    const event = await findAlbumEvent(db, token);
    if (!event) return jsonError("This album link is not valid.", 404);

    // Data-URL hardening: mime allowlist + SVG injection scan + size ceiling.
    const dataUrl = validatePhotoDataUrl(parsed.data.dataUrl);
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

    const existing = await db.guestPhoto.count({ where: { eventId: event.id } });
    if (existing >= ALBUM_MAX_PHOTOS_PER_EVENT) {
      return jsonError(
        `This shared album is full (${ALBUM_MAX_PHOTOS_PER_EVENT} photos) — the host will treasure what's already here.`,
        409
      );
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

    return NextResponse.json({
      ok: true,
      photo: {
        id: row.id,
        uploader: row.uploader,
        caption: row.caption,
        dataUrl: row.dataUrl,
        createdAt: row.createdAt.toISOString(),
      },
      count: existing + 1,
      remaining: Math.max(0, ALBUM_MAX_PHOTOS_PER_EVENT - (existing + 1)),
    });
  };
}
