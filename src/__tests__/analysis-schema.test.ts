import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { AnalysisResultSchema } from "@/lib/analysis/schema";
import { goldenAnalysisResult } from "@/__tests__/fixtures/golden-analysis-result";

describe("analysis schema validation", () => {
  it("validates the golden analysis result fixture", () => {
    const result = AnalysisResultSchema.safeParse(goldenAnalysisResult);

    if (!result.success) {
      console.error("Validation issues:", JSON.stringify(result.error?.issues ?? "no error", null, 2));
    }
    assert.ok(
      result.success,
      `Golden fixture failed schema validation`
    );
  });

  it("rejects an analysis result missing required fields", () => {
    const incomplete = {
      title: "Test",
      // missing prUrl, nodes, edges, findings, qaItems, affectedFiles
    };

    const result = AnalysisResultSchema.safeParse(incomplete);
    assert.ok(!result.success, "Should reject incomplete analysis result");
  });

  it("rejects an analysis result with invalid node impact value", () => {
    const invalid = {
      ...goldenAnalysisResult,
      nodes: [
        {
          ...goldenAnalysisResult.nodes[0],
          impact: "unknown" as string,
        },
      ],
    };

    const result = AnalysisResultSchema.safeParse(invalid);
    assert.ok(!result.success, "Should reject invalid impact value");
  });

  it("rejects an analysis result with invalid finding severity", () => {
    const invalid = {
      ...goldenAnalysisResult,
      findings: [
        {
          ...goldenAnalysisResult.findings[0],
          severity: "critical" as string,
        },
      ],
    };

    const result = AnalysisResultSchema.safeParse(invalid);
    assert.ok(!result.success, "Should reject invalid severity value");
  });

  it("rejects an analysis result with invalid file status", () => {
    const invalid = {
      ...goldenAnalysisResult,
      affectedFiles: [
        {
          ...goldenAnalysisResult.affectedFiles[0],
          status: "renamed" as string,
        },
      ],
    };

    const result = AnalysisResultSchema.safeParse(invalid);
    assert.ok(!result.success, "Should reject invalid file status");
  });

  it("rejects an analysis result with invalid node kind", () => {
    const invalid = {
      ...goldenAnalysisResult,
      nodes: [
        {
          ...goldenAnalysisResult.nodes[0],
          kind: "unknown" as string,
        },
      ],
    };

    const result = AnalysisResultSchema.safeParse(invalid);
    assert.ok(!result.success, "Should reject invalid node kind");
  });
});
