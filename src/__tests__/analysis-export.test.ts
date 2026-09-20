import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { serializeReport, exportReportAsJson } from "@/lib/analysis/export";
import { goldenAnalysisResult } from "@/__tests__/fixtures/golden-analysis-result";

describe("analysis export helpers", () => {
  it("serializes a valid AnalysisResult to a JSON blob", () => {
    const result = serializeReport(goldenAnalysisResult);
    assert.ok("blob" in result, "Should return blob");
    assert.ok(result.filename.endsWith(".json"));
    assert.strictEqual(result.blob.type, "application/json");
  });

  it("uses a custom filename when provided", () => {
    const result = serializeReport(goldenAnalysisResult, { filename: "my-report" });
    assert.ok("blob" in result);
    assert.strictEqual(result.filename, "my-report.json");
  });

  it("rejects invalid data with a validation error", () => {
    const invalid = { title: "test" };
    const result = serializeReport(invalid);
    assert.ok("error" in result);
    assert.strictEqual(result.error.kind, "validation");
  });

  it("exports a valid report without serialization error", async () => {
    // exportReportAsJson calls DOM APIs in downloadBlob; test serialization path only
    const serialized = serializeReport(goldenAnalysisResult);
    assert.ok("blob" in serialized);
    assert.ok(serialized.blob.size > 0);
  });

  it("returns a validation error when exporting invalid data", async () => {
    const outcome = await exportReportAsJson({ title: "test" });
    assert.ok(outcome.error);
    assert.strictEqual(outcome.error.kind, "validation");
  });
});
