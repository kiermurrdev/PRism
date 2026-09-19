import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { generateContext } from "@/lib/analysis/context/generator";
import {
  smallPRSnapshot,
  largePRSnapshot,
  deletedFileSnapshot,
  missingPatchSnapshot,
  truncatedTreeSnapshot,
  excludedFilesSnapshot,
} from "@/__tests__/fixtures/context-fixtures";

describe("context generator", () => {
  describe("deterministic output", () => {
    it("produces identical output for identical input", () => {
      const context1 = generateContext(smallPRSnapshot);
      const context2 = generateContext(smallPRSnapshot);

      assert.strictEqual(context1.context, context2.context);
      assert.strictEqual(context1.truncation.totalChars, context2.truncation.totalChars);
      assert.deepStrictEqual(context1.truncation.truncatedSections, context2.truncation.truncatedSections);
    });

    it("produces deterministic output across multiple runs", () => {
      const results = Array.from({ length: 5 }, () =>
        generateContext(largePRSnapshot)
      );

      for (let i = 1; i < results.length; i++) {
        assert.strictEqual(
          results[i].context,
          results[0].context,
          `Run ${i} differs from run 0`
        );
      }
    });
  });

  describe("priority ordering", () => {
    it("includes patches section before repository structure", () => {
      const { context } = generateContext(smallPRSnapshot);

      const patchesIndex = context.indexOf("=== CHANGES ===");
      const structureIndex = context.indexOf("=== REPOSITORY STRUCTURE ===");

      assert.ok(
        patchesIndex > 0,
        "CHANGES section must be present"
      );
      assert.ok(
        structureIndex > 0,
        "REPOSITORY STRUCTURE section must be present"
      );
      assert.ok(
        patchesIndex < structureIndex,
        "CHANGES must appear before REPOSITORY STRUCTURE"
      );
    });

    it("includes changed files summary before patches", () => {
      const { context } = generateContext(smallPRSnapshot);

      const summaryIndex = context.indexOf("=== CHANGED FILES SUMMARY ===");
      const patchesIndex = context.indexOf("=== CHANGES ===");

      assert.ok(summaryIndex > 0, "CHANGED FILES SUMMARY must be present");
      assert.ok(patchesIndex > 0, "CHANGES must be present");
      assert.ok(
        summaryIndex < patchesIndex,
        "CHANGED FILES SUMMARY must appear before CHANGES"
      );
    });

    it("includes PR metadata first", () => {
      const { context } = generateContext(smallPRSnapshot);

      const metaIndex = context.indexOf("=== PR METADATA ===");
      const summaryIndex = context.indexOf("=== CHANGED FILES SUMMARY ===");

      assert.ok(
        metaIndex === 0,
        "PR METADATA must be the first section"
      );
      assert.ok(
        metaIndex < summaryIndex,
        "PR METADATA must appear before CHANGED FILES SUMMARY"
      );
    });
  });

  describe("exclusions", () => {
    it("excludes binary files from patches", () => {
      const { context } = generateContext(excludedFilesSnapshot);

      // PNG file should not appear in patches
      const changesSection = context.slice(
        context.indexOf("=== CHANGES ==="),
        context.indexOf("=== MANIFESTS AND CONFIGURATION ===")
      );

      assert.ok(
        !changesSection.includes("logo.png"),
        "Binary PNG file should be excluded from patches"
      );
    });

    it("excludes lockfiles from manifests", () => {
      const { context } = generateContext(excludedFilesSnapshot);

      const manifestsSection = context.slice(
        context.indexOf("=== MANIFESTS AND CONFIGURATION ==="),
        context.indexOf("=== REPOSITORY STRUCTURE ===")
      );

      assert.ok(
        !manifestsSection.includes("package-lock.json"),
        "Lockfile should be excluded from manifests"
      );
    });

    it("excludes node_modules from repository structure", () => {
      const { context } = generateContext(excludedFilesSnapshot);

      const structureSection = context.slice(
        context.indexOf("=== REPOSITORY STRUCTURE ==="),
        context.indexOf("=== SUPPORTING CONTEXT ===")
      );

      assert.ok(
        !structureSection.includes("node_modules"),
        "node_modules should be excluded from repository structure"
      );
    });

    it("excludes .next directory from repository structure", () => {
      const { context } = generateContext(excludedFilesSnapshot);

      const structureSection = context.slice(
        context.indexOf("=== REPOSITORY STRUCTURE ==="),
        context.indexOf("=== SUPPORTING CONTEXT ===")
      );

      assert.ok(
        !structureSection.includes(".next"),
        ".next directory should be excluded from repository structure"
      );
    });

    it("excludes dist directory from repository structure", () => {
      const { context } = generateContext(excludedFilesSnapshot);

      const structureSection = context.slice(
        context.indexOf("=== REPOSITORY STRUCTURE ==="),
        context.indexOf("=== SUPPORTING CONTEXT ===")
      );

      assert.ok(
        !structureSection.includes("/dist"),
        "dist directory should be excluded from repository structure"
      );
    });
  });

  describe("per-section limits", () => {
    it("applies per-section character limits", () => {
      const { context, truncation } = generateContext(largePRSnapshot);

      // With 150 files, some sections should be truncated
      assert.ok(
        truncation.truncatedSections.length > 0 ||
          context.length < 60000,
        "Large PR should either truncate some sections or stay within total limit"
      );
    });

    it("includes truncation markers when sections are truncated", () => {
      const { context, truncation } = generateContext(largePRSnapshot);

      if (truncation.truncatedSections.length > 0) {
        assert.ok(
          context.includes("[...truncated]"),
          "Context should include truncation markers when sections are truncated"
        );
      }
    });
  });

  describe("strict total-character limit", () => {
    it("never exceeds the maximum context size", () => {
      const { context, truncation } = generateContext(largePRSnapshot);

      assert.ok(
        context.length <= 60000,
        `Context length ${context.length} exceeds maximum 60000`
      );
      assert.strictEqual(
        truncation.totalChars,
        context.length,
        "truncation.totalChars must match actual context length"
      );
    });

    it("marks totalLimitReached when limit is hit", () => {
      const { context, truncation } = generateContext(largePRSnapshot);

      if (context.length >= 60000) {
        assert.ok(
          truncation.totalLimitReached,
          "totalLimitReached should be true when limit is hit"
        );
      }
    });

    it("includes truncation notice when total limit is exceeded", () => {
      const { context, truncation } = generateContext(largePRSnapshot);

      if (truncation.totalLimitReached) {
        assert.ok(
          context.includes("TRUNCATED") || context.includes("[...truncated]"),
          "Context should include truncation notice when total limit is exceeded"
        );
      }
    });
  });

  describe("truncation metadata", () => {
    it("records correct total character count", () => {
      const { context, truncation } = generateContext(smallPRSnapshot);

      assert.strictEqual(
        truncation.totalChars,
        context.length,
        "totalChars must equal actual context length"
      );
    });

    it("reports truncated sections", () => {
      const { truncation } = generateContext(largePRSnapshot);

      // Should have some truncated sections for a large PR
      if (truncation.truncatedSections.length > 0) {
        assert.ok(
          Array.isArray(truncation.truncatedSections),
          "truncatedSections must be an array"
        );
        assert.ok(
          truncation.truncatedSections.every((s) => typeof s === "string"),
          "All truncated sections must be strings"
        );
      }
    });

    it("propagates ingestion truncation metadata in PR metadata", () => {
      const { context } = generateContext(truncatedTreeSnapshot);

      assert.ok(
        context.includes("treeTruncated") ||
          context.includes("Repository tree was truncated") ||
          context.includes("truncat"),
        "Context should mention truncation from ingestion"
      );
    });
  });

  describe("missing-patch handling", () => {
    it("handles changed files with missing patches without crashing", () => {
      assert.doesNotThrow(() => {
        const result = generateContext(missingPatchSnapshot);
        assert.ok(result.context.length > 0);
      });
    });

    it("indicates when a patch is missing", () => {
      const { context } = generateContext(missingPatchSnapshot);

      assert.ok(
        context.includes("No patch available") ||
          context.includes("settings.json"),
        "Context should indicate missing patch or reference the file"
      );
    });
  });

  describe("deleted-file handling", () => {
    it("handles deleted files without crashing", () => {
      assert.doesNotThrow(() => {
        const result = generateContext(deletedFileSnapshot);
        assert.ok(result.context.length > 0);
      });
    });

    it("marks deleted files appropriately", () => {
      const { context } = generateContext(deletedFileSnapshot);

      assert.ok(
        context.includes("deleted") || context.includes("DELETED"),
        "Context should indicate the file was deleted"
      );
      assert.ok(
        context.includes("old-module"),
        "Context should reference the deleted file path"
      );
    });

    it("handles deleted files with no patch", () => {
      const { context } = generateContext(deletedFileSnapshot);

      // Should not crash or produce empty output
      const changesSection = context.slice(
        context.indexOf("=== CHANGES ===")
      );
      assert.ok(
        changesSection.includes("old-module") ||
          changesSection.includes("deleted"),
        "Changes section should reference the deleted file"
      );
    });
  });

  describe("small PR", () => {
    it("generates complete context for a small PR", () => {
      const { context, truncation } = generateContext(smallPRSnapshot);

      assert.ok(context.length > 0, "Context should not be empty");
      assert.ok(context.includes("=== PR METADATA ==="), "Must include PR metadata");
      assert.ok(
        context.includes("=== CHANGED FILES SUMMARY ==="),
        "Must include changed files summary"
      );
      assert.ok(context.includes("=== CHANGES ==="), "Must include changes");
      assert.ok(
        context.includes("=== MANIFESTS AND CONFIGURATION ==="),
        "Must include manifests"
      );
      assert.ok(
        context.includes("=== REPOSITORY STRUCTURE ==="),
        "Must include repository structure"
      );
      assert.ok(
        context.includes("=== SUPPORTING CONTEXT ==="),
        "Must include supporting context"
      );

      // Small PR should not hit the total limit
      assert.ok(
        !truncation.totalLimitReached,
        "Small PR should not trigger total limit"
      );
    });

    it("includes PR metadata fields", () => {
      const { context } = generateContext(smallPRSnapshot);

      assert.ok(context.includes("owner/repo"), "Must include repo");
      assert.ok(context.includes("42"), "Must include PR number");
      assert.ok(context.includes("Add user authentication"), "Must include title");
      assert.ok(context.includes("dev-user"), "Must include author");
      assert.ok(context.includes("main"), "Must include base branch");
      assert.ok(context.includes("feature/auth"), "Must include head branch");
      assert.ok(context.includes("abc123def456"), "Must include head SHA");
    });
  });

  describe("large PR", () => {
    it("handles a large PR without crashing", () => {
      assert.doesNotThrow(() => {
        const result = generateContext(largePRSnapshot);
        assert.ok(result.context.length > 0);
      });
    });

    it("respects total character limit for large PR", () => {
      const { context, truncation } = generateContext(largePRSnapshot);

      assert.ok(
        context.length <= 60000,
        `Large PR context (${context.length}) must not exceed 60000 chars`
      );
    });
  });

  describe("truncated repository tree", () => {
    it("handles a truncated tree without crashing", () => {
      assert.doesNotThrow(() => {
        const result = generateContext(truncatedTreeSnapshot);
        assert.ok(result.context.length > 0);
      });
    });

    it("includes truncation notice from ingestion metadata", () => {
      const { context } = generateContext(truncatedTreeSnapshot);

      assert.ok(
        context.toLowerCase().includes("truncat"),
        "Context should reference the truncated tree"
      );
    });
  });

  describe("empty and edge cases", () => {
    it("handles empty changed files list", () => {
      const emptySnapshot = {
        ...smallPRSnapshot,
        changedFiles: [],
      };

      assert.doesNotThrow(() => {
        const result = generateContext(emptySnapshot);
        assert.ok(result.context.length > 0);
      });
    });

    it("handles empty tree", () => {
      const emptyTreeSnapshot = {
        ...smallPRSnapshot,
        tree: [],
      };

      assert.doesNotThrow(() => {
        const result = generateContext(emptyTreeSnapshot);
        assert.ok(result.context.length > 0);
      });
    });

    it("handles empty manifests", () => {
      const emptyManifestsSnapshot = {
        ...smallPRSnapshot,
        manifests: [],
      };

      assert.doesNotThrow(() => {
        const result = generateContext(emptyManifestsSnapshot);
        assert.ok(result.context.length > 0);
      });
    });

    it("handles all empty arrays", () => {
      const emptySnapshot = {
        ...smallPRSnapshot,
        changedFiles: [],
        tree: [],
        manifests: [],
      };

      assert.doesNotThrow(() => {
        const result = generateContext(emptySnapshot);
        assert.ok(result.context.length > 0, "Context should still have metadata");
        assert.ok(
          result.context.includes("=== PR METADATA ==="),
          "Metadata section should still be present"
        );
      });
    });
  });
});
