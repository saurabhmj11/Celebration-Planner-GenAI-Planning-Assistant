import { db } from "@/lib/db";
import { createSyncListHandler, createSyncPushHandler } from "@/lib/sync/handlers";

export const runtime = "nodejs";

export const GET = createSyncListHandler(db);
export const POST = createSyncPushHandler(db);
