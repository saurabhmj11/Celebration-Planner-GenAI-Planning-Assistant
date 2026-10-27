/**
 * Cloud-sync route contract tests — list / push / pull / delete / share-rsvp /
 * ack, against an in-memory fake db.
 *
 * Covers auth enforcement (401s), ownership isolation between accounts,
 * upsert versioning, snapshot validation (envelope + JSON + size cap), token
 * minting idempotency, and response acknowledgement semantics.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  createAckResponsesHandler,
  createShareRsvpHandler,
  createSyncDeleteHandler,
  createSyncGetHandler,
  createSyncListHandler,
  createSyncPushHandler,
} from "../../src/lib/sync/handlers";
import { resetRateLimits } from "../../src/lib/security/rateLimit";
import { makeSyncDb, jsonRequest } from "../helpers/fakeCloudDb";

const BASE = "http://localhost:3000";
const EMAIL_A = "a@example.com";
const EMAIL_B = "b@example.com";

const snapshotOf = (localId: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    id: localId,
    title: "Vineyard Vows",
    type: "wedding",
    date: "2027-07-18",
    guests: [{ id: "guest-1", name: "Eleanor Vance", rsvp: "invited" }],
    invitation: { headline: "You are invited", rsvpDeadline: "2027-06-01" },
    ...extra,
  });

let fake: ReturnType<typeof makeSyncDb>;
let list: ReturnType<typeof createSyncListHandler>;
let push: ReturnType<typeof createSyncPushHandler>;
let get: ReturnType<typeof createSyncGetHandler>;
let del: ReturnType<typeof createSyncDeleteHandler>;
let share: ReturnType<typeof createShareRsvpHandler>;
let ack: ReturnType<typeof createAckResponsesHandler>;
let tokenA: string;
let tokenB: string;

beforeEach(() => {
  resetRateLimits();
  fake = makeSyncDb({
    users: [
      { id: "user-a", email: EMAIL_A, name: "A", passwordHash: "scrypt$1$1$1$ab$cd" },
      { id: "user-b", email: EMAIL_B, name: "B", passwordHash: "scrypt$1$1$1$ab$cd" },
    ],
  });
  list = createSyncListHandler(fake.db as never);
  push = createSyncPushHandler(fake.db as never);
  get = createSyncGetHandler(fake.db as never);
  del = createSyncDeleteHandler(fake.db as never);
  share = createShareRsvpHandler(fake.db as never);
  ack = createAckResponsesHandler(fake.db as never);
  tokenA = fake.loginAs(EMAIL_A);
  tokenB = fake.loginAs(EMAIL_B);
});

afterEach(() => {
  resetRateLimits();
});

describe("auth enforcement", () => {
  test("every endpoint returns 401 without a session cookie", async () => {
    const anon = async (fn: (req: Request, ctx?: unknown) => Promise<Response>, url: string, method = "GET") => {
      const res =
        method === "GET" || method === "DELETE"
          ? await fn(new Request(url, { method }))
          : await fn(jsonRequest(url, method, {}));
      return res.status;
    };
    expect(await anon(list, `${BASE}/api/sync/events`)).toBe(401);
    expect(await anon(push, `${BASE}/api/sync/events`, "POST")).toBe(401);
    expect(
      await get(new Request(`${BASE}/api/sync/events/evt-1`), {
        params: Promise.resolve({ localId: "evt-1" }),
      } as never)
    ).toBeDefined(); // returns a response (401 checked below via raw call)
    const got = await get(new Request(`${BASE}/api/sync/events/evt-1`), {
      params: Promise.resolve({ localId: "evt-1" }),
    } as never);
    expect(got.status).toBe(401);
    const deleted = await del(new Request(`${BASE}/api/sync/events/evt-1`, { method: "DELETE" }), {
      params: Promise.resolve({ localId: "evt-1" }),
    } as never);
    expect(deleted.status).toBe(401);
  });
});

describe("POST /api/sync/events (push)", () => {
  test("creates v1 on first push, increments on re-push", async () => {
    const first = await push(
      jsonRequest(
        `${BASE}/api/sync/events`,
        "POST",
        {
          localId: "evt-1",
          title: "Vineyard Vows",
          eventType: "wedding",
          eventDate: "2027-07-18",
          snapshot: snapshotOf("evt-1"),
        },
        tokenA
      )
    );
    expect(first.status).toBe(200);
    let body = await first.json();
    expect(body.version).toBe(1);
    expect(body.responseCount).toBe(0);

    const second = await push(
      jsonRequest(
        `${BASE}/api/sync/events`,
        "POST",
        {
          localId: "evt-1",
          title: "Vineyard Vows — updated",
          eventType: "wedding",
          eventDate: null,
          snapshot: snapshotOf("evt-1", { title: "Vineyard Vows — updated" }),
        },
        tokenA
      )
    );
    body = await second.json();
    expect(body.version).toBe(2);

    const row = fake.events.get("user-a:evt-1");
    expect(row!.title).toBe("Vineyard Vows — updated");
    expect(row!.eventDate).toBeNull();
  });

  test("rejects a bad envelope, invalid snapshot JSON, and oversized snapshots", async () => {
    const badEnvelope = await push(
      jsonRequest(`${BASE}/api/sync/events`, "POST", { localId: "x" }, tokenA)
    );
    expect(badEnvelope.status).toBe(400);
    expect((await badEnvelope.json()).fields).toBeDefined();

    const badSnapshot = await push(
      jsonRequest(
        `${BASE}/api/sync/events`,
        "POST",
        {
          localId: "evt-1",
          title: "T",
          eventType: "wedding",
          snapshot: "not-json{{",
        },
        tokenA
      )
    );
    expect(badSnapshot.status).toBe(400);
    expect((await badSnapshot.json()).fields.snapshot).toBeDefined();

    const hugeSnapshot = await push(
      new Request(`${BASE}/api/sync/events`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `planner_session=${tokenA}`,
        },
        body: JSON.stringify({
          localId: "evt-1",
          title: "T",
          eventType: "wedding",
          snapshot: `{"pad":"${"x".repeat(2_600_000)}"}`,
        }),
      })
    );
    // Snapshot alone exceeds the 2.5MB per-event cap -> schema-level 400.
    expect(hugeSnapshot.status).toBe(400);

    const hugeBody = await push(
      new Request(`${BASE}/api/sync/events`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `planner_session=${tokenA}`,
        },
        body: `{"localId":"evt-1","title":"T","eventType":"wedding","snapshot":"${"y".repeat(3_100_000)}"}`,
      })
    );
    expect(hugeBody.status).toBe(413);
  });

  test("accounts are isolated — B cannot read A's event", async () => {
    await push(
      jsonRequest(
        `${BASE}/api/sync/events`,
        "POST",
        { localId: "evt-1", title: "T", eventType: "wedding", snapshot: snapshotOf("evt-1") },
        tokenA
      )
    );
    const res = await get(new Request(`${BASE}/api/sync/events/evt-1`), {
      params: Promise.resolve({ localId: "evt-1" }),
    } as never);
    // no cookie -> 401
    expect(res.status).toBe(401);

    const asB = await get(
      new Request(`${BASE}/api/sync/events/evt-1`, {
        headers: { cookie: `planner_session=${tokenB}` },
      }),
      { params: Promise.resolve({ localId: "evt-1" }) } as never
    );
    expect(asB.status).toBe(404);
  });
});

describe("GET list / GET one / DELETE", () => {
  beforeEach(async () => {
    await push(
      jsonRequest(
        `${BASE}/api/sync/events`,
        "POST",
        { localId: "evt-1", title: "Vineyard Vows", eventType: "wedding", snapshot: snapshotOf("evt-1") },
        tokenA
      )
    );
  });

  test("list returns summaries with live response counts", async () => {
    const row = fake.events.get("user-a:evt-1")!;
    fake.db.rsvpResponse.upsert({
      where: { eventId_guestKey: { eventId: row.id, guestKey: "guest-1" } },
      create: {
        eventId: row.id,
        guestKey: "guest-1",
        name: "Eleanor Vance",
        attending: "attending",
        plusOnes: 1,
        submittedAt: new Date(),
        updatedAt: new Date(),
      },
      update: {},
    });

    const res = await list(
      new Request(`${BASE}/api/sync/events`, { headers: { cookie: `planner_session=${tokenA}` } })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.events).toHaveLength(1);
    expect(body.events[0].localId).toBe("evt-1");
    expect(body.events[0].responseCount).toBe(1);
    expect(body.events[0].version).toBe(1);
  });

  test("get returns the parsed snapshot and responses", async () => {
    const row = fake.events.get("user-a:evt-1")!;
    await fake.db.rsvpResponse.upsert({
      where: { eventId_guestKey: { eventId: row.id, guestKey: "guest-1" } },
      create: {
        eventId: row.id,
        guestKey: "guest-1",
        name: "Eleanor Vance",
        attending: "attending",
        plusOnes: 0,
        submittedAt: new Date(),
        updatedAt: new Date(),
      },
      update: {},
    });

    const res = await get(
      new Request(`${BASE}/api/sync/events/evt-1`, {
        headers: { cookie: `planner_session=${tokenA}` },
      }),
      { params: Promise.resolve({ localId: "evt-1" }) } as never
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.snapshot.id).toBe("evt-1");
    expect(body.snapshot.guests).toHaveLength(1);
    expect(body.responses).toHaveLength(1);
    expect(body.responses[0].attending).toBe("attending");
  });

  test("delete removes the row and its responses; a repeat delete 404s", async () => {
    const row = fake.events.get("user-a:evt-1")!;
    await fake.db.rsvpResponse.upsert({
      where: { eventId_guestKey: { eventId: row.id, guestKey: "guest-1" } },
      create: {
        eventId: row.id,
        guestKey: "guest-1",
        name: "Eleanor Vance",
        attending: "attending",
        plusOnes: 0,
        submittedAt: new Date(),
        updatedAt: new Date(),
      },
      update: {},
    });

    const res = await del(
      new Request(`${BASE}/api/sync/events/evt-1`, {
        method: "DELETE",
        headers: { cookie: `planner_session=${tokenA}` },
      }),
      { params: Promise.resolve({ localId: "evt-1" }) } as never
    );
    expect(res.status).toBe(200);
    expect(fake.events.size).toBe(0);
    expect(fake.responses.size).toBe(0); // cascaded

    const repeat = await del(
      new Request(`${BASE}/api/sync/events/evt-1`, {
        method: "DELETE",
        headers: { cookie: `planner_session=${tokenA}` },
      }),
      { params: Promise.resolve({ localId: "evt-1" }) } as never
    );
    expect(repeat.status).toBe(404);
  });
});

describe("share-rsvp + ack", () => {
  test("share requires a synced event, then mints a stable token with a public URL", async () => {
    const notSynced = await share(
      new Request(`${BASE}/api/sync/events/evt-1`, {
        method: "POST",
        headers: { cookie: `planner_session=${tokenA}` },
      }),
      { params: Promise.resolve({ localId: "evt-1" }) } as never
    );
    expect(notSynced.status).toBe(404);

    await push(
      jsonRequest(
        `${BASE}/api/sync/events`,
        "POST",
        { localId: "evt-1", title: "T", eventType: "wedding", snapshot: snapshotOf("evt-1") },
        tokenA
      )
    );

    const first = await share(
      new Request(`${BASE}/api/sync/events/evt-1`, {
        method: "POST",
        headers: { cookie: `planner_session=${tokenA}`, host: "planner.example:3000" },
      }),
      { params: Promise.resolve({ localId: "evt-1" }) } as never
    );
    expect(first.status).toBe(200);
    const body = await first.json();
    expect(body.token).toMatch(/^[0-9a-f]{32}$/);
    // No x-forwarded-proto on a non-localhost host -> https (proxy-safe default).
    expect(body.url).toBe(`https://planner.example:3000/rsvp/${body.token}`);

    const second = await share(
      new Request(`${BASE}/api/sync/events/evt-1`, {
        method: "POST",
        headers: { cookie: `planner_session=${tokenA}` },
      }),
      { params: Promise.resolve({ localId: "evt-1" }) } as never
    );
    expect((await second.json()).token).toBe(body.token); // idempotent
  });

  test("ack deletes exactly the acknowledged guest keys", async () => {
    await push(
      jsonRequest(
        `${BASE}/api/sync/events`,
        "POST",
        { localId: "evt-1", title: "T", eventType: "wedding", snapshot: snapshotOf("evt-1") },
        tokenA
      )
    );
    const row = fake.events.get("user-a:evt-1")!;
    for (const key of ["guest-1", "new:olivia-stone"]) {
      await fake.db.rsvpResponse.upsert({
        where: { eventId_guestKey: { eventId: row.id, guestKey: key } },
        create: {
          eventId: row.id,
          guestKey: key,
          name: "X",
          attending: "attending",
          plusOnes: 0,
          isNewGuest: key.startsWith("new:"),
          submittedAt: new Date(),
          updatedAt: new Date(),
        },
        update: {},
      });
    }

    const res = await ack(
      new Request(`${BASE}/api/sync/events/evt-1/responses/ack`, {
        method: "POST",
        headers: { cookie: `planner_session=${tokenA}` },
        body: JSON.stringify({ guestKeys: ["guest-1"] }),
      }),
      { params: Promise.resolve({ localId: "evt-1" }) } as never
    );
    expect(res.status).toBe(200);
    expect((await res.json()).deleted).toBe(1);
    expect(fake.responses.has(`${row.id}:guest-1`)).toBe(false);
    expect(fake.responses.has(`${row.id}:new:olivia-stone`)).toBe(true);
  });
});
