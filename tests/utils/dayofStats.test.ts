/**
 * Day-of readiness calculators: payment ledger stats, seating stats
 * (weighted seats) and run-sheet stats.
 */
import { describe, expect, test } from "bun:test";
import {
  calculatePaymentStats,
  calculateSeatingStats,
  calculateRunSheetStats,
} from "../../src/utils/calculator";

const NOV_1 = new Date(2026, 10, 1); // 2026-11-01

describe("calculatePaymentStats", () => {
  test("empty / null input returns zeros with no next-due", () => {
    for (const input of [[], null, undefined]) {
      const s = calculatePaymentStats(input as never, NOV_1);
      expect(s.total).toBe(0);
      expect(s.paidTotal).toBe(0);
      expect(s.outstandingTotal).toBe(0);
      expect(s.overdueCount).toBe(0);
      expect(s.nextDue).toBeNull();
    }
  });

  test("splits paid vs outstanding and sums amounts", () => {
    const s = calculatePaymentStats(
      [
        { amount: 1000, dueDate: "2026-10-01", paid: true },
        { amount: 2500, dueDate: "2026-11-10", paid: false },
        { amount: 500, dueDate: "2026-11-20", paid: false },
      ],
      NOV_1
    );
    expect(s.total).toBe(3);
    expect(s.paidCount).toBe(1);
    expect(s.paidTotal).toBe(1000);
    expect(s.outstandingTotal).toBe(3000);
    expect(s.overdueCount).toBe(0);
  });

  test("flags overdue unpaid payments (strict calendar, past only)", () => {
    const s = calculatePaymentStats(
      [
        { amount: 100, dueDate: "2026-10-31", paid: false }, // yesterday -> overdue
        { amount: 200, dueDate: "2026-11-01", paid: false }, // today -> NOT overdue
        { amount: 300, dueDate: "2026-10-31", paid: true }, // paid -> never overdue
      ],
      NOV_1
    );
    expect(s.overdueCount).toBe(1);
    expect(s.overdueTotal).toBe(100);
  });

  test("nextDue is the earliest upcoming unpaid milestone with a label", () => {
    const s = calculatePaymentStats(
      [
        { amount: 500, dueDate: "2026-11-20", paid: false },
        { amount: 800, dueDate: "2026-11-05", paid: false },
        { amount: 900, dueDate: "2026-11-08", paid: true }, // paid excluded
      ],
      NOV_1
    );
    expect(s.nextDue).not.toBeNull();
    expect(s.nextDue!.date).toBe("2026-11-05");
    expect(s.nextDue!.diffDays).toBe(4);
    expect(s.nextDue!.label).toBe("Due in 4d");
    expect(s.nextDue!.amount).toBe(800);
  });

  test("nextDue on the same day says 'Due today'", () => {
    const s = calculatePaymentStats([{ amount: 42, dueDate: "2026-11-01", paid: false }], NOV_1);
    expect(s.nextDue!.label).toBe("Due today");
    expect(s.nextDue!.diffDays).toBe(0);
  });

  test("invalid dueDates are ignored for overdue/next-due but still counted in totals", () => {
    const s = calculatePaymentStats(
      [
        { amount: 100, dueDate: "not-a-date", paid: false },
        { amount: 100, dueDate: "2026-02-30", paid: false }, // rolls over -> invalid
      ],
      NOV_1
    );
    expect(s.total).toBe(2);
    expect(s.outstandingTotal).toBe(200);
    expect(s.overdueCount).toBe(0);
    expect(s.nextDue).toBeNull();
  });

  test("negative / NaN amounts are clamped to >= 0", () => {
    const s = calculatePaymentStats(
      [
        { amount: -50, dueDate: "2026-11-02", paid: false },
        { amount: Number.NaN, dueDate: "2026-11-02", paid: true },
      ],
      NOV_1
    );
    expect(s.outstandingTotal).toBe(0);
    expect(s.paidTotal).toBe(0);
  });
});

