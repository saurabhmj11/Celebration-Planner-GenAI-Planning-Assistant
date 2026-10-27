import { db } from "@/lib/db";
import { createShareAlbumHandler } from "@/lib/sync/handlers";

export const runtime = "nodejs";

export const POST = createShareAlbumHandler(db);
