import { requireUser } from "@/lib/auth-required";
import {
  repositoryRepository,
  installationRepository,
  tenantAccountRepository,
  accountMembershipRepository,
  repositorySettingsRepository,
} from "@/lib/db/domain-repositories";
import { NextResponse } from "next/server";

export async function GET() {
  const userOrError = await requireUser();
  if (userOrError instanceof NextResponse) return userOrError;
  const { user } = userOrError;

  try {
    // Get all accounts this user belongs to
    const ownedAccounts = await tenantAccountRepository.listByOwnerId(user.id);
    const membershipAccounts = await accountMembershipRepository.listByUser(user.id);

    const accountIds = new Set<string>();
    for (const acc of ownedAccounts) accountIds.add(acc.id);
    for (const mem of membershipAccounts) accountIds.add(mem.accountId);

    if (accountIds.size === 0) {
      return NextResponse.json({ repositories: [] });
    }

    // Get all installations for these accounts
    const installationIds: string[] = [];
    for (const accountId of accountIds) {
      const installations = await installationRepository.listByAccount(accountId);
      for (const inst of installations) installationIds.push(inst.id);
    }

    if (installationIds.length === 0) {
      return NextResponse.json({ repositories: [] });
    }

    const allRepos: Array<{
      id: string;
      githubRepoId: number;
      fullName: string;
      installationId: string;
      isPrivate: boolean;
      createdAt: string;
      settings: {
        autoReview: boolean;
        credentialId: string | null;
        promptVersion: string;
        isConfigured: boolean;
      } | null;
    }> = [];

    for (const instId of installationIds) {
      const repos = await repositoryRepository.listByInstallation(instId);
      for (const repo of repos) {
        const settingsRows = await repositorySettingsRepository.findByRepository(repo.id);
        const settings = settingsRows.length > 0 ? settingsRows[0] : null;

        allRepos.push({
          id: repo.id,
          githubRepoId: repo.githubRepoId,
          fullName: repo.fullName,
          installationId: repo.installationId,
          isPrivate: repo.isPrivate,
          createdAt: repo.createdAt.toISOString(),
          settings: settings
            ? {
                autoReview: settings.autoComment,
                credentialId: settings.credentialId,
                promptVersion: settings.promptVersion,
                isConfigured: !!settings.credentialId && settings.autoComment,
              }
            : null,
        });
      }
    }

    return NextResponse.json({ repositories: allRepos });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch repositories";
    return NextResponse.json(
      { code: "SERVER_ERROR", message },
      { status: 500 },
    );
  }
}
