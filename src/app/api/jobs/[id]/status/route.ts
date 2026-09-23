import { requireUser } from "@/lib/auth-required";
import { analysisJobRepository, reportRepository } from "@/lib/db/domain-repositories";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userOrError = await requireUser();
  if (userOrError instanceof NextResponse) return userOrError;
  const { user } = userOrError;

  const { id } = await params;

  const rows = await analysisJobRepository.findById(id);
  if (rows.length === 0) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "Job not found or access denied." },
      { status: 404 },
    );
  }

  const job = rows[0];

  // Verify ownership via repository
  const repoRows = await reportRepository.findByJob(job.id);
  if (repoRows.length > 0 && repoRows[0].userId !== user.id) {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "You do not have access to this job." },
      { status: 403 },
    );
  }

  const statusMessages: Record<string, string> = {
    queued: "Job queued for analysis",
    pending: "Waiting to start analysis",
    running: "Analysis in progress",
    completed: "Analysis completed",
    failed: job.errorMessage || "Analysis failed",
    cancelled: "Analysis was cancelled",
  };

  return NextResponse.json({
    id: job.id,
    status: job.status,
    message: statusMessages[job.status] || job.status,
    repositoryId: job.repositoryId,
    prNumber: job.prNumber,
    headSha: job.headSha,
    attemptCount: job.attemptCount,
    errorMessage: job.errorMessage ?? undefined,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    completedAt: job.completedAt?.toISOString() ?? undefined,
  });
}
