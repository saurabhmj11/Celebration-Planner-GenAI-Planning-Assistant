import { db } from "@/lib/db";
import { createGuestPhotosHandler } from "@/lib/sync/handlers";

export const runtime = "nodejs";

export const GET = createGuestPhotosHandler(db);
