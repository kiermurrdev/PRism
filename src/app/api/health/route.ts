/**
 * GET /api/health
 *
 * Reports application readiness without exposing secrets, tokens,
 * repository content, environment-variable values, or sensitive configuration.
 *
 * Checks:
 * - Application is running
 * - Database connectivity (optional, controlled by query param)
 * - Required environment variables are set
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db/client";

async function checkDatabase(): Promise<{ status: "ok" | "warning" | "error"; message?: string }> {
  try {
    await db.execute("SELECT 1");
    return { status: "ok" };
  } catch (error) {
    return {
      status: "error",
      message: "Database connection failed",
    };
  }
}

function checkEnvVars(): { status: "ok" | "warning" | "error"; missing: string[]; warnings: string[] } {
  const required = ["DATABASE_URL", "AUTH_SECRET"];
  const recommended = ["GITHUB_APP_ID", "GITHUB_APP_SLUG", "NEXT_PUBLIC_APP_URL"];

  const missing = required.filter((key) => !process.env[key]);
  const warnings = recommended.filter((key) => !process.env[key]);

  return {
    status: missing.length > 0 ? "error" : warnings.length > 0 ? "warning" : "ok",
    missing,
    warnings,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const checkDb = request.nextUrl.searchParams.get("checkDb") === "true";

  const envCheck = checkEnvVars();
  const dbCheck = checkDb ? await checkDatabase() : undefined;

  const overallStatus =
    envCheck.status === "error" || dbCheck?.status === "error" ? "error" : "ok";

  const body: Record<string, unknown> = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };

  if (envCheck.missing.length > 0) {
    body.envMissing = envCheck.missing;
  }

  if (checkDb) {
    body.database = dbCheck;
  }

  const statusCode = overallStatus === "ok" ? 200 : 503;

  return NextResponse.json(body, { status: statusCode });
}
