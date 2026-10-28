import { db } from "@/lib/db";
import { createShareRsvpHandler } from "@/lib/sync/handlers";

export const runtime = "nodejs";

export const POST = createShareRsvpHandler(db);
