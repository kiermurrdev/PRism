import { requireUser } from "@/lib/auth-required";
import { installationRepository, tenantAccountRepository, accountMembershipRepository } from "@/lib/db/domain-repositories";
import { NextResponse } from "next/server";

export async function GET() {
  const userOrError = await requireUser();
  if (userOrError instanceof NextResponse) return userOrError;
  const { user } = userOrError;

  try {
    // Get all accounts this user belongs to (as owner or member)
    const ownedAccounts = await tenantAccountRepository.listByOwnerId(user.id);
    const membershipAccounts = await accountMembershipRepository.listByUser(user.id);

    const accountIds = new Set<string>();
    for (const acc of ownedAccounts) accountIds.add(acc.id);
    for (const mem of membershipAccounts) accountIds.add(mem.accountId);

    if (accountIds.size === 0) {
      return NextResponse.json({ installations: [] });
    }

    const allInstallations: Array<{
      id: string;
      githubInstallationId: number;
      accountId: string;
      appId: number;
      appSlug: string;
      accountName: string;
      createdAt: string;
      updatedAt: string;
    }> = [];

    for (const accountId of accountIds) {
      const installations = await installationRepository.listByAccount(accountId);
      const account = await tenantAccountRepository.findById(accountId);

      for (const inst of installations) {
        allInstallations.push({
          id: inst.id,
          githubInstallationId: inst.githubInstallationId,
          accountId: inst.accountId,
          appId: inst.appId,
          appSlug: inst.appSlug,
          accountName: account.length > 0 ? account[0].name : "Unknown Account",
          createdAt: inst.createdAt.toISOString(),
          updatedAt: inst.updatedAt.toISOString(),
        });
      }
    }

    return NextResponse.json({ installations: allInstallations });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch installations";
    return NextResponse.json(
      { code: "SERVER_ERROR", message },
      { status: 500 },
    );
  }
}
