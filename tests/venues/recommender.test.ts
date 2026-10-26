/**
 * Venue recommendation algorithm tests.
 *
 * Covers the deterministic multi-factor scorer, cost estimation,
 * natural-language preference parsing (synonym expansion), capacity/budget
 * warnings, catalog integrity, and ranking behavior for the exact user
 * stories the Venue Finder must serve (e.g. "lakeside hotel resort").
 */
import { describe, expect, test } from "bun:test";
import {
  estimateVenueCost,
  parseVenuePreferences,
  scoreCapacityFit,
  scoreBudgetFit,
  scoreStyleMatch,
  scoreVenues,
  topVenueSuggestions,
} from "../../src/lib/venues/recommender";
import { VENUES } from "../../src/data/venues";

const byId = (id: string) => {
  const v = VENUES.find((x) => x.id === id);
  if (!v) throw new Error(`venue ${id} missing from catalog`);
  return v;
};

describe("catalog integrity", () => {
  test("16 venues with unique ids, valid capacities, images, coords and tags", () => {
    const ids = new Set<string>();
    for (const v of VENUES) {
      expect(ids.has(v.id)).toBe(false);
      ids.add(v.id);
      expect(v.capacity.min).toBeGreaterThan(0);
      expect(v.capacity.max).toBeGreaterThanOrEqual(v.capacity.min);
      expect(v.images.length).toBeGreaterThanOrEqual(2);
      expect(v.pricing.base).toBeGreaterThan(0);
      expect(v.pricing.perGuest).toBeGreaterThan(0);
      expect(v.tags.length).toBeGreaterThan(2);
      expect(v.affinity.other).toBeGreaterThan(0);
      expect(Math.abs(v.coords.lat)).toBeGreaterThan(0);
      expect(v.coords.lng).toBeLessThan(0); // Austin, TX is west of the meridian
      expect(v.rating).toBeGreaterThanOrEqual(3.5);
      expect(v.rating).toBeLessThanOrEqual(5);
    }
    expect(VENUES.length).toBe(16);
  });

  test("a lakeside venue AND a lakeside resort exist (user story coverage)", () => {
    const lakeside = VENUES.filter((v) => v.tags.includes("lakeside"));
    expect(lakeside.length).toBeGreaterThanOrEqual(3);
    const lakesideResort = lakeside.filter((v) => v.tags.includes("resort"));
    expect(lakesideResort.length).toBeGreaterThanOrEqual(2); // Grand Azure + Emerald Bay
  });
});

describe("estimateVenueCost", () => {
  test("base + per-guest + 10% service fee", () => {
    const venue = byId("petite-loft"); // base 1200, perGuest 30
    expect(estimateVenueCost(venue, 40)).toBe(Math.round((1200 + 30 * 40) * 1.1)); // 2640
  });

  test("zero guests -> base + fee only", () => {
    const venue = byId("petite-loft");
    expect(estimateVenueCost(venue, 0)).toBe(Math.round(1200 * 1.1));
  });
});

describe("parseVenuePreferences", () => {
  test("'lakeside hotel resort near the lake for 120 guests' expands synonyms", () => {
    const { tags, guestHint } = parseVenuePreferences(
      "a lakeside hotel resort near the lake for 120 guests",
      VENUES
    );
    expect(tags).toContain("lakeside");
    expect(tags).toContain("resort");
    expect(tags).toContain("hotel");
    expect(guestHint).toBe(120);
  });

  test("'near the water' matches waterfront/marina tags", () => {
    const { tags } = parseVenuePreferences("venue near the water", VENUES);
    expect(tags.some((t) => ["waterfront", "lakeside", "marina", "beach", "pool"].includes(t))).toBe(
      true
    );
  });

  test("stop words and empty input produce no preferences", () => {
    expect(parseVenuePreferences("", VENUES).tags).toEqual([]);
    expect(parseVenuePreferences("a venue for the and at place", VENUES).tags.length).toBe(0);
    expect(parseVenuePreferences("a venue for the and at place", VENUES).concepts.length).toBe(0);
  });

  test("budget hint parses '$9000'", () => {
    const { budgetHint } = parseVenuePreferences("something under $9000", VENUES);
    expect(budgetHint).toBe(9000);
  });
});

