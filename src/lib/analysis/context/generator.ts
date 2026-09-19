import type { PRSnapshot } from "@/lib/github/types";
import {
  MAX_CONTEXT_CHARS,
  MAX_PR_META_CHARS,
  MAX_CHANGED_FILES_SUMMARY_CHARS,
  MAX_PATCHES_CHARS,
  MAX_REPO_STRUCTURE_CHARS,
  MAX_MANIFESTS_CHARS,
  MAX_SUPPORTING_CHARS,
  BINARY_EXTENSIONS,
  EXCLUDED_PATTERNS,
} from "./constants";

/**
 * Metadata about truncation applied during context generation.
 */
export interface ContextTruncation {
  /** Total characters in the generated context. */
  totalChars: number;
  /** Whether the total character limit was reached. */
  totalLimitReached: boolean;
  /** Which sections were truncated (if any). */
  truncatedSections: string[];
}

/**
 * A single line of context output, used for deterministic assembly.
 */
interface ContextLine {
  text: string;
  section: string;
}

/**
 * Check if a file path should be excluded from context.
 */
function isExcluded(path: string): boolean {
  // Check binary extensions
  const ext = "." + path.split(".").pop()?.toLowerCase();
  if (ext && BINARY_EXTENSIONS.has(ext)) {
    return true;
  }

  // Check excluded patterns
  for (const pattern of EXCLUDED_PATTERNS) {
    if (
      path.startsWith(pattern) ||
      path === pattern ||
      pattern.startsWith(path + "/")
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Get the directory containing a file path.
 */
function getDirectory(path: string): string {
  const parts = path.split("/");
  return parts.length > 1 ? parts.slice(0, -1).join("/") : "";
}

/**
 * Compare two file paths for stable sorting.
 */
function comparePaths(a: string, b: string): number {
  return a.localeCompare(b, "en", { sensitivity: "base" });
}

/**
 * Truncate a string to a maximum length, preserving line boundaries.
 * Returns the truncated string and whether truncation occurred.
 */
function truncateToMax(
  text: string,
  maxChars: number,
  suffix = "\n[...truncated]\n"
): { text: string; truncated: boolean } {
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }

  const available = maxChars - suffix.length;
  if (available < 1) {
    return { text: text.slice(0, maxChars), truncated: true };
  }

  // Find the last newline before the limit to avoid splitting lines
  let cutAt = text.lastIndexOf("\n", available);
  if (cutAt === -1) {
    cutAt = available;
  }

  return { text: text.slice(0, cutAt) + suffix, truncated: true };
}

/**
 * Generate a bounded context string from a PR snapshot.
 *
 * This is a pure transformation:
 * - No GitHub requests
 * - No Nemotron requests
 * - No filesystem access
 * - No environment variable access
 * - No current-time or random behavior
 *
 * Identical input always produces identical output.
 *
 * @param snapshot - The PR snapshot to transform into context
 * @returns The generated context string and truncation metadata
 */
export function generateContext(snapshot: PRSnapshot): {
  context: string;
  truncation: ContextTruncation;
} {
  const lines: ContextLine[] = [];
  const truncatedSections: string[] = [];
  let totalChars = 0;

  // Pre-compute derived sets used across sections
  const changedPaths = new Set(snapshot.changedFiles.map((f) => f.path));

  // Helper to add a line and track total character count
  const addLine = (text: string, section: string) => {
    lines.push({ text, section });
    totalChars += text.length;
  };

  // Helper to check if adding a line would exceed the global limit
  const wouldExceedLimit = (textLength: number): boolean => {
    return totalChars + textLength > MAX_CONTEXT_CHARS;
  };

  // If we've already exceeded the limit, stop adding content
  const isOverLimit = (): boolean => {
    return totalChars >= MAX_CONTEXT_CHARS;
  };

  // ===== SECTION 1: PR METADATA =====
  if (!isOverLimit()) {
    const metaLines: string[] = [];
    metaLines.push("=== PR METADATA ===");
    metaLines.push(`Repository: ${snapshot.repo}`);
    metaLines.push(`PR Number: ${snapshot.prNumber}`);
    metaLines.push(`Title: ${snapshot.title}`);
    metaLines.push(`Author: ${snapshot.author}`);
    metaLines.push(`Base Branch: ${snapshot.baseBranch}`);
    metaLines.push(`Head Branch: ${snapshot.headBranch}`);
    metaLines.push(`Head SHA: ${snapshot.headSha}`);
    metaLines.push(`Changed Files: ${snapshot.changedFiles.length}`);

    // Include truncation info from ingestion
    if (snapshot.truncation) {
      metaLines.push("Ingestion Truncation:");
      if (snapshot.truncation.filesTruncated) {
        metaLines.push("- Changed files list was truncated");
      }
      if (snapshot.truncation.patchesTruncated) {
        metaLines.push("- Some patches were truncated");
      }
      if (snapshot.truncation.treeTruncated) {
        metaLines.push("- Repository tree was truncated");
      }
    }

    const metaText = metaLines.join("\n") + "\n\n";
    const { text: metaContent, truncated } = truncateToMax(
      metaText,
      MAX_PR_META_CHARS
    );
    if (truncated) truncatedSections.push("pr_metadata");
    if (!wouldExceedLimit(metaContent.length)) {
      addLine(metaContent, "pr_metadata");
    }
  }

  // ===== SECTION 2: CHANGED FILES SUMMARY =====
  if (!isOverLimit()) {
    const summaryLines: string[] = [];
    summaryLines.push("=== CHANGED FILES SUMMARY ===");

    // Sort changed files by path for deterministic output
    const sortedFiles = [...snapshot.changedFiles].sort((a, b) =>
      comparePaths(a.path, b.path)
    );

    for (const file of sortedFiles) {
      const status = file.status.toUpperCase();
      const addStr = `+${file.additions}`;
      const delStr = `-${file.deletions}`;
      summaryLines.push(`${status}: ${file.path} (${addStr}, ${delStr})`);
    }

    const summaryText = summaryLines.join("\n") + "\n\n";
    const { text: summaryContent, truncated } = truncateToMax(
      summaryText,
      MAX_CHANGED_FILES_SUMMARY_CHARS
    );
    if (truncated) truncatedSections.push("changed_files_summary");
    if (!wouldExceedLimit(summaryContent.length)) {
      addLine(summaryContent, "changed_files_summary");
    }
  }

  // ===== SECTION 3: CHANGES (PATCHES) - HIGHEST PRIORITY =====
  if (!isOverLimit()) {
    const patchLines: string[] = [];
    patchLines.push("=== CHANGES ===");

    // Sort changed files by path for deterministic output
    const sortedFiles = [...snapshot.changedFiles].sort((a, b) =>
      comparePaths(a.path, b.path)
    );

    for (const file of sortedFiles) {
      if (isExcluded(file.path)) {
        continue;
      }

      patchLines.push(`\n--- ${file.path} (${file.status}) ---`);

      if (file.status === "deleted") {
        patchLines.push("[File deleted - no patch available]");
        continue;
      }

      if (!file.patch || file.patch.trim().length === 0) {
        patchLines.push("[No patch available for this file]");
        continue;
      }

      patchLines.push(file.patch);
    }

    const patchText = patchLines.join("\n") + "\n\n";
    const { text: patchContent, truncated } = truncateToMax(
      patchText,
      MAX_PATCHES_CHARS
    );
    if (truncated) truncatedSections.push("patches");
    if (!wouldExceedLimit(patchContent.length)) {
      addLine(patchContent, "patches");
    }
  }

  // ===== SECTION 4: MANIFESTS AND CONFIGURATION =====
  if (!isOverLimit()) {
    const manifestLines: string[] = [];
    manifestLines.push("=== MANIFESTS AND CONFIGURATION ===");

    // Sort manifests by path for deterministic output
    const sortedManifests = [...snapshot.manifests].sort((a, b) =>
      comparePaths(a.path, b.path)
    );

    for (const manifest of sortedManifests) {
      if (isExcluded(manifest.path)) {
        continue;
      }

      manifestLines.push(`\n--- ${manifest.path} ---`);
      manifestLines.push(manifest.content);
    }

    const manifestText = manifestLines.join("\n") + "\n\n";
    const { text: manifestContent, truncated } = truncateToMax(
      manifestText,
      MAX_MANIFESTS_CHARS
    );
    if (truncated) truncatedSections.push("manifests");
    if (!wouldExceedLimit(manifestContent.length)) {
      addLine(manifestContent, "manifests");
    }
  }

  // ===== SECTION 5: REPOSITORY STRUCTURE =====
  if (!isOverLimit()) {
    const structLines: string[] = [];
    structLines.push("=== REPOSITORY STRUCTURE ===");

    // Build a set of changed file paths and directories for prioritization
    const changedDirs = new Set(
      snapshot.changedFiles.map((f) => getDirectory(f.path))
    );

    // Filter tree entries: exclude binary/generated/vendor, prioritize useful
    const filteredTree = snapshot.tree
      .filter((entry) => !isExcluded(entry.path))
      .sort((a, b) => comparePaths(a.path, b.path));

    // Group by directory for cleaner output
    const dirMap = new Map<string, string[]>();
    const rootFiles: string[] = [];

    for (const entry of filteredTree) {
      if (entry.type === "tree") {
        // Add directory to map
        const existing = dirMap.get(entry.path) || [];
        existing.push(entry.path);
        dirMap.set(entry.path, [...new Set(existing)]);
      } else {
        const dir = getDirectory(entry.path);
        if (dir) {
          const existing = dirMap.get(dir) || [];
          existing.push(entry.path);
          dirMap.set(dir, existing);
        } else {
          rootFiles.push(entry.path);
        }
      }
    }

    // Prioritize directories that contain changed files
    const allDirs = [...dirMap.keys()].sort((a, b) => {
      const aHasChanges = changedDirs.has(a) || [...changedPaths].some((p) => p.startsWith(a + "/"));
      const bHasChanges = changedDirs.has(b) || [...changedPaths].some((p) => p.startsWith(b + "/"));
      if (aHasChanges && !bHasChanges) return -1;
      if (!aHasChanges && bHasChanges) return 1;
      return comparePaths(a, b);
    });

    // Output prioritized directories
    for (const dir of allDirs) {
      structLines.push(`\n${dir}/`);
    }

    // Output root files
    if (rootFiles.length > 0) {
      structLines.push("\n[Root files]");
      for (const file of rootFiles.sort(comparePaths)) {
        structLines.push(`  ${file}`);
      }
    }

    const structText = structLines.join("\n") + "\n\n";
    const { text: structContent, truncated } = truncateToMax(
      structText,
      MAX_REPO_STRUCTURE_CHARS
    );
    if (truncated) truncatedSections.push("repository_structure");
    if (!wouldExceedLimit(structContent.length)) {
      addLine(structContent, "repository_structure");
    }
  }

  // ===== SECTION 6: SUPPORTING CONTEXT (nearby files) =====
  if (!isOverLimit()) {
    const supportLines: string[] = [];
    supportLines.push("=== SUPPORTING CONTEXT ===");

    // Find files in the same directory as changed files
    const nearbyFiles = new Set<string>();
    const changedDirsMap = new Map<string, string[]>();

    for (const file of snapshot.changedFiles) {
      const dir = getDirectory(file.path);
      if (!dir) continue;

      if (!changedDirsMap.has(dir)) {
        changedDirsMap.set(dir, []);
      }
      changedDirsMap.get(dir)!.push(file.path);
    }

    // Find nearby files from the tree
    for (const entry of snapshot.tree) {
      if (entry.type !== "blob" || isExcluded(entry.path)) continue;

      const dir = getDirectory(entry.path);
      const changedInDir = changedDirsMap.get(dir);
      if (changedInDir && !changedInDir.includes(entry.path)) {
        nearbyFiles.add(entry.path);
      }
    }

    if (nearbyFiles.size > 0) {
      supportLines.push("\nNearby files (same directory as changed files):");
      for (const path of [...nearbyFiles].sort(comparePaths)) {
        supportLines.push(`  ${path}`);
      }
    }

    // Find similarly named files (same base name, different directory)
    const changedBasenames = new Map<string, string[]>();
    for (const file of snapshot.changedFiles) {
      const basename = file.path.split("/").pop() || file.path;
      if (!changedBasenames.has(basename)) {
        changedBasenames.set(basename, []);
      }
      changedBasenames.get(basename)!.push(file.path);
    }

    const similarFiles = new Set<string>();
    for (const entry of snapshot.tree) {
      if (entry.type !== "blob" || isExcluded(entry.path)) continue;
      const basename = entry.path.split("/").pop() || entry.path;
      if (changedBasenames.has(basename) && !changedPaths.has(entry.path)) {
        similarFiles.add(entry.path);
      }
    }

    if (similarFiles.size > 0) {
      supportLines.push("\nSimilarly named files:");
      for (const path of [...similarFiles].sort(comparePaths)) {
        supportLines.push(`  ${path}`);
      }
    }

    const supportText = supportLines.join("\n") + "\n\n";
    const { text: supportContent, truncated } = truncateToMax(
      supportText,
      MAX_SUPPORTING_CHARS
    );
    if (truncated) truncatedSections.push("supporting_context");
    if (!wouldExceedLimit(supportContent.length)) {
      addLine(supportContent, "supporting_context");
    }
  }

  // ===== ASSEMBLE FINAL CONTEXT =====
  let context = "";
  let finalTruncated = false;

  for (const line of lines) {
    const remaining = MAX_CONTEXT_CHARS - context.length;
    if (remaining <= 0) {
      finalTruncated = true;
      break;
    }

    if (line.text.length <= remaining) {
      context += line.text;
    } else {
      // Truncate this line to fit
      context += line.text.slice(0, remaining);
      finalTruncated = true;
      break;
    }
  }

  // Add truncation notice if needed
  if (finalTruncated && !context.endsWith("[...truncated]")) {
    context += "\n\n[CONTEXT TRUNCATED: exceeded maximum character limit]\n";
  }

  // Calculate actual final length
  const actualChars = context.length;

  return {
    context,
    truncation: {
      totalChars: actualChars,
      totalLimitReached: finalTruncated || actualChars >= MAX_CONTEXT_CHARS,
      truncatedSections: [...new Set(truncatedSections)],
    },
  };
}
