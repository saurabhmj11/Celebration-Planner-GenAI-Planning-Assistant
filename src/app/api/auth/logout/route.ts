import { db } from "@/lib/db";
import { createLogoutHandler } from "@/lib/auth/handlers";

export const runtime = "nodejs";

export const POST = createLogoutHandler(db);
