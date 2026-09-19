import { strict as assert } from "node:assert";
import { describe, it, beforeEach, afterEach, mock } from "node:test";
import { analyzeWithNemotron, MAX_REPAIR_ATTEMPTS } from "@/lib/nemotron/index";
import type { NemotronContext } from "@/lib/nemotron/types";

const VALID_REPORT_JSON = {
  title: "Test PR",
  prUrl: "https://github.com/owner/repo/pull/1",
  summary: "Test summary.",
  nodes: [
    {
      id: "test-node",
      label: "Test Node",
      kind: "frontend",
      impact: "direct",
      description: "A test node.",
      reason: "It was changed.",
      filePaths: ["src/test.ts"],
      position: { x: 100, y: 100 },
    },
  ],
  edges: [],
  findings: [],
  qaItems: [{ id: "qa1", description: "Check something.", checked: false }],
  affectedFiles: [
    {
      path: "src/test.ts",
      status: "modified",
      additions: 10,
      deletions: 2,
      changeType: "Added feature",
    },
  ],
};

function makeContext(): NemotronContext {
  return {
    repo: "owner/repo",
    prNumber: 1,
    title: "Test PR",
    prUrl: "https://github.com/owner/repo/pull/1",
    headSha: "abc123",
    baseBranch: "main",
    headBranch: "feature",
    changedFiles: [
      {
        path: "src/test.ts",
        status: "modified",
        additions: 10,
        deletions: 2,
        patch: "@@ -1 +1 @@\n-old\n+new",
      },
    ],
  };
}