describe("calculateSeatingStats", () => {
  const guests = [
    { id: "g1", rsvp: "attending", plusOnes: 1 },
    { id: "g2", rsvp: "attending", plusOnes: 0 },
    { id: "g3", rsvp: "maybe", plusOnes: 2 },
    { id: "g4", rsvp: "declined", plusOnes: 0 },
  ];

  test("weighted seats: plus-ones occupy physical chairs", () => {
    const s = calculateSeatingStats(
      [
        { id: "t1", capacity: 8, seats: ["g1", "g2"] },
      ],
      guests
    );
    expect(s.seatedCount).toBe(2);
    expect(s.takenSeats).toBe(3); // g1 (2 chairs) + g2 (1 chair)
    expect(s.seatableCount).toBe(2); // attending only
    expect(s.unseatedCount).toBe(0);
    expect(s.utilizationPct).toBe(38); // 3/8
  });

  test("non-attending and stale seat ids are ignored, not counted", () => {
    const s = calculateSeatingStats(
      [{ id: "t1", capacity: 8, seats: ["g3", "ghost-id"] }],
      guests
    );
    expect(s.seatedCount).toBe(0);
    expect(s.takenSeats).toBe(0);
    expect(s.seatableCount).toBe(2);
    expect(s.unseatedCount).toBe(2);
  });

  test("over-capacity tables are flagged", () => {
    const s = calculateSeatingStats(
      [
        { id: "t1", capacity: 2, seats: ["g1", "g2"] }, // needs 3 chairs
        { id: "t2", capacity: 8, seats: [] },
      ],
      guests
    );
    expect(s.overCapacityTables).toEqual(["t1"]);
    expect(s.totalCapacity).toBe(10);
    expect(s.seatsFree).toBe(7);
  });

  test("duplicate seat across tables counts once (first table wins)", () => {
    const s = calculateSeatingStats(
      [
        { id: "t1", capacity: 8, seats: ["g1"] },
        { id: "t2", capacity: 8, seats: ["g1"] }, // stale duplicate
      ],
      guests
    );
    expect(s.seatedCount).toBe(1);
    expect(s.takenSeats).toBe(2); // t1 only; t2's copy ignored
  });

  test("empty / null inputs are safe", () => {
    const s = calculateSeatingStats([], []);
    expect(s.totalTables).toBe(0);
    expect(s.utilizationPct).toBe(0);
    expect(calculateSeatingStats(null as never, null as never).totalTables).toBe(0);
  });
});

describe("calculateRunSheetStats", () => {
  test("sorts by time, counts done, computes the program span", () => {
    const items = [
      { time: "18:30", durationMin: 90, activity: "Dinner", done: false },
      { time: "16:00", durationMin: 45, activity: "Ceremony", done: true },
      { time: "20:00", durationMin: 60, activity: "Dance", done: false },
    ];
    const s = calculateRunSheetStats(items);
    expect(s.total).toBe(3);
    expect(s.done).toBe(1);
    expect(s.pending).toBe(2);
    expect(s.progressPct).toBe(33);
    expect(s.firstAt).toBe("16:00");
    expect(s.lastAt).toBe("20:00");
    expect(s.sorted[0].activity).toBe("Ceremony");
    // 16:00 -> 21:00 end of last item = 5h span
    expect(s.spanHours).toBe(5);
  });

  test("invalid times sink to the end and are excluded from first/last", () => {
    const s = calculateRunSheetStats([
      { time: "bad", durationMin: 30, activity: "No clock", done: false },
      { time: "09:00", durationMin: 30, activity: "Setup", done: false },
    ]);
    expect(s.firstAt).toBe("09:00");
    expect(s.lastAt).toBe("09:00");
    // Untimed item still counted in totals
    expect(s.total).toBe(2);
  });

  test("empty input returns zeros", () => {
    const s = calculateRunSheetStats([]);
    expect(s.total).toBe(0);
    expect(s.progressPct).toBe(0);
    expect(s.spanHours).toBe(0);
    expect(s.firstAt).toBeNull();
  });

  test("durations are clamped into the span math (0-1440)", () => {
    const s = calculateRunSheetStats([{ time: "23:00", durationMin: 9999, activity: "Marathon", done: false }]);
    // 23:00 + 1440min clamp = next-day -> 24h span
    expect(s.spanHours).toBe(24);
  });
});
