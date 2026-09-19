import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  MAX_CHANGED_FILES,
  MAX_PATCH_BYTES,
  MAX_TOTAL_TEXT_BYTES,
  MAX_TREE_ENTRIES,
  MAX_MANIFEST_BYTES,
  EXCLUDED_EXTENSIONS,
  EXCLUDED_DIRECTORIES,
} from "@/lib/github/constants";

describe("GitHub ingestion constants", () => {
  describe("EXCLUDED_EXTENSIONS", () => {
    it("excludes common binary formats", () => {
      assert.ok(EXCLUDED_EXTENSIONS.has(".png"));
      assert.ok(EXCLUDED_EXTENSIONS.has(".jpg"));
      assert.ok(EXCLUDED_EXTENSIONS.has(".gif"));
      assert.ok(EXCLUDED_EXTENSIONS.has(".pdf"));
      assert.ok(EXCLUDED_EXTENSIONS.has(".exe"));
      assert.ok(EXCLUDED_EXTENSIONS.has(".dll"));
      assert.ok(EXCLUDED_EXTENSIONS.has(".zip"));
      assert.ok(EXCLUDED_EXTENSIONS.has(".tar"));
      assert.ok(EXCLUDED_EXTENSIONS.has(".gz"));
    });

    it("excludes compiled artifacts", () => {
      assert.ok(EXCLUDED_EXTENSIONS.has(".pyc"));
      assert.ok(EXCLUDED_EXTENSIONS.has(".class"));
      assert.ok(EXCLUDED_EXTENSIONS.has(".o"));
      assert.ok(EXCLUDED_EXTENSIONS.has(".a"));
      assert.ok(EXCLUDED_EXTENSIONS.has(".so"));
    });

    it("excludes lockfiles", () => {
      assert.ok(EXCLUDED_EXTENSIONS.has(".lock"));
      assert.ok(EXCLUDED_EXTENSIONS.has("package-lock.json"));
      assert.ok(EXCLUDED_EXTENSIONS.has("yarn.lock"));
      assert.ok(EXCLUDED_EXTENSIONS.has("pnpm-lock.yaml"));
      assert.ok(EXCLUDED_EXTENSIONS.has("Cargo.lock"));
      assert.ok(EXCLUDED_EXTENSIONS.has("Gemfile.lock"));
    });

    it("excludes source maps and minified files", () => {
      assert.ok(EXCLUDED_EXTENSIONS.has(".map"));
      assert.ok(EXCLUDED_EXTENSIONS.has(".min.js"));
      assert.ok(EXCLUDED_EXTENSIONS.has(".min.css"));
    });
  });

  describe("EXCLUDED_DIRECTORIES", () => {
    it("excludes dependency directories", () => {
      assert.ok(EXCLUDED_DIRECTORIES.has("node_modules"));
      assert.ok(EXCLUDED_DIRECTORIES.has("vendor"));
    });

    it("excludes version control directories", () => {
      assert.ok(EXCLUDED_DIRECTORIES.has(".git"));
      assert.ok(EXCLUDED_DIRECTORIES.has(".svn"));
      assert.ok(EXCLUDED_DIRECTORIES.has(".hg"));
    });

    it("excludes build output directories", () => {
      assert.ok(EXCLUDED_DIRECTORIES.has("dist"));
      assert.ok(EXCLUDED_DIRECTORIES.has("build"));
      assert.ok(EXCLUDED_DIRECTORIES.has(".next"));
      assert.ok(EXCLUDED_DIRECTORIES.has("target"));
    });

    it("excludes cache directories", () => {
      assert.ok(EXCLUDED_DIRECTORIES.has("__pycache__"));
      assert.ok(EXCLUDED_DIRECTORIES.has(".cache"));
    });
  });

  describe("limits", () => {
    it("defines a reasonable MAX_CHANGED_FILES", () => {
      assert.ok(MAX_CHANGED_FILES > 0);
      assert.ok(MAX_CHANGED_FILES <= 1000);
    });

    it("defines a reasonable MAX_PATCH_BYTES", () => {
      assert.ok(MAX_PATCH_BYTES > 0);
      assert.ok(MAX_PATCH_BYTES <= 1 * 1024 * 1024); // <= 1 MB
    });

    it("defines a reasonable MAX_TOTAL_TEXT_BYTES", () => {
      assert.ok(MAX_TOTAL_TEXT_BYTES > 0);
      assert.ok(MAX_TOTAL_TEXT_BYTES <= 10 * 1024 * 1024); // <= 10 MB
    });

    it("defines a reasonable MAX_TREE_ENTRIES", () => {
      assert.ok(MAX_TREE_ENTRIES > 0);
      assert.ok(MAX_TREE_ENTRIES <= 10000);
    });

    it("defines a reasonable MAX_MANIFEST_BYTES", () => {
      assert.ok(MAX_MANIFEST_BYTES > 0);
      assert.ok(MAX_MANIFEST_BYTES <= 1 * 1024 * 1024); // <= 1 MB
    });
  });
});
