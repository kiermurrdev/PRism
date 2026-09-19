/**
 * GitHub API client for PR ingestion.
 *
 * Uses the platform's built-in fetch. Supports unauthenticated requests to
 * public repositories when GITHUB_TOKEN is absent.
 */

import type { GitHubError } from "./types";
import {
  GITHUB_API_BASE,
  MAX_CHANGED_FILES,
  MAX_PATCH_BYTES,
  MAX_TOTAL_TEXT_BYTES,
  MAX_TREE_ENTRIES,
  MAX_MANIFEST_BYTES,
  EXCLUDED_EXTENSIONS,
  EXCLUDED_DIRECTORIES,
  MANIFEST_PATTERNS,
} from "./constants";

/**
 * Internal GitHub API response helpers.
 */

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };

  const token =
    typeof process !== "undefined" ? process.env.GITHUB_TOKEN : undefined;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function isRateLimitResponse(status: number, headers: Headers): boolean {
  return (
    status === 403 ||
    status === 429 ||
    headers.get("X-RateLimit-Remaining") === "0"
  );
}

/**
 * Fetch from GitHub and return either the response or a GitHubError.
 */
async function githubFetch(
  url: string,
  init?: RequestInit
): Promise<{ ok: true; response: Response } | { ok: false; error: GitHubError }> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        ...getAuthHeaders(),
        ...init?.headers,
      },
    });

    if (!response.ok) {
      return { ok: false, error: classifyGitHubError(response.status, response.headers) };
    }

    return { ok: true, response };
  } catch {
    return {
      ok: false,
      error: {
        code: "NETWORK_ERROR",
        message: "Failed to connect to GitHub.",
      },
    };
  }
}

function classifyGitHubError(
  status: number,
  headers: Headers
): GitHubError {
  if (isRateLimitResponse(status, headers)) {
    return { code: "RATE_LIMITED", message: "GitHub API rate limit exceeded." };
  }

  if (status === 404) {
    return { code: "PR_NOT_FOUND", message: "Pull request not found." };
  }

  if (status === 401 || status === 403) {
    return {
      code: "ACCESS_DENIED",
      message: "Repository is private or inaccessible.",
    };
  }

  return { code: "GITHUB_ERROR", message: "A GitHub API error occurred." };
}

/**
 * Fetch PR metadata from GitHub.
 */
async function fetchPR(
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
  | { ok: false; error: GitHubError }
> {
  const result = await githubFetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}`
  );

  if (!result.ok) return result;

  try {
    const data = await result.response.json();
    return {
      ok: true,
      data: {
        title: data.title ?? "",
        author: data.user?.login ?? "",
        baseBranch: data.base?.ref ?? "",
        headBranch: data.head?.ref ?? "",
        headSha: data.head?.sha ?? "",
      },
    };
  } catch {
    return {
      ok: false,
      error: {
        code: "GITHUB_ERROR",
        message: "Failed to parse PR data.",
      },
    };
  }
}

/**
 * Fetch all changed files for a PR, handling pagination.
 */
async function fetchChangedFiles(
  owner: string,
  repo: string,
  prNumber: number
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
  | { ok: false; error: GitHubError }
> {
  const files: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    patch?: string;
  }> = [];
  let page = 1;
  const perPage = 100;

  while (files.length < MAX_CHANGED_FILES) {
    const result = await githubFetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}/files?page=${page}&per_page=${perPage}`
    );

    if (!result.ok) return result;

    try {
      const data = await result.response.json();
      if (!Array.isArray(data) || data.length === 0) break;

      for (const file of data) {
        if (files.length >= MAX_CHANGED_FILES) break;
        files.push({
          filename: file.filename,
          status: file.status,
          additions: file.additions ?? 0,
          deletions: file.deletions ?? 0,
          patch: file.patch ?? undefined,
        });
      }
    } catch {
      return {
        ok: false,
        error: {
          code: "GITHUB_ERROR",
          message: "Failed to parse PR files data.",
        },
      };
    }

    page++;
  }

  return { ok: true, files };
}

