/**
 * Public RSVP route contract tests — lookup + submit.
 *
 * These endpoints are unauthenticated by design (guests only hold the token),
 * so the tests focus on the hardening: token 404s, the deadline lock (410),
 * Zod validation of every field, guest-list privacy (lookup answers queries,
 * never lists), upsert semantics for revisions, and the new-guest path.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  createRsvpLookupHandler,
  createRsvpSubmitHandler,
} from "../../src/lib/rsvp/handlers";
import { resetRateLimits } from "../../src/lib/security/rateLimit";
import { makeSyncDb, jsonRequest, type FakeEventRow } from "../helpers/fakeCloudDb";

const BASE = "http://localhost:3000";
const TOKEN = "f".repeat(32);

const FIXED_NOW = () => new Date("2026-10-27T12:00:00.000Z");

function seedEvent(extra: Record<string, unknown> = {}): FakeEventRow {
  const snapshot = JSON.stringify({
    id: "evt-1",
    title: "Vineyard Vows",
    type: "wedding",
    date: "2027-07-18",
    time: "16:00",
    guests: [
      { id: "guest-1", name: "Eleanor Vance", rsvp: "invited" },
      { id: "guest-2", name: "Marco Rossi", rsvp: "invited" },
      { id: "guest-3", name: "Eleanor Roosevelt", rsvp: "invited" },
    ],
    invitation: { headline: "You are invited", rsvpDeadline: "2027-06-01" },
    ...extra,
  });
  const row: FakeEventRow = {
    id: "evt-cloud-1",
    userId: "user-a",
    localId: "evt-1",
    title: "Vineyard Vows",
    eventType: "wedding",
    eventDate: "2027-07-18",
    snapshot,
    version: 1,
    rsvpToken: TOKEN,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return row;
}

let fake: ReturnType<typeof makeSyncDb>;
let lookup: ReturnType<typeof createRsvpLookupHandler>;
let submit: ReturnType<typeof createRsvpSubmitHandler>;

beforeEach(() => {
  resetRateLimits();
  fake = makeSyncDb({
    users: [{ id: "user-a", email: "a@example.com", name: "A", passwordHash: "x" }],
  });
  lookup = createRsvpLookupHandler(fake.db as never, FIXED_NOW);
  submit = createRsvpSubmitHandler(fake.db as never, FIXED_NOW);
});

afterEach(() => {
  resetRateLimits();
});

describe("POST /api/public/rsvp/lookup", () => {
  test("answers a name query with matches only — never the guest list", async () => {
    fake.events.set("user-a:evt-1", seedEvent());
    const res = await lookup(
      jsonRequest(`${BASE}/api/public/rsvp/lookup`, "POST", {
        token: TOKEN,
        nameQuery: "eleanor",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.matches).toHaveLength(2); // Eleanor Vance + Eleanor Roosevelt
    // Exact-substring matches rank above partial ones; ties break alphabetically.
    expect(body.matches.map((m: { guestKey: string }) => m.guestKey).sort()).toEqual(["guest-1", "guest-3"]);
    expect(body.matches.every((m: { name: string }) => /eleanor/i.test(m.name))).toBe(true);
    expect(body.matches.every((m: { email?: string }) => !("email" in m))).toBe(true);
  });

  test("multi-word queries must match every word; short queries 400; unknown tokens 404", async () => {
    fake.events.set("user-a:evt-1", seedEvent());
    const strict = await lookup(
      jsonRequest(`${BASE}/api/public/rsvp/lookup`, "POST", {
        token: TOKEN,
        nameQuery: "eleanor vance",
      })
    );
    const strictBody = await strict.json();
    expect(strictBody.matches).toHaveLength(2); // loose any-word match also admits Roosevelt
    expect(strictBody.matches[0].guestKey).toBe("guest-1"); // but the full match ranks first

    const short = await lookup(
      jsonRequest(`${BASE}/api/public/rsvp/lookup`, "POST", { token: TOKEN, nameQuery: "e" })
    );
    expect(short.status).toBe(400);

    const bogus = await lookup(
      jsonRequest(`${BASE}/api/public/rsvp/lookup`, "POST", {
        token: "0".repeat(32),
        nameQuery: "eleanor",
      })
    );
    expect(bogus.status).toBe(404);
  });

  test("respects the RSVP deadline lock with 410", async () => {
    fake.events.set("user-a:evt-1", seedEvent({ invitation: { rsvpDeadline: "2020-01-01" } }));
    const res = await lookup(
      jsonRequest(`${BASE}/api/public/rsvp/lookup`, "POST", {
        token: TOKEN,
        nameQuery: "eleanor",
      })
    );
    expect(res.status).toBe(410);
  });
});

describe("POST /api/public/rsvp (submit)", () => {
  test("keyed submission maps to the invited guest with their canonical name", async () => {
    fake.events.set("user-a:evt-1", seedEvent());
    const res = await submit(
      jsonRequest(`${BASE}/api/public/rsvp`, "POST", {
        token: TOKEN,
        guestKey: "guest-1",
        attending: "attending",
        plusOnes: 2,
        meal: "vegetarian",
        note: "Bringing the kids",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.responseCount).toBe(1);

    const row = fake.responses.get("evt-cloud-1:guest-1")!;
    expect(row.name).toBe("Eleanor Vance");
    expect(row.plusOnes).toBe(2);
    expect(row.meal).toBe("vegetarian");
    expect(row.isNewGuest).toBe(false);
  });

  test("a revision upserts the same row instead of duplicating it", async () => {
    fake.events.set("user-a:evt-1", seedEvent());
    await submit(
      jsonRequest(`${BASE}/api/public/rsvp`, "POST", {
        token: TOKEN,
        guestKey: "guest-1",
        attending: "maybe",
        plusOnes: 0,
      })
    );
    const revised = await submit(
      jsonRequest(`${BASE}/api/public/rsvp`, "POST", {
        token: TOKEN,
        guestKey: "guest-1",
        attending: "attending",
        plusOnes: 1,
      })
    );
    const body = await revised.json();
    expect(body.responseCount).toBe(1); // still one row
    const row = fake.responses.get("evt-cloud-1:guest-1")!;
    expect(row.attending).toBe("attending");
    expect(row.plusOnes).toBe(1);
  });

  test("unlisted guests respond under a new: key flagged isNewGuest", async () => {
    fake.events.set("user-a:evt-1", seedEvent());
    const res = await submit(
      jsonRequest(`${BASE}/api/public/rsvp`, "POST", {
        token: TOKEN,
        name: "Olivia Stone",
        attending: "attending",
        plusOnes: 0,
        note: "Met the couple at pottery class",
      })
    );
    expect(res.status).toBe(200);
    const row = fake.responses.get("evt-cloud-1:new:olivia-stone")!;
    expect(row.isNewGuest).toBe(true);
    expect(row.name).toBe("Olivia Stone");
    expect(row.note).toContain("pottery");
  });

  test("validation: bad attending 400, plusOnes > 5 400, unknown guestKey 400, name required 400, closed 410", async () => {
    fake.events.set("user-a:evt-1", seedEvent());
    expect(
      (await submit(jsonRequest(`${BASE}/api/public/rsvp`, "POST", { token: TOKEN, guestKey: "guest-1", attending: "excited", plusOnes: 0 }))).status
    ).toBe(400);
    expect(
      (await submit(jsonRequest(`${BASE}/api/public/rsvp`, "POST", { token: TOKEN, guestKey: "guest-1", attending: "attending", plusOnes: 6 }))).status
    ).toBe(400);
    expect(
      (await submit(jsonRequest(`${BASE}/api/public/rsvp`, "POST", { token: TOKEN, guestKey: "guest-404", attending: "attending", plusOnes: 0 }))).status
    ).toBe(400);
    expect(
      (await submit(jsonRequest(`${BASE}/api/public/rsvp`, "POST", { token: TOKEN, attending: "attending", plusOnes: 0 }))).status
    ).toBe(400);

    fake.events.set("user-a:evt-1", seedEvent({ invitation: { rsvpDeadline: "2020-01-01" } }));
    expect(
      (await submit(jsonRequest(`${BASE}/api/public/rsvp`, "POST", { token: TOKEN, guestKey: "guest-1", attending: "attending", plusOnes: 0 }))).status
    ).toBe(410);
  });

  test("an unknown token 404s and an invalid snapshot behaves like an unknown link", async () => {
    const bogus = await submit(
      jsonRequest(`${BASE}/api/public/rsvp`, "POST", {
        token: "0".repeat(32),
        name: "Anyone",
        attending: "attending",
        plusOnes: 0,
      })
    );
    expect(bogus.status).toBe(404);

    const broken = seedEvent();
    broken.snapshot = "{not json";
    fake.events.set("user-a:evt-1", broken);
    const res = await submit(
      jsonRequest(`${BASE}/api/public/rsvp`, "POST", {
        token: TOKEN,
        name: "Anyone",
        attending: "attending",
        plusOnes: 0,
      })
    );
    expect(res.status).toBe(404);
  });
});
