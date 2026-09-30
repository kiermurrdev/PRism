import { requireUser } from "@/lib/auth-required";
import {
  analysisJobRepository,
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
  const statusFilter = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

  try {
    const userRepoIds = await getUserRepositoryIds(user.id);

    if (userRepoIds.length === 0) {
      return NextResponse.json({ jobs: [] });
    }

    const jobs: Array<{
      id: string;
      repositoryId: string;
      repositoryFullName: string;
      prNumber: number;
      headSha: string;
      status: string;
      attemptCount: number;
      errorMessage: string | null;
      createdAt: string;
      updatedAt: string;
      completedAt: string | null;
    }> = [];

    for (const repoId of userRepoIds) {
      const jobsForRepo = await analysisJobRepository.findByRepositoryAndPR(repoId, 0);
      // Filter by status if provided
      const filtered = statusFilter
        ? jobsForRepo.filter((j) => j.status === statusFilter)
        : jobsForRepo;

      for (const job of filtered.slice(0, limit)) {
        const repoRows = await repositoryRepository.findById(job.repositoryId);
        const repo = repoRows.length > 0 ? repoRows[0] : null;

        jobs.push({
          id: job.id,
          repositoryId: job.repositoryId,
          repositoryFullName: repo?.fullName || "Unknown",
          prNumber: job.prNumber,
          headSha: job.headSha,
          status: job.status,
          attemptCount: job.attemptCount,
          errorMessage: job.errorMessage,
          createdAt: job.createdAt.toISOString(),
          updatedAt: job.updatedAt.toISOString(),
          completedAt: job.completedAt?.toISOString() || null,
        });
      }
    }

    // Sort by updatedAt descending
    jobs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return NextResponse.json({ jobs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch jobs";
    return NextResponse.json(
      { code: "SERVER_ERROR", message },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userOrError = await requireUser();
  if (userOrError instanceof NextResponse) return userOrError;
  const { user } = userOrError;

  const { id } = await params;

  try {
    const jobRows = await analysisJobRepository.findById(id);
    if (jobRows.length === 0) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Job not found" },
        { status: 404 },
      );
    }

    const job = jobRows[0];

    // Verify user owns this job's repository
    const userRepoIds = await getUserRepositoryIds(user.id);
    if (!userRepoIds.includes(job.repositoryId)) {
      return NextResponse.json(
        { code: "FORBIDDEN", message: "You do not have access to this job" },
        { status: 403 },
      );
    }

    // Only retry failed jobs
    if (job.status !== "failed") {
      return NextResponse.json(
        { code: "INVALID_STATE", message: "Only failed jobs can be retried" },
        { status: 400 },
      );
    }

    // Reset job to queued
    const updated = await analysisJobRepository.update(id, {
      status: "queued",
      errorMessage: null,
    });

    return NextResponse.json({
      job: {
        id: updated[0].id,
        status: updated[0].status,
        attemptCount: updated[0].attemptCount,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to retry job";
    return NextResponse.json(
      { code: "SERVER_ERROR", message },
      { status: 500 },
    );
  }
}
