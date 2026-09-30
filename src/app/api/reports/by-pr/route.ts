import { requireUser } from "@/lib/auth-required";
import { analysisJobRepository, reportRepository, repositoryRepository } from "@/lib/db/domain-repositories";
import { NextRequest, NextResponse } from "next/server";

// Parse GitHub PR URL into repo slug + PR number
function parseGitHubPR(url: string): { owner: string; repo: string; number: number } | null {
  const m = url.match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)/);
  if (!m) return null;
  return { owner: m[1], repo: m[2], number: parseInt(m[3], 10) };
}

export async function GET(request: NextRequest) {
  const userOrError = await requireUser();
  if (userOrError instanceof NextResponse) return userOrError;
  const { user } = userOrError;

  const searchParams = request.nextUrl.searchParams;
  const prUrl = searchParams.get("prUrl");
  const repoSlug = searchParams.get("repo");
  const prNumberStr = searchParams.get("prNumber");
  const headSha = searchParams.get("headSha");

  if (!prUrl && (!repoSlug || !prNumberStr)) {
    return NextResponse.json(
      { code: "MISSING_PARAMS", message: "Provide prUrl or both repo and prNumber" },
      { status: 400 },
    );
  }

  let parsed: { owner: string; repo: string; number: number };
  if (prUrl) {
    const result = parseGitHubPR(prUrl);
    if (!result) {
      return NextResponse.json(
        { code: "INVALID_PR_URL", message: "Invalid GitHub PR URL" },
        { status: 400 },
      );
    }
    parsed = result;
  } else {
    // repoSlug is guaranteed non-null here due to the guard above
    const [owner, repo] = repoSlug!.split("/");
    parsed = { owner, repo, number: parseInt(prNumberStr!, 10) };
  }

  const repoRow = await repositoryRepository.findByFullName(`${parsed.owner}/${parsed.repo}`);
  if (!repoRow || repoRow.length === 0) {
    return NextResponse.json(
      { code: "REPO_NOT_FOUND", message: "Repository not found" },
      { status: 404 },
    );
  }
  const repositoryId = repoRow[0].id;

  // Fetch the latest report for this PR
  const latestReport = await reportRepository.findLatestByRepositoryAndPR(
    repositoryId,
    parsed.number,
  );

  if (!latestReport) {
    return NextResponse.json(
      { code: "NO_REPORT", message: "No report found for this PR" },
      { status: 404 },
    );
  }

  // Optional: if headSha is provided, only return if it matches
  if (headSha && latestReport.headSha !== headSha) {
    return NextResponse.json(
      { code: "SHA_MISMATCH", message: "Report exists but for a different commit" },
      { status: 404 },
    );
  }

  // Auth gate: owner can access; later we can add org membership checks
  if (latestReport.userId !== user.id) {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "You do not have access to this report" },
      { status: 403 },
    );
  }

  return NextResponse.json({
    id: latestReport.id,
    jobId: latestReport.jobId,
    repositoryId: latestReport.repositoryId,
    headSha: latestReport.headSha,
    provider: latestReport.provider,
    model: latestReport.model,
    promptVersion: latestReport.promptVersion,
    schemaVersion: latestReport.schemaVersion,
    analyzedAt: latestReport.analyzedAt.toISOString(),
    title: latestReport.title,
    prUrl: latestReport.prUrl,
    summary: latestReport.summary,
    nodes: latestReport.nodes,
    edges: latestReport.edges,
    findings: latestReport.findings,
    qaItems: latestReport.qaItems,
    affectedFiles: latestReport.affectedFiles,
  });
}
