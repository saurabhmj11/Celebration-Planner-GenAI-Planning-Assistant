import { db } from "@/lib/db";
import { createSessionHandler } from "@/lib/auth/handlers";

export const runtime = "nodejs";

export const GET = createSessionHandler(db);
