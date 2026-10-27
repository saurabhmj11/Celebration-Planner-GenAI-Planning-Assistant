/**
 * Smart Offline Planning Engine tests.
 *
 * The offline tier is the app's zero-latency fallback for every AI panel —
 * these tests pin the quality contracts the UI relies on:
 * shapes, counts, date safety, category exclusion, score bounds, and intent
 * routing for the chat responder.
 */
import { describe, expect, test } from "bun:test";
import {
  offlineAssistantChat,
  offlineBudgetPlan,
  offlineInvitationCopy,
  offlinePlanReview,
  offlineTimelinePlan,
  offlineVenueRecommend,
  offlineVendorInquiry,
  offlineVendorPlan,
} from "../../src/services/assistOffline";

const todayStr = () => new Date().toISOString().slice(0, 10);

describe("offlineBudgetPlan", () => {
  test("allocations sum to 100 and are within safe percent bounds", () => {
    const plan = offlineBudgetPlan({ eventType: "wedding", totalBudget: 25000, guestCount: 120 });
    const sum = plan.allocations.reduce((acc, a) => acc + a.percent, 0);
    expect(sum).toBe(100);
    for (const a of plan.allocations) {
      expect(a.percent).toBeGreaterThanOrEqual(1);
      expect(a.percent).toBeLessThanOrEqual(60);
      expect(a.category.length).toBeGreaterThan(0);
      expect(a.rationale).toContain("$");
    }
    expect(plan.tips.length).toBeGreaterThanOrEqual(3);
    expect(plan.headline.length).toBeGreaterThan(10);
  });

  test("rationales scale dollar amounts with the budget", () => {
    const small = offlineBudgetPlan({ eventType: "birthday", totalBudget: 500, guestCount: 10 });
    const big = offlineBudgetPlan({ eventType: "birthday", totalBudget: 50000, guestCount: 200 });
    expect(small.allocations[0].rationale).not.toBe(big.allocations[0].rationale);
  });

  test("event types get dedicated templates", () => {
    const wedding = offlineBudgetPlan({ eventType: "wedding", totalBudget: 1000, guestCount: 10 });
    const community = offlineBudgetPlan({ eventType: "community", totalBudget: 1000, guestCount: 10 });
    expect(wedding.headline).toContain("wedding");
    expect(community.headline).toContain("community event");
    expect(
      wedding.allocations.some((a) => a.category.includes("Attire"))
    ).toBe(true);
  });
});

describe("offlineTimelinePlan", () => {
  test("dueDates never fall after the event date and are sorted", () => {
    const plan = offlineTimelinePlan({
      eventType: "wedding",
      eventDate: "2027-06-15",
      daysUntilEvent: 240,
    });
    expect(plan.tasks.length).toBeGreaterThanOrEqual(5);
    let prev = "";
    for (const t of plan.tasks) {
      expect(/^\d{4}-\d{2}-\d{2}$/.test(t.dueDate)).toBe(true);
      expect(t.dueDate <= "2027-06-15").toBe(true);
      expect(t.dueDate >= todayStr()).toBe(true); // never scheduled in the past
      expect(prev <= t.dueDate).toBe(true);
      prev = t.dueDate;
    }
    expect(["high", "medium", "low"]).toContain(plan.tasks[0].priority);
  });

  test("compresses the plan into a short runway", () => {
    const plan = offlineTimelinePlan({
      eventType: "birthday",
      eventDate: "2026-12-24",
      daysUntilEvent: 10,
    });
    const dates = plan.tasks.map((t) => t.dueDate);
    expect(dates.every((d) => d <= "2026-12-24")).toBe(true);
    // Everything fits inside the 10-day window (>= today).
    expect(dates.every((d) => d >= todayStr())).toBe(true);
    expect(plan.headline).toContain("10 days");
  });

  test("carries the requested tone into descriptions", () => {
    const plain = offlineTimelinePlan({ eventType: "community", eventDate: "2027-01-01", daysUntilEvent: 90 });
    const themed = offlineTimelinePlan({ eventType: "community", eventDate: "2027-01-01", daysUntilEvent: 90, tone: "eco-friendly" });
    expect(themed.tasks[0].description).toContain("eco-friendly");
    expect(plain.tasks[0].description).not.toContain("eco-friendly");
  });
});

