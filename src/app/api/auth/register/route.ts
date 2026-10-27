import { db } from "@/lib/db";
import { createRegisterHandler } from "@/lib/auth/handlers";

export const runtime = "nodejs";

export const POST = createRegisterHandler(db);
