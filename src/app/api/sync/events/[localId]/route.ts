import { db } from "@/lib/db";
import {
  createSyncDeleteHandler,
  createSyncGetHandler,
} from "@/lib/sync/handlers";

export const runtime = "nodejs";

export const GET = createSyncGetHandler(db);
export const DELETE = createSyncDeleteHandler(db);
