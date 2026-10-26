/**
 * Vendor checklist stats tests.
 * Ported from the original Vite test-suite + negative-value immunity cases.
 */
import { describe, expect, test } from "bun:test";
import { calculateVendorStats } from "../src/utils/calculator.js";

describe("calculateVendorStats", () => {
  test("returns zeros for empty or malformed vendor lists", () => {
    const stats = calculateVendorStats([]);
    expect(stats.totalVendors).toBe(0);
    expect(stats.bookedCount).toBe(0);
    expect(stats.totalCommittedCost).toBe(0);

    expect(calculateVendorStats(null).totalVendors).toBe(0);
    expect(calculateVendorStats("junk").totalVendors).toBe(0);
  });

  test("aggregates booked count (booked + deposit_paid) and committed cost", () => {
    const vendors = [
      { id: "1", name: "DJ Sound", status: "booked", cost: 1200 },
      { id: "2", name: "Gourmet Catering", status: "deposit_paid", cost: 3500 },
      { id: "3", name: "Floral Studio", status: "contacted", cost: 800 },
      { id: "4", name: "Venue Grand", status: "researching", cost: 5000 },
    ];

    const stats = calculateVendorStats(vendors);
    expect(stats.totalVendors).toBe(4);
    expect(stats.bookedCount).toBe(2); // booked + deposit_paid
    expect(stats.totalCommittedCost).toBe(10500); // 1200 + 3500 + 800 + 5000
  });

  test("ignores negative and NaN costs", () => {
    const vendors = [
      { id: "1", status: "booked", cost: -100 },
      { id: "2", status: "booked", cost: NaN },
      { id: "3", status: "booked", cost: 250 },
    ];
    const stats = calculateVendorStats(vendors);
    expect(stats.bookedCount).toBe(3);
    expect(stats.totalCommittedCost).toBe(250);
  });

  test("coerces numeric-string costs", () => {
    const stats = calculateVendorStats([{ id: "1", status: "booked", cost: "900" }]);
    expect(stats.totalCommittedCost).toBe(900);
  });
});
