import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { goldenAnalysisResult } from "@/__tests__/fixtures/golden-analysis-result";

describe("React Flow compatibility", () => {
  it("all nodes have valid positions for React Flow", () => {
    for (const node of goldenAnalysisResult.nodes) {
      assert.ok(
        typeof node.position.x === "number" && !isNaN(node.position.x),
        `Node ${node.id} has invalid x position`
      );
      assert.ok(
        typeof node.position.y === "number" && !isNaN(node.position.y),
        `Node ${node.id} has invalid y position`
      );
    }
  });

  it("all edges reference existing node IDs", () => {
    const nodeIds = new Set(goldenAnalysisResult.nodes.map((n) => n.id));

    for (const edge of goldenAnalysisResult.edges) {
      assert.ok(
        nodeIds.has(edge.source),
        `Edge ${edge.id} references missing source node: ${edge.source}`
      );
      assert.ok(
        nodeIds.has(edge.target),
        `Edge ${edge.id} references missing target node: ${edge.target}`
      );
    }
  });

  it("all findings reference existing node IDs", () => {
    const nodeIds = new Set(goldenAnalysisResult.nodes.map((n) => n.id));

    for (const finding of goldenAnalysisResult.findings) {
      for (const nodeId of finding.affectedNodes) {
        assert.ok(
          nodeIds.has(nodeId),
          `Finding ${finding.id} references missing node: ${nodeId}`
        );
      }
    }
  });

  it("nodes have unique IDs", () => {
    const ids = goldenAnalysisResult.nodes.map((n) => n.id);
    const uniqueIds = new Set(ids);

    assert.strictEqual(
      ids.length,
      uniqueIds.size,
      "Node IDs must be unique"
    );
  });

  it("edges have unique IDs", () => {
    const ids = goldenAnalysisResult.edges.map((e) => e.id);
    const uniqueIds = new Set(ids);

    assert.strictEqual(
      ids.length,
      uniqueIds.size,
      "Edge IDs must be unique"
    );
  });

  it("findings have unique IDs", () => {
    const ids = goldenAnalysisResult.findings.map((f) => f.id);
    const uniqueIds = new Set(ids);

    assert.strictEqual(
      ids.length,
      uniqueIds.size,
      "Finding IDs must be unique"
    );
  });

  it("qa items have unique IDs", () => {
    const ids = goldenAnalysisResult.qaItems.map((q) => q.id);
    const uniqueIds = new Set(ids);

    assert.strictEqual(
      ids.length,
      uniqueIds.size,
      "QA item IDs must be unique"
    );
  });
});
