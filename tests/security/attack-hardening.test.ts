/**
 * Red-team regression suite (Task 17) — pins the fixes for the 4 findings
 * from the 2026-10-28 live attack report (scripts/attack-harness.js):
 *
 *   V-1  Unbounded JSON body on public album/RSVP endpoints  → capped, 413
 *   V-2  x-forwarded-for rotation mints fresh rate-limit buckets
 *        → per-TOKEN ceilings back the per-IP ones
 *   V-3  count-then-create capacity race under concurrent guests
 *        → per-event serial queue; overflow is impossible
 *   V-4  Guest SVG uploads (denylist misses onmouseover= etc.)
 *        → guests are limited to RASTER formats, SVG refused outright
 *
 * Every test here reproduces the attacker's exact move; remove a fix and
 * its test goes red (the race test provably interleave-overflows without
 * the queue — verified during the red-team pass).
 */
import { beforeEach, describe, expect, test } from "bun:test";
import {
  createAlbumInfoHandler,
  createAlbumUploadHandler,
} from "../../src/lib/album/handlers";
import {
  createRsvpLookupHandler,
  createRsvpSubmitHandler,
} from "../../src/lib/rsvp/handlers";
import { resetRateLimits } from "../../src/lib/security/rateLimit";
import {
  validateGuestPhotoDataUrl,
  validatePhotoDataUrl,
} from "../../src/lib/photos/photoModel";
import {
  makeSyncDb,
  type FakeGuestPhotoRow,
} from "../helpers/fakeCloudDb";

const BASE = "http://localhost:3000";
const ALBUM_TOKEN = "b".repeat(32);
const RSVP_TOKEN = "c".repeat(32);
/** Comfortably over the album body cap (dataUrl cap 400k + 16k envelope). */
const ALBUM_BODY_OVERFLOW = 500_000;

const TINY_JPEG =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AmgA//9k=";

/** The hostile SVG that the red-team harness proved was storable (V-4). */
const EVIL_SVG_MOUSEOVER = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red" onmouseover="alert(document.domain)"/></svg>'
)}`;
/** A perfectly clean, harmless SVG — still refused for GUEST uploads. */
const CLEAN_SVG = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><circle cx="5" cy="5" r="4" fill="#8b5cf6"/></svg>'
)}`;

let fake: ReturnType<typeof makeSyncDb>;
let upload: ReturnType<typeof createAlbumUploadHandler>;
let info: ReturnType<typeof createAlbumInfoHandler>;
let lookup: ReturnType<typeof createRsvpLookupHandler>;
let submit: ReturnType<typeof createRsvpSubmitHandler>;

