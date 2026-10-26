/**
 * Timeline & milestone urgency tests.
 * Ported from the original Vite test-suite and extended with deterministic
 * reference-date cases for the urgency bands (overdue / today / urgent / upcoming).
 */
import { describe, expect, test } from "bun:test";
import {
  calculateTimelineStats,
  getDueDateUrgency,
} from "../src/utils/calculator.js";

describe("calculateTimelineStats", () => {
  test("returns zeros for empty or malformed task lists", () => {
    const empty = calculateTimelineStats([]);
    expect(empty.totalTasks).toBe(0);
    expect(empty.completedTasks).toBe(0);
    expect(empty.pendingTasks).toBe(0);
    expect(empty.progressPct).toBe(0);

    expect(calculateTimelineStats(null).totalTasks).toBe(0);
    expect(calculateTimelineStats("junk").totalTasks).toBe(0);
  });

  test("computes correct progress percentage", () => {
    const tasks = [
      { id: "1", completed: true },
      { id: "2", completed: true },
      { id: "3", completed: false },
      { id: "4", completed: false },
    ];
    const stats = calculateTimelineStats(tasks);
    expect(stats.totalTasks).toBe(4);
    expect(stats.completedTasks).toBe(2);
    expect(stats.pendingTasks).toBe(2);
    expect(stats.progressPct).toBe(50);
  });

  test("treats missing completed flag as pending", () => {
    const stats = calculateTimelineStats([{ id: "1" }, { id: "2", completed: true }]);
    expect(stats.pendingTasks).toBe(1);
    expect(stats.progressPct).toBe(50);
  });
});

describe("getDueDateUrgency", () => {
  // Fixed reference date so urgency bands are deterministic in CI.
  const ref = new Date(2026, 9, 15); // Oct 15, 2026

  test("returns null for completed tasks or missing/invalid dates", () => {
    expect(getDueDateUrgency(null, false, ref)).toBeNull();
    expect(getDueDateUrgency("2026-12-01", true, ref)).toBeNull();
    expect(getDueDateUrgency("garbage", false, ref)).toBeNull();
    expect(getDueDateUrgency("2026-13-99", false, ref)).toBeNull();
  });

  test("marks past-due milestones as overdue", () => {
    const result = getDueDateUrgency("2026-10-12", false, ref);
    expect(result?.status).toBe("overdue");
    expect(result?.diffDays).toBe(-3);
    expect(result?.label).toBe("Overdue by 3d");
  });

  test("marks same-day milestones as due today", () => {
    const result = getDueDateUrgency("2026-10-15", false, ref);
    expect(result?.status).toBe("today");
    expect(result?.label).toBe("Due Today");
  });

  test("marks within-3-day milestones as urgent", () => {
    const result = getDueDateUrgency("2026-10-17", false, ref);
    expect(result?.status).toBe("urgent");
    expect(result?.label).toBe("Due in 2d");
  });

  test("marks far-out milestones as upcoming", () => {
    const result = getDueDateUrgency("2026-11-15", false, ref);
    expect(result?.status).toBe("upcoming");
    expect(result?.diffDays).toBe(31);
  });

  test("supplies a tailwind color class for every band", () => {
    const bands = [
      getDueDateUrgency("2026-10-10", false, ref),
      getDueDateUrgency("2026-10-15", false, ref),
      getDueDateUrgency("2026-10-17", false, ref),
      getDueDateUrgency("2026-11-30", false, ref),
    ];
    for (const band of bands) {
      expect(band).not.toBeNull();
      expect(band!.color).toMatch(/text-\w+-\d+ bg-\w+-\d+ border-\w+-\d+/);
    }
  });
});
