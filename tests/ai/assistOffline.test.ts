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
  offlinePlanReview,
  offlineTimelinePlan,
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
