import { NextResponse } from "next/server";

/**
 * Health check and service metadata endpoint for Celebration & Event Planner.
 */
export async function GET() {
  return NextResponse.json({
    status: "healthy",
    service: "Celebration & Event Planner API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    endpoints: {
      themes: "/api/ai/themes",
      assist: "/api/ai/assist",
      rsvp: "/api/public/rsvp",
      album: "/api/public/album",
      sync: "/api/sync/events",
    },
  });
}