/**
 * Fetch a bounded repository tree (recursive, HEAD of base branch).
 */
async function fetchTree(
  owner: string,
  repo: string,
  baseBranch: string
): Promise<
  | {
      ok: true;
      tree: Array<{ path: string; type: "blob" | "tree" }>;
    }
  | { ok: false; error: GitHubError }
> {
  // Get the commit SHA for the base branch
  const refResult = await githubFetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`
  );
  if (!refResult.ok) return refResult;

  let commitSha: string | undefined;
  try {
    const refData = await refResult.response.json();
    commitSha = refData.object?.sha;
  } catch {
    return {
      ok: false,
      error: {
        code: "GITHUB_ERROR",
        message: "Failed to parse branch ref data.",
      },
    };
  }
  if (!commitSha) {
    return {
      ok: false,
      error: {
        code: "GITHUB_ERROR",
        message: "Could not resolve branch commit.",
      },
    };
  }

  // Get the tree recursively
  const treeResult = await githubFetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${commitSha}?recursive=1`
  );
  if (!treeResult.ok) return treeResult;

  let entries: Array<{ path: string; type: string }>;
  try {
    const treeData = await treeResult.response.json();
    entries = treeData.tree ?? [];
  } catch {
    return {
      ok: false,
      error: {
        code: "GITHUB_ERROR",
        message: "Failed to parse tree data.",
      },
    };
  }

  const tree: Array<{ path: string; type: "blob" | "tree" }> = [];
  for (const entry of entries) {
    if (tree.length >= MAX_TREE_ENTRIES) break;

    // Skip excluded directories
    const parts = entry.path.split("/");
    const excluded = parts.some((part) => EXCLUDED_DIRECTORIES.has(part));
    if (excluded) continue;

    tree.push({
      path: entry.path,
      type: entry.type as "blob" | "tree",
    });
  }

  return { ok: true, tree };
}

/**
 * Check if a file should be excluded from content collection.
 */
function isExcludedFile(path: string): boolean {
  const ext = "." + path.split(".").pop()?.toLowerCase();
  if (EXCLUDED_EXTENSIONS.has(ext)) return true;
  if (EXCLUDED_EXTENSIONS.has(path.toLowerCase())) return true;

  const parts = path.split("/");
  return parts.some((part) => EXCLUDED_DIRECTORIES.has(part));
}

/**
 * Fetch content of a single file from GitHub.
 */
