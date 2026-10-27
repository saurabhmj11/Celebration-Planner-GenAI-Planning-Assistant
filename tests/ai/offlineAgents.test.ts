/**
 * Offline Agent Force engines — the always-available tier for seating,
 * payments and run sheet. Deterministic contracts so the fallback UX is
 * testable and predictable.
 */
import { describe, expect, test } from "bun:test";
import {
  offlineSeatingPlan,
  offlinePaymentSchedule,
  offlineRunSheet,
} from "../../src/services/assistOffline";

describe("offlineSeatingPlan", () => {
  const G = (id, group, rsvp = "attending", plusOnes = 0) => ({ id, group, rsvp, plusOnes });

  test("seats every attending party when capacity allows", () => {
    const result = offlineSeatingPlan({
      eventType: "wedding",
      tables: [
        { id: "t1", name: "T1", capacity: 6 },
        { id: "t2", name: "T2", capacity: 6 },
      ],
      guests: [
        G("g1", "family", "attending", 1),
        G("g2", "family", "attending"),
        G("g3", "friends", "attending"),
        G("g4", "friends", "maybe"),
      ],
    });

    expect(result.assignments.length).toBeGreaterThan(0);
    const seated = result.assignments.flatMap((a) => a.guestIds);
    expect(seated.sort()).toEqual(["g1", "g2", "g3"]);
    expect(result.summary).toContain("3");
    expect(result.notes.length).toBeGreaterThan(0);
  });

  test("notes unseated guests when capacity runs out", () => {
    const result = offlineSeatingPlan({
      eventType: "birthday",
      tables: [{ id: "t1", name: "Only", capacity: 2 }],
      guests: [G("a", "x"), G("b", "x"), G("c", "x")],
    });
    const seated = result.assignments.flatMap((a) => a.guestIds);
    expect(seated.length).toBe(2);
    expect(result.notes.some((n) => n.includes("1 attending guest"))).toBe(true);
  });

  test("empty inputs produce an empty-but-valid plan", () => {
    const result = offlineSeatingPlan({ eventType: "other", tables: [], guests: [] });
    expect(result.assignments).toEqual([]);
    expect(result.summary).toBeTypeOf("string");
  });
});

describe("offlinePaymentSchedule", () => {
  test("booked vendors become deposit/balance pairs that sum to cost", () => {
    const result = offlinePaymentSchedule({
      eventType: "wedding",
      eventDate: "2027-06-20",
      totalBudget: 20000,
      vendors: [
        { name: "Venue Co", category: "venue", cost: 5000, status: "booked" },
        { name: "Caterer", category: "catering", cost: 3000, status: "deposit_paid" },
        { name: "Maybe DJ", category: "entertainment", cost: 800, status: "quote_received" }, // excluded
      ],
    });

    expect(result.payments.length).toBe(4); // 2 per booked vendor
    for (const v of [5000, 3000]) {
      const pair = result.payments.filter((p) => p.amount === Math.round(v * 0.3) || p.vendorName);
      expect(pair.length).toBeGreaterThan(0);
    }
    const byVendor = new Map<string, number>();
    for (const p of result.payments) {
      byVendor.set(p.vendorName!, (byVendor.get(p.vendorName!) || 0) + p.amount);
    }
    expect(byVendor.get("Venue Co")).toBe(5000);
    expect(byVendor.get("Caterer")).toBe(3000);
    expect(byVendor.has("Maybe DJ")).toBe(false);

    // Chronological, kinds and windows respected
    const dates = result.payments.map((p) => p.dueDate);
    expect([...dates].sort()).toEqual(dates);
    expect(result.payments.every((p) => p.dueDate <= "2027-06-20")).toBe(true);
    expect(result.payments.some((p) => p.kind === "deposit")).toBe(true);
    expect(result.payments.some((p) => p.kind === "balance")).toBe(true);
  });

  test("with no booked vendors, phases the total budget instead", () => {
    const result = offlinePaymentSchedule({
      eventType: "community",
      eventDate: "2027-03-27",
      totalBudget: 9000,
      vendors: [],
    });
    expect(result.payments.length).toBeGreaterThanOrEqual(4);
    const total = result.payments.reduce((s, p) => s + p.amount, 0);
    expect(Math.abs(total - 9000)).toBeLessThanOrEqual(2); // rounding tolerance
  });

  test("degenerate: zero budget and no vendors still yields a valid retainer", () => {
    const result = offlinePaymentSchedule({ eventType: "other", eventDate: "2027-01-01", totalBudget: 0, vendors: [] });
    expect(result.payments.length).toBeGreaterThan(0);
    expect(result.summary).toBeTypeOf("string");
  });
});

describe("offlineRunSheet", () => {
  test("anchored to the event time: setup 3h before, teardown after close", () => {
    const result = offlineRunSheet({
      eventType: "wedding",
      eventTitle: "Vineyard Wedding",
      eventTime: "16:00",
      vendors: ["Golden State Sound (entertainment)", "Lumiere Studios (photography)"],
      highlights: ["Confirm playlist with DJ"],
    });

    expect(result.items.length).toBeGreaterThanOrEqual(10);
    const times = result.items.map((i) => i.time);
    expect(times).toEqual([...times].sort());
    expect(times).toContain("13:00"); // 3h before 16:00
    expect(times).toContain("16:00"); // doors/moment
    expect(result.items.at(-1)!.time >= "21:00").toBe(true); // teardown last

    // Every item is a valid cue
    for (const item of result.items) {
      expect(item.time).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
      expect(item.durationMin).toBeGreaterThanOrEqual(5);
      expect(item.activity.length).toBeGreaterThan(3);
      expect(item.owner.length).toBeGreaterThan(0);
    }
  });

  test("event-type awareness: wedding gets vows + first dance, birthday gets games + cake", () => {
    const wedding = offlineRunSheet({ eventType: "wedding", eventTime: "16:00", vendors: [] });
    const birthday = offlineRunSheet({ eventType: "birthday", eventTime: "20:00", vendors: [] });
    const community = offlineRunSheet({ eventType: "community", eventTime: "10:00", vendors: [] });

    expect(wedding.items.some((i) => i.activity.includes("Ceremony & vows"))).toBe(true);
    expect(wedding.items.some((i) => i.activity.includes("First dance"))).toBe(true);
    expect(birthday.items.some((i) => i.activity.includes("Cake cutting"))).toBe(true);
    expect(birthday.items.some((i) => i.activity.includes("Games"))).toBe(true);
    expect(community.items.some((i) => i.activity.includes("opening"))).toBe(true);
  });

  test("vendor-aware owners: catering/DJ detection changes owners and notes", () => {
    const withVendors = offlineRunSheet({
      eventType: "birthday",
      eventTime: "20:00",
      vendors: ["DJ SynthWave Pulse (entertainment)"],
      highlights: [],
    });
    const djCue = withVendors.items.find((i) => /sound|DJ/i.test(i.activity));
    expect(djCue).toBeDefined();
    expect(djCue!.owner).toBe("Music & Production");
  });

  test("past-midnight items are marked instead of wrapping silently", () => {
    const late = offlineRunSheet({ eventType: "birthday", eventTime: "23:30", vendors: [] });
    expect(late.items.some((i) => i.activity.includes("(past midnight)"))).toBe(true);
  });
});
