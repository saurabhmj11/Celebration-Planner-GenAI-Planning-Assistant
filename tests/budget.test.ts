/**
 * Budget calculation tests.
 * Ported from the original Vite test-suite and extended with edge cases:
 * negative-value immunity, string-number coercion, and budget-warning bands.
 */
import { describe, expect, test } from "bun:test";
import {
  calculateBudgetTotals,
  calculateCategoryBreakdown,
} from "../src/utils/calculator.js";

describe("calculateBudgetTotals", () => {
  test("handles empty / null event safely", () => {
    const result = calculateBudgetTotals(null);
    expect(result.totalBudget).toBe(0);
    expect(result.totalSpent).toBe(0);
    expect(result.totalAllocated).toBe(0);
    expect(result.remainingBudget).toBe(0);
    expect(result.isOverBudget).toBe(false);
    expect(result.isAllocatedOver).toBe(false);
    expect(result.spentPct).toBe(0);
    expect(result.costPerGuest).toBe(0);
  });

  test("handles a malformed event object without throwing", () => {
    const result = calculateBudgetTotals({
      budget: "not-a-number",
      guestCount: undefined,
      expenses: "oops",
    } as unknown as Record<string, unknown>);
    expect(result.totalBudget).toBe(0);
    expect(result.totalSpent).toBe(0);
    expect(result.costPerGuest).toBe(0);
  });

  test("computes accurate spend and remaining balance", () => {
    const sampleEvent = {
      budget: 10000,
      guestCount: 50,
      expenses: [
        { id: "1", spent: 3000, allocated: 3500 },
        { id: "2", spent: 2500, allocated: 2500 },
        { id: "3", spent: 500, allocated: 1000 },
      ],
    };

    const totals = calculateBudgetTotals(sampleEvent);
    expect(totals.totalBudget).toBe(10000);
    expect(totals.totalSpent).toBe(6000);
    expect(totals.totalAllocated).toBe(7000);
    expect(totals.remainingBudget).toBe(4000);
    expect(totals.isOverBudget).toBe(false);
    expect(totals.spentPct).toBe(60);
    expect(totals.costPerGuest).toBe(120);
  });

  test("flags isOverBudget when expenses exceed the ceiling", () => {
    const overEvent = {
      budget: 5000,
      expenses: [
        { id: "1", spent: 4000 },
        { id: "2", spent: 2000 },
      ],
    };

    const totals = calculateBudgetTotals(overEvent);
    expect(totals.totalSpent).toBe(6000);
    expect(totals.remainingBudget).toBe(-1000);
    expect(totals.isOverBudget).toBe(true);
    expect(totals.spentPct).toBe(120);
  });

  test("flags isAllocatedOver when allocations exceed budget but spend does not", () => {
    const event = {
      budget: 5000,
      expenses: [{ id: "1", spent: 1000, allocated: 9000 }],
    };
    const totals = calculateBudgetTotals(event);
    expect(totals.isOverBudget).toBe(false);
    expect(totals.isAllocatedOver).toBe(true);
  });

  test("coerces numeric strings and ignores negative / NaN values", () => {
    const event = {
      budget: "8000",
      guestCount: "40",
      expenses: [
        { id: "1", spent: "1500" },
        { id: "2", spent: -500 },
        { id: "3", spent: NaN },
      ],
    };
    const totals = calculateBudgetTotals(event as unknown as Record<string, unknown>);
    expect(totals.totalBudget).toBe(8000);
    expect(totals.totalSpent).toBe(1500);
    expect(totals.remainingBudget).toBe(6500);
    expect(totals.costPerGuest).toBe(38); // 1500 / 40 rounded
  });

  test("zero budget never divides by zero", () => {
    const totals = calculateBudgetTotals({ budget: 0, expenses: [{ spent: 10 }] });
    expect(totals.spentPct).toBe(0);
    expect(totals.costPerGuest).toBe(10); // guestCount falls back to 1
  });
});

describe("calculateCategoryBreakdown", () => {
  const categories = [
    { id: "venue", label: "Venue & Rentals" },
    { id: "catering", label: "Catering & Beverages" },
  ];

  test("groups expenses by category accurately", () => {
    const expenses = [
      { id: "1", category: "venue", spent: 2000, allocated: 2500 },
      { id: "2", category: "venue", spent: 1000, allocated: 1000 },
      { id: "3", category: "catering", spent: 1500, allocated: 2000 },
    ];

    const breakdown = calculateCategoryBreakdown(categories, expenses, 10000);
    expect(breakdown).toHaveLength(2);

    const venue = breakdown[0];
    expect(venue.spent).toBe(3000);
    expect(venue.allocated).toBe(3500);
    expect(venue.itemCount).toBe(2);
    expect(venue.pctOfBudget).toBe(30); // 3000/10000

    const catering = breakdown[1];
    expect(catering.spent).toBe(1500);
    expect(catering.itemCount).toBe(1);
    expect(catering.pctOfBudget).toBe(15); // 1500/10000
  });

  test("returns empty array for non-array categories and ignores malformed expenses", () => {
    expect(calculateCategoryBreakdown(null, [], 1000)).toEqual([]);
    const breakdown = calculateCategoryBreakdown(categories, "junk", 1000);
    expect(breakdown[0].spent).toBe(0);
    expect(breakdown[0].itemCount).toBe(0);
  });
});
