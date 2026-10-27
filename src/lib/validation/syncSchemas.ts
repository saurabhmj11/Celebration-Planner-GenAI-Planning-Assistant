/**
 * Zod request schemas for the cloud-sync account + sync + public RSVP APIs.
 *
 * Same discipline as assistSchemas.ts: validation failures return a 400 with
 * a field-level error map — never a stack trace, never a silent coercion.
 */
import { z } from "zod";

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const safeDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const shortText = (max: number) => z.string().max(max);

export const emailField = z
  .string()
  .min(5, "Email is too short.")
  .max(320)
  .regex(EMAIL_RE, "Enter a valid email address.");

/* ---------------- Auth ---------------- */

export const registerSchema = z
  .object({
    email: emailField,
    name: shortText(80).optional(),
    password: z.string().min(8, "Password must be at least 8 characters.").max(200),
  })
  .strip();

export const loginSchema = z
  .object({
    email: emailField,
    password: z.string().min(1, "Password is required.").max(200),
  })
  .strip();

/* ---------------- Sync ---------------- */

export const SYNC_MAX_SNAPSHOT_CHARS = 2_500_000; // 2.5MB hard cap per event
export const SYNC_COLLECTION_CAP = 600;

export const syncPushSchema = z
  .object({
    localId: z
      .string()
      .min(4)
      .max(80)
      .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/, "Invalid event id."),
    title: shortText(120).min(1, "Title is required."),
    eventType: shortText(40).min(1),
    eventDate: safeDate.nullish(),
    snapshot: z.string().min(2).max(SYNC_MAX_SNAPSHOT_CHARS),
  })
  .strip();

export const ackResponsesSchema = z
  .object({
    guestKeys: z.array(shortText(120)).min(1).max(600),
  })
  .strip();

/* ---------------- Public RSVP ---------------- */

export const rsvpLookupSchema = z
  .object({
    token: z.string().min(10).max(80),
    nameQuery: z.string().min(2, "Type at least 2 characters.").max(80),
  })
  .strip();

export const ATTENDING_VALUES = ["attending", "maybe", "declined"] as const;

export const rsvpSubmitSchema = z
  .object({
    token: z.string().min(10).max(80),
    guestKey: shortText(120).optional(),
    name: shortText(80).optional(),
    attending: z.enum(ATTENDING_VALUES),
    plusOnes: z.number().int().min(0).max(5),
    meal: shortText(40).optional(),
    note: shortText(400).optional(),
  })
  .strip();