describe("factor scorers", () => {
  test("capacity overflow warns and heavily penalizes", () => {
    const venue = byId("petite-loft"); // max 60
    const res = scoreCapacityFit(venue, 90);
    expect(res.fit).toBeLessThanOrEqual(35);
    expect(res.warning).toContain("over capacity");
  });

  test("capacity well under minimum warns about feeling empty", () => {
    const venue = byId("congress-convention"); // min 150
    const res = scoreCapacityFit(venue, 40);
    expect(res.fit).toBeLessThanOrEqual(85);
    expect(res.warning).toBeDefined();
  });

  test("capacity sweet spot scores near 100", () => {
    const venue = byId("heritage-ballroom"); // 100-450
    expect(scoreCapacityFit(venue, 250).fit).toBeGreaterThanOrEqual(90);
  });

  test("budget: inside 70-100% of the slice scores 100, over-budget decays", () => {
    const venue = byId("riverside-pavilion"); // 900 + 18*250 + 10% fee
    const est = estimateVenueCost(venue, 250);
    // At exactly the venue budget -> sweet spot.
    expect(scoreBudgetFit(venue, 250, est).fit).toBe(100);
    // Budget slice = half the estimate -> ratio 2.0 (100% over) -> heavy penalty.
    const over = scoreBudgetFit(venue, 250, Math.round(est / 2));
    expect(over.fit).toBeLessThanOrEqual(40);
    expect(over.warning).toContain("100% over");
    // 25% over -> still scores a 60.
    expect(scoreBudgetFit(venue, 250, Math.round(est / 1.25)).fit).toBe(60);
  });

  test("style match: no preferences is neutral 60; concept misses cost", () => {
    const venue = byId("grand-azure-resort");
    expect(scoreStyleMatch(venue, [])).toBe(60);
    // Single-tag concepts (chips): full hit.
    expect(scoreStyleMatch(venue, ["resort", "hotel", "lakeside"])).toBe(100);
    // Complete concept miss -> 40 floor, not 50.
    expect(scoreStyleMatch(venue, ["barn", "rustic"])).toBe(40);
    // Concept-level: a marina venue satisfies "lake" but NOT the hotel/resort concept.
    const marina = byId("sunset-marina");
    const hotelConcept = [["hotel", "resort"]];
    expect(scoreStyleMatch(marina, [], hotelConcept)).toBe(40);
    expect(scoreStyleMatch(venue, [], hotelConcept)).toBe(100);
  });
});

describe("scoreVenues — composite ranking", () => {
  test("sorted descending, scores clamped 0-100, deterministic", () => {
    const a = scoreVenues(VENUES, {
      eventType: "wedding",
      guestCount: 120,
      venueBudget: 7000,
    });
    const b = scoreVenues(VENUES, {
      eventType: "wedding",
      guestCount: 120,
      venueBudget: 7000,
    });
    expect(a.map((s) => s.venue.id)).toEqual(b.map((s) => s.venue.id));
    for (let i = 1; i < a.length; i++) expect(a[i - 1].score).toBeGreaterThanOrEqual(a[i].score);
    for (const s of a) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
      expect(s.estCost).toBeGreaterThan(0);
      expect(s.reasons.length).toBeLessThanOrEqual(3);
    }
  });

  test("wedding ranks wedding-affinity venues over a convention hall", () => {
    const ranked = scoreVenues(VENUES, {
      eventType: "wedding",
      guestCount: 120,
      venueBudget: 8000,
    });
    const pos = (id: string) => ranked.findIndex((s) => s.venue.id === id);
    expect(pos("vineyard-vista")).toBeLessThan(pos("congress-convention"));
    expect(pos("lakeside-pavilion")).toBeLessThan(pos("congress-convention"));
    expect(pos("congress-convention")).toBeGreaterThan(0); // not #1 for a wedding
  });

  test("USER STORY: 'near the lake and hotel resort' puts a lakeside resort on top", () => {
    const ranked = scoreVenues(VENUES, {
      eventType: "anniversary",
      guestCount: 100,
      venueBudget: 15000,
      query: "a hotel resort near the lake",
    });
    const top3 = ranked.slice(0, 3).map((s) => s.venue.id);
    expect(top3).toContain("emerald-bay-resort"); // resort + lakeside + waterfront
    const winner = ranked[0].venue;
    expect(winner.tags).toContain("resort");
    expect(
      winner.tags.some((t) => ["lakeside", "waterfront", "marina"].includes(t))
    ).toBe(true);
    // A marina-only venue (no hotel/resort tag) must NOT beat the resorts for this wish.
    expect(ranked[0].breakdown.styleMatch).toBeGreaterThan(
      ranked.find((s) => s.venue.id === "sunset-marina")!.breakdown.styleMatch
    );
  });

  test("guest count is respected: 600-person gala ranks the big halls up", () => {
    const ranked = scoreVenues(VENUES, {
      eventType: "gala",
      guestCount: 600,
      venueBudget: 30000,
    });
    const top5 = ranked.slice(0, 5).map((s) => s.venue.id);
    expect(top5).toContain("congress-convention"); // seats 900
    const warnings = new Map<string, string[]>();
    ranked.forEach((s) => warnings.set(s.venue.id, s.warnings));
    expect(warnings.get("petite-loft")?.[0]).toContain("over capacity"); // 60 cap
  });

  test("topVenueSuggestions returns exactly n items", () => {
    const top3 = topVenueSuggestions(
      VENUES,
      { eventType: "birthday", guestCount: 35, venueBudget: 1500 },
      3
    );
    expect(top3.length).toBe(3);
  });
});
