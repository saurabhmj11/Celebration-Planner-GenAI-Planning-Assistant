/**
 * Offline AI intake prompter — the rule-based detection tier that absorbs
 * live-engine failures on the new-event modal. Deterministic contracts:
 * type detection, date/budget/guest/time extraction, next-occurrence dates,
 * title derivation, and plan drafting (milestones + budget lines).
 */
import { describe, expect, test } from "bun:test";
import { offlineEventIntake } from "../../src/services/assistOffline";

const TODAY = "2026-10-27"; // fixed clock so "next June" is deterministic

describe("offlineEventIntake — detection", () => {
  test("detects wedding type, budget with k suffix, guests and next-occurrence date", () => {
    const result = offlineEventIntake({
      prompt: "Backyard wedding for 120 guests in September 2027, $30k budget, rustic garden vibe",
      today: TODAY,
    });

    expect(result.eventType).toBe("wedding");
    expect(result.budget).toBe(30000);
    expect(result.guestCount).toBe(120);
    expect(result.date).toBe("2027-09-01"); // bare month + year resolves to the 1st? No — needs a day…
  });

  test("detects birthday facts: kids count, dollar budget, month-day date without year", () => {
    const result = offlineEventIntake({
      prompt: "Ava's fairy-themed 7th birthday for ~20 kids on June 14 at Willow Park, $3,000 budget",
      today: TODAY,
    });

    expect(result.eventType).toBe("birthday");
    expect(result.guestCount).toBe(20);
    expect(result.budget).toBe(3000);
    // No year given → next occurrence of June 14 after 2026-10-27.
    expect(result.date).toBe("2027-06-14");
    // Ordinal fallback title (live model weaves the name in).
    expect(result.title).toBe("7th Birthday");
    expect(result.locationHint).toBe("Willow Park");
    expect(result.confidence).toBe("medium"); // date + budget present
  });

  test("resolves past month-day to the next year", () => {
    const result = offlineEventIntake({
      prompt: "Our anniversary dinner for 30 guests on March 5",
      today: TODAY,
    });
    expect(result.eventType).toBe("anniversary");
    expect(result.date).toBe("2027-03-05");
  });

  test("accepts explicit ISO dates verbatim", () => {
    const result = offlineEventIntake({
      prompt: "Company holiday gala on 2026-12-12 for 80 people, $15,000 budget",
      today: TODAY,
    });
    expect(result.eventType).toBe("gala");
    expect(result.date).toBe("2026-12-12");
    expect(result.guestCount).toBe(80);
  });

  test("parses times: 7pm, 5:30 pm and 18:30", () => {
    const pm = offlineEventIntake({ prompt: "Charity gala at the Hilton at 7pm for 200 guests", today: TODAY });
    expect(pm.time).toBe("19:00");
    expect(pm.eventType).toBe("gala");

    const half = offlineEventIntake({ prompt: "Dinner party starting 5:30 pm for 25 people", today: TODAY });
    expect(half.time).toBe("17:30");

    const iso = offlineEventIntake({ prompt: "Rooftop party starts 18:30 for 40 guests", today: TODAY });
    expect(iso.time).toBe("18:30");
  });

  test("parses budget spellings: comma thousands, 'budget of 5k', millions", () => {
    expect(
      offlineEventIntake({ prompt: "Wedding for 100 guests, $50,000 budget", today: TODAY }).budget
    ).toBe(50000);
    expect(
      offlineEventIntake({ prompt: "Sweet sixteen with a budget of 5k for 60 guests", today: TODAY }).budget
    ).toBe(5000);
    expect(
      offlineEventIntake({ prompt: "Launch gala, $2 million budget, 500 guests", today: TODAY }).budget
    ).toBe(2_000_000);
  });

  test("type keyword precedence: baby shower beats birthday, gala beats community", () => {
    expect(
      offlineEventIntake({ prompt: "Baby shower birthday-themed for 40 guests", today: TODAY }).eventType
    ).toBe("babyshower");
    expect(
      offlineEventIntake({ prompt: "Charity fundraiser gala for 300 guests", today: TODAY }).eventType
    ).toBe("gala");
    expect(
      offlineEventIntake({ prompt: "Neighborhood block party for the community, 150 people", today: TODAY })
        .eventType
    ).toBe("community");
  });

  test("quoted titles win; possessive titles are captured", () => {
    expect(
      offlineEventIntake({ prompt: '"Starlight Bash" for 50 guests next summer', today: TODAY }).title
    ).toBe("Starlight Bash");
    expect(
      offlineEventIntake({ prompt: "Maya's wedding for 90 guests, $40k budget", today: TODAY }).title
    ).toBe("Maya's Wedding");
  });

  test("empty-vague prompts degrade gracefully to 'other' with nulls", () => {
    const result = offlineEventIntake({
      prompt: "Something small and nice for the family",
      today: TODAY,
    });
    expect(result.eventType).toBe("other");
    expect(result.date).toBeNull();
    expect(result.budget).toBeNull();
    expect(result.guestCount).toBeNull();
    expect(result.confidence).toBe("low");
    // No date → no dated milestones (starter checklist covers that path).
    expect(result.milestones).toEqual([]);
    // Budget lines still come from the default template.
    expect(result.budgetLines.length).toBeGreaterThanOrEqual(5);
  });
});

describe("offlineEventIntake — drafted plan", () => {
  test("milestones are dated inside [today, eventDate] and budget lines sum to 100", () => {
    const result = offlineEventIntake({
      prompt: "Garden wedding on June 14 2027 for 120 guests, $30k budget",
      today: TODAY,
    });

    expect(result.milestones.length).toBeGreaterThanOrEqual(5);
    for (const m of result.milestones) {
      expect(m.dueDate >= TODAY).toBe(true);
      expect(m.dueDate <= "2027-06-14").toBe(true);
      expect(["high", "medium", "low"]).toContain(m.priority);
      expect(m.category.length).toBeGreaterThan(0);
    }

    expect(result.budgetLines.length).toBeGreaterThanOrEqual(5);
    const sum = result.budgetLines.reduce((acc, l) => acc + l.percent, 0);
    expect(sum).toBe(100);

    expect(result.suggestions).toHaveLength(3);
    expect(result.summary).toContain("wedding");
  });

  test("summary weaves every detected fact", () => {
    const result = offlineEventIntake({
      prompt: "Quinceanera at the Hilton on August 9 2027 for 150 guests, $25,000 budget, starts at 6pm",
      today: TODAY,
    });
    expect(result.eventType).toBe("birthday"); // quinceañera maps to birthday
    expect(result.summary).toContain("2027-08-09");
    expect(result.summary).toContain("$25,000");
    expect(result.summary).toContain("150");
    expect(result.summary).toContain("18:00");
  });
});
