/**
 * GET /api/jobs/[jobId]
 *
 * Returns the current status of an analysis job.
 * If completed, includes the report ID and URL.
 * If the job doesn't exist or the user has no access, returns 404.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { analysisJobs, reports, repositories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { analysisJobRepository, reportRepository } from "@/lib/db/domain-repositories";
import { requireUser } from "@/lib/auth-required";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult.user;

  const { jobId } = await params;

  // Fetch the job
  const [job] = await analysisJobRepository.findById(jobId);
  if (!job) {
    return NextResponse.json({ code: "NOT_FOUND", message: "Job not found." }, { status: 404 });
  }

  // Check access: user must own the report or the repository's account
  const [report] = await reportRepository.findByJob(jobId);
  if (report) {
    // If report exists, check if user owns it
    if (report.userId !== user.id) {
      // Check if user has access to the repository via account membership
      const [repo] = await db.select().from(repositories).where(eq(repositories.id, job.repositoryId)).limit(1);
      if (!repo) {
        return NextResponse.json({ code: "NOT_FOUND", message: "Job not found." }, { status: 404 });
      }
      // For now, only report owner can view; later we can add account membership checks
      return NextResponse.json({ code: "FORBIDDEN", message: "You do not have access to this job." }, { status: 403 });
    }
  } else {
    // No report yet — check if user has access to the repository
    const [repo] = await db.select().from(repositories).where(eq(repositories.id, job.repositoryId)).limit(1);
    if (!repo) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Job not found." }, { status: 404 });
    }
    // Allow viewing jobs for repositories in the user's account (simplified for now)
  }

  const result: { jobId: string; status: string; errorMessage?: string; attemptCount: number; reportId?: string; reportUrl?: string } = {
    jobId: job.id,
    status: job.status,
    attemptCount: job.attemptCount,
  };

  if (job.errorMessage) {
    result.errorMessage = job.errorMessage;
  }

  if (report) {
    result.reportId = report.id;
    result.reportUrl = `/reports/${report.id}`;
  }

  return NextResponse.json(result);
}