describe("offlineVendorPlan", () => {
  test("excludes categories that are already covered", () => {
    const plan = offlineVendorPlan({
      eventType: "wedding",
      totalBudget: 20000,
      existingCategories: ["Venue", "Catering", "Photography"],
    });
    const names = plan.suggestions.map((s) => s.category.toLowerCase());
    expect(names).not.toContain("venue");
    expect(names).not.toContain("catering");
    expect(plan.questions.length).toBe(6);
  });

  test("falls back to a coordinator suggestion when everything is covered", () => {
    const plan = offlineVendorPlan({
      eventType: "birthday",
      totalBudget: 2000,
      existingCategories: ["Venue", "Catering", "Entertainment", "Bakery", "Decoration", "Photography"],
    });
    expect(plan.suggestions.length).toBeGreaterThan(0);
    expect(plan.suggestions[0].category).toContain("Coordinator");
  });

  test("cost ranges scale with the budget", () => {
    const small = offlineVendorPlan({ eventType: "community", totalBudget: 1000, existingCategories: [] });
    const large = offlineVendorPlan({ eventType: "community", totalBudget: 100000, existingCategories: [] });
    expect(small.suggestions[0].estCostRange).not.toBe(large.suggestions[0].estCostRange);
    expect(large.suggestions[0].estCostRange).toContain("typical");
  });
});

describe("offlineVendorInquiry", () => {
  test("personalizes subject and body with the real event facts", () => {
    const draft = offlineVendorInquiry({
      vendorName: "Neon Nights DJ",
      vendorCategory: "Music & Entertainment",
      eventTitle: "Marcus's 30th Neon Synthwave Rooftop Party",
      eventType: "birthday",
      eventDate: "2026-12-14",
      location: "The Velvet Sky Lounge",
      guestCount: 60,
      estCost: 900,
    });
    expect(draft.subject).toContain("Marcus's 30th");
    expect(draft.subject).toContain("2026-12-14");
    expect(draft.message).toContain("Neon Nights DJ");
    expect(draft.message).toContain("60 guests");
    expect(draft.message).toContain("itemized quote");
    expect(draft.message).toContain("$900");
    expect(draft.message).not.toContain("[Name]");
  });
});

describe("offlinePlanReview", () => {
  const healthy = {
    eventTitle: "Aurora Vineyard Wedding",
    eventType: "wedding",
    daysUntilEvent: 90,
    totalBudget: 30000,
    spentSoFar: 21000,
    guestCount: 100,
    taskStats: { total: 12, completed: 9 },
    vendorStats: { total: 6, booked: 5 },
    unbookedCategories: ["Florist"],
  };

  test("a strong plan scores high and lists strengths", () => {
    const review = offlinePlanReview(healthy);
    expect(review.score).toBeGreaterThanOrEqual(70);
    expect(review.score).toBeLessThanOrEqual(100);
    expect(review.strengths.length).toBeGreaterThan(0);
    expect(review.nextActions.length).toBeGreaterThan(0);
    expect(review.summary).toContain(String(review.score));
  });

  test("an over-budget plan scores lower and flags the overrun", () => {
    const review = offlinePlanReview({ ...healthy, spentSoFar: 36000, vendorStats: { total: 6, booked: 2 } });
    const baseline = offlinePlanReview(healthy);
    expect(review.score).toBeLessThan(baseline.score);
    expect(review.risks.some((r) => r.toLowerCase().includes("budget"))).toBe(true);
  });

  test("an empty plan always produces actionable next steps", () => {
    const review = offlinePlanReview({
      eventType: "other",
      daysUntilEvent: 30,
      totalBudget: 0,
      spentSoFar: 0,
      guestCount: 0,
      taskStats: { total: 0, completed: 0 },
      vendorStats: { total: 0, booked: 0 },
      unbookedCategories: [],
    });
    expect(review.score).toBeLessThanOrEqual(100);
    expect(review.nextActions.length).toBeGreaterThanOrEqual(2);
    expect(review.strengths.length).toBeGreaterThan(0);
  });
});

describe("offlineInvitationCopy", () => {
  test("weaves the real event facts into every part of the copy", () => {
    const copy = offlineInvitationCopy({
      eventType: "wedding",
      eventTitle: "Sophia & Liam's Vineyard Wedding",
      hostName: "Sophia & Liam",
      eventDate: "2026-11-21",
      eventTime: "16:00",
      location: "Vista Winery Terrace",
      guestCount: 120,
      tone: "formal",
      themeName: "Rustic Tuscan Romance",
      rsvpDeadline: "2026-11-01",
    });

    expect(copy.headline).toContain("Sophia & Liam's Vineyard Wedding");
    expect(copy.message).toContain("2026-11-21");
    expect(copy.message).toContain("16:00");
    expect(copy.message).toContain("Vista Winery Terrace");
    expect(copy.message).toContain("120");
    expect(copy.message).toContain("Rustic Tuscan Romance");
    expect(copy.message).toContain("2026-11-01");
    expect(copy.signOff).toContain("Sophia & Liam");
  });

  test("each tone produces distinct headline and body copy", () => {
    const copies = ["warm", "formal", "playful", "elegant"].map((tone) =>
      offlineInvitationCopy({ tone, eventTitle: "The Big Bash" })
    );
    expect(new Set(copies.map((c) => c.headline)).size).toBe(4);
    expect(new Set(copies.map((c) => c.message)).size).toBe(4);
    expect(copies[1].message).toContain("cordially"); // formal opener
    expect(copies[2].message).toContain("VIP list"); // playful opener
    expect(copies[2].headline).toContain("needs you there");
  });

  test("defaults safely with an empty payload", () => {
    const copy = offlineInvitationCopy();
    expect(copy.headline.length).toBeGreaterThan(5);
    expect(copy.message).toContain("celebration");
    expect(copy.message).toContain("date to be announced");
    expect(copy.signOff).toContain("love");
  });

  test("unknown tone falls back to the warm voice", () => {
    const copy = offlineInvitationCopy({ tone: "meme", eventTitle: "X" });
    expect(copy.message).toContain("Dear friends and family");
  });

  test("headlines stay under the 90-char card cap", () => {
    const copy = offlineInvitationCopy({
      tone: "formal",
      eventTitle: "An Extremely Long And Elaborate Celebration Title That Goes On Far Longer Than Any Headline Should Ever Need To Be",
    });
    expect(copy.headline.length).toBeLessThanOrEqual(90);
  });
});