describe("analyzeWithNemotron", () => {
  let originalEnv: Record<string, string | undefined>;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalEnv = {
      NEMOTRON_BASE_URL: process.env.NEMOTRON_BASE_URL,
      NEMOTRON_MODEL: process.env.NEMOTRON_MODEL,
      NVIDIA_API_KEY: process.env.NVIDIA_API_KEY,
    };
    originalFetch = global.fetch;
    process.env.NEMOTRON_BASE_URL = "https://nemotron.example.com/v1";
    process.env.NEMOTRON_MODEL = "nemotron-test-model";
    delete process.env.NVIDIA_API_KEY;
  });

  afterEach(() => {
    Object.assign(process.env, originalEnv);
    global.fetch = originalFetch;
    mock.restoreAll();
  });

  it("returns MISSING_CONFIG when NEMOTRON_BASE_URL is not set", async () => {
    delete process.env.NEMOTRON_BASE_URL;

    const result = await analyzeWithNemotron(makeContext());
    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.error.code, "MISSING_CONFIG");
    }
  });

  it("returns MISSING_CONFIG when NEMOTRON_MODEL is not set", async () => {
    delete process.env.NEMOTRON_MODEL;

    const result = await analyzeWithNemotron(makeContext());
    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.error.code, "MISSING_CONFIG");
    }
  });

  it("returns a valid report on successful response", async () => {
    global.fetch = mock.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify(VALID_REPORT_JSON),
                },
              },
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
    );

    const result = await analyzeWithNemotron(makeContext());
    assert.strictEqual(result.ok, true);
    if (!result.ok) throw new Error("should be ok");

    assert.strictEqual(result.report.title, "Test PR");
    assert.strictEqual(result.report.prUrl, "https://github.com/owner/repo/pull/1");
    assert.strictEqual(result.report.nodes.length, 1);
    assert.strictEqual(result.report.nodes[0].id, "test-node");
    assert.strictEqual(result.report.affectedFiles.length, 1);
    assert.strictEqual(result.report.affectedFiles[0].path, "src/test.ts");
  });

  it("preserves deterministic affected-file statistics from context", async () => {
    const modelReport = {
      ...VALID_REPORT_JSON,
      affectedFiles: [
        {
          path: "src/test.ts",
          status: "added",
          additions: 999,
          deletions: 999,
          changeType: "Model invented stats",
        },
      ],
    };

    global.fetch = mock.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(modelReport) } }],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
    );

    const result = await analyzeWithNemotron(makeContext());
    assert.strictEqual(result.ok, true);
    if (!result.ok) throw new Error("should be ok");

    const file = result.report.affectedFiles[0];
    assert.strictEqual(file.path, "src/test.ts");
    assert.strictEqual(file.status, "modified");
    assert.strictEqual(file.additions, 10);
    assert.strictEqual(file.deletions, 2);
  });

  it("includes only changed files from context in affectedFiles", async () => {
    const ctx = makeContext();
    ctx.changedFiles.push({
      path: "src/another.ts",
      status: "added",
      additions: 5,
      deletions: 0,
    });

    const modelReport = {
      ...VALID_REPORT_JSON,
      affectedFiles: [
        {
          path: "src/test.ts",
          status: "modified",
          additions: 10,
          deletions: 2,
          changeType: "Added feature",
        },
      ],
    };

    global.fetch = mock.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(modelReport) } }],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
    );

    const result = await analyzeWithNemotron(ctx);
    assert.strictEqual(result.ok, true);
    if (!result.ok) throw new Error("should be ok");

    assert.strictEqual(result.report.affectedFiles.length, 2);
    assert.strictEqual(result.report.affectedFiles[0].path, "src/test.ts");
    assert.strictEqual(result.report.affectedFiles[1].path, "src/another.ts");
  });

  it("returns INVALID_JSON on malformed JSON response", async () => {
    global.fetch = mock.fn(() =>
      Promise.resolve(
        new Response("{ not valid json", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const result = await analyzeWithNemotron(makeContext());
    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.error.code, "INVALID_JSON");
    }
  });

  it("returns SCHEMA_INVALID when JSON does not match schema", async () => {
    const invalidReport = {
      title: "Test",
      prUrl: "https://github.com/owner/repo/pull/1",
      summary: "Test",
      nodes: [
        {
          id: "bad",
          label: "Missing required fields",
          kind: "invalid-kind",
        },
      ],
      edges: [],
      findings: [],
      qaItems: [],
      affectedFiles: [],
    };

    global.fetch = mock.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(invalidReport) } }],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
    );

    const result = await analyzeWithNemotron(makeContext());
    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.error.code, "SCHEMA_INVALID");
    }
  });

  it("makes exactly one repair attempt after invalid JSON", async () => {
    let callCount = 0;

    global.fetch = mock.fn(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(
          new Response("{ broken", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(VALID_REPORT_JSON) } }],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      );
    });

    const result = await analyzeWithNemotron(makeContext());
    assert.strictEqual(result.ok, true);
    assert.strictEqual(callCount, 2);
  });

  it("makes exactly one repair attempt after schema-invalid response", async () => {
    let callCount = 0;

    const schemaInvalid = {
      title: "Test",
      prUrl: "https://github.com/owner/repo/pull/1",
      summary: "Test",
      nodes: [{ id: "bad", kind: "not-a-real-kind" }],
      edges: [],
      findings: [],
      qaItems: [],
      affectedFiles: [],
    };

    global.fetch = mock.fn(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: JSON.stringify(schemaInvalid) } }],
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          )
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(VALID_REPORT_JSON) } }],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      );
    });

    const result = await analyzeWithNemotron(makeContext());
    assert.strictEqual(result.ok, true);
    assert.strictEqual(callCount, 2);
  });

  it("fails after MAX_REPAIR_ATTEMPTS when repair also fails", async () => {
    let callCount = 0;

    global.fetch = mock.fn(() => {
      callCount++;
      return Promise.resolve(
        new Response("{ broken", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    const result = await analyzeWithNemotron(makeContext());
    assert.strictEqual(result.ok, false);
    const totalAllowed = 1 + MAX_REPAIR_ATTEMPTS;
    assert.strictEqual(callCount, totalAllowed);
  });

  it("returns TIMEOUT when request exceeds timeout", async () => {
    const originalAbortController = global.AbortController;

    global.AbortController = class extends originalAbortController {
      constructor() {
        super();
      }
    } as typeof AbortController;

    global.fetch = mock.fn((input: unknown, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (signal) {
          signal.addEventListener("abort", () => {
            const err = new Error("The operation was aborted.");
            err.name = "AbortError";
            reject(err);
          });
        }
      });
    });

    const result = await analyzeWithNemotron(makeContext(), { timeoutMs: 50 });

    global.AbortController = originalAbortController;

    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.error.code, "TIMEOUT");
    }
  });

  it("returns AUTH_FAILURE on 401 response", async () => {
    global.fetch = mock.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: { message: "Unauthorized" } }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const result = await analyzeWithNemotron(makeContext());
    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.error.code, "AUTH_FAILURE");
    }
  });

  it("returns AUTH_FAILURE on 403 response", async () => {
    global.fetch = mock.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: { message: "Forbidden" } }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const result = await analyzeWithNemotron(makeContext());
    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.error.code, "AUTH_FAILURE");
    }
  });

  it("returns RATE_LIMITED on 429 response", async () => {
    global.fetch = mock.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: { message: "Rate limited" } }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const result = await analyzeWithNemotron(makeContext());
    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.error.code, "RATE_LIMITED");
    }
  });

  it("returns UPSTREAM_ERROR on 500 response", async () => {
    global.fetch = mock.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: { message: "Internal error" } }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const result = await analyzeWithNemotron(makeContext());
    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.error.code, "UPSTREAM_ERROR");
    }
  });

  it("returns NETWORK_ERROR on fetch failure", async () => {
    global.fetch = mock.fn(() =>
      Promise.reject(new Error("network failure"))
    );

    const result = await analyzeWithNemotron(makeContext());
    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.error.code, "NETWORK_ERROR");
    }
  });

  it("sends Authorization header when NVIDIA_API_KEY is set", async () => {
    process.env.NVIDIA_API_KEY = "test-api-key-123";

    let capturedHeaders: Record<string, string> | undefined;

    global.fetch = mock.fn((input: unknown, init?: RequestInit) => {
      capturedHeaders = init?.headers as Record<string, string> | undefined;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(VALID_REPORT_JSON) } }],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      );
    });

    await analyzeWithNemotron(makeContext());

    assert.ok(capturedHeaders);
    assert.strictEqual(
      capturedHeaders?.["Authorization"],
      "Bearer test-api-key-123"
    );
  });

  it("does not send Authorization header when NVIDIA_API_KEY is not set", async () => {
    delete process.env.NVIDIA_API_KEY;

    let capturedHeaders: Record<string, string> | undefined;

    global.fetch = mock.fn((input: unknown, init?: RequestInit) => {
      capturedHeaders = init?.headers as Record<string, string> | undefined;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(VALID_REPORT_JSON) } }],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      );
    });

    await analyzeWithNemotron(makeContext());

    assert.ok(capturedHeaders);
    assert.strictEqual(capturedHeaders?.["Authorization"], undefined);
  });

  it("does not retry on non-parseable errors (auth failure)", async () => {
    let callCount = 0;

    global.fetch = mock.fn(() => {
      callCount++;
      return Promise.resolve(
        new Response(JSON.stringify({ error: { message: "Unauthorized" } }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    const result = await analyzeWithNemotron(makeContext());
    assert.strictEqual(result.ok, false);
    assert.strictEqual(callCount, 1);
  });

  it("does not retry on timeout", async () => {
    let callCount = 0;

    global.fetch = mock.fn(() => {
      callCount++;
      return new Promise((_resolve, reject) => {
        setTimeout(() => reject(new Error("timeout")), 5000);
      });
    });

    const controllerMock = mock.method(
      AbortController.prototype,
      "abort",
      () => {}
    );

    const result = await analyzeWithNemotron(makeContext(), { timeoutMs: 10 });
    controllerMock.mock.restore();

    assert.strictEqual(result.ok, false);
    assert.strictEqual(callCount, 1);
  });
});
