import { strict as assert } from "node:assert";
import { describe, it, beforeEach, afterEach } from "node:test";
import { goldenAnalysisResult } from "@/__tests__/fixtures/golden-analysis-result";

// Mock sessionStorage type for tests
type MockSessionStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  readonly length: number;
  key: (index: number) => string | null;
};

describe("analysis result load/store", () => {
  // Mock sessionStorage for Node.js test environment
  let mockStorage: Record<string, string>;
  let mockSessionStorage: MockSessionStorage;

  beforeEach(() => {
    mockStorage = {};
    mockSessionStorage = {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
      get length() {
        return Object.keys(mockStorage).length;
      },
      key: (index: number) => {
        const keys = Object.keys(mockStorage);
        return keys[index] ?? null;
      },
    };

    Object.defineProperty(global, "sessionStorage", {
      value: mockSessionStorage,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).sessionStorage;
  });

  it("stores and loads the golden analysis result via JSON", () => {
    const serialized = JSON.stringify(goldenAnalysisResult);
    mockSessionStorage.setItem("prism_analysis_result", serialized);

    const stored = JSON.parse(
      mockSessionStorage.getItem("prism_analysis_result")!
    );

    assert.deepStrictEqual(stored, goldenAnalysisResult);
  });

  it("preserves all node fields through JSON round-trip", () => {
    const serialized = JSON.stringify(goldenAnalysisResult);
    const restored = JSON.parse(serialized);

    for (const original of goldenAnalysisResult.nodes) {
      const found = restored.nodes.find((n: typeof original) => n.id === original.id);
      assert.ok(found, `Node ${original.id} missing after round-trip`);
      assert.strictEqual(found.position.x, original.position.x);
      assert.strictEqual(found.position.y, original.position.y);
      assert.deepStrictEqual(found.filePaths, original.filePaths);
    }
  });

  it("preserves all edge fields through JSON round-trip", () => {
    const serialized = JSON.stringify(goldenAnalysisResult);
    const restored = JSON.parse(serialized);

    for (const original of goldenAnalysisResult.edges) {
      const found = restored.edges.find((e: typeof original) => e.id === original.id);
      assert.ok(found, `Edge ${original.id} missing after round-trip`);
      assert.strictEqual(found.source, original.source);
      assert.strictEqual(found.target, original.target);
    }
  });

  it("preserves QA item checked state through JSON round-trip", () => {
    const serialized = JSON.stringify(goldenAnalysisResult);
    const restored = JSON.parse(serialized);

    for (const original of goldenAnalysisResult.qaItems) {
      const found = restored.qaItems.find((q: typeof original) => q.id === original.id);
      assert.ok(found, `QA item ${original.id} missing after round-trip`);
      assert.strictEqual(found.checked, original.checked);
    }
  });

  it("handles corrupted JSON gracefully", () => {
    mockSessionStorage.setItem("prism_analysis_result", "{invalid json");

    let parsed: unknown;
    let errorThrown = false;

    try {
      parsed = JSON.parse(mockSessionStorage.getItem("prism_analysis_result")!);
    } catch {
      errorThrown = true;
    }

    assert.ok(errorThrown, "Should throw on corrupted JSON");
    assert.strictEqual(parsed, undefined);
  });
});