describe("offlineAssistantChat", () => {
  const ctx = {
    eventTitle: "Marcus's 30th Neon Synthwave Rooftop Party",
    eventType: "birthday",
    eventDate: "2026-12-14",
    daysUntilEvent: 49,
    totalBudget: 32000,
    spentSoFar: 29950,
    guestCount: 60,
    taskStats: { total: 10, completed: 5 },
    vendorStats: { total: 6, booked: 4 },
    unbookedCategories: ["Bakery & Cake", "Attire"],
  };

  test("routes budget intents to a budget answer with real numbers", () => {
    const res = offlineAssistantChat({ ...ctx, message: "How is my budget looking?" });
    expect(res.reply).toContain("$2,050");
    expect(res.reply.toLowerCase()).toContain("budget");
    expect(res.suggestions.length).toBe(3);
  });

  test("routes timeline intents with runway and task facts", () => {
    const res = offlineAssistantChat({ ...ctx, message: "what should I do next on the plan?" });
    expect(res.reply).toContain("49 days");
    expect(res.reply).toContain("5 of 10");
  });

  test("routes vendor intents and names the unbooked gaps", () => {
    const res = offlineAssistantChat({ ...ctx, message: "which vendors am I missing?" });
    expect(res.reply).toContain("Bakery & Cake");
    expect(res.reply).toContain("4 of 6");
  });

  test("routes creative intents toward the Theme Studio", () => {
    const res = offlineAssistantChat({ ...ctx, message: "give me decoration ideas" });
    expect(res.reply).toContain("Theme Studio");
  });

  test("steers off-topic questions back to planning help", () => {
    const res = offlineAssistantChat({ ...ctx, message: "what is the capital of France?" });
    expect(res.reply).toContain("budget");
    expect(res.suggestions.length).toBeGreaterThan(0);
  });
});

describe("offlineVenueRecommend", () => {
  const candidates = [
    {
      id: "emerald-bay-resort",
      name: "Emerald Bay Waterfront Resort",
      type: "resort",
      tags: ["resort", "lakeside", "luxury", "pool"],
      capacityMax: 350,
      rating: 4.8,
      score: 92,
      estCost: 14300,
    },
    {
      id: "riverside-pavilion",
      name: "Riverside Community Pavilion",
      type: "convention",
      tags: ["budget", "community", "pavilion"],
      capacityMax: 250,
      rating: 4.4,
      score: 61,
      estCost: 3100,
    },
  ];

  test("builds rationale for every candidate with capacity + budget notes", () => {
    const res = offlineVenueRecommend({
      eventType: "anniversary",
      eventTitle: "Silver Lakeside Anniversary",
      guestCount: 100,
      venueBudget: 15000,
      preferences: ["lakeside", "resort"],
      candidates,
    });

    expect(res.venues.length).toBe(2);
    const emerald = res.venues.find((v) => v.id === "emerald-bay-resort");
    expect(emerald?.whyItFits).toContain("100 guests");
    expect(emerald?.whyItFits).toContain("inside your venue budget");
    expect(emerald?.negotiationTip).toContain("resort");
    const riverside = res.venues.find((v) => v.id === "riverside-pavilion");
    expect(riverside?.whyItFits).toContain("3100");
    expect(res.summary).toContain("Emerald Bay");
    expect(res.tips.length).toBe(3);
  });

  test("flags over-budget estimates in the rationale", () => {
    const res = offlineVenueRecommend({
      eventType: "wedding",
      guestCount: 200,
      venueBudget: 8000,
      candidates: [candidates[0]],
    });
    expect(res.venues[0].whyItFits).toContain("over the venue slice");
  });

  test("empty shortlist degrades gracefully with booking tips", () => {
    const res = offlineVenueRecommend({ candidates: [] });
    expect(res.venues.length).toBe(0);
    expect(res.summary).toContain("adjust your preferences");
    expect(res.tips.length).toBe(3);
  });
});
