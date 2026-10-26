/**
 * GenAI assist task registry.
 *
 * Each task bundles everything needed to serve one AI capability:
 *  - buildUserPrompt: turns a validated payload into a strict JSON-only prompt
 *  - normalize: parses/coerces/clamps the model's JSON into a safe, typed shape
 *
 * Keeping prompts + normalizers as pure functions means the route stays a thin
 * orchestrator and every task is unit-testable without a live model.
 */

import { sanitizeText, isSafeDateString } from "@/lib/security/sanitize";
import type { AssistRequest } from "@/lib/validation/assistSchemas";

/** Common JSON discipline suffix appended to every user prompt. */
const JSON_RULES = `Rules:
- Output raw JSON only. No markdown fences, no commentary.
- The first character of your reply must be "{" and the last must be "}".
- Never invent or echo dangerous, hateful, or promotional content.`;

export interface AssistTask<P = unknown, N = unknown> {
  /** Compact capability description used in the system prompt. */
  systemHint: string;
  buildUserPrompt: (payload: P) => string;
  /** Returns a normalized payload, or null when the model output is unusable. */
  normalize: (parsed: unknown) => N | null;
}

const str = (v: unknown, max: number): string =>
  sanitizeText(v, { maxLength: max });

const strList = (v: unknown, maxItems: number, maxLen: number): string[] => {
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => str(item, maxLen))
    .filter((item) => item.length > 0)
    .slice(0, maxItems);
};

const clampInt = (v: unknown, min: number, max: number): number => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
};

/** Valid calendar date on/before the ceiling; falls back to the ceiling. */
const dateOnOrBefore = (v: unknown, ceiling: string): string => {
  if (isSafeDateString(v) && v <= ceiling) return v;
  return ceiling;
};

/* ------------------------------------------------------------------ */
/* 1. Budget plan                                                     */
/* ------------------------------------------------------------------ */

export interface BudgetPlanResult {
  headline: string;
  allocations: { category: string; percent: number; rationale: string }[];
  tips: string[];
}

const budgetTask: AssistTask<
  Extract<AssistRequest, { task: "budget-plan" }>["payload"],
  BudgetPlanResult
