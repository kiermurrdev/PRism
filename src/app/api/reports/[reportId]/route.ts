import { requireUser } from "@/lib/auth-required";
import { reportRepository } from "@/lib/db/domain-repositories";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const userOrError = await requireUser();
  if (userOrError instanceof NextResponse) return userOrError;
  const { user } = userOrError;

  const reportId = (await params).reportId;

  const rows = await reportRepository.findById(reportId);
  if (rows.length === 0) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "Report not found" },
      { status: 404 },
    );
  }

  const report = rows[0];

  // Auth gate: only the report owner can access it (for now; multi-account
  // membership checks can be layered later).
  if (report.userId !== user.id) {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "You do not have access to this report" },
      { status: 403 },
    );
  }

  return NextResponse.json({
    id: report.id,
    jobId: report.jobId,
    repositoryId: report.repositoryId,
    headSha: report.headSha,
    provider: report.provider,
    model: report.model,
    promptVersion: report.promptVersion,
    schemaVersion: report.schemaVersion,
    analyzedAt: report.analyzedAt.toISOString(),
    title: report.title,
    prUrl: report.prUrl,
    summary: report.summary,
    nodes: report.nodes,
    edges: report.edges,
    findings: report.findings,
    qaItems: report.qaItems,
    affectedFiles: report.affectedFiles,
  });
}
