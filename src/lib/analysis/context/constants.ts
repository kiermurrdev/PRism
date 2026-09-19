/**
 * Constants for the repository-context generator.
 *
 * These define the limits and exclusion rules applied when transforming
 * a PRSnapshot into compact context for the Nemotron prompt.
 */

/**
 * Maximum total characters in the generated context (inclusive of headings,
 * separators, and truncation notices).
 */
export const MAX_CONTEXT_CHARS = 60_000;

/**
 * Maximum characters for the PR metadata section.
 */
export const MAX_PR_META_CHARS = 500;

/**
 * Maximum characters for the changed-files summary section.
 */
export const MAX_CHANGED_FILES_SUMMARY_CHARS = 1_500;

/**
 * Maximum characters for the patches section.
 */
export const MAX_PATCHES_CHARS = 30_000;

/**
 * Maximum characters for the repository structure section.
 */
export const MAX_REPO_STRUCTURE_CHARS = 5_000;

/**
 * Maximum characters for the manifests/config section.
 */
export const MAX_MANIFESTS_CHARS = 5_000;

/**
 * Maximum characters for the supporting context section (nearby files, etc.).
 */
export const MAX_SUPPORTING_CHARS = 5_000;

/**
 * File extensions considered binary and excluded from context.
 */
export const BINARY_EXTENSIONS = new Set<string>([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".ico",
  ".webp",
  ".svg",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".mp4",
  ".webm",
  ".avi",
  ".mov",
  ".mp3",
  ".wav",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".zip",
  ".tar",
  ".gz",
  ".bz2",
  ".xz",
  ".7z",
  ".rar",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
]);

/**
 * File patterns considered generated, vendored, or lockfiles and excluded.
 */
export const EXCLUDED_PATTERNS = new Set<string>([
  "node_modules/",
  ".git/",
  ".next/",
  "dist/",
  "build/",
  ".cache/",
  ".eslintcache",
  ".eslintrc.cache",
  "pnpm-lock.yaml",
  "yarn.lock",
  "package-lock.json",
  "poetry.lock",
  "Cargo.lock",
  "Gemfile.lock",
  "composer.lock",
  "vendor/",
  ".venv/",
  "venv/",
  "__pycache__/",
  ".tox/",
  ".mypy_cache/",
  ".pytest_cache/",
  ".coverage",
  "coverage/",
  ".nyc_output/",
  ".parcel-cache/",
  ".turbo/",
  ".rollup.cache/",
  ".swc/",
  ".docusaurus/",
]);

/**
 * Manifest and configuration file names that are always included when present.
 */
export const MANIFEST_NAMES = new Set<string>([
  "package.json",
  "tsconfig.json",
  "next.config.js",
  "next.config.ts",
  "next.config.mjs",
  "webpack.config.js",
  "webpack.config.ts",
  "vite.config.js",
  "vite.config.ts",
  ".eslintrc.js",
  ".eslintrc.cjs",
  ".eslintrc.json",
  ".prettierrc",
  ".prettierrc.json",
  ".prettierrc.js",
  ".prettierrc.cjs",
  ".babelrc",
  "babel.config.js",
  "babel.config.json",
  "playwright.config.ts",
  "jest.config.js",
  "jest.config.ts",
  "vitest.config.ts",
  "tailwind.config.js",
  "tailwind.config.ts",
  "postcss.config.js",
  "postcss.config.mjs",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "go.sum",
  "requirements.txt",
  "Pipfile",
  "Gemfile",
  ".github/workflows/",
]);

/**
 * Directory prefixes considered useful for repository structure context.
 */
export const USEFUL_DIRS = new Set<string>([
  "src/",
  "lib/",
  "app/",
  "components/",
  "pages/",
  "api/",
  "routes/",
  "tests/",
  "test/",
  "__tests__/",
  "scripts/",
  "config/",
  "public/",
  "assets/",
  ".github/",
]);
