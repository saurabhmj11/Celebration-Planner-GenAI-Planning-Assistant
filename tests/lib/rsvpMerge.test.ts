/**
 * Pure RSVP-merge engine contracts (src/lib/sync/rsvpMerge.js).
 *
 * Covers the three merge outcomes — update existing guest, add new guest,
 * skip removed guest — plus provenance notes, clamping, summary counts and
 * the toast text builder. Immutability matters: the local event object must
 * never be mutated (the undo engine snapshots by reference).
 */
import { describe, expect, test } from "bun:test";
import {
  mergeRsvpResponses,
  rsvpSummaryText,
} from "../../src/lib/sync/rsvpMerge";

const EVENT = {
  id: "event-1",
  title: "Vineyard Vows",
  guests: [
    {
      id: "guest-1",
      name: "Eleanor Vance",
      rsvp: "invited",
      plusOnes: 0,
      meal: "standard",
      group: "family",
      notes: "Aisle seat.",
    },
    {
      id: "guest-2",
      name: "Marco Rossi",
      rsvp: "attending",
      plusOnes: 1,
      meal: "standard",
      group: "friends",
      notes: "",
    },
  ],
};

describe("mergeRsvpResponses", () => {
  test("updates an existing guest from their keyed response", () => {
    const { guests, summary } = mergeRsvpResponses(EVENT, [
      {
        guestKey: "guest-1",
        name: "Eleanor Vance",
        attending: "attending",
        plusOnes: 2,
        meal: "vegetarian",
        note: "Bringing the kids!",
        isNewGuest: false,
        submittedAt: "2026-10-27T10:00:00.000Z",
      },
    ]);

    expect(summary.updated).toBe(1);
    expect(summary.added).toBe(0);
    expect(summary.confirmed).toBe(1);
    const eleanor = guests.find((g) => g.id === "guest-1");
    expect(eleanor.rsvp).toBe("attending");
    expect(eleanor.plusOnes).toBe(2);
    expect(eleanor.meal).toBe("vegetarian");
    expect(eleanor.notes).toContain("[Public RSVP 2026-10-27]");
    expect(eleanor.notes).toContain("Bringing the kids!");
    expect(eleanor.notes).toContain("Aisle seat."); // original note preserved
  });

  test("appends a flagged new guest in the rsvp group with a fresh id", () => {
    const before = EVENT.guests.map((g) => g.id);
    const { guests, summary, changes } = mergeRsvpResponses(EVENT, [
      {
        guestKey: "new:olivia-stone",
        name: "Olivia Stone",
        attending: "attending",
        plusOnes: 0,
        meal: "vegan",
        note: "",
        isNewGuest: true,
        submittedAt: "2026-10-27T11:00:00.000Z",
      },
    ]);

    expect(summary.added).toBe(1);
    const added = guests.find((g) => g.name === "Olivia Stone");
    expect(added).toBeDefined();
    expect(added.group).toBe("rsvp");
    expect(added.rsvp).toBe("attending");
    expect(added.meal).toBe("vegan");
    expect(added.notes).toContain("Added via the public RSVP page.");
    expect(before).toContain("guest-1"); // original untouched
    expect(guests.some((g) => before.includes(g.id))).toBe(true);
    expect(changes[0].isNew).toBe(true);
  });

  test("skips responses for guests the host removed", () => {
    const { guests, summary } = mergeRsvpResponses(EVENT, [
      {
        guestKey: "guest-removed",
        name: "Ghost Guest",
        attending: "attending",
        plusOnes: 0,
        isNewGuest: false,
        submittedAt: "2026-10-27T11:00:00.000Z",
      },
    ]);
    expect(summary.skipped).toBe(1);
    expect(summary.updated).toBe(0);
    expect(guests).toHaveLength(2); // nothing added
  });

  test("counts declined and tentative answers, clamps plus-ones, degrades bad attending", () => {
    const { summary } = mergeRsvpResponses(EVENT, [
      {
        guestKey: "guest-1",
        attending: "declined",
        plusOnes: 99,
        isNewGuest: false,
        submittedAt: "2026-10-27T09:00:00.000Z",
      },
      {
        guestKey: "guest-2",
        attending: "bogus",
        plusOnes: -4,
        isNewGuest: false,
        submittedAt: "2026-10-27T09:30:00.000Z",
      },
    ]);
    expect(summary.declined).toBe(1);
    expect(summary.tentative).toBe(1); // bogus -> maybe
    expect(summary.confirmed).toBe(0);
    const merged = mergeRsvpResponses(EVENT, [
      { guestKey: "guest-1", attending: "attending", plusOnes: 99, isNewGuest: false, submittedAt: "2026-10-27T09:00:00.000Z" },
    ]);
    expect(merged.guests.find((g) => g.id === "guest-1").plusOnes).toBe(5);
  });

  test("no visible change -> no change entries (idempotent re-import)", () => {
    const response = {
      guestKey: "guest-2",
      name: "Marco Rossi",
      attending: "attending",
      plusOnes: 1,
      meal: "standard",
      isNewGuest: false,
      submittedAt: "2026-10-27T09:00:00.000Z",
    };
    const first = mergeRsvpResponses(EVENT, [response]);
    const second = mergeRsvpResponses(
      { ...EVENT, guests: first.guests },
      [response]
    );
    expect(second.summary.updated).toBe(1);
    expect(second.changes).toHaveLength(0);
  });

  test("never mutates the input event or its guest objects", () => {
    const frozenEvent = JSON.parse(JSON.stringify(EVENT));
    mergeRsvpResponses(frozenEvent, [
      {
        guestKey: "guest-1",
        attending: "attending",
        plusOnes: 3,
        meal: "vegan",
        isNewGuest: false,
        submittedAt: "2026-10-27T09:00:00.000Z",
      },
      { guestKey: "new:z", name: "Zed Quill", attending: "attending", plusOnes: 0, isNewGuest: true, submittedAt: "2026-10-27T09:00:00.000Z" },
    ]);
    expect(frozenEvent).toEqual(EVENT);
  });

  test("handles empty/absent guests and non-array responses gracefully", () => {
    const { guests, summary } = mergeRsvpResponses({ id: "x" }, []);
    expect(guests).toEqual([]);
    expect(summary.imported).toBe(0);
    expect(rsvpSummaryText(summary)).toBe("No new responses.");
  });
});

describe("rsvpSummaryText", () => {
  test("weaves counts into a toast line", () => {
    const text = rsvpSummaryText({
      imported: 4,
      updated: 3,
      added: 1,
      skipped: 0,
      confirmed: 2,
      declined: 1,
      tentative: 1,
    });
    expect(text).toContain("2 confirmed");
    expect(text).toContain("1 tentative");
    expect(text).toContain("1 declined");
    expect(text).toContain("1 new guest added");
  });

  test("skipped responses are surfaced to the host", () => {
    const text = rsvpSummaryText({
      imported: 1,
      updated: 0,
      added: 0,
      skipped: 1,
      confirmed: 0,
      declined: 0,
      tentative: 1,
    });
    expect(text).toContain("1 skipped (removed guest)");
  });
});
