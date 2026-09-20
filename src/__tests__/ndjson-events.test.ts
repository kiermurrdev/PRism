import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { goldenAnalysisResult } from "@/__tests__/fixtures/golden-analysis-result";

describe("NDJSON progress events", () => {
  /**
   * Verify that NDJSON events can be serialized and parsed correctly.
   * The analyze route streams events as:
   *   {"type":"stage","snapshot":{...}}\n
   *   {"type":"complete","data":{...}}\n
   *   {"type":"error","code":"...","message":"..."}\n
   */

  it("serializes a stage event as valid NDJSON", () => {
    const event = {
      type: "stage" as const,
      snapshot: {
        status: "fetching" as const,
        message: "Reading pull request",
      },
    };

    const line = JSON.stringify(event) + "\n";
    const parsed = JSON.parse(line.trim());

    assert.strictEqual(parsed.type, "stage");
    assert.strictEqual(parsed.snapshot.status, "fetching");
  });

  it("serializes a complete event with the golden result as valid NDJSON", () => {
    const event = {
      type: "complete" as const,
      data: goldenAnalysisResult,
    };

    const line = JSON.stringify(event) + "\n";
    const parsed = JSON.parse(line.trim());

    assert.strictEqual(parsed.type, "complete");
    assert.strictEqual(parsed.data.title, goldenAnalysisResult.title);
    assert.strictEqual(parsed.data.nodes.length, goldenAnalysisResult.nodes.length);
    assert.strictEqual(parsed.data.edges.length, goldenAnalysisResult.edges.length);
  });

  it("serializes an error event as valid NDJSON", () => {
    const event = {
      type: "error" as const,
      code: "PR_NOT_FOUND",
      message: "Pull request not found",
    };

    const line = JSON.stringify(event) + "\n";
    const parsed = JSON.parse(line.trim());

    assert.strictEqual(parsed.type, "error");
    assert.strictEqual(parsed.code, "PR_NOT_FOUND");
  });

  it("multiple events can be concatenated and parsed line by line", () => {
    const events = [
      { type: "stage" as const, snapshot: { status: "fetching" as const, message: "Reading" } },
      { type: "stage" as const, snapshot: { status: "analyzing" as const, message: "Mapping" } },
      { type: "complete" as const, data: goldenAnalysisResult },
    ];

    const stream = events.map((e) => JSON.stringify(e) + "\n").join("");
    const lines = stream.trim().split("\n");

    assert.strictEqual(lines.length, 3);

    const parsedEvents = lines.map((line) => JSON.parse(line));
    assert.strictEqual(parsedEvents[0].type, "stage");
    assert.strictEqual(parsedEvents[1].type, "stage");
    assert.strictEqual(parsedEvents[2].type, "complete");
  });
});
