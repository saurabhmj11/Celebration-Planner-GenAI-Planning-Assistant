import { db } from "@/lib/db";
import { createRsvpSubmitHandler } from "@/lib/rsvp/handlers";

export const runtime = "nodejs";

export const POST = createRsvpSubmitHandler(db);