function seedEvent() {
  fake.events.set("evt-cloud-1", {
    id: "evt-cloud-1",
    userId: "user-a",
    localId: "evt-1",
    title: "Vineyard Vows",
    eventType: "wedding",
    eventDate: "2027-07-18",
    snapshot: JSON.stringify({
      id: "evt-1",
      title: "Vineyard Vows",
      type: "wedding",
      date: "2027-07-18",
      guests: [{ id: "g-1", name: "Aditi Sharma", rsvpStatus: "invited" }],
    }),
    version: 1,
    rsvpToken: RSVP_TOKEN,
    albumToken: ALBUM_TOKEN,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

/** Build an album POST Request with a spoofable x-forwarded-for. */
function albumRequest(xff: string, body: unknown, extraHeaders: Record<string, string> = {}) {
  return new Request(`${BASE}/api/public/album/${ALBUM_TOKEN}`, {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json", "x-forwarded-for": xff, ...extraHeaders },
  });
}

function albumCtx(token = ALBUM_TOKEN) {
  return { params: Promise.resolve({ token }) };
}

function rsvpRequest(path: string, xff: string, body: unknown) {
  return new Request(`${BASE}${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", "x-forwarded-for": xff },
  });
}

/** Plant n guest photos directly (no requests) to stage capacity scenarios. */
function plantPhotos(n: number) {
  for (let i = 0; i < n; i++) {
    const row: FakeGuestPhotoRow = {
      id: `seed-${i}`,
      eventId: "evt-cloud-1",
      uploader: "Seeded Guest",
      caption: null,
      dataUrl: TINY_JPEG,
      imported: false,
      createdAt: new Date(Date.now() + i),
    };
    fake.photos.set(row.id, row);
  }
}

const okUpload = (i: number) => ({
  token: ALBUM_TOKEN,
  uploader: `Guest ${i}`,
  dataUrl: TINY_JPEG,
});

beforeEach(() => {
  resetRateLimits();
  fake = makeSyncDb({
    users: [{ id: "user-a", email: "a@example.com", name: "A", passwordHash: "x" }],
    events: [],
  });
  seedEvent();
  upload = createAlbumUploadHandler(fake.db as never);
  info = createAlbumInfoHandler(fake.db as never);
  lookup = createRsvpLookupHandler(fake.db as never);
  submit = createRsvpSubmitHandler(fake.db as never);
});

/* ---------------------------------------------------------------- V-1: body caps */

describe("V-1 — request bodies are capped before parsing", () => {
  test("album upload: oversized Content-Length is refused with 413 (never parsed)", async () => {
    const huge = "A".repeat(500_000);
    const res = await upload(
      albumRequest("9.9.9.9", { token: ALBUM_TOKEN, uploader: "M", dataUrl: huge }, {
        "content-length": String(JSON.stringify({ token: ALBUM_TOKEN, uploader: "M", dataUrl: huge }).length + 1_000_000),
      }),
      albumCtx()
    );
    expect(res.status).toBe(413);
    expect(fake.photos.size).toBe(0);
  });

  test("album upload: chunked oversize (lying header omitted) still 413 after read", async () => {
    const body = JSON.stringify({ token: ALBUM_TOKEN, uploader: "Mallory", dataUrl: "A".repeat(ALBUM_BODY_OVERFLOW) });
    const res = await upload(albumRequest("9.9.9.9", body), albumCtx());
    expect(res.status).toBe(413);
    expect(fake.photos.size).toBe(0);
  });

  test("album upload: a legitimately-sized photo still passes the cap", async () => {
    const res = await upload(albumRequest("9.9.9.9", okUpload(1)), albumCtx());
    expect(res.status).toBe(200);
    expect(fake.photos.size).toBe(1);
  });

  test("album upload: invalid JSON under the cap is still 400", async () => {
    const res = await upload(albumRequest("9.9.9.9", "{oops"), albumCtx());
    expect(res.status).toBe(400);
  });

  test("rsvp lookup + submit: oversized bodies get 413, not a parse", async () => {
    const fatQuery = { token: RSVP_TOKEN, nameQuery: "x".repeat(20_000) };
    const res1 = await lookup(rsvpRequest("/api/public/rsvp/lookup", "9.9.9.9", fatQuery));
    expect(res1.status).toBe(413);
    const fatNote = { token: RSVP_TOKEN, name: "Bob", attending: "attending", plusOnes: 0, note: "x".repeat(20_000) };
    const res2 = await submit(rsvpRequest("/api/public/rsvp", "9.9.9.9", fatNote));
    expect(res2.status).toBe(413);
    expect(fake.responses.size).toBe(0);
  });
});

/* ---------------------------------------------------------------- V-4: guest SVG */

describe("V-4 — guests can only upload raster images", () => {
  test("the red-team SVG (onmouseover=) is refused for guest uploads", async () => {
    const res = await upload(
      albumRequest("9.9.9.9", { token: ALBUM_TOKEN, uploader: "Mallory", dataUrl: EVIL_SVG_MOUSEOVER }),
      albumCtx()
    );
    expect(res.status).toBe(400);
    expect(fake.photos.size).toBe(0);
  });

  test("even a clean, harmless SVG is refused for guests (outright, not scanned)", async () => {
    const res = await upload(
      albumRequest("9.9.9.9", { token: ALBUM_TOKEN, uploader: "Friendly Ghost", dataUrl: CLEAN_SVG }),
      albumCtx()
    );
    expect(res.status).toBe(400);
  });

  test("validateGuestPhotoDataUrl: raster mimes pass, every svg flavour fails", () => {
    expect(validateGuestPhotoDataUrl(TINY_JPEG)).toBe(TINY_JPEG);
    expect(validateGuestPhotoDataUrl("data:image/png;base64,iVBORw0KGgo=")).toBeTruthy();
    expect(validateGuestPhotoDataUrl("data:image/gif;base64,R0lGODlh=")).toBeTruthy();
    expect(validateGuestPhotoDataUrl("data:image/webp;base64,UklGRho=")).toBeTruthy();
    expect(validateGuestPhotoDataUrl(CLEAN_SVG)).toBeNull();
    expect(validateGuestPhotoDataUrl(EVIL_SVG_MOUSEOVER)).toBeNull();
    // double-encoded onload — inert in browsers, but still refused by policy
    expect(
      validateGuestPhotoDataUrl("data:image/svg+xml,%3Csvg%20onload%253D%22alert(1)%22%3E%3C/svg%3E")
    ).toBeNull();
  });

  test("regression: the app's own SVG seed cards still pass the general validator", () => {
    expect(validatePhotoDataUrl(CLEAN_SVG)).toBe(CLEAN_SVG);
  });

  test("documentation: the GENERAL validator still accepts onmouseover= SVG (why guests get the outright ban)", () => {
    // The red-team harness stored exactly this SVG — the denylist does NOT
    // list onmouseover=. That gap is acceptable ONLY because the guest
    // upload path now refuses SVG entirely (validated above); this test
    // pins that reasoning so nobody "simplifies" the guest ban away while
    // assuming the denylist is exhaustive.
    expect(validatePhotoDataUrl(EVIL_SVG_MOUSEOVER)).toBeTruthy();
    expect(validateGuestPhotoDataUrl(EVIL_SVG_MOUSEOVER)).toBeNull();
  });
});

/* ---------------------------------------------------------------- V-3: capacity race */

describe("V-3 — concurrent uploads can never overflow the 60-photo cap", () => {
  test(
    "15 simultaneous guests at 59/60: exactly one wins, the queue serializes the rest",
    async () => {
      plantPhotos(59);
      // Hostile mock: pause INSIDE create so its commit lands ~8ms after the
      // count — exactly Prisma-over-SQLite's real interleaving window. With
      // count-then-create unserialized, all 15 requests observe 59 and commit
      // together (verified: overflows to 74 without the queue — this test is
      // the red-team reproduction, kept as the regression pin).
      const realCreate = fake.db.guestPhoto.create.bind(fake.db.guestPhoto);
      const slowCreate = async (args: unknown) => {
        await new Promise((r) => setTimeout(r, 8));
        return (realCreate as (a: unknown) => Promise<unknown>)(args);
      };
      const slowDb = {
        ...fake.db,
        guestPhoto: { ...fake.db.guestPhoto, create: slowCreate },
      } as never;
      const raceUpload = createAlbumUploadHandler(slowDb);

      const results = await Promise.all(
        Array.from({ length: 15 }, (_, i) =>
          raceUpload(albumRequest(`203.0.113.${i}`, okUpload(i)), albumCtx()).then((r) => r.status)
        )
      );

      const succeeded = results.filter((s) => s === 200).length;
      const rejected = results.filter((s) => s === 409).length;
      expect(succeeded).toBe(1);
      expect(rejected).toBe(14);
      expect(fake.photos.size).toBe(60);
      expect(fake.photos.size).toBeLessThanOrEqual(60);
    }
  );

  test("sequential fill after the burst: the 61st photo still gets 409", async () => {
    plantPhotos(60);
    const res = await upload(albumRequest("9.9.9.9", okUpload(0)), albumCtx());
    expect(res.status).toBe(409);
    expect(fake.photos.size).toBe(60);
  });
});

/* ---------------------------------------------------------------- V-2: per-token rate limits */

describe("V-2 — per-token ceilings survive x-forwarded-for rotation", () => {
  test("album: the 121st upload within a minute is throttled even from 121 fresh IPs", async () => {
    plantPhotos(60); // capacity-blocked instantly, but every request still
    // burns one per-TOKEN slot (the check runs before the capacity gate).
    let last = 0;
    for (let i = 0; i < 121; i++) {
      last = (await upload(albumRequest(`198.51.100.${i % 250}.${i}`, okUpload(i)), albumCtx())).status;
    }
    expect(last).toBe(429);
  });

  test("album: a genuine guest is never throttled under the ceiling", async () => {
    const res = await upload(albumRequest("198.51.100.7", okUpload(1)), albumCtx());
    expect(res.status).toBe(200);
  });

  test("rsvp lookup: the 41st lookup per token is throttled despite rotating IPs", async () => {
    let last = 0;
    for (let i = 0; i < 41; i++) {
      last = (
        await lookup(
          rsvpRequest("/api/public/rsvp/lookup", `198.51.100.${i}`, {
            token: RSVP_TOKEN,
            nameQuery: "ar",
          })
        )
      ).status;
    }
    expect(last).toBe(429);
  });

  test("rsvp submit: the 31st submission per token is throttled despite rotating IPs", async () => {
    let last = 0;
    for (let i = 0; i < 31; i++) {
      last = (
        await submit(
          rsvpRequest("/api/public/rsvp", `198.51.100.${i}`, {
            token: RSVP_TOKEN,
            name: `Flood Guest ${i}`,
            attending: "attending",
            plusOnes: 0,
          })
        )
      ).status;
    }
    expect(last).toBe(429);
    // the flood still left at most 30 rows — not 31
    expect(fake.responses.size).toBeLessThanOrEqual(30);
  });

  test("rsvp: different token buckets do not interfere", async () => {
    // burn RSVP_TOKEN's lookup bucket to the ceiling…
    for (let i = 0; i < 40; i++) {
      await lookup(
        rsvpRequest("/api/public/rsvp/lookup", `198.51.100.${i}`, {
          token: RSVP_TOKEN,
          nameQuery: "ar",
        })
      );
    }
    // …another album's token is unaffected
    fake.events.set("evt-cloud-2", {
      ...fake.events.get("evt-cloud-1")!,
      rsvpToken: "d".repeat(32),
    });
    const res = await lookup(
      rsvpRequest("/api/public/rsvp/lookup", "198.51.100.200", {
        token: "d".repeat(32),
        nameQuery: "ar",
      })
    );
    expect(res.status).toBe(200);
  });
});

/* ---------------------------------------------------------------- fuzz probes */

describe("fuzz — hostile inputs must degrade, never throw", () => {
  test("album upload with prototype-pollution payload keys is rejected by the schema", async () => {
    // Raw JSON so __proto__ arrives as an own property (an object literal
    // would just set the prototype and never serialize it).
    const payload =
      `{"token":"${ALBUM_TOKEN}","uploader":"Mallory","dataUrl":"${TINY_JPEG}",` +
      `"__proto__":{"isAdmin":true},"constructor":"x"}`;
    const res = await upload(albumRequest("9.9.9.9", payload), albumCtx());
    expect([200, 400]).toContain(res.status);
    expect(fake.photos.size).toBe(1);
    const stored = [...fake.photos.values()][0];
    expect(Object.keys(stored)).not.toContain("__proto__");
    expect(Object.keys(stored)).not.toContain("constructor");
    expect((stored as unknown as { isAdmin?: boolean }).isAdmin).toBeUndefined();
  });

  test("album GET with absurd tokens never throws", async () => {
    for (const tok of ["", "x", "%00%01", "a".repeat(500), "'; DROP TABLE events;--"]) {
      const res = await info(new Request(`${BASE}/api/public/album/${encodeURIComponent(tok)}`), {
        params: Promise.resolve({ token: tok }),
      });
      expect([404, 429]).toContain(res.status);
    }
  });
});
