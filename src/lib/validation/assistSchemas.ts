/**
 * Zod request schemas for the unified GenAI assist endpoint.
 *
 * One discriminated union covers every AI capability so validation lives in a
 * single, exhaustively-tested place. Validation failures return a 400 with a
 * field-level error map — never a stack trace.
 *
 * Tasks:
 *  - budget-plan     : smart budget allocation plan + saving tips
 *  - timeline-plan   : personalized milestone/task plan relative to the event date
 *  - vendor-plan     : missing vendor categories + questions to ask vendors
 *  - vendor-inquiry  : personalized outreach message draft for one vendor
 *  - venue-recommend  : AI venue scout — rationale + negotiation tips for an
 *                       algorithm-ranked venue shortlist (anti-hallucination:
 *                       only ids from the curated catalog are accepted back)
 *  - invitation-copy : guest-facing invitation wording tuned to tone + theme
 *  - plan-review     : score + strengths + risks + next actions for the whole plan
 *  - assistant-chat  : context-aware conversational planning helper
 *  - seating-plan    : Agent Force — assign attending guests to tables (ids only
 *                       from the request are accepted back; anti-hallucination)
 *  - payment-schedule : Agent Force — deposit/balance milestones from vendors
 *  - run-sheet        : Agent Force — minute-by-minute day-of schedule
 */

import { z } from "zod";

export const ASSIST_MAX_BODY_BYTES = 50 * 1024; // 50KB

const eventTypeEnum = z.enum([
  "wedding",
  "birthday",
  "community",
  "anniversary",
  "gala",
  "babyshower",
  "other",
]);

const safeDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

const shortText = (max: number) => z.string().max(max);
const categoryList = z.array(shortText(60)).max(40);

const budgetPlanSchema = z
  .object({
    task: z.literal("budget-plan"),
    payload: z
      .object({
        eventType: eventTypeEnum,
        totalBudget: z.number().min(0).max(100_000_000),
        guestCount: z.number().int().min(0).max(100_000),
        spentSoFar: z.number().min(0).max(100_000_000).optional(),
      })
      .strip(),
  })
  .strip();

const timelinePlanSchema = z
  .object({
    task: z.literal("timeline-plan"),
    payload: z
      .object({
        eventType: eventTypeEnum,
        eventDate: safeDate,
        daysUntilEvent: z.number().int().min(-3650).max(3650),
        guestCount: z.number().int().min(0).max(100_000),
        totalBudget: z.number().min(0).max(100_000_000),
        tone: shortText(160).optional(),
        existingTaskTitles: z.array(shortText(160)).max(60),
      })
      .strip(),
  })
  .strip();

const vendorPlanSchema = z
  .object({
    task: z.literal("vendor-plan"),
    payload: z
      .object({
        eventType: eventTypeEnum,
        guestCount: z.number().int().min(0).max(100_000),
        totalBudget: z.number().min(0).max(100_000_000),
        existingCategories: categoryList,
      })
      .strip(),
  })
  .strip();

const vendorInquirySchema = z
  .object({
    task: z.literal("vendor-inquiry"),
    payload: z
      .object({
        eventType: eventTypeEnum,
        eventTitle: shortText(120),
        eventDate: safeDate.optional(),
        location: shortText(160).optional(),
        guestCount: z.number().int().min(0).max(100_000).optional(),
        vendorName: shortText(120),
        vendorCategory: shortText(60),
        estCost: z.number().min(0).max(100_000_000).optional(),
      })
      .strip(),
  })
  .strip();

const venueRecommendSchema = z
  .object({
    task: z.literal("venue-recommend"),
    payload: z
      .object({
        eventType: eventTypeEnum,
        eventTitle: shortText(120).optional(),
        eventDate: safeDate.optional(),
        guestCount: z.number().int().min(0).max(100_000),
        venueBudget: z.number().min(0).max(100_000_000),
        preferences: z.array(shortText(40)).max(8).optional(),
        query: shortText(300).optional(),
        candidates: z
          .array(
            z
              .object({
                id: shortText(60),
                name: shortText(100),
                type: shortText(40),
                area: shortText(100).optional(),
                tags: z.array(shortText(40)).max(14),
                capacityMax: z.number().int().min(1),
                rating: z.number().min(0).max(5),
                score: z.number().min(0).max(100),
                estCost: z.number().min(0),
              })
              .strip()
          )
          .min(1)
          .max(6),
      })
      .strip(),
  })
  .strip();

const planReviewSchema = z
  .object({
    task: z.literal("plan-review"),
    payload: z
      .object({
        eventType: eventTypeEnum,
        eventTitle: shortText(120),
        eventDate: safeDate,
        daysUntilEvent: z.number().int().min(-3650).max(3650),
        totalBudget: z.number().min(0).max(100_000_000),
        spentSoFar: z.number().min(0).max(100_000_000),
        guestCount: z.number().int().min(0).max(100_000),
        taskStats: z.object({ total: z.number().int().min(0), completed: z.number().int().min(0) }),
        vendorStats: z.object({ total: z.number().int().min(0), booked: z.number().int().min(0) }),
        upcomingTasks: z
          .array(z.object({ title: shortText(160), dueDate: safeDate.optional() }))
          .max(5),
        unbookedCategories: categoryList,
        guestStats: z
          .object({
            total: z.number().int().min(0),
            attending: z.number().int().min(0),
            pending: z.number().int().min(0),
          })
          .optional(),
        rsvpDaysLeft: z.number().int().min(-3650).max(3650).optional(),
      })
      .strip(),
  })
  .strip();

