/**
 * Live guest math contract tests: calculateGuestStats (the RSVP engine that
 * flows into the headcount cards, catering cost-per-seat and meal counts)
 * and getRsvpUrgency (the deadline chase banner).
 */
import { describe, expect, test } from "bun:test";
import { calculateGuestStats, getRsvpUrgency } from "../../src/utils/calculator";

const guest = (over = {}) => ({
  name: "Guest",
  rsvp: "invited",
  plusOnes: 0,
  meal: "standard",
  group: "friends",
  ...over,
});

describe("calculateGuestStats", () => {
  test("empty or missing guest lists are all zeros, never NaN", () => {
    const empty = calculateGuestStats([]);
    expect(empty.totalGuests).toBe(0);
    expect(empty.byStatus).toEqual({ invited: 0, attending: 0, maybe: 0, declined: 0 });
    expect(empty.attendingHeadcount).toBe(0);
    expect(empty.responseRate).toBe(0);
    expect(empty.pending).toBe(0);

    const nullish = calculateGuestStats(null);
    expect(nullish.totalGuests).toBe(0);
  });

  test("headcount = attending guests + their registered plus-ones", () => {
    const stats = calculateGuestStats([
      guest({ rsvp: "attending", plusOnes: 2 }),
      guest({ rsvp: "attending", plusOnes: 0 }),
      guest({ rsvp: "attending", plusOnes: 1 }),
      guest({ rsvp: "maybe", plusOnes: 3 }),
      guest({ rsvp: "declined", plusOnes: 4 }),
      guest({ rsvp: "invited", plusOnes: 5 }),
    ]);
    expect(stats.byStatus.attending).toBe(3);
    expect(stats.plusOnesAttending).toBe(3); // only attending plus-ones count
    expect(stats.attendingHeadcount).toBe(6); // 3 guests + 3 plus-ones
  });

  test("plus-ones above 10 are clamped (mirrors the context write path)", () => {
    const stats = calculateGuestStats([guest({ rsvp: "attending", plusOnes: 99 })]);
    expect(stats.plusOnesAttending).toBe(10);
  });

  test("meal counts cover attending guests only — declined prefs are noise", () => {
    const stats = calculateGuestStats([
      guest({ rsvp: "attending", meal: "vegetarian" }),
      guest({ rsvp: "attending", meal: "vegan" }),
      guest({ rsvp: "attending", meal: "vegetarian" }),
      guest({ rsvp: "declined", meal: "vegan" }),
      guest({ rsvp: "maybe", meal: "kids" }),
    ]);
    expect(stats.mealCounts).toEqual({ vegetarian: 2, vegan: 1 });
  });

  test("response rate counts attending + maybe + declined", () => {
    const stats = calculateGuestStats([
      guest({ rsvp: "attending" }),
      guest({ rsvp: "attending" }),
      guest({ rsvp: "maybe" }),
      guest({ rsvp: "declined" }),
      guest(),
      guest(),
      guest(),
      guest(),
    ]);
    expect(stats.responded).toBe(4);
    expect(stats.responseRate).toBe(50); // 4 of 8
    expect(stats.pending).toBe(4);
  });

  test("unknown RSVP values fall back to 'invited' (pending)", () => {
    const stats = calculateGuestStats([guest({ rsvp: "teleported" })]);
    expect(stats.byStatus.invited).toBe(1);
    expect(stats.pending).toBe(1);
  });

  test("missing/invalid plusOnes coerce to zero, not NaN", () => {
    const stats = calculateGuestStats([
      guest({ rsvp: "attending", plusOnes: "abc" }),
      guest({ rsvp: "attending" }),
    ]);
    expect(stats.plusOnesAttending).toBe(0);
    expect(stats.attendingHeadcount).toBe(2);
  });

  test("groups tally per group key with a safe default", () => {
    const stats = calculateGuestStats([
      guest({ group: "family" }),
      guest({ group: "family" }),
      guest({ group: "vip" }),
      guest({ group: undefined }),
    ]);
    expect(stats.byGroup.family).toBe(2);
    expect(stats.byGroup.vip).toBe(1);
    expect(stats.byGroup.friends).toBe(1); // default bucket
  });

  test("counts the full sample wedding list correctly (regression pin)", () => {
    // Mirrors defaultData's 12-guest wedding: 6 attending (+4 plus-ones),
    // 2 maybe, 2 invited, 1 declined → 75% responded, headcount 10.
    const stats = calculateGuestStats([
      guest({ rsvp: "attending", plusOnes: 1 }),
      guest({ rsvp: "attending", plusOnes: 1 }),
      guest({ rsvp: "attending", plusOnes: 0 }),
      guest({ rsvp: "attending", plusOnes: 0 }),
      guest({ rsvp: "maybe", plusOnes: 0 }),
      guest({ rsvp: "maybe", plusOnes: 1 }),
      guest({ rsvp: "invited", plusOnes: 0 }),
      guest({ rsvp: "invited", plusOnes: 0 }),
      guest({ rsvp: "declined", plusOnes: 0 }),
      guest({ rsvp: "attending", plusOnes: 1 }),
      guest({ rsvp: "attending", plusOnes: 1 }),
      guest({ rsvp: "invited", plusOnes: 0 }),
    ]);
    expect(stats.totalGuests).toBe(12);
    expect(stats.byStatus.attending).toBe(6);
    expect(stats.plusOnesAttending).toBe(4);
    expect(stats.attendingHeadcount).toBe(10);
    expect(stats.responded).toBe(9);
    expect(stats.responseRate).toBe(75);
    expect(stats.pending).toBe(3);
  });
});

describe("getRsvpUrgency", () => {
  const REF = new Date(2026, 9, 27); // Oct 27 2026, local midnight

  test("overdue deadlines are flagged with days past", () => {
    const u = getRsvpUrgency("2026-10-20", REF);
    expect(u.status).toBe("overdue");
    expect(u.diffDays).toBe(-7);
    expect(u.label).toContain("passed 7d ago");
  });

  test("due today gets its own status", () => {
    const u = getRsvpUrgency("2026-10-27", REF);
    expect(u.status).toBe("today");
    expect(u.label).toContain("today");
  });

  test("within a week is urgent; later is upcoming", () => {
    expect(getRsvpUrgency("2026-10-30", REF).status).toBe("urgent");
    const u2 = getRsvpUrgency("2026-11-15", REF);
    expect(u2.status).toBe("upcoming");
    expect(u2.diffDays).toBe(19);
  });

  test("crosses month/year boundaries correctly", () => {
    const endOfMonth = getRsvpUrgency("2026-10-31", new Date(2026, 9, 29));
    expect(endOfMonth.diffDays).toBe(2);
    const nextMonth = getRsvpUrgency("2027-01-02", REF);
    expect(nextMonth.diffDays).toBe(67);
  });

  test("invalid or missing deadlines return null (banner hidden)", () => {
    expect(getRsvpUrgency("", REF)).toBeNull();
    expect(getRsvpUrgency("2026-13-01", REF)).toBeNull();
    expect(getRsvpUrgency("2026-02-30", REF)).toBeNull(); // non-existent day
    expect(getRsvpUrgency("garbage", REF)).toBeNull();
    expect(getRsvpUrgency(null, REF)).toBeNull();
  });

  test("shape matches getDueDateUrgency so chips render identically", () => {
    const u = getRsvpUrgency("2026-10-28", REF);
    expect(Object.keys(u).sort()).toEqual(["color", "diffDays", "label", "status"]);
    expect(u.color).toContain("border");
  });
});
