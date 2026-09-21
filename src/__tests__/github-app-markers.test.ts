import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  buildMarkerStart,
  buildMarkerBlock,
  parseMarker,
  isPrismComment,
} from "@/lib/github/app/markers";

describe("GitHub App comment markers", () => {
  const REPO = "owner/repo";
  const PR_NUMBER = 42;
  const SHA = "abc123def456";

  describe("buildMarkerStart", () => {
    it("builds the correct start marker format", () => {
      const marker = buildMarkerStart(REPO, PR_NUMBER, SHA);
      assert.strictEqual(
        marker,
        "<!-- PRISM_ANALYSIS_START:repo=owner/repo:pr=42:sha=abc123def456 -->",
      );
    });
  });

  describe("buildMarkerBlock", () => {
    it("wraps content with start and end markers", () => {
      const content = "Analysis summary here.";
      const block = buildMarkerBlock(REPO, PR_NUMBER, SHA, content);

      assert.ok(block.includes("<!-- PRISM_ANALYSIS_START:repo=owner/repo:pr=42:sha=abc123def456 -->"));
      assert.ok(block.includes("Analysis summary here."));
      assert.ok(block.includes("<!-- PRISM_ANALYSIS_END -->"));
    });

    it("preserves newlines in content", () => {
      const content = "Line 1\nLine 2\nLine 3";
      const block = buildMarkerBlock(REPO, PR_NUMBER, SHA, content);
      assert.ok(block.includes("Line 1\nLine 2\nLine 3"));
    });
  });

  describe("parseMarker", () => {
    it("parses a valid marker from a comment", () => {
      const comment = buildMarkerBlock(REPO, PR_NUMBER, SHA, "Some content");
      const marker = parseMarker(comment);

      assert.ok(marker);
      assert.strictEqual(marker!.repo, REPO);
      assert.strictEqual(marker!.prNumber, PR_NUMBER);
      assert.strictEqual(marker!.sha, SHA);
    });

    it("parses marker even with extra text before and after", () => {
      const comment =
        "Here is some text.\n" +
        "<!-- PRISM_ANALYSIS_START:repo=org/project:pr=99:sha=deadbeef -->\n" +
        "Content\n" +
        "<!-- PRISM_ANALYSIS_END -->\n" +
        "More text after.";
      const marker = parseMarker(comment);

      assert.ok(marker);
      assert.strictEqual(marker!.repo, "org/project");
      assert.strictEqual(marker!.prNumber, 99);
      assert.strictEqual(marker!.sha, "deadbeef");
    });

    it("returns null for a comment without a marker", () => {
      const marker = parseMarker("This is just a regular comment.");
      assert.strictEqual(marker, null);
    });

    it("returns null for a marker with invalid pr number", () => {
      const comment =
        "<!-- PRISM_ANALYSIS_START:repo=owner/repo:pr=abc:sha=abc123 -->\n" +
        "Content\n" +
        "<!-- PRISM_ANALYSIS_END -->";
      const marker = parseMarker(comment);
      assert.strictEqual(marker, null);
    });

    it("returns null for a marker with zero pr number", () => {
      const comment =
        "<!-- PRISM_ANALYSIS_START:repo=owner/repo:pr=0:sha=abc123 -->\n" +
        "Content\n" +
        "<!-- PRISM_ANALYSIS_END -->";
      const marker = parseMarker(comment);
      assert.strictEqual(marker, null);
    });

    it("returns null for a marker with non-hex sha", () => {
      const comment =
        "<!-- PRISM_ANALYSIS_START:repo=owner/repo:pr=1:sha=zzzzzz -->\n" +
        "Content\n" +
        "<!-- PRISM_ANALYSIS_END -->";
      const marker = parseMarker(comment);
      assert.strictEqual(marker, null);
    });
  });

  describe("isPrismComment", () => {
    it("returns true for a PRism-generated comment", () => {
      const comment = buildMarkerBlock(REPO, PR_NUMBER, SHA, "Content");
      assert.ok(isPrismComment(comment));
    });

    it("returns false for a regular comment", () => {
      assert.ok(!isPrismComment("Looks good to me!"));
    });

    it("returns false for a comment with only a start marker", () => {
      const comment = "<!-- PRISM_ANALYSIS_START:repo=x/y:pr=1:sha=abc -->\nContent";
      assert.ok(!isPrismComment(comment));
    });

    it("returns false for a comment with only an end marker", () => {
      const comment = "Content\n<!-- PRISM_ANALYSIS_END -->";
      assert.ok(!isPrismComment(comment));
    });
  });

  describe("idempotency scenarios", () => {
    it("can detect same PR different SHA for update-in-place", () => {
      const oldComment = buildMarkerBlock(REPO, PR_NUMBER, "abcdef111111", "Old analysis");
      const newComment = buildMarkerBlock(REPO, PR_NUMBER, "abcdef222222", "New analysis");

      const oldMarker = parseMarker(oldComment);
      const newMarker = parseMarker(newComment);

      assert.ok(oldMarker && newMarker);
      assert.strictEqual(oldMarker!.repo, newMarker!.repo);
      assert.strictEqual(oldMarker!.prNumber, newMarker!.prNumber);
      assert.notStrictEqual(oldMarker!.sha, newMarker!.sha);
    });

    it("can detect same PR same SHA for no-op", () => {
      const comment1 = buildMarkerBlock(REPO, PR_NUMBER, SHA, "Analysis v1");
      const comment2 = buildMarkerBlock(REPO, PR_NUMBER, SHA, "Analysis v2");

      const marker1 = parseMarker(comment1);
      const marker2 = parseMarker(comment2);

      assert.ok(marker1 && marker2);
      assert.strictEqual(marker1!.repo, marker2!.repo);
      assert.strictEqual(marker1!.prNumber, marker2!.prNumber);
      assert.strictEqual(marker1!.sha, marker2!.sha);
    });
  });
});
