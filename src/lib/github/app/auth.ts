/**
 * GitHub App authentication utilities.
 *
 * SERVER-ONLY. Handles JWT creation and installation access tokens.
 */

import { loadGitHubAppConfig } from "./config";

const GITHUB_API_BASE = "https://api.github.com";
const JWT_EXPIRY_SECONDS = 600; // 10 minutes max

/**
 * Create a GitHub App JWT for authenticating as the app itself.
 */
export async function createAppJwt(): Promise<string | null> {
  const configResult = loadGitHubAppConfig();
  if (!configResult.ok) return null;

  const config = configResult.config;

  try {
    // Parse the private key
    const header = Buffer.from(
      JSON.stringify({ alg: "RS256", typ: "JWT" })
    ).toString("base64url");

    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(
      JSON.stringify({
        iat: now,
        exp: now + JWT_EXPIRY_SECONDS,
        iss: config.appId,
      })
    ).toString("base64url");

    const signatureInput = `${header}.${payload}`;

    // Use Node.js crypto for signing
    const crypto = await import("crypto");
    const sign = crypto.createSign("RSA-SHA256");
    sign.update(signatureInput);
    const signature = sign.sign(config.privateKey, "base64url");

    return `${signatureInput}.${signature}`;
  } catch {
    return null;
  }
}

/**
 * Exchange an app JWT for an installation access token.
 *
 * Returns a short-lived token scoped to the installation.
 */
export async function getInstallationAccessToken(
  installationId: number
): Promise<string | null> {
  const jwt = await createAppJwt();
  if (!jwt) return null;

  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/app/installations/${installationId}/access_tokens`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.token ?? null;
  } catch {
    return null;
  }
}

/**
 * Make an authenticated request to the GitHub API using an installation token.
 */
export async function githubApiRequest(
  installationId: number,
  method: string,
  path: string,
  body?: unknown
): Promise<{ ok: true; data: unknown } | { ok: false; status: number }> {
  const token = await getInstallationAccessToken(installationId);
  if (!token) {
    return { ok: false, status: 500 };
  }

  try {
    const response = await fetch(`${GITHUB_API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      return { ok: false, status: response.status };
    }

    if (response.status === 204) {
      return { ok: true, data: null };
    }

    const data = await response.json();
    return { ok: true, data };
  } catch {
    return { ok: false, status: 500 };
  }
}

/**
 * Fetch PR data using installation auth.
 */
export async function fetchPRForInstallation(
  installationId: number,
  owner: string,
  repo: string,
  prNumber: number
): Promise<
  | {
      ok: true;
      data: {
        title: string;
        author: string;
        baseBranch: string;
        headBranch: string;
        headSha: string;
      };
    }
  | { ok: false; status: number }
> {
  const result = await githubApiRequest(
    installationId,
    "GET",
    `/repos/${owner}/${repo}/pulls/${prNumber}`
  );

  if (!result.ok) return result;

  const data = result.data as Record<string, unknown>;
  return {
    ok: true,
    data: {
      title: (data.title as string) ?? "",
      author: ((data.user as Record<string, unknown>)?.login as string) ?? "",
      baseBranch: ((data.base as Record<string, unknown>)?.ref as string) ?? "",
      headBranch: ((data.head as Record<string, unknown>)?.ref as string) ?? "",
      headSha: ((data.head as Record<string, unknown>)?.sha as string) ?? "",
    },
  };
}

/**
 * Fetch changed files for a PR using installation auth.
 */
export async function fetchChangedFilesForInstallation(
  installationId: number,
  owner: string,
  repo: string,
  prNumber: number,
  maxFiles: number = 200
): Promise<
  | {
      ok: true;
      files: Array<{
        filename: string;
        status: string;
        additions: number;
        deletions: number;
        patch?: string;
      }>;
    }
  | { ok: false; status: number }
> {
  const files: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    patch?: string;
  }> = [];

  const token = await getInstallationAccessToken(installationId);
  if (!token) return { ok: false, status: 500 };

  let page = 1;
  const perPage = 100;

  try {
    while (files.length < maxFiles) {
      const response = await fetch(
        `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}/files?page=${page}&per_page=${perPage}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        }
      );

      if (!response.ok) {
        return { ok: false, status: response.status };
      }

      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) break;

      for (const file of data) {
        if (files.length >= maxFiles) break;
        files.push({
          filename: file.filename,
          status: file.status,
          additions: file.additions ?? 0,
          deletions: file.deletions ?? 0,
          patch: file.patch ?? undefined,
        });
      }

      page++;
    }
  } catch {
    return { ok: false, status: 500 };
  }

  return { ok: true, files };
}
