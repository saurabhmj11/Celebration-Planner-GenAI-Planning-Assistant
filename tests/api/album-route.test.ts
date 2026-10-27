/**
 * Guest photo album contract tests (GAP 3) — public upload/list + the
 * host-side share-album / photos inbox / ack loop.
 *
 * Hardening focus: token 404s, data-URL allowlist (bad mime / svg injection /
 * oversize rejected), uploader sanitization, the per-event 60-photo cap, upload
 * rate limiting, auth-gated host endpoints, and ack deleting only the listed
 * ids for the owning event.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  createAlbumInfoHandler,
  createAlbumUploadHandler,
} from "../../src/lib/album/handlers";
import {
  createShareAlbumHandler,
  createGuestPhotosHandler,
  createAckPhotosHandler,
} from "../../src/lib/sync/handlers";
import { resetRateLimits } from "../../src/lib/security/rateLimit";
import {
  makeSyncDb,
  jsonRequest,
  type FakeEventRow,
  type FakeGuestPhotoRow,
} from "../helpers/fakeCloudDb";

const BASE = "http://localhost:3000";
const ALBUM_TOKEN = "a".repeat(32);
const FIXED_NOW = () => new Date("2026-10-27T12:00:00.000Z");

// Tiny (but valid) JPEG data URL — a real 1x1 pixel JPEG.
const TINY_JPEG =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AmgA//9k=";

function seedEvent(extra: Record<string, unknown> = {}): FakeEventRow {
  const snapshot = JSON.stringify({
    id: "evt-1",
    title: "Vineyard Vows",
    type: "wedding",
    date: "2027-07-18",
  });
  return {
    id: "evt-cloud-1",
    userId: "user-a",
    localId: "evt-1",
    title: "Vineyard Vows",
    eventType: "wedding",
    eventDate: "2027-07-18",
    snapshot,
    version: 1,
    rsvpToken: null,
    albumToken: ALBUM_TOKEN,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...extra,
  };
}

function ctxToken(token = ALBUM_TOKEN) {
  return { params: Promise.resolve({ token }) };
}

let fake: ReturnType<typeof makeSyncDb>;
let info: ReturnType<typeof createAlbumInfoHandler>;
let upload: ReturnType<typeof createAlbumUploadHandler>;
let shareAlbum: ReturnType<typeof createShareAlbumHandler>;
let inbox: ReturnType<typeof createGuestPhotosHandler>;
let ack: ReturnType<typeof createAckPhotosHandler>;
let session: string;

beforeEach(() => {
  resetRateLimits();
  fake = makeSyncDb({
    users: [{ id: "user-a", email: "a@example.com", name: "A", passwordHash: "x" }],
    events: [seedEvent()],
  });
  session = fake.loginAs("a@example.com");
  info = createAlbumInfoHandler(fake.db as never);
  upload = createAlbumUploadHandler(fake.db as never, FIXED_NOW);
  shareAlbum = createShareAlbumHandler(fake.db as never);
  inbox = createGuestPhotosHandler(fake.db as never);
  ack = createAckPhotosHandler(fake.db as never);
});

afterEach(() => {
  resetRateLimits();
});

describe("GET /api/public/album/[token]", () => {
  test("returns album info + gallery with counts", async () => {
    fake.photos.set("photo-1", {
      id: "photo-1",
      eventId: "evt-cloud-1",
      uploader: "Auntie Priya",
      caption: "The cake!",
      dataUrl: TINY_JPEG,
      imported: false,
      createdAt: new Date("2026-10-26T10:00:00Z"),
    });
    const res = await info(new Request(`${BASE}/x`), ctxToken());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.event.title).toBe("Vineyard Vows");
    expect(body.event.type).toBe("wedding");
    expect(body.count).toBe(1);
    expect(body.maxPhotos).toBe(60);
    expect(body.remaining).toBe(59);
    expect(body.photos).toHaveLength(1);
    expect(body.photos[0].uploader).toBe("Auntie Priya");
    expect(body.photos[0].createdAt).toBe("2026-10-26T10:00:00.000Z");
  });

  test("404s an unknown token", async () => {
    const res = await info(new Request(`${BASE}/x`), ctxToken("b".repeat(32)));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("not valid");
  });

  test("falls back to the envelope title when the snapshot is corrupt", async () => {
    fake.events.set("user-a:evt-1", seedEvent({ snapshot: "{not json" }));
    const res = await info(new Request(`${BASE}/x`), ctxToken());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.event.title).toBe("Vineyard Vows"); // envelope field
  });
});

describe("POST /api/public/album/[token] — upload", () => {
  test("accepts a valid photo and reports remaining slots", async () => {
    const res = await upload(
      jsonRequest(`${BASE}/x`, "POST", {
        token: ALBUM_TOKEN,
        uploader: "  Auntie   Priya ",
        caption: "The cake!",
        dataUrl: TINY_JPEG,
      }),
      ctxToken()
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.count).toBe(1);
    expect(body.remaining).toBe(59);
    expect(body.photo.uploader).toBe("Auntie Priya"); // whitespace collapsed
    expect(body.photo.caption).toBe("The cake!");
    // persisted with the trusted clock
    expect(body.photo.createdAt).toBe("2026-10-27T12:00:00.000Z");
    expect(fake.photos.size).toBe(1);
  });

  test("404s an unknown token", async () => {
    const res = await upload(
      jsonRequest(`${BASE}/x`, "POST", {
        token: "b".repeat(32),
        uploader: "Someone",
        dataUrl: TINY_JPEG,
      }),
      ctxToken("b".repeat(32))
    );
    expect(res.status).toBe(404);
  });

  test("rejects a URL-token / body-token mismatch", async () => {
    const res = await upload(
      jsonRequest(`${BASE}/x`, "POST", {
        token: "c".repeat(32), // differs from the URL token
        uploader: "Someone",
        dataUrl: TINY_JPEG,
      }),
      ctxToken()
    );
    expect(res.status).toBe(404);
  });

  test("rejects a non-image data URL", async () => {
    const res = await upload(
      jsonRequest(`${BASE}/x`, "POST", {
        token: ALBUM_TOKEN,
        uploader: "Someone",
        dataUrl: "data:text/html;base64,PGI+aGk8L2I+",
      }),
      ctxToken()
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.fields.dataUrl).toBeDefined();
  });

  test("rejects an SVG carrying an event handler", async () => {
    const evil = `data:image/svg+xml,${encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect/></svg>'
    )}`;
    const res = await upload(
      jsonRequest(`${BASE}/x`, "POST", {
        token: ALBUM_TOKEN,
        uploader: "Someone",
        dataUrl: evil,
      }),
      ctxToken()
    );
    expect(res.status).toBe(400);
  });

  test("rejects an oversized payload at the Zod layer", async () => {
    const huge = `data:image/jpeg;base64,${"A".repeat(400_001)}`;
    const res = await upload(
      jsonRequest(`${BASE}/x`, "POST", {
        token: ALBUM_TOKEN,
        uploader: "Someone",
        dataUrl: huge,
      }),
      ctxToken()
    );
    expect(res.status).toBe(400);
    expect(fake.photos.size).toBe(0);
  });

  test("rejects a one-character uploader name", async () => {
    const res = await upload(
      jsonRequest(`${BASE}/x`, "POST", {
        token: ALBUM_TOKEN,
        uploader: "A",
        dataUrl: TINY_JPEG,
      }),
      ctxToken()
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.fields.uploader).toBeDefined();
  });

  test("rejects an empty caption by storing null (optional field)", async () => {
    const res = await upload(
      jsonRequest(`${BASE}/x`, "POST", {
        token: ALBUM_TOKEN,
        uploader: "Someone",
        caption: "",
        dataUrl: TINY_JPEG,
      }),
      ctxToken()
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.photo.caption).toBeNull();
  });

  test("blocks the 61st photo with 409", async () => {
    for (let i = 0; i < 60; i++) {
      fake.photos.set(`photo-${i}`, {
        id: `photo-${i}`,
        eventId: "evt-cloud-1",
        uploader: "Someone",
        caption: null,
        dataUrl: TINY_JPEG,
        imported: false,
        createdAt: new Date(),
      });
    }
    const res = await upload(
      jsonRequest(`${BASE}/x`, "POST", {
        token: ALBUM_TOKEN,
        uploader: "Late Guest",
        dataUrl: TINY_JPEG,
      }),
      ctxToken()
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("full");
    expect(fake.photos.size).toBe(60);
  });

  test("rate-limits a flood of uploads (10/min)", async () => {
    let last = 0;
    for (let i = 0; i < 11; i++) {
      last = (
        await upload(
          jsonRequest(`${BASE}/x`, "POST", {
            token: ALBUM_TOKEN,
            uploader: "Burst Guest",
            dataUrl: TINY_JPEG,
          }),
          ctxToken()
        )
      ).status;
    }
    expect(last).toBe(429);
  });

  test("invalid JSON body returns 400", async () => {
    const res = await upload(
      new Request(`${BASE}/x`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{oops",
      }),
      ctxToken()
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/sync/events/[localId]/share-album", () => {
  test("mints a stable album token and returns the /album/ url", async () => {
    const res = await shareAlbum(
      jsonRequest(`${BASE}/x`, "POST", undefined, session),
      { params: Promise.resolve({ localId: "evt-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toContain("/album/");
    expect(body.token).toBe(ALBUM_TOKEN); // already minted by seed
  });

  test("generates a token when none exists", async () => {
    fake.events.set("user-a:evt-1", seedEvent({ albumToken: null }));
    const res = await shareAlbum(
      jsonRequest(`${BASE}/x`, "POST", undefined, session),
      { params: Promise.resolve({ localId: "evt-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toMatch(/^[0-9a-f]{32}$/);
    // Re-call returns the SAME token (no churn).
    const again = await shareAlbum(
      jsonRequest(`${BASE}/x`, "POST", undefined, session),
      { params: Promise.resolve({ localId: "evt-1" }) }
    );
    expect((await again.json()).token).toBe(body.token);
  });

  test("401s without a session, 404s an unsynced event", async () => {
    const anon = await shareAlbum(
      jsonRequest(`${BASE}/x`, "POST", undefined),
      { params: Promise.resolve({ localId: "evt-1" }) }
    );
    expect(anon.status).toBe(401);
    const missing = await shareAlbum(
      jsonRequest(`${BASE}/x`, "POST", undefined, session),
      { params: Promise.resolve({ localId: "evt-nope" }) }
    );
    expect(missing.status).toBe(404);
  });
});

describe("host photo inbox: GET photos + POST ack", () => {
  test("lists shared photos for the owning event only", async () => {
    fake.photos.set("photo-1", {
      id: "photo-1",
      eventId: "evt-cloud-1",
      uploader: "Guest A",
      caption: "Dance floor",
      dataUrl: TINY_JPEG,
      imported: false,
      createdAt: new Date("2026-10-26T10:00:00Z"),
    });
    fake.photos.set("photo-other", {
      id: "photo-other",
      eventId: "evt-cloud-2",
      uploader: "Guest B",
      caption: null,
      dataUrl: TINY_JPEG,
      imported: false,
      createdAt: new Date(),
    });
    const res = await inbox(
      jsonRequest(`${BASE}/x`, "GET", undefined, session),
      { params: Promise.resolve({ localId: "evt-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(1);
    expect(body.photos[0].uploader).toBe("Guest A");
  });

  test("ack deletes exactly the listed ids for that event", async () => {
    fake.photos.set("photo-1", photoRow("photo-1"));
    fake.photos.set("photo-2", photoRow("photo-2"));
    fake.photos.set("photo-keep", photoRow("photo-keep"));
    fake.photos.set("photo-other", {
      ...photoRow("photo-same-id-other-event"),
      id: "photo-1",
      eventId: "evt-cloud-2",
    });
    const res = await ack(
      jsonRequest(`${BASE}/x`, "POST", { photoIds: ["photo-1", "photo-2"] }, session),
      { params: Promise.resolve({ localId: "evt-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(2);
    expect(fake.photos.has("photo-1")).toBe(false);
    expect(fake.photos.has("photo-2")).toBe(false);
    expect(fake.photos.has("photo-keep")).toBe(true);
  });

  test("ack validates the body (empty id list rejected)", async () => {
    const res = await ack(
      jsonRequest(`${BASE}/x`, "POST", { photoIds: [] }, session),
      { params: Promise.resolve({ localId: "evt-1" }) }
    );
    expect(res.status).toBe(400);
  });

  test("inbox + ack are session-gated", async () => {
    const noAuth = await inbox(jsonRequest(`${BASE}/x`, "GET", undefined), {
      params: Promise.resolve({ localId: "evt-1" }),
    });
    expect(noAuth.status).toBe(401);
    const noAuthAck = await ack(jsonRequest(`${BASE}/x`, "POST", { photoIds: ["x"] }), {
      params: Promise.resolve({ localId: "evt-1" }),
    });
    expect(noAuthAck.status).toBe(401);
  });
});

function photoRow(id: string): FakeGuestPhotoRow {
  return {
    id,
    eventId: "evt-cloud-1",
    uploader: "Guest",
    caption: null,
    dataUrl: TINY_JPEG,
    imported: false,
    createdAt: new Date(),
  };
}
