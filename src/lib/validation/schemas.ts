/**
 * Zod request schemas for the GenAI theme endpoint.
 *
 * All untrusted request bodies are validated here BEFORE touching the LLM or
 * any downstream logic. Validation failures return a 400 with a field-level
 * error map — never a stack trace.
 */

import { z } from "zod";

/** Hard body-size cap enforced before parsing (see route handler). */
export const MAX_BODY_BYTES = 50 * 1024; // 50KB

export const eventBriefSchema = z
  .object({
    title: z.string().max(120).optional(),
    type: z.enum(["wedding", "birthday", "community", "other"]).optional(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
      .optional(),
    time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:MM")
      .optional(),
    location: z.string().max(160).optional(),
    guestCount: z.number().int().min(0).max(100_000).optional(),
    budget: z.number().min(0).max(100_000_000).optional(),
    description: z.string().max(600).optional(),
  })
  .strip();

export const themesRequestSchema = z
  .object({
    event: eventBriefSchema.optional(),
    customPrompt: z.string().max(2000).optional(),
  })
  .strip();

export type ThemesRequest = z.infer<typeof themesRequestSchema>;
export type EventBrief = z.infer<typeof eventBriefSchema>;

/**
 * Flatten a ZodError into a compact `{ path: message }` map for API responses.
 */
export function formatZodErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "(root)";
    if (!(path in out)) out[path] = issue.message;
  }
  return out;
}
