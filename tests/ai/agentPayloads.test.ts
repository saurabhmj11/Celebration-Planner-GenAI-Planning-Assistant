/**
 * Agent Force payload builders — the compression layer between the live
 * event object and the validated assist-task context.
 */
import { describe, expect, test } from "bun:test";
import {
  buildSeatingPayload,
  buildPaymentsPayload,
  buildRunSheetPayload,
  buildAuditPayload,
} from "../../src/lib/agents/payloads";

describe("buildSeatingPayload", () => {
  test("attending guests only, with table roster and weights", () => {
    const payload = buildSeatingPayload({
      type: "wedding",
      seating: { tables: [{ id: "t1", name: "Family", capacity: 8 }] },
      guests: [
        { id: "g1", name: "Ana", group: "family", rsvp: "attending", plusOnes: 2, meal: "vegan", notes: "x".repeat(400) },
        { id: "g2", name: "Ben", group: "friends", rsvp: "maybe", plusOnes: 0, meal: "standard" },
        { id: "g3", name: "Cy", group: "friends", rsvp: "declined", plusOnes: 1, meal: "standard" },
      ],
    });

    expect(payload.eventType).toBe("wedding");
    expect(payload.tables).toHaveLength(1);
    expect(payload.tables[0]).toEqual({ id: "t1", name: "Family", capacity: 8 });
    expect(payload.guests).toHaveLength(1);
    expect(payload.guests[0].id).toBe("g1");
    expect(payload.guests[0].plusOnes).toBe(2);
    expect(payload.guests[0].notes.length).toBeLessThanOrEqual(120);
  });

  test("unknown event types fall back to 'other'; missing seating is safe", () => {
    const payload = buildSeatingPayload({ type: "gala-fantasy", guests: [] });
    expect(payload.eventType).toBe("other");
    expect(payload.tables).toEqual([]);
    expect(payload.guests).toEqual([]);
    expect(buildSeatingPayload(null as never).eventType).toBe("other");
  });
});

describe("buildPaymentsPayload", () => {
  test("vendors carried with costs and statuses; today is included", () => {
    const payload = buildPaymentsPayload({
      type: "birthday",
      date: "2026-12-14",
      budget: 6500,
      vendors: [
        { name: "Velvet Sky Rooftop", category: "venue", cost: 2400, status: "booked" },
        { name: "DJ Pulse", category: "entertainment", cost: 750, status: "quote_received" },
      ],
    });

    expect(payload.eventType).toBe("birthday");
    expect(payload.eventDate).toBe("2026-12-14");
    expect(payload.totalBudget).toBe(6500);
    expect(payload.vendors).toHaveLength(2);
    expect(payload.vendors[0]).toEqual({ name: "Velvet Sky Rooftop", category: "venue", cost: 2400, status: "booked" });
    expect(payload.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("invalid date falls back to today; costs clamped >= 0", () => {
    const payload = buildPaymentsPayload({ type: "other", date: "nope", budget: -5, vendors: [{ cost: -100 }] });
    expect(payload.eventDate).toBe(payload.today);
    expect(payload.totalBudget).toBe(0);
    expect(payload.vendors[0].cost).toBe(0);
  });
});

describe("buildRunSheetPayload", () => {
  test("anchors to event time, booked vendors and open tasks", () => {
    const payload = buildRunSheetPayload({
      type: "wedding",
      title: "Sophia & Liam's Sunset Vineyard Wedding",
      date: "2026-11-20",
      time: "16:00",
      location: "Napa Valley Vista Winery",
      guestCount: 120,
      vendors: [
        { name: "Golden State Sound", category: "entertainment", status: "booked" },
        { name: "Tent Co", category: "rentals", status: "researching" }, // excluded
      ],
      tasks: [
        { title: "Confirm playlist with DJ", completed: false },
        { title: "Book venue", completed: true }, // excluded
      ],
    });

    expect(payload.eventType).toBe("wedding");
    expect(payload.eventTime).toBe("16:00");
    expect(payload.venueName).toBe("Napa Valley Vista Winery");
    expect(payload.vendorCount).toBe(1);
    expect(payload.vendors).toEqual(["Golden State Sound (entertainment)"]);
    expect(payload.highlights).toEqual(["Confirm playlist with DJ"]);
    expect(payload.durationHours).toBe(6);
  });

  test("defaults: bad time -> 17:00, missing title -> fallback", () => {
    const payload = buildRunSheetPayload({ type: "other", time: "25:99" });
    expect(payload.eventTime).toBe("17:00");
    expect(payload.eventTitle).toBe("Your celebration");
    expect(payload.vendors).toEqual([]);
    expect(payload.highlights).toEqual([]);
  });
});

describe("buildAuditPayload", () => {
  test("weaves task/vendor/guest/budget stats into one snapshot", () => {
    const payload = buildAuditPayload({
      type: "wedding",
      title: "Vineyard Wedding",
      date: "2026-11-20",
      budget: 32000,
      guestCount: 120,
      expenses: [{ spent: 9500 }, { spent: 7800 }],
      tasks: [
        { title: "A", completed: true },
        { title: "B", completed: false, dueDate: "2026-11-01" },
        { title: "C", completed: false, dueDate: "2026-10-28" },
      ],
      vendors: [
        { category: "venue", status: "booked" },
        { category: "catering", status: "booked" },
        { category: "photography", status: "researching" },
      ],
      guests: [
        { rsvp: "attending", plusOnes: 1 },
        { rsvp: "attending", plusOnes: 0 },
        { rsvp: "invited", plusOnes: 0 },
      ],
    });

    expect(payload.eventType).toBe("wedding");
    expect(payload.totalBudget).toBe(32000);
    expect(payload.spentSoFar).toBe(17300);
    expect(payload.taskStats).toEqual({ total: 3, completed: 1 });
    expect(payload.vendorStats).toEqual({ total: 3, booked: 2 });
    expect(payload.unbookedCategories).toEqual(["photography"]);
    expect(payload.guestStats).toEqual({ total: 3, attending: 3, pending: 1 });
    // Upcoming tasks: earliest-due first, max 5
    expect(payload.upcomingTasks.map((t: { title: string }) => t.title)).toEqual(["C", "B"]);
    expect(typeof payload.daysUntilEvent).toBe("number");
  });

  test("empty event degrades safely", () => {
    const payload = buildAuditPayload({});
    expect(payload.eventType).toBe("other");
    expect(payload.taskStats.total).toBe(0);
    expect(payload.unbookedCategories).toEqual([]);
    expect(payload.guestStats.total).toBe(0);
  });
});
