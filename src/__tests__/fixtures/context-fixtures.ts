import type { PRSnapshot } from "@/lib/github/types";

/**
 * Fixtures for the repository-context generator tests.
 *
 * These are typed local fixtures representing various PR scenarios.
 */

/**
 * A small, realistic PR snapshot.
 */
export const smallPRSnapshot: PRSnapshot = {
  repo: "owner/repo",
  prNumber: 42,
  title: "Add user authentication",
  author: "dev-user",
  baseBranch: "main",
  headBranch: "feature/auth",
  headSha: "abc123def456",
  changedFiles: [
    {
      path: "src/lib/auth.ts",
      status: "added",
      additions: 45,
      deletions: 0,
      patch: `@@ -0,0 +1,45 @@
+import { hash, verify } from "crypto";
+
+export async function createUser(email: string, password: string) {
+  const hashed = await hash(password);
+  return { email, hashed };
+}
+
+export async function verifyPassword(
+  input: string,
+  stored: string
+): Promise<boolean> {
+  return verify(input, stored);
+}`,
    },
    {
      path: "src/app/login/page.tsx",
      status: "added",
      additions: 30,
      deletions: 0,
      patch: `@@ -0,0 +1,30 @@
+import { createUser } from "@/lib/auth";
+
+export default function LoginPage() {
+  return <form>Login</form>;
+}`,
    },
  ],
  tree: [
    { path: "src/lib/auth.ts", type: "blob" },
    { path: "src/lib/utils.ts", type: "blob" },
    { path: "src/app/login/page.tsx", type: "blob" },
    { path: "src/app/page.tsx", type: "blob" },
    { path: "package.json", type: "blob" },
    { path: "tsconfig.json", type: "blob" },
    { path: "src", type: "tree" },
    { path: "src/lib", type: "tree" },
    { path: "src/app", type: "tree" },
  ],
  manifests: [
    {
      path: "package.json",
      content: `{
  "name": "repo",
  "version": "1.0.0",
  "dependencies": {
    "react": "^19.0.0"
  }
}`,
    },
    {
      path: "tsconfig.json",
      content: `{
  "compilerOptions": {
    "strict": true,
    "module": "esnext"
  }
}`,
    },
  ],
  truncation: {
    filesTruncated: false,
    patchesTruncated: false,
    treeTruncated: false,
    totalTextTruncated: false,
  },
};

/**
 * A large PR snapshot with many changed files.
 */
export const largePRSnapshot: PRSnapshot = (() => {
  const changedFiles: PRSnapshot["changedFiles"] = [];
  const tree: PRSnapshot["tree"] = [];

  for (let i = 0; i < 150; i++) {
    const path = `src/modules/module${i}/index.ts`;
    changedFiles.push({
      path,
      status: "modified",
      additions: 20,
      deletions: 10,
      patch: `@@ -1,5 +1,10 @@
+// New code in module${i}
+export function feature${i}() {
+  return true;
+}`,
    });
    tree.push({ path, type: "blob" });
    tree.push({ path: `src/modules/module${i}`, type: "tree" });
  }

  return {
    repo: "owner/large-repo",
    prNumber: 999,
    title: "Massive refactoring across all modules",
    author: "refactor-bot",
    baseBranch: "main",
    headBranch: "refactor/all",
    headSha: "deadbeef1234",
    changedFiles,
    tree: [
      ...tree,
      { path: "package.json", type: "blob" },
      { path: "src", type: "tree" },
    ],
    manifests: [
      {
        path: "package.json",
        content: `{"name":"large-repo","version":"2.0.0"}`,
      },
    ],
    truncation: {
      filesTruncated: true,
      patchesTruncated: false,
      treeTruncated: true,
      totalTextTruncated: false,
    },
  };
})();

/**
 * A PR that includes a deleted file.
 */
export const deletedFileSnapshot: PRSnapshot = {
  repo: "owner/repo",
  prNumber: 100,
  title: "Remove legacy module",
  author: "dev-user",
  baseBranch: "main",
  headBranch: "cleanup/legacy",
  headSha: "deleted123",
  changedFiles: [
    {
      path: "src/legacy/old-module.ts",
      status: "deleted",
      additions: 0,
      deletions: 120,
      patch: undefined,
    },
    {
      path: "src/app/index.ts",
      status: "modified",
      additions: 1,
      deletions: 3,
      patch: `@@ -5,7 +5,6 @@
-import { legacy } from "@/legacy/old-module";
+// Removed legacy module import
 export default function App() {`,
    },
  ],
  tree: [
    { path: "src/app/index.ts", type: "blob" },
    { path: "src/app", type: "tree" },
    { path: "package.json", type: "blob" },
  ],
  manifests: [
    {
      path: "package.json",
      content: `{"name":"repo","version":"1.0.0"}`,
    },
  ],
  truncation: {
    filesTruncated: false,
    patchesTruncated: false,
    treeTruncated: false,
    totalTextTruncated: false,
  },
};

