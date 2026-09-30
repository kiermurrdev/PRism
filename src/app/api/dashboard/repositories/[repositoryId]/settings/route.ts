import { requireUser } from "@/lib/auth-required";
import {
  repositorySettingsRepository,
  repositoryRepository,
  installationRepository,
  tenantAccountRepository,
  accountMembershipRepository,
} from "@/lib/db/domain-repositories";
import { NextRequest, NextResponse } from "next/server";

async function userOwnsRepository(userId: string, repositoryId: string): Promise<boolean> {
  const repoRows = await repositoryRepository.findById(repositoryId);
  if (repoRows.length === 0) return false;
  const repo = repoRows[0];

  const instRows = await installationRepository.findById(repo.installationId);
  if (instRows.length === 0) return false;
  const inst = instRows[0];

  const ownedAccounts = await tenantAccountRepository.listByOwnerId(userId);
  const membershipAccounts = await accountMembershipRepository.listByUser(userId);

  const accountIds = new Set<string>();
  for (const acc of ownedAccounts) accountIds.add(acc.id);
  for (const mem of membershipAccounts) accountIds.add(mem.accountId);

  return accountIds.has(inst.accountId);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ repositoryId: string }> },
) {
  const userOrError = await requireUser();
  if (userOrError instanceof NextResponse) return userOrError;
  const { user } = userOrError;

  const { repositoryId } = await params;

  if (!(await userOwnsRepository(user.id, repositoryId))) {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "You do not have access to this repository" },
      { status: 403 },
    );
  }

  try {
    const settingsRows = await repositorySettingsRepository.findByRepository(repositoryId);
    const settings = settingsRows.length > 0 ? settingsRows[0] : null;

    return NextResponse.json({
      settings: settings
        ? {
            id: settings.id,
            repositoryId: settings.repositoryId,
            autoReview: settings.autoComment,
            credentialId: settings.credentialId,
            promptVersion: settings.promptVersion,
            createdAt: settings.createdAt.toISOString(),
            updatedAt: settings.updatedAt.toISOString(),
          }
        : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch settings";
    return NextResponse.json(
      { code: "SERVER_ERROR", message },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ repositoryId: string }> },
) {
  const userOrError = await requireUser();
  if (userOrError instanceof NextResponse) return userOrError;
  const { user } = userOrError;

  const { repositoryId } = await params;

  if (!(await userOwnsRepository(user.id, repositoryId))) {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "You do not have access to this repository" },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const { autoReview, credentialId, promptVersion } = body;

    const settings = await repositorySettingsRepository.upsertByRepository(repositoryId, {
      autoComment: autoReview !== undefined ? autoReview : true,
      credentialId: credentialId !== undefined ? credentialId : null,
      promptVersion: promptVersion || "v1",
    });

    return NextResponse.json({
      settings: {
        id: settings.id,
        repositoryId: settings.repositoryId,
        autoReview: settings.autoComment,
        credentialId: settings.credentialId,
        promptVersion: settings.promptVersion,
        createdAt: settings.createdAt.toISOString(),
        updatedAt: settings.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update settings";
    return NextResponse.json(
      { code: "SERVER_ERROR", message },
      { status: 500 },
    );
  }
}
