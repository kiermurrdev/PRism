/**
 * Limits and configuration for GitHub PR ingestion.
 *
 * These values bound the size and scope of snapshots to keep the prototype
 * predictable and safe. They are exported so tests can reference them.
 */

/** Maximum number of changed files to include in the snapshot. */
export const MAX_CHANGED_FILES = 200;

/** Maximum bytes for a single file patch before truncation. */
export const MAX_PATCH_BYTES = 64 * 1024; // 64 KB

/** Maximum total bytes of collected text (patches + manifests) before truncation. */
export const MAX_TOTAL_TEXT_BYTES = 1 * 1024 * 1024; // 1 MB

/** Maximum tree entries to include in the repository tree. */
export const MAX_TREE_ENTRIES = 1000;

/** Maximum content bytes for a single manifest/config file. */
export const MAX_MANIFEST_BYTES = 32 * 1024; // 32 KB

/** GitHub API base URL. */
export const GITHUB_API_BASE = "https://api.github.com";

/**
 * File extensions and patterns to exclude from content collection.
 * These are considered binary, generated, vendored, or lockfiles.
 */
export const EXCLUDED_EXTENSIONS = new Set([
  // Binary
  ".bin",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".a",
  ".o",
  ".pyc",
  ".pyo",
  ".class",
  ".jar",
  ".war",
  ".ear",
  ".zip",
  ".tar",
  ".gz",
  ".bz2",
  ".xz",
  ".7z",
  ".rar",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".ico",
  ".webp",
  ".svg",
  ".mp4",
  ".mp3",
  ".wav",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  // Generated / lockfiles
  ".lock",
  ".pnpm-lock.yaml",
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  "Cargo.lock",
  "Gemfile.lock",
  "poetry.lock",
  "Pipfile.lock",
  // Vendored / build
  ".min.js",
  ".min.css",
  ".map",
]);

/**
 * Directory names to ignore when collecting content.
 */
export const EXCLUDED_DIRECTORIES = new Set([
  "node_modules",
  "vendor",
  ".git",
  ".svn",
  ".hg",
  "dist",
  "build",
  ".next",
  "__pycache__",
  ".cache",
  ".idea",
  ".vscode",
  "target",
]);

/**
 * Manifest and configuration file names to collect (when present).
 */
export const MANIFEST_PATTERNS = [
  "package.json",
  "tsconfig.json",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "Gemfile",
  "requirements.txt",
  "Dockerfile",
  ".eslintrc",
  ".eslintrc.json",
  ".eslintrc.js",
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "tailwind.config.js",
  "tailwind.config.mjs",
  ".prettierrc",
  ".prettierrc.json",
];
