import { requireUser } from "@/lib/auth-required";
import {
  reportRepository,
  repositoryRepository,
  installationRepository,
  tenantAccountRepository,
  accountMembershipRepository,
} from "@/lib/db/domain-repositories";
import { NextRequest, NextResponse } from "next/server";

async function getUserRepositoryIds(userId: string): Promise<string[]> {
  const ownedAccounts = await tenantAccountRepository.listByOwnerId(userId);
  const membershipAccounts = await accountMembershipRepository.listByUser(userId);

  const accountIds = new Set<string>();
  for (const acc of ownedAccounts) accountIds.add(acc.id);
  for (const mem of membershipAccounts) accountIds.add(mem.accountId);

  const installationIds: string[] = [];
  for (const accountId of accountIds) {
    const installations = await installationRepository.listByAccount(accountId);
    for (const inst of installations) installationIds.push(inst.id);
  }

  const repoIds: string[] = [];
  for (const instId of installationIds) {
    const repos = await repositoryRepository.listByInstallation(instId);
    for (const repo of repos) repoIds.push(repo.id);
  }
  return repoIds;
}

export async function GET(request: NextRequest) {
  const userOrError = await requireUser();
  if (userOrError instanceof NextResponse) return userOrError;
  const { user } = userOrError;

  const searchParams = request.nextUrl.searchParams;
  const repositoryId = searchParams.get("repositoryId");
  const prNumber = searchParams.get("prNumber");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

  try {
    const userRepoIds = await getUserRepositoryIds(user.id);

    if (userRepoIds.length === 0) {
      return NextResponse.json({ reports: [] });
    }

    const reports: Array<{
      id: string;
      jobId: string;
      repositoryId: string;
      repositoryFullName: string;
      prNumber: number;
      headCommit: string;
      status: string;
      createdAt: string;
      updatedAt: string;
    }> = [];

    for (const repoId of userRepoIds) {
      if (repositoryId && repoId !== repositoryId) continue;

      const reportsForRepo = await reportRepository.findByRepository(repoId);
      const filtered = prNumber
        ? reportsForRepo.filter((r) => r.prNumber === parseInt(prNumber))
        : reportsForRepo;

      for (const report of filtered.slice(0, limit)) {
        const repoRows = await repositoryRepository.findById(report.repositoryId);
        const repo = repoRows.length > 0 ? repoRows[0] : null;

        reports.push({
          id: report.id,
          jobId: report.jobId,
          repositoryId: report.repositoryId,
          repositoryFullName: repo?.fullName || "Unknown",
          prNumber: report.prNumber,
          headCommit: report.headSha,
          status: "completed",
          createdAt: report.analyzedAt.toISOString(),
          updatedAt: report.analyzedAt.toISOString(),
        });
      }
    }

    reports.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return NextResponse.json({ reports });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch reports";
    return NextResponse.json(
      { code: "SERVER_ERROR", message },
      { status: 500 },
    );
  }
}
