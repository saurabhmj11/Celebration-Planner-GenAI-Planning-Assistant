import { db } from "@/lib/db";
import { createRsvpLookupHandler } from "@/lib/rsvp/handlers";

export const runtime = "nodejs";

export const POST = createRsvpLookupHandler(db);
