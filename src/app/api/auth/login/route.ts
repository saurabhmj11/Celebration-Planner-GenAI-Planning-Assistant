import { db } from "@/lib/db";
import { createLoginHandler } from "@/lib/auth/handlers";

export const runtime = "nodejs";

export const POST = createLoginHandler(db);
