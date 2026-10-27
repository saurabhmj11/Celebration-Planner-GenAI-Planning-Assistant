import { db } from "@/lib/db";
import { createAckPhotosHandler } from "@/lib/sync/handlers";

export const runtime = "nodejs";

export const POST = createAckPhotosHandler(db);
