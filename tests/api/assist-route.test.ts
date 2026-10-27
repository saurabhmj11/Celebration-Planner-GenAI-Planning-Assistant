/**
 * API route contract tests for POST /api/ai/assist.
 *
 * Uses the handler factory (`createAssistPostHandler`) with a deterministic
 * fake engine, so the FULL pipeline is covered without live LLM calls:
 * rate limiting -> payload caps -> JSON parsing -> discriminated-union
 * validation -> prompt assembly -> engine call -> JSON extraction ->
 * per-task normalization (clamping/rescaling) -> response shaping,
 * including the retry, 4xx and 5xx paths for all six assist tasks.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createAssistPostHandler } from "../../src/app/api/ai/assist/route";
import type { RunEngine, ChatMessage } from "../../src/lib/ai/engine";
import { resetRateLimits } from "../../src/lib/security/rateLimit";

const ENDPOINT = "http://localhost:3000/api/ai/assist";
const RATE_LIMIT_PER_MINUTE = 12;

interface FakeEngineState {
  responses: Array<{ content?: string; model?: string } | Error>;
  calls: ChatMessage[][];
}

function makeFakeEngine(state: FakeEngineState): RunEngine {
  let i = 0;
  return async (messages) => {
    state.calls.push(messages);
    const next = state.responses[Math.min(i++, state.responses.length - 1)];
    if (next instanceof Error) throw next;
    return next;
  };
}

const fenced = (obj: unknown) => "```json\n" + JSON.stringify(obj) + "\n```";

let state: FakeEngineState;
let POST: ReturnType<typeof createAssistPostHandler>;

beforeEach(() => {
  resetRateLimits();
  state = {
    responses: [{ content: "{}", model: "mock-glm" }],
    calls: [],
  };
  POST = createAssistPostHandler(makeFakeEngine(state));
});

afterEach(() => {
  resetRateLimits();
});

function makeRequest(body: unknown, init?: RequestInit): Request {
  return new Request(ENDPOINT, {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
}

/* ------------------------------------------------------------------ */
/* Happy paths — one per task                                          */
/* ------------------------------------------------------------------ */

