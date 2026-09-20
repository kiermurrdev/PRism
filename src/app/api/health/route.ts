/**
 * GET /api/health
 *
 * Reports application readiness without exposing secrets, tokens,
 * repository content, environment-variable values, or sensitive configuration.
 */

import { NextResponse } from "next/server";

export function GET(): NextResponse {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
