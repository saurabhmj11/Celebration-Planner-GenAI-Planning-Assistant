import { db } from "@/lib/db";
import { createAckResponsesHandler } from "@/lib/sync/handlers";

export const runtime = "nodejs";

export const POST = createAckResponsesHandler(db);