/**
 * A PR where a changed file has a missing patch.
 */
export const missingPatchSnapshot: PRSnapshot = {
  repo: "owner/repo",
  prNumber: 101,
  title: "Update config",
  author: "dev-user",
  baseBranch: "main",
  headBranch: "update/config",
  headSha: "nopatch123",
  changedFiles: [
    {
      path: "src/config/settings.json",
      status: "modified",
      additions: 5,
      deletions: 2,
      patch: undefined, // Patch is missing
    },
    {
      path: "src/config/index.ts",
      status: "modified",
      additions: 3,
      deletions: 1,
      patch: `@@ -1,3 +1,5 @@
+// New config loading
-export const config = load();
+export const config = loadAdvanced();`,
    },
  ],
  tree: [
    { path: "src/config/settings.json", type: "blob" },
    { path: "src/config/index.ts", type: "blob" },
    { path: "src/config", type: "tree" },
    { path: "package.json", type: "blob" },
  ],
  manifests: [
    {
      path: "package.json",
      content: `{"name":"repo","version":"1.0.0"}`,
    },
  ],
  truncation: {
    filesTruncated: false,
    patchesTruncated: false,
    treeTruncated: false,
    totalTextTruncated: false,
  },
};

/**
 * A snapshot with a truncated repository tree.
 */
export const truncatedTreeSnapshot: PRSnapshot = {
  repo: "owner/repo",
  prNumber: 102,
  title: "Small change in large repo",
  author: "dev-user",
  baseBranch: "main",
  headBranch: "fix/small",
  headSha: "small123",
  changedFiles: [
    {
      path: "src/core/main.ts",
      status: "modified",
      additions: 2,
      deletions: 1,
      patch: `@@ -10,4 +10,5 @@
 export function main() {
+  // Fixed bug
   return run();
 }`,
    },
  ],
  tree: [
    { path: "src/core/main.ts", type: "blob" },
    { path: "src/core/utils.ts", type: "blob" },
    { path: "src/core", type: "tree" },
    { path: "package.json", type: "blob" },
  ],
  manifests: [
    {
      path: "package.json",
      content: `{"name":"repo","version":"1.0.0"}`,
    },
  ],
  truncation: {
    filesTruncated: false,
    patchesTruncated: false,
    treeTruncated: true,
    totalTextTruncated: false,
  },
};

/**
 * A snapshot with binary, generated, vendor, and lockfile entries that should be excluded.
 */
export const excludedFilesSnapshot: PRSnapshot = {
  repo: "owner/repo",
  prNumber: 103,
  title: "Mixed content PR",
  author: "dev-user",
  baseBranch: "main",
  headBranch: "mixed",
  headSha: "mixed123",
  changedFiles: [
    {
      path: "src/app/page.tsx",
      status: "modified",
      additions: 10,
      deletions: 5,
      patch: `@@ -1,5 +1,10 @@
+// New feature
 export default function Page() {`,
    },
    {
      path: "public/logo.png",
      status: "modified",
      additions: 1,
      deletions: 1,
      patch: undefined,
    },
    {
      path: "package-lock.json",
      status: "modified",
      additions: 500,
      deletions: 300,
      patch: `@@ -1,10 +1,10 @@`,
    },
    {
      path: "node_modules/some-dep/index.js",
      status: "modified",
      additions: 10,
      deletions: 5,
      patch: `@@ -1,5 +1,5 @@`,
    },
  ],
  tree: [
    { path: "src/app/page.tsx", type: "blob" },
    { path: "public/logo.png", type: "blob" },
    { path: "package-lock.json", type: "blob" },
    { path: "package.json", type: "blob" },
    { path: "node_modules/some-dep/index.js", type: "blob" },
    { path: ".next/cache/data.json", type: "blob" },
    { path: "dist/bundle.js", type: "blob" },
    { path: "src", type: "tree" },
    { path: "src/app", type: "tree" },
    { path: "public", type: "tree" },
    { path: "node_modules", type: "tree" },
    { path: ".next", type: "tree" },
    { path: "dist", type: "tree" },
  ],
  manifests: [
    {
      path: "package.json",
      content: `{"name":"repo","version":"1.0.0"}`,
    },
    {
      path: "package-lock.json",
      content: `{"lockfileVersion":3}`,
    },
  ],
  truncation: {
    filesTruncated: false,
    patchesTruncated: false,
    treeTruncated: false,
    totalTextTruncated: false,
  },
};