const assistantChatSchema = z
  .object({
    task: z.literal("assistant-chat"),
    payload: z
      .object({
        eventTitle: shortText(120).optional(),
        eventType: eventTypeEnum.optional(),
        eventDate: safeDate.optional(),
        daysUntilEvent: z.number().int().min(-3650).max(3650).optional(),
        totalBudget: z.number().min(0).max(100_000_000).optional(),
        spentSoFar: z.number().min(0).max(100_000_000).optional(),
        guestCount: z.number().int().min(0).max(100_000).optional(),
        taskStats: z.object({ total: z.number().int().min(0), completed: z.number().int().min(0) }).optional(),
        vendorStats: z.object({ total: z.number().int().min(0), booked: z.number().int().min(0) }).optional(),
        unbookedCategories: categoryList.optional(),
        upcomingTaskTitles: z.array(shortText(160)).max(5).optional(),
        guestStats: z
          .object({
            total: z.number().int().min(0),
            attending: z.number().int().min(0),
            pending: z.number().int().min(0),
          })
          .optional(),
        rsvpDaysLeft: z.number().int().min(-3650).max(3650).optional(),
        history: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              text: shortText(1000),
            })
          )
          .max(12)
          .optional(),
        message: z.string().min(1).max(1000),
      })
      .strip(),
  })
  .strip();

const invitationCopySchema = z
  .object({
    task: z.literal("invitation-copy"),
    payload: z
      .object({
        eventType: eventTypeEnum,
        eventTitle: shortText(120),
        hostName: shortText(120).optional(),
        eventDate: safeDate.optional(),
        eventTime: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:MM")
          .optional(),
        location: shortText(200).optional(),
        guestCount: z.number().int().min(0).max(100_000).optional(),
        tone: z.enum(["warm", "formal", "playful", "elegant"]).optional(),
        themeName: shortText(120).optional(),
        rsvpDeadline: safeDate.optional(),
      })
      .strip(),
  })
  .strip();

const seatingPlanSchema = z
  .object({
    task: z.literal("seating-plan"),
    payload: z
      .object({
        eventType: eventTypeEnum,
        tables: z
          .array(
            z
              .object({
                id: shortText(60),
                name: shortText(60),
                capacity: z.number().int().min(1).max(50),
              })
              .strip()
          )
          .min(1)
          .max(30),
        guests: z
          .array(
            z
              .object({
                id: shortText(60),
                name: shortText(80),
                group: shortText(40),
                plusOnes: z.number().int().min(0).max(10),
                meal: shortText(30),
                notes: shortText(120).optional(),
              })
              .strip()
          )
          .min(0)
          .max(150),
      })
      .strip(),
  })
  .strip();

const paymentScheduleSchema = z
  .object({
    task: z.literal("payment-schedule"),
    payload: z
      .object({
        eventType: eventTypeEnum,
        eventDate: safeDate,
        today: safeDate,
        totalBudget: z.number().min(0).max(100_000_000),
        vendors: z
          .array(
            z
              .object({
                name: shortText(80),
                category: shortText(40),
                cost: z.number().min(0).max(100_000_000),
                status: shortText(30),
              })
              .strip()
          )
          .min(0)
          .max(30),
      })
      .strip(),
  })
  .strip();

const runSheetSchema = z
  .object({
    task: z.literal("run-sheet"),
    payload: z
      .object({
        eventType: eventTypeEnum,
        eventTitle: shortText(120),
        eventDate: safeDate,
        eventTime: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:MM"),
        durationHours: z.number().min(1).max(18),
        venueName: shortText(160).optional(),
        guestCount: z.number().int().min(0).max(100_000),
        vendorCount: z.number().int().min(0).max(500),
        vendors: z.array(shortText(80)).max(15),
        highlights: z.array(shortText(90)).max(8),
      })
      .strip(),
  })
  .strip();

export const assistRequestSchema = z.discriminatedUnion("task", [
  budgetPlanSchema,
  timelinePlanSchema,
  vendorPlanSchema,
  vendorInquirySchema,
  venueRecommendSchema,
  invitationCopySchema,
  planReviewSchema,
  assistantChatSchema,
  seatingPlanSchema,
  paymentScheduleSchema,
  runSheetSchema,
]);

export type AssistRequest = z.infer<typeof assistRequestSchema>;

export const ASSIST_TASKS = [
  "budget-plan",
  "timeline-plan",
  "vendor-plan",
  "vendor-inquiry",
  "venue-recommend",
  "invitation-copy",
  "plan-review",
  "assistant-chat",
  "seating-plan",
  "payment-schedule",
  "run-sheet",
] as const;

export type AssistTaskId = (typeof ASSIST_TASKS)[number];
