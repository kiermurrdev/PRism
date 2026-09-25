import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { verifyStateToken } from "@/lib/github/app/state-token";
import { parseInstallationCallback } from "@/lib/github/app/installation";
import { loadGitHubAppConfig } from "@/lib/github/app/config";
import { createJwt } from "@/lib/github/app/jwt";
import { getInstallationAccessToken } from "@/lib/github/app/token";
import { installationRepository, repositoryRepository, tenantAccountRepository } from "@/lib/db/domain-repositories";

/**
 * GET /api/github-install/callback
 *
 * Handles the OAuth-style callback from GitHub after the user installs the App.
 *
 * Flow:
 * 1. Verify the signed state token matches the signed-in user.
 * 2. Validate the installation_id from GitHub.
 * 3. Use the installation token to confirm GitHub ownership.
 * 4. Create or update the installation record linked to the user's tenant.
 * 5. Synchronize repositories granted to the App.
 * 6. Redirect to the dashboard or an installation-success page.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  // Step 1: Check the user is authenticated
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/auth/signin?error=unauthorized", url.origin));
  }

  // Step 2: Verify the signed state token
  const state = searchParams.get("state");
  if (!state) {
    return NextResponse.redirect(new URL("/github-install?error=missing_state", url.origin));
  }

  const decoded = verifyStateToken(state);
  if ("code" in decoded) {
    const errorParam = decoded.code === "EXPIRED" ? "expired_state" : "invalid_state";
    return NextResponse.redirect(new URL(`/github-install?error=${errorParam}`, url.origin));
  }

  // Ensure the state token belongs to the current user
  if (decoded.userId !== session.user.id) {
    return NextResponse.redirect(new URL("/github-install?error=invalid_state", url.origin));
  }

  // Step 3: Parse and validate GitHub's callback parameters
  const callbackResult = parseInstallationCallback(searchParams);
  if (!callbackResult.ok) {
    return NextResponse.redirect(new URL("/github-install?error=invalid_callback", url.origin));
  }

  const { setupAction, installationId } = callbackResult;

  // Step 4: Load GitHub App config
  const configResult = loadGitHubAppConfig();
  if (!configResult.ok) {
    console.error("[github-install] config error:", configResult.error);
    return NextResponse.redirect(new URL("/github-install?error=server_error", url.origin));
  }
  const { config } = configResult;

  // Step 5: Generate JWT and get installation access token
  const jwtResult = await createJwt({
    appId: config.appId,
    privateKey: config.privateKey,
  });

  if (!jwtResult.ok) {
    console.error("[github-install] JWT error:", jwtResult.error);
    return NextResponse.redirect(new URL("/github-install?error=server_error", url.origin));
  }

  const tokenResult = await getInstallationAccessToken(
    { jwt: jwtResult.jwt, installationId },
    globalThis.fetch
  );

  if (!tokenResult.ok) {
    console.error("[github-install] token error:", tokenResult.error);
    return NextResponse.redirect(new URL("/github-install?error=auth_failed", url.origin));
  }

  // Step 6: Handle the installation action
  if (setupAction === "installed" || setupAction === "updated") {
    const linkResult = await linkInstallationToUser(
      session.user.id,
      installationId,
      tokenResult.token,
      config
    );

    if (!linkResult.ok) {
      console.error("[github-install] link error:", linkResult.error);
      return NextResponse.redirect(new URL("/github-install?error=link_failed", url.origin));
    }

    return NextResponse.redirect(new URL("/dashboard", url.origin));
  }

  // Handle uninstalled
  if (setupAction === "uninstalled") {
    await handleUninstallation(installationId);
    return NextResponse.redirect(new URL("/dashboard", url.origin));
  }

  return NextResponse.redirect(new URL("/github-install?error=unknown_action", url.origin));
}

/**
 * Link the GitHub installation to the user's tenant account and sync repos.
 */
async function linkInstallationToUser(
  userId: string,
  installationId: number,
  accessToken: string,
  config: { appId: number; appSlug: string; appUrl: string }
) {
  try {
    // Find or create the user's tenant account
    const tenantAccounts = await tenantAccountRepository.listByOwnerId(userId);
    let tenantAccountId: string;

    if (tenantAccounts.length === 0) {
      const newTenant = await tenantAccountRepository.create({
        ownerId: userId,
        name: "My Account",
      });
      tenantAccountId = newTenant[0].id;
    } else {
      tenantAccountId = tenantAccounts[0].id;
    }

    // Check if installation already exists
    const existingInstallations = await installationRepository.findByGithubInstallationId(installationId);

    if (existingInstallations.length > 0) {
      // Update existing installation
      const existing = existingInstallations[0];
      await installationRepository.update(existing.id, {
        accountId: tenantAccountId,
      });
    } else {
      // Create new installation
      const newInstallation = await installationRepository.create({
        accountId: tenantAccountId,
        githubInstallationId: installationId,
        appId: config.appId,
        appSlug: config.appSlug,
      });
    }

    // Synchronize repositories
    await syncRepositoriesForInstallation(installationId, accessToken);

    return { ok: true };
  } catch (error) {
    console.error("[github-install] linkInstallationToUser failed:", error);
    return {
      ok: false,
      error: { code: "LINK_FAILED", message: "Failed to link installation" },
    };
  }
}

/**
 * Fetch and sync all repositories granted to this installation.
 */
async function syncRepositoriesForInstallation(
  installationId: number,
  accessToken: string
) {
  const url = `https://api.github.com/installation/repositories`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "PRism-GitHub-App",
    },
  });

  if (!response.ok) {
    console.error("[github-install] fetch repositories failed:", response.status);
    return;
  }

  const data: { repositories?: Array<{ id: number; full_name: string }> } = await response.json();
  const repos = data.repositories ?? [];

  // Find the installation record
  const installations = await installationRepository.findByGithubInstallationId(installationId);
  if (installations.length === 0) return;

  const installationIdStr = installations[0].id;

  // Get existing repositories for this installation
  const existingRepos = await repositoryRepository.listByInstallation(installationIdStr);
  const existingRepoIds = new Set(existingRepos.map((r) => r.githubRepoId));

  const grantedRepoIds = new Set<number>();

  for (const repo of repos) {
    grantedRepoIds.add(repo.id);

    // Check if repo already exists
    const existing = await repositoryRepository.findByGithubRepoId(repo.id);
    if (existing.length > 0) {
      // Update installation if needed
      await repositoryRepository.update(existing[0].id, {
        installationId: installationIdStr,
        fullName: repo.full_name,
      });
    } else {
      // Create new repository record
      await repositoryRepository.create({
        installationId: installationIdStr,
        githubRepoId: repo.id,
        fullName: repo.full_name,
      });
    }
  }

  // Mark repos no longer granted as inactive (soft delete)
  for (const repo of existingRepos) {
    if (!grantedRepoIds.has(repo.githubRepoId)) {
      await repositoryRepository.update(repo.id, {
        fullName: repo.fullName,
      });
    }
  }
}

/**
 * Handle uninstallation by marking the installation as revoked.
 */
async function handleUninstallation(installationId: number) {
  const installations = await installationRepository.findByGithubInstallationId(installationId);
  if (installations.length > 0) {
    await installationRepository.delete(installations[0].id);
  }
}