> = {
  systemHint: "smart budget allocation and money-saving strategies",
  buildUserPrompt: (p) => `
Create a smart budget allocation plan for a ${p.eventType} with:
- Total Budget: $${p.totalBudget}
- Guest Count: ${p.guestCount}
- Already Spent: $${p.spentSoFar ?? 0}

Respond strictly in valid JSON matching exactly this schema:
{
  "headline": "One-sentence money strategy for this event (under 140 chars)",
  "allocations": [
    { "category": "Category name like Venue, Catering, Photography, Decoration, Entertainment, Attire, Invitations, Contingency", "percent": 25, "rationale": "Why this share, tied to this event type & guest count (under 140 chars)" }
  ],
  "tips": ["Actionable money-saving tip specific to this event (under 160 chars)"]
}
Rules:
- 5 to 8 allocations. Percents are whole numbers 1-60 and must sum to 100.
- Exactly 4 tips, each concrete and actionable (name real trade-offs, not platitudes).
- Anchor dollar values to realistic ${p.eventType} pricing for ${p.guestCount} guests.
${JSON_RULES}`,
  normalize: (parsed) => {
    if (typeof parsed !== "object" || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;
    const rawAllocs = Array.isArray(obj.allocations) ? obj.allocations : [];
    const allocations = rawAllocs
      .map((a) => {
        if (typeof a !== "object" || a === null) return null;
        const rec = a as Record<string, unknown>;
        const category = str(rec.category, 80);
        if (!category) return null;
        return {
          category,
          percent: clampInt(rec.percent, 1, 60),
          rationale: str(rec.rationale, 200) || "Recommended share for this event profile.",
        };
      })
      .filter((a): a is BudgetPlanResult["allocations"][number] => a !== null)
      .slice(0, 8);
    if (allocations.length < 3) return null;

    // Rescale so the plan always sums to 100 (remainder lands on the first item).
    const sum = allocations.reduce((acc, a) => acc + a.percent, 0);
    if (sum > 0) {
      const scale = 100 / sum;
      let running = 0;
      allocations.forEach((a) => {
        a.percent = Math.max(1, Math.round(a.percent * scale));
        running += a.percent;
      });
      allocations[0].percent += 100 - running;
    }

    const tips = strList(obj.tips, 6, 240);
    if (tips.length < 1) return null;

    return {
      headline: str(obj.headline, 200) || "A balanced allocation plan for your celebration.",
      allocations,
      tips,
    };
  },
};

/* ------------------------------------------------------------------ */
/* 2. Timeline plan                                                   */
/* ------------------------------------------------------------------ */

export interface TimelinePlanResult {
  headline: string;
  tasks: {
    title: string;
    description: string;
    dueDate: string;
    priority: "high" | "medium" | "low";
    category: string;
  }[];
}

const timelineTask: AssistTask<
  Extract<AssistRequest, { task: "timeline-plan" }>["payload"],
  TimelinePlanResult
> = {
  systemHint: "milestone planning and deadline scheduling",
  buildUserPrompt: (p) => `
Create a personalized milestone task plan for a ${p.eventType}.
- Event Date: ${p.eventDate} (${p.daysUntilEvent} days from today)
- Guest Count: ${p.guestCount}
- Total Budget: $${p.totalBudget}
- Desired Tone: ${p.tone ? str(p.tone, 160) : "warm, memorable, well-organized"}
- Tasks already on the list (do NOT duplicate these): ${
    p.existingTaskTitles.length
      ? p.existingTaskTitles.map((t) => `"${str(t, 160)}"`).join("; ")
      : "none"
  }

Respond strictly in valid JSON matching exactly this schema:
{
  "headline": "One-sentence planning strategy given the runway (under 140 chars)",
  "tasks": [
    { "title": "Short action item (under 90 chars)", "description": "Concrete detail of what to do (under 200 chars)", "dueDate": "YYYY-MM-DD", "priority": "high|medium|low", "category": "venue|catering|decoration|photography|entertainment|logistics|stationery|attire|other" }
  ]
}
Rules:
- 6 to 12 tasks, ordered chronologically, spread across the runway to ${p.eventDate}.
- Every dueDate must be a real calendar date between today and ${p.eventDate} (inclusive).
- Priorities: "high" for bookings with long lead times or legal/venue items, "medium" for most, "low" for polish items.
${JSON_RULES}`,
  normalize: (parsed) => {
    if (typeof parsed !== "object" || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;
    const ceiling = typeof obj._ceiling === "string" ? obj._ceiling : undefined;
    const rawTasks = Array.isArray(obj.tasks) ? obj.tasks : [];
    const priorityFor = (v: unknown): "high" | "medium" | "low" =>
      v === "high" || v === "low" ? v : "medium";

    const tasks = rawTasks
      .map((t) => {
        if (typeof t !== "object" || t === null) return null;
        const rec = t as Record<string, unknown>;
        const title = str(rec.title, 140);
        if (!title) return null;
        return {
          title,
          description: str(rec.description, 280),
          dueDate: ceiling
            ? dateOnOrBefore(rec.dueDate, ceiling)
            : str(rec.dueDate, 10),
          priority: priorityFor(rec.priority),
          category: str(rec.category, 40) || "other",
        };
      })
      .filter((t): t is TimelinePlanResult["tasks"][number] => t !== null)
      .slice(0, 14);

    if (tasks.length < 3) return null;
    tasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    return {
      headline: str(obj.headline, 200) || "A phased plan to reach your celebration date.",
      tasks,
    };
  },
};

/* ------------------------------------------------------------------ */
/* 3. Vendor plan                                                     */
/* ------------------------------------------------------------------ */

export interface VendorPlanResult {
  headline: string;
  suggestions: { category: string; why: string; estCostRange: string }[];
  questions: string[];
}

const vendorTask: AssistTask<
  Extract<AssistRequest, { task: "vendor-plan" }>["payload"],
  VendorPlanResult
> = {
  systemHint: "vendor sourcing and supplier negotiation",
  buildUserPrompt: (p) => `
Recommend the vendor categories still missing for a ${p.eventType} with ${p.guestCount} guests and a $${p.totalBudget} budget.
Already covered (do NOT repeat): ${
    p.existingCategories.length
      ? p.existingCategories.map((c) => str(c, 60)).join(", ")
      : "none"
  }

Respond strictly in valid JSON matching exactly this schema:
{
  "headline": "One-sentence vendor strategy (under 140 chars)",
  "suggestions": [
    { "category": "Vendor category name (under 50 chars)", "why": "Why it matters for THIS event type (under 180 chars)", "estCostRange": "e.g. $800 - $1,500 typical for this guest count" }
  ],
  "questions": ["Sharp question to ask when contacting a vendor (under 160 chars)"]
}
Rules:
- 3 to 6 suggestions, highest impact first, excluding every covered category.
- Exactly 6 questions that reveal hidden fees, capacity, insurance, or contract traps.
- Cost ranges must be realistic for ${p.guestCount} guests at a $${p.totalBudget} budget tier.
${JSON_RULES}`,
  normalize: (parsed) => {
    if (typeof parsed !== "object" || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;
    const rawSugg = Array.isArray(obj.suggestions) ? obj.suggestions : [];
    const suggestions = rawSugg
      .map((s) => {
        if (typeof s !== "object" || s === null) return null;
        const rec = s as Record<string, unknown>;
        const category = str(rec.category, 60);
        if (!category) return null;
        return {
          category,
          why: str(rec.why, 220) || "Key category for this celebration type.",
          estCostRange: str(rec.estCostRange, 80) || "Get 3 quotes to compare",
        };
      })
      .filter((s): s is VendorPlanResult["suggestions"][number] => s !== null)
      .slice(0, 6);

    if (suggestions.length < 1) return null;
    const questions = strList(obj.questions, 8, 200);
    if (questions.length < 2) return null;

    return {
      headline: str(obj.headline, 200) || "Fill these vendor gaps next.",
      suggestions,
      questions,
    };
  },
};

/* ------------------------------------------------------------------ */
/* 4. Vendor inquiry draft                                            */
/* ------------------------------------------------------------------ */

export interface VendorInquiryResult {
  subject: string;
  message: string;
}

const inquiryTask: AssistTask<
  Extract<AssistRequest, { task: "vendor-inquiry" }>["payload"],
  VendorInquiryResult
> = {
  systemHint: "professional vendor outreach writing",
  buildUserPrompt: (p) => `
Draft a warm, professional first-contact inquiry message to a vendor.
- Vendor: ${str(p.vendorName, 120)} (${str(p.vendorCategory, 60)})
- Event: ${str(p.eventTitle, 120)} (${p.eventType}${p.eventDate ? ` on ${p.eventDate}` : ""}${p.location ? `, at ${str(p.location, 160)}` : ""})
- Guests: ${p.guestCount ?? "TBD"}${p.estCost ? `, estimated vendor budget: $${p.estCost}` : ""}

Respond strictly in valid JSON matching exactly this schema:
{
  "subject": "Email subject line (under 100 chars)",
  "message": "The full message body (under 900 chars). Ask for availability, an itemized quote, and their deposit/cancellation policy. Polite, concise, no placeholders like [Name] — address the vendor directly."
}
${JSON_RULES}`,
  normalize: (parsed) => {
    if (typeof parsed !== "object" || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;
    const message = str(obj.message, 1200);
    if (!message) return null;
    return {
      subject: str(obj.subject, 140) || "Celebration inquiry — availability & quote",
      message,
    };
  },
};

/* ------------------------------------------------------------------ */
/* 4b. Venue recommendation (hybrid: algorithm shortlist + GenAI rationale) */
/* ------------------------------------------------------------------ */

export interface VenueRecommendResult {
  summary: string;
  venues: {
    id: string;
    whyItFits: string;
    negotiationTip: string;
    costSuggestion?: string;
  }[];
  tips: string[];
}

const venueTask: AssistTask<
  Extract<AssistRequest, { task: "venue-recommend" }>["payload"],
  VenueRecommendResult
> = {
  systemHint: "venue scouting, site-visit strategy and vendor negotiation",
  buildUserPrompt: (p) => `
You are an expert venue scout. The app's recommendation algorithm pre-ranked a shortlist for a ${p.eventType}${
    p.eventTitle ? ` ("${p.eventTitle}"${p.eventDate ? ` on ${p.eventDate}` : ""})` : ""
  } with ${p.guestCount} guests and a venue budget of $${Math.round(p.venueBudget)}.
${p.preferences?.length ? `User's style preferences: ${p.preferences.map((t) => str(t, 40)).join(", ")}.` : ""}
${p.query ? `User's venue wish (free text): "${str(p.query, 300)}"` : ""}

Algorithm shortlist (already computed — do NOT invent new venues, only reference these):
${p.candidates
  .map(
    (c) =>
      `- id: ${c.id} | ${c.name} (${c.type}${c.area ? `, ${c.area}` : ""}) | tags: ${c.tags.join(
        ", "
      )} | seats up to ${c.capacityMax} | rating ${c.rating} | match score ${c.score}/100 | estimated cost $${Math.round(c.estCost)}`
  )
  .join("\n")}

Respond strictly in valid JSON matching exactly this schema:
{
  "summary": "One-sentence verdict on the best pick and why (under 200 chars)",
  "venues": [
    { "id": "the candidate id exactly as listed", "whyItFits": "Why THIS venue fits this specific event, guests, budget and style (under 180 chars)", "negotiationTip": "A specific negotiation or booking tactic for this venue type (under 160 chars)", "costSuggestion": "What is/isn't typically included at this price point (under 120 chars)" }
  ],
  "tips": ["Venue-booking tip: hidden fees to ask about, timing, deposits, rain plans (under 160 chars)"]
}
Rules:
- Cover 3 to ${p.candidates.length} venues from the shortlist — include the top algorithm pick and at least one cheaper alternative.
- Every "id" must be copied EXACTLY from the shortlist above; never invent ids.
- "whyItFits" must reference real numbers from this request (guests, budget, tags).
- Exactly 3 general tips.
${JSON_RULES}`,
  normalize: (parsed) => {
    if (typeof parsed !== "object" || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;
    // Valid ids are injected onto the parsed payload by the route via
    // withVenueCandidateIds() — same pattern as the timeline _ceiling tag.
    const rawValidIds = Array.isArray(obj._validVenueIds) ? obj._validVenueIds : [];
    const validIds = new Set(rawValidIds.map((i) => String(i)));
    const rawVenues = Array.isArray(obj.venues) ? obj.venues : [];

    // Anti-hallucination: drop anything whose id isn't in the request's shortlist.
    const seen = new Set<string>();
    const venues = rawVenues
      .map((v) => {
        if (typeof v !== "object" || v === null) return null;
        const rec = v as Record<string, unknown>;
        const id = str(rec.id, 60);
        if (!id || !validIds.has(id) || seen.has(id)) return null;
        const whyItFits = str(rec.whyItFits, 240);
        if (!whyItFits) return null;
        seen.add(id);
        return {
          id,
          whyItFits,
          negotiationTip: str(rec.negotiationTip, 220) || "Ask for an all-inclusive quote to avoid hidden fees.",
          costSuggestion: str(rec.costSuggestion, 160) || undefined,
        };
      })
      .filter((v): v is VenueRecommendResult["venues"][number] => v !== null)
      .slice(0, 6);

    const summary = str(obj.summary, 280);
    // Without id-tagging the filter above drops everything, so a missing tag
    // fails the whole response -> route retry. Conservative by design:
    // venue insights are only served when grounding is certain.
    if (!summary || venues.length < 1) return null;
    const tips = strList(obj.tips, 5, 200);

    return {
      summary,
      venues,
      tips: tips.length > 0 ? tips : ["Ask each venue for an itemized all-in quote including service fees and overtime."],
    };
  },
};

/* ------------------------------------------------------------------ */
/* 5. Plan review                                                     */
/* ------------------------------------------------------------------ */

export interface PlanReviewResult {
  summary: string;
  score: number;
  strengths: string[];
  risks: string[];
  nextActions: string[];
}

const reviewTask: AssistTask<
  Extract<AssistRequest, { task: "plan-review" }>["payload"],
  PlanReviewResult
> = {
  systemHint: "risk-aware plan auditing and prioritization",
  buildUserPrompt: (p) => `
Audit this celebration plan like a seasoned event producer:
- Event: ${str(p.eventTitle, 120)} (${p.eventType}) on ${p.eventDate} — ${p.daysUntilEvent} days from today
- Guests: ${p.guestCount}, Budget: $${p.totalBudget}, Spent so far: $${p.spentSoFar}
- Tasks: ${p.taskStats.completed}/${p.taskStats.total} completed
- Vendors: ${p.vendorStats.booked}/${p.vendorStats.total} booked; unbooked: ${
    p.unbookedCategories.length
      ? p.unbookedCategories.map((c) => str(c, 60)).join(", ")
      : "none"
  }
- Upcoming tasks: ${
    p.upcomingTasks.length
      ? p.upcomingTasks
          .map((t) => `${str(t.title, 160)}${t.dueDate ? ` (due ${t.dueDate})` : ""}`)
          .join("; ")
      : "none logged"
  }

Respond strictly in valid JSON matching exactly this schema:
{
  "summary": "Honest 2-sentence state of the plan (under 260 chars)",
  "score": 0,
  "strengths": ["What is already on track (under 180 chars)"],
  "risks": ["A specific risk with its consequence (under 180 chars)"],
  "nextActions": ["Concrete next step, phrased as an instruction (under 180 chars)"]
}
Rules:
- score is an integer 0-100 reflecting real readiness (budget discipline, runway, vendor lock-in, task completion).
- 1 to 4 strengths, 1 to 4 risks, 2 to 5 nextActions ordered by urgency.
- Reference the actual numbers above; no generic filler.
${JSON_RULES}`,
  normalize: (parsed) => {
    if (typeof parsed !== "object" || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;
    const nextActions = strList(obj.nextActions, 5, 220);
    if (nextActions.length < 1) return null;
    return {
      summary: str(obj.summary, 320) || "Plan audit complete.",
      score: clampInt(obj.score, 0, 100),
      strengths: strList(obj.strengths, 4, 220),
      risks: strList(obj.risks, 4, 220),
      nextActions,
    };
  },
};

/* ------------------------------------------------------------------ */
/* 6. Assistant chat                                                  */
/* ------------------------------------------------------------------ */

export interface AssistantChatResult {
  reply: string;
  suggestions: string[];
}

const chatTask: AssistTask<
  Extract<AssistRequest, { task: "assistant-chat" }>["payload"],
  AssistantChatResult
> = {
  systemHint: "conversational celebration co-pilot advice",
  buildUserPrompt: (p) => `
You are advising on: ${p.eventTitle ? `${p.eventTitle}` : "an unnamed celebration"}${
    p.eventType ? ` (${p.eventType})` : ""
  }${p.eventDate ? ` on ${p.eventDate}` : ""}${
    p.daysUntilEvent !== undefined ? ` — ${p.daysUntilEvent} days away` : ""
  }${p.totalBudget !== undefined ? `, budget $${p.totalBudget}` : ""}${
    p.spentSoFar !== undefined ? `, $${p.spentSoFar} spent` : ""
  }${p.guestCount !== undefined ? `, ${p.guestCount} guests` : ""}${
    p.taskStats ? `, tasks ${p.taskStats.completed}/${p.taskStats.total} done` : ""
  }${
    p.vendorStats ? `, vendors ${p.vendorStats.booked}/${p.vendorStats.total} booked` : ""
  }${
    p.unbookedCategories?.length
      ? `, unbooked: ${p.unbookedCategories.map((c) => str(c, 60)).join(", ")}`
      : ""
  }${
    p.upcomingTaskTitles?.length
      ? `, next tasks: ${p.upcomingTaskTitles.map((t) => str(t, 160)).join("; ")}`
      : ""
  }.

Conversation so far:
${
  (p.history ?? []).length
    ? (p.history ?? [])
        .map((h) => `${h.role === "user" ? "User" : "Assistant"}: ${str(h.text, 1000)}`)
        .join("\n")
    : "(new conversation)"
}
User: ${str(p.message, 1000)}

Respond strictly in valid JSON matching exactly this schema:
{
  "reply": "Your helpful answer (under 600 chars). Use the event facts above when relevant. Warm, concrete, and practical.",
  "suggestions": ["Short follow-up question the user might ask next (under 70 chars)"]
}
Rules:
- Exactly 3 suggestions.
- If asked something unrelated to events, gently steer back to planning help.
${JSON_RULES}`,
  normalize: (parsed) => {
    if (typeof parsed !== "object" || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;
    const reply = str(obj.reply, 900);
    if (!reply) return null;
    return {
      reply,
      suggestions: strList(obj.suggestions, 3, 90).slice(0, 3),
    };
  },
};

/* ------------------------------------------------------------------ */
/* Registry                                                           */
/* ------------------------------------------------------------------ */

export const ASSIST_TASK_REGISTRY = {
  "budget-plan": budgetTask,
  "timeline-plan": timelineTask,
  "vendor-plan": vendorTask,
  "vendor-inquiry": inquiryTask,
  "venue-recommend": venueTask,
  "plan-review": reviewTask,
  "assistant-chat": chatTask,
} as const;

export type AssistTaskKey = keyof typeof ASSIST_TASK_REGISTRY;

export const ASSIST_SYSTEM_PROMPT = `You are the AI co-planner inside a celebration & event planner app, with deep expertise in weddings, birthdays, community events, galas, and showers.
You always respond with STRICTLY VALID JSON — no markdown fences, no commentary, no text outside the JSON object.
Your advice is warm, concrete, budget-aware, and instantly actionable.`;

/**
 * Tag a parsed model response with the event-date ceiling so the timeline
 * normalizer can clamp dates without threading the date through the model.
 */
export function withTimelineCeiling(parsed: unknown, ceilingDate: string): unknown {
  if (typeof parsed === "object" && parsed !== null) {
    return { ...(parsed as Record<string, unknown>), _ceiling: ceilingDate };
  }
  return parsed;
}

/**
 * Tag a parsed venue-recommend response with the shortlist ids the model was
 * given, so the normalizer can drop any hallucinated venue id.
 */
export function withVenueCandidateIds(parsed: unknown, candidateIds: string[]): unknown {
  if (typeof parsed === "object" && parsed !== null) {
    return { ...(parsed as Record<string, unknown>), _validVenueIds: candidateIds };
  }
  return parsed;
}