async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<string | null> {
  const result = await githubFetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${ref}`
  );

  if (!result.ok) return null;

  try {
    const data = await result.response.json();
    if (!data.content || data.encoding !== "base64") return null;

    const decoded = Buffer.from(data.content, "base64").toString("utf-8");
    if (decoded.length > MAX_MANIFEST_BYTES) return null;

    return decoded;
  } catch {
    return null;
  }
}

/**
 * Collect manifest and configuration file contents.
 */
async function fetchManifests(
  owner: string,
  repo: string,
  tree: Array<{ path: string; type: string }>,
  baseBranch: string
): Promise<Array<{ path: string; content: string }>> {
  const manifests: Array<{ path: string; content: string }> = [];

  // Find manifest files in the tree
  const manifestPaths = tree
    .filter((entry) => entry.type === "blob")
    .map((entry) => entry.path)
    .filter((path) => {
      const basename = path.split("/").pop() ?? "";
      return MANIFEST_PATTERNS.some((pattern) => basename === pattern);
    });

  for (const path of manifestPaths) {
    if (isExcludedFile(path)) continue;

    const content = await fetchFileContent(owner, repo, path, baseBranch);
    if (content) {
      manifests.push({ path, content });
    }
  }

  return manifests;
}

/**
 * Truncate a string to a maximum byte length.
 */
function truncateBytes(str: string, maxBytes: number): string {
  const encoded = new TextEncoder().encode(str);
  if (encoded.length <= maxBytes) return str;
  return new TextDecoder().decode(encoded.slice(0, maxBytes));
}

/**
 * Build a bounded PR snapshot from GitHub data.
 */
export async function fetchPRSnapshot(
  owner: string,
  repo: string,
  prNumber: number
): Promise<
  | {
      ok: true;
      snapshot: {
        repo: string;
        prNumber: number;
        title: string;
        author: string;
        baseBranch: string;
        headBranch: string;
        headSha: string;
        changedFiles: Array<{
          path: string;
          status: "added" | "modified" | "deleted" | "renamed" | "copied";
          additions: number;
          deletions: number;
          patch?: string;
        }>;
        tree: Array<{ path: string; type: "blob" | "tree" }>;
        manifests: Array<{ path: string; content: string }>;
        truncation: {
          filesTruncated: boolean;
          patchesTruncated: boolean;
          treeTruncated: boolean;
          totalTextTruncated: boolean;
        };
      };
    }
  | { ok: false; error: GitHubError }
> {
  // Fetch PR metadata
  const prResult = await fetchPR(owner, repo, prNumber);
  if (!prResult.ok) return prResult;
  const pr = prResult.data;

  // Fetch changed files
  const filesResult = await fetchChangedFiles(owner, repo, prNumber);
  if (!filesResult.ok) return filesResult;
  const rawFiles = filesResult.files;

  const filesTruncated = rawFiles.length >= MAX_CHANGED_FILES;
  const boundedFiles = rawFiles.slice(0, MAX_CHANGED_FILES);

  // Truncate patches and track total text
  let totalTextBytes = 0;
  let patchesTruncated = false;

  const changedFiles = boundedFiles.map((file) => {
    let patch = file.patch;
    if (patch) {
      const patchBytes = new TextEncoder().encode(patch).length;
      if (
        patchBytes > MAX_PATCH_BYTES ||
        totalTextBytes + patchBytes > MAX_TOTAL_TEXT_BYTES
      ) {
        patchesTruncated = true;
        const remaining = Math.min(
          MAX_PATCH_BYTES,
          MAX_TOTAL_TEXT_BYTES - totalTextBytes
        );
        if (remaining > 0) {
          patch = truncateBytes(patch, remaining);
          totalTextBytes += new TextEncoder().encode(patch).length;
        } else {
          patch = undefined;
        }
      } else {
        totalTextBytes += patchBytes;
      }
    }

    return {
      path: file.filename,
      status: file.status as
        | "added"
        | "modified"
        | "deleted"
        | "renamed"
        | "copied",
      additions: file.additions,
      deletions: file.deletions,
      patch,
    };
  });

  // Fetch repository tree
  const treeResult = await fetchTree(owner, repo, pr.baseBranch);
  const tree = treeResult.ok ? treeResult.tree : [];
  const treeTruncated = tree.length >= MAX_TREE_ENTRIES;

  // Fetch manifests
  const manifests = await fetchManifests(owner, repo, tree, pr.baseBranch);

  // Check total text truncation (including manifests)
  let totalTextTruncated = false;
  for (const m of manifests) {
    const bytes = new TextEncoder().encode(m.content).length;
    if (totalTextBytes + bytes > MAX_TOTAL_TEXT_BYTES) {
      totalTextTruncated = true;
      break;
    }
    totalTextBytes += bytes;
  }

  return {
    ok: true,
    snapshot: {
      repo: `${owner}/${repo}`,
      prNumber,
      title: pr.title,
      author: pr.author,
      baseBranch: pr.baseBranch,
      headBranch: pr.headBranch,
      headSha: pr.headSha,
      changedFiles,
      tree,
      manifests,
      truncation: {
        filesTruncated,
        patchesTruncated,
        treeTruncated,
        totalTextTruncated,
      },
    },
  };
}