describe("POST /api/ai/assist — happy paths", () => {
  test("budget-plan returns a rescaled allocation plan", async () => {
    state.responses = [
      {
        model: "mock-glm",
        content: fenced({
          headline: "Venue-first strategy",
          allocations: [
            { category: "Venue", percent: 40, rationale: "Biggest line" },
            { category: "Catering", percent: 30, rationale: "Per guest" },
            { category: "Photo", percent: 20, rationale: "Memories" },
            { category: "Contingency", percent: 5, rationale: "Buffer" },
          ],
          tips: ["Bundle venue+catering", "Off-season saves 20%", "Digital albums", "DIY florals"],
        }),
      },
    ];

    const res = await POST(
      makeRequest({
        task: "budget-plan",
        payload: { eventType: "wedding", totalBudget: 20000, guestCount: 100, spentSoFar: 2000 },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.task).toBe("budget-plan");
    expect(body.model).toBe("mock-glm");
    const sum = body.data.allocations.reduce((acc: number, a: { percent: number }) => acc + a.percent, 0);
    expect(sum).toBe(100);
    expect(body.data.allocations.length).toBe(4);
    expect(body.data.tips.length).toBe(4);
  });

  test("timeline-plan clamps dueDates to the event date", async () => {
    state.responses = [
      {
        content: JSON.stringify({
          headline: "Book fast",
          tasks: [
            { title: "Book venue", description: "Lock the date", dueDate: "2030-01-01", priority: "high", category: "venue" },
            { title: "Send invites", description: "RSVPs", dueDate: "2026-11-01", priority: "medium", category: "stationery" },
            { title: "Confirm headcount", description: "Final numbers", dueDate: "bad-date", priority: "high", category: "logistics" },
          ],
        }),
      },
    ];

    const res = await POST(
      makeRequest({
        task: "timeline-plan",
        payload: {
          eventType: "birthday",
          eventDate: "2026-12-05",
          daysUntilEvent: 40,
          guestCount: 25,
          totalBudget: 1500,
          tone: "neon party",
          existingTaskTitles: ["Cake order"],
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.task).toBe("timeline-plan");
    // 2030-01-01 (after the event) and "bad-date" both clamp to the event date.
    expect(body.data.tasks[1].dueDate).toBe("2026-12-05");
    expect(body.data.tasks[2].dueDate).toBe("2026-12-05");
    // Sorted chronologically.
    expect(body.data.tasks[0].title).toBe("Send invites");
    // The sanitized prompt received the tone and existing tasks.
    const userPrompt = state.calls[0][1].content;
    expect(userPrompt).toContain("neon party");
    expect(userPrompt).toContain("Cake order");
  });

  test("vendor-plan returns suggestions and questions", async () => {
    state.responses = [
      {
        content: JSON.stringify({
          headline: "Two gaps to close",
          suggestions: [
            { category: "Florist", why: "Sets the mood", estCostRange: "$300 - $600" },
            { category: "Bakery", why: "The centerpiece dessert", estCostRange: "$120 - $260" },
          ],
          questions: ["Availability?", "Itemized quote?", "Cancellation policy?", "Insurance proof?", "References?", "Day-of needs?"],
        }),
      },
    ];

    const res = await POST(
      makeRequest({
        task: "vendor-plan",
        payload: { eventType: "wedding", guestCount: 80, totalBudget: 18000, existingCategories: ["venue", "catering"] },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.suggestions.length).toBe(2);
    expect(body.data.questions.length).toBe(6);
    const userPrompt = state.calls[0][1].content;
    expect(userPrompt).toContain("venue, catering");
  });

  test("vendor-inquiry returns subject and message", async () => {
    state.responses = [
      {
        content: JSON.stringify({
          subject: "Availability for Ava's 7th — 20 guests",
          message: "Hello Sweet Creations, we are planning Ava's 7th and would love a cake quote.",
        }),
      },
    ];

    const res = await POST(
      makeRequest({
        task: "vendor-inquiry",
        payload: {
          eventType: "birthday",
          eventTitle: "Ava's 7th",
          eventDate: "2026-12-05",
          guestCount: 20,
          vendorName: "Sweet Creations",
          vendorCategory: "Bakery & Cake",
          estCost: 150,
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.subject).toContain("Ava's 7th");
    expect(body.data.message).toContain("Sweet Creations");
  });

  test("plan-review clamps the score and keeps prioritized actions", async () => {
    state.responses = [
      {
        content: JSON.stringify({
          summary: "Solid pace, tight budget.",
          score: 250,
          strengths: ["Vendors locked"],
          risks: ["Over budget by $500"],
          nextActions: ["Rebalance allocations", "Confirm headcount", "Freeze new spend"],
        }),
      },
    ];

    const res = await POST(
      makeRequest({
        task: "plan-review",
        payload: {
          eventType: "community",
          eventTitle: "Riverside Cleanup Festival",
          eventDate: "2026-11-20",
          daysUntilEvent: 25,
          totalBudget: 5000,
          spentSoFar: 5500,
          guestCount: 200,
          taskStats: { total: 10, completed: 4 },
          vendorStats: { total: 6, booked: 2 },
          upcomingTasks: [{ title: "File permits", dueDate: "2026-11-01" }],
          unbookedCategories: ["Security", "Sound"],
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.score).toBe(100); // clamped from 250
    expect(body.data.nextActions.length).toBe(3);
  });

  test("assistant-chat returns reply and suggestions", async () => {
    state.responses = [
      {
        content: JSON.stringify({
          reply: "You have $2,050 left — hold new spend until headcount is final.",
          suggestions: ["How is my timeline?", "Which vendors are missing?", "Ideas to save more?"],
        }),
      },
    ];

    const res = await POST(
      makeRequest({
        task: "assistant-chat",
        payload: {
          eventTitle: "Marcus's 30th",
          eventType: "birthday",
          totalBudget: 32000,
          spentSoFar: 29950,
          guestCount: 60,
          history: [{ role: "user", text: "budget?" }],
          message: "how is my budget looking?",
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.reply).toContain("$2,050");
    expect(body.data.suggestions.length).toBe(3);
    const userPrompt = state.calls[0][1].content;
    expect(userPrompt).toContain("User: budget?");
  });

  test("invitation-copy returns guest-facing invitation wording", async () => {
    state.responses = [
      {
        model: "mock-glm",
        content: fenced({
          headline: "You are invited to Marcus's 30th",
          message: "The rooftop goes full 80s — arcade cabinets, neon lasers, and a synthwave DJ. Kindly RSVP by 2026-11-30.",
          signOff: "Player One: Marcus",
        }),
      },
    ];

    const res = await POST(
      makeRequest({
        task: "invitation-copy",
        payload: {
          eventType: "birthday",
          eventTitle: "Marcus's 30th Neon Rooftop Party",
          hostName: "Marcus",
          eventDate: "2026-12-14",
          eventTime: "20:00",
          location: "The Velvet Sky Lounge",
          guestCount: 55,
          tone: "playful",
          themeName: "Retro Neon Synthwave",
          rsvpDeadline: "2026-11-30",
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.task).toBe("invitation-copy");
    expect(body.data.headline).toContain("Marcus");
    expect(body.data.message).toContain("RSVP");
    expect(body.data.signOff).toContain("Marcus");
    // The prompt is grounded in the real event facts.
    const userPrompt = state.calls[0][1].content;
    expect(userPrompt).toContain("playful");
    expect(userPrompt).toContain("2026-11-30");
    expect(userPrompt).toContain("Retro Neon Synthwave");
    const systemPrompt = state.calls[0][0].content;
    expect(systemPrompt).toContain("invitation wording");
  });

  test("invitation-copy defaults headline and sign-off when the model omits them", async () => {
    state.responses = [
      { content: JSON.stringify({ message: "Please come celebrate with us under the festoon lights." }) },
    ];

    const res = await POST(
      makeRequest({
        task: "invitation-copy",
        payload: { eventType: "wedding", eventTitle: "Vineyard Vows" },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.headline).toBe("You are invited to a celebration");
    expect(body.data.signOff).toBe("With love & celebration");
    expect(body.data.message).toContain("festoon");
  });

  test("venue-recommend enriches the shortlist and drops hallucinated ids", async () => {
    state.responses = [
      {
        content: fenced({
          summary: "Emerald Bay leads: lakeside resort fit for 100 anniversary guests inside budget.",
          venues: [
            {
              id: "emerald-bay-resort",
              whyItFits: "Waterfront rooms + pool pavilion host 100 guests with rooms for all.",
              negotiationTip: "Ask to waive the site fee for a Sunday anniversary brunch.",
              costSuggestion: "Includes tables/chairs; catering is separate.",
            },
            {
              id: "grand-azure-resort",
              whyItFits: "Downtown resort ballroom with lake terrace and spa packages.",
              negotiationTip: "Bundle guest-room block for a venue-fee credit.",
            },
            {
              id: "totally-made-up-venue", // hallucination — must be dropped
              whyItFits: "Looks great!",
              negotiationTip: "Pay cash.",
            },
          ],
          tips: [
            "Ask for an itemized all-in quote.",
            "Sundays are 20% cheaper.",
            "Deposit terms in writing.",
          ],
        }),
      },
    ];

    const res = await POST(
      makeRequest({
        task: "venue-recommend",
        payload: {
          eventType: "anniversary",
          eventTitle: "25th Lakeside Anniversary",
          guestCount: 100,
          venueBudget: 15000,
          preferences: ["lakeside", "resort"],
          query: "a hotel resort near the lake",
          candidates: [
            {
              id: "emerald-bay-resort",
              name: "Emerald Bay Waterfront Resort",
              type: "resort",
              tags: ["resort", "lakeside", "luxury"],
              capacityMax: 350,
              rating: 4.8,
              score: 92,
              estCost: 14300,
            },
            {
              id: "grand-azure-resort",
              name: "Grand Azure Resort & Spa",
              type: "resort",
              tags: ["resort", "hotel", "lakeside"],
              capacityMax: 420,
              rating: 4.7,
              score: 88,
              estCost: 16500,
            },
          ],
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.task).toBe("venue-recommend");
    expect(body.data.venues.length).toBe(2); // hallucinated id dropped
    expect(body.data.venues.map((v: { id: string }) => v.id)).toEqual([
      "emerald-bay-resort",
      "grand-azure-resort",
    ]);
    expect(body.data.tips.length).toBe(3);
    // The prompt must embed the algorithm shortlist (grounding).
    const userPrompt = state.calls[0][1].content;
    expect(userPrompt).toContain("emerald-bay-resort");
    expect(userPrompt).toContain("match score 92/100");
  });

  /* ---------------------------------------------------------------- */
  /* Agent Force tasks                                                 */
  /* ---------------------------------------------------------------- */

  test("seating-plan drops hallucinated ids and enforces capacity server-side", async () => {
    state.responses = [
      {
        content: JSON.stringify({
          summary: "Families together at the front.",
          assignments: [
            { tableId: "t1", guestIds: ["g1", "g2", "ghost-guest"] }, // ghost dropped
            { tableId: "t1", guestIds: ["g1"] }, // duplicate table + already-seated guest
            { tableId: "hallucinated-table", guestIds: ["g3"] }, // whole row dropped
            { tableId: "t2", guestIds: ["g3"] }, // fits
          ],
          notes: ["Kept the Rossi family together."],
        }),
      },
    ];

    const res = await POST(
      makeRequest({
        task: "seating-plan",
        payload: {
          eventType: "wedding",
          tables: [
            { id: "t1", name: "Family Table", capacity: 4 },
            { id: "t2", name: "Friends", capacity: 4 },
          ],
          guests: [
            { id: "g1", name: "Ana", group: "family", plusOnes: 1, meal: "standard" },
            { id: "g2", name: "Ben", group: "family", plusOnes: 0, meal: "vegan" },
            { id: "g3", name: "Cy", group: "friends", plusOnes: 0, meal: "standard" },
          ],
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.task).toBe("seating-plan");
    // t1 keeps g1(2 seats)+g2(1)=3<=4; ghost id dropped; dup table merged; bad table row gone
    const t1 = body.data.assignments.find((a: { tableId: string }) => a.tableId === "t1");
    const t2 = body.data.assignments.find((a: { tableId: string }) => a.tableId === "t2");
    expect(t1.guestIds).toEqual(["g1", "g2"]);
    expect(t2.guestIds).toEqual(["g3"]);
    expect(body.data.assignments).toHaveLength(2);
    expect(body.data.notes[0]).toContain("Rossi");
    // Prompt grounding: guest + table ids appear verbatim
    const userPrompt = state.calls[0][1].content;
    expect(userPrompt).toContain("party of 2"); // 1 + plusOne
    expect(userPrompt).toContain("Family Table | 4 seats");
  });

  test("seating-plan truncates overflow parties instead of trusting model math", async () => {
    state.responses = [
      {
        content: JSON.stringify({
          summary: "Tight but workable.",
          assignments: [{ tableId: "t1", guestIds: ["big1", "big2"] }],
          notes: [],
        }),
      },
    ];

    const res = await POST(
      makeRequest({
        task: "seating-plan",
        payload: {
          eventType: "wedding",
          tables: [{ id: "t1", name: "T1", capacity: 4 }],
          guests: [
            { id: "big1", name: "Party One", group: "family", plusOnes: 3, meal: "standard" }, // 4 seats
            { id: "big2", name: "Party Two", group: "friends", plusOnes: 0, meal: "standard" }, // no room left
          ],
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.assignments).toHaveLength(1);
    expect(body.data.assignments[0].guestIds).toEqual(["big1"]); // big2 dropped by capacity guard
  });

  test("payment-schedule clamps dueDates into [today, eventDate] and sorts", async () => {
    state.responses = [
      {
        content: JSON.stringify({
          summary: "Deposit now, balance two weeks out.",
          payments: [
            { label: "Venue balance", vendorName: "Venue Co", amount: 3500, kind: "balance", dueDate: "2030-01-01" }, // after event -> clamp
            { label: "Venue deposit", vendorName: "Venue Co", amount: 1500, kind: "deposit", dueDate: "2020-01-01" }, // before today -> clamp
            { label: "Catering deposit", vendorName: "Caterer", amount: 900, kind: "weird-kind", dueDate: "not-a-date" }, // bad kind/date
          ],
        }),
      },
    ];

    const res = await POST(
      makeRequest({
        task: "payment-schedule",
        payload: {
          eventType: "wedding",
          eventDate: "2026-12-05",
          today: "2026-10-27",
          totalBudget: 20000,
          vendors: [
            { name: "Venue Co", category: "venue", cost: 5000, status: "booked" },
            { name: "Caterer", category: "catering", cost: 1800, status: "deposit_paid" },
          ],
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.task).toBe("payment-schedule");
    const dates = body.data.payments.map((p: { dueDate: string }) => p.dueDate);
    expect(dates).toEqual([...dates].sort());
    expect(body.data.payments.every((p: { dueDate: string }) => p.dueDate >= "2026-10-27" && p.dueDate <= "2026-12-05")).toBe(true);
    // unknown kind falls back to milestone; invalid date falls back to the ceiling
    expect(body.data.payments[2].kind).toBe("milestone");
    expect(body.data.payments[2].dueDate).toBe("2026-12-05");
    // Prompt grounding
    expect(state.calls[0][1].content).toContain("Venue Co | venue | $5000 | booked");
  });

  test("run-sheet sorts cues, clamps durations and repairs times", async () => {
    state.responses = [
      {
        content: JSON.stringify({
          summary: "Load-in to load-out.",
          items: [
            { time: "20:00", durationMin: 999, activity: "Open floor", owner: "DJ", notes: "Requests live" },
            { time: "16:00", durationMin: 30, activity: "Doors open", owner: "" }, // empty owner -> Host
            { time: "99:99", durationMin: 10, activity: "Bad time cue", owner: "Host" }, // invalid time -> ''
            { activity: "No time at all", owner: "Host" },
          ],
        }),
      },
    ];

    const res = await POST(
      makeRequest({
        task: "run-sheet",
        payload: {
          eventType: "birthday",
          eventTitle: "Marcus's 30th",
          eventDate: "2026-12-14",
          eventTime: "20:00",
          durationHours: 6,
          venueName: "Velvet Sky Lounge",
          guestCount: 55,
          vendorCount: 3,
          vendors: ["DJ SynthWave Pulse (entertainment)"],
          highlights: ["Curate party playlist"],
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.task).toBe("run-sheet");
    const timed = body.data.items.filter((i: { time: string }) => i.time);
    const times = timed.map((i: { time: string }) => i.time);
    expect(times).toEqual([...times].sort());
    const openFloor = body.data.items.find((i: { activity: string }) => i.activity === "Open floor");
    expect(openFloor.durationMin).toBe(240); // clamped from 999
    expect(body.data.items.some((i: { owner: string }) => i.owner === "Host")).toBe(true);
    // Invalid times survive as empty strings (sorted last), not garbage
    expect(body.data.items.some((i: { time: string }) => i.time === "")).toBe(true);
    expect(state.calls[0][1].content).toContain("Marcus's 30th");
    expect(state.calls[0][1].content).toContain("Curate party playlist");
  });

  test("event-intake detects fields, clamps milestones into [today, eventDate] and rescales budget lines", async () => {
    state.responses = [
      {
        model: "mock-glm",
        content: fenced({
          title: "Ava's Enchanted 7th Birthday",
          eventType: "birthday",
          date: "2027-06-14",
          time: "15:00",
          budget: 3000,
          guestCount: 20,
          locationHint: "Willow Park",
          vibe: "sparkly garden",
          summary: "A fairy-themed 7th birthday for 20 kids.",
          confidence: "high",
          milestones: [
            // Past date → clamps to today; future date → clamps to the event date.
            { title: "Book Willow Park pavilion", description: "Reserve early.", dueDate: "2020-01-01", priority: "high", category: "venue" },
            { title: "Order the cake", description: "", dueDate: "2099-01-01", priority: "low", category: "catering" },
            { title: "Send invitations", description: "", dueDate: "2027-05-01", priority: "medium", category: "stationery" },
          ],
          budgetLines: [
            { category: "Venue & Rentals", percent: 40 },
            { category: "Catering & Cake", percent: 30 },
            { category: "Entertainment", percent: 20 },
          ],
          suggestions: ["Lock the pavilion", "Book the fairy entertainer", "Order the cake"],
        }),
      },
    ];

    const res = await POST(
      makeRequest({
        task: "event-intake",
        payload: {
          prompt: "Ava's fairy-themed 7th birthday for ~20 kids on June 14 at Willow Park, $3,000 budget",
          today: "2026-10-27",
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.task).toBe("event-intake");
    expect(body.data.title).toBe("Ava's Enchanted 7th Birthday");
    expect(body.data.eventType).toBe("birthday");
    expect(body.data.date).toBe("2027-06-14");
    expect(body.data.time).toBe("15:00");
    expect(body.data.budget).toBe(3000);
    expect(body.data.guestCount).toBe(20);
    expect(body.data.locationHint).toBe("Willow Park");
    expect(body.data.confidence).toBe("high");

    // Milestones sorted + clamped into [today, eventDate].
    expect(body.data.milestones.map((m: { dueDate: string }) => m.dueDate)).toEqual([
      "2026-10-27",
      "2027-05-01",
      "2027-06-14",
    ]);

    // Budget lines rescaled to exactly 100.
    const percentSum = body.data.budgetLines.reduce(
      (acc: number, l: { percent: number }) => acc + l.percent,
      0
    );
    expect(percentSum).toBe(100);
    expect(body.data.budgetLines.length).toBe(3);

    // Prompt grounding: verbatim description + trusted today reach the model.
    expect(state.calls[0][1].content).toContain("Ava's fairy-themed 7th birthday");
    expect(state.calls[0][1].content).toContain("2026-10-27");
  });

  test("event-intake drops milestones when no date was detected and repairs bad fields", async () => {
    state.responses = [
      {
        content: JSON.stringify({
          title: "Family Reunion Celebration",
          eventType: "pool-party", // unknown → 'other'
          date: null,
          time: "25:99", // invalid → null
          budget: -50, // negative → 0
          guestCount: "tons", // NaN → null
          milestones: [{ title: "Should be dropped", dueDate: "2027-01-01", priority: "high", category: "venue" }],
          budgetLines: [{ category: "Only One", percent: 100 }], // < 3 lines kept as-is
          suggestions: [],
          summary: "",
          confidence: "bogus", // → 'medium'
        }),
      },
    ];

    const res = await POST(
      makeRequest({
        task: "event-intake",
        payload: { prompt: "Something small and nice for the whole family", today: "2026-10-27" },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.eventType).toBe("other");
    expect(body.data.date).toBeNull();
    expect(body.data.time).toBeNull();
    expect(body.data.budget).toBe(0);
    expect(body.data.guestCount).toBeNull();
    expect(body.data.milestones).toEqual([]); // no date → never dated milestones
    expect(body.data.budgetLines).toEqual([{ category: "Only One", percent: 100 }]);
    expect(body.data.confidence).toBe("medium");
    expect(body.data.summary.length).toBeGreaterThan(0); // fallback copy
  });
});

/* ------------------------------------------------------------------ */
/* Validation & security paths                                         */
/* ------------------------------------------------------------------ */

describe("POST /api/ai/assist — guard rails", () => {
  test("405s non-POST methods", async () => {
    const res = await POST(new Request(ENDPOINT, { method: "GET" }));
    expect(res.status).toBe(405);
  });

  test("400s an unknown task", async () => {
    const res = await POST(makeRequest({ task: "teleport-guests", payload: {} }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
  });

  test("400s invalid payloads with a field map", async () => {
    const res = await POST(
      makeRequest({ task: "budget-plan", payload: { eventType: "space-rave", totalBudget: -5 } })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(Object.keys(body.fields).length).toBeGreaterThan(0);
  });

  test("400s venue-recommend without candidates", async () => {
    const res = await POST(
      makeRequest({
        task: "venue-recommend",
        payload: { eventType: "wedding", guestCount: 100, venueBudget: 5000, candidates: [] },
      })
    );
    expect(res.status).toBe(400);
  });

  test("400s unparseable JSON bodies", async () => {
    const res = await POST(makeRequest("{nope"));
    expect(res.status).toBe(400);
  });

  test("413s oversized bodies", async () => {
    const res = await POST(
      makeRequest({ task: "assistant-chat", payload: { message: "x".repeat(60_000) } })
    );
    expect(res.status).toBe(413);
  });

  test("429s after the per-minute quota with Retry-After", async () => {
    state.responses = [
      { content: JSON.stringify({ reply: "ok", suggestions: ["a?", "b?", "c?"] }) },
    ];
    const chatBody = {
      task: "assistant-chat",
      payload: { message: "hi" },
    };

    let last: Response | null = null;
    for (let i = 0; i < RATE_LIMIT_PER_MINUTE + 1; i++) {
      last = await POST(makeRequest(chatBody));
    }
    expect(last!.status).toBe(429);
    expect(Number(last!.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  test("500s (not stack-leaks) when the engine always fails", async () => {
    state.responses = [new Error("SDK exploded: secret-token-xyz")];
    const res = await POST(
      makeRequest({
        task: "assistant-chat",
        payload: { message: "hello" },
      })
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("SDK exploded");
    expect(JSON.stringify(body)).not.toContain("stack");
  });
});

/* ------------------------------------------------------------------ */
/* Retry path                                                          */
/* ------------------------------------------------------------------ */

describe("POST /api/ai/assist — resilience", () => {
  test("retries once when the first reply is not JSON", async () => {
    state.responses = [
      { content: "Sure! Here is your plan: <not json>" },
      { content: JSON.stringify({ reply: "Recovered", suggestions: ["1?", "2?", "3?"] }) },
    ];

    const res = await POST(
      makeRequest({ task: "assistant-chat", payload: { message: "help" } })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.reply).toBe("Recovered");
    expect(state.calls.length).toBe(2);
    expect(state.calls[1][1].content).toContain("could not be parsed");
  });

  test("system prompt carries the per-task capability hint", async () => {
    state.responses = [
      { content: JSON.stringify({ reply: "ok", suggestions: [] }) },
    ];
    await POST(makeRequest({ task: "assistant-chat", payload: { message: "hi" } }));
    const systemPrompt = state.calls[0][0].content;
    expect(systemPrompt).toContain("AI co-planner");
    expect(systemPrompt).toContain("conversational celebration co-pilot advice");
  });
});
