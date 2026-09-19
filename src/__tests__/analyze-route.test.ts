import { strict as assert } from "node:assert";
import { describe, it, beforeEach, afterEach, mock } from "node:test";
import type { NextRequest, NextResponse } from "next/server";

describe("POST /api/analyze", () => {
  let originalFetch: typeof global.fetch;
  let POST: (req: NextRequest) => Promise<NextResponse>;

  beforeEach(() => {
    originalFetch = global.fetch;
    process.env.GITHUB_TOKEN = "test-github-token";
    process.env.NEMOTRON_BASE_URL = "https://nemotron.example.com/v1";
    process.env.NEMOTRON_MODEL = "nemotron-test-model";
    delete process.env.NVIDIA_API_KEY;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    Object.assign(process.env, {
      GITHUB_TOKEN: undefined,
      NEMOTRON_BASE_URL: undefined,
      NEMOTRON_MODEL: undefined,
      NVIDIA_API_KEY: undefined,
    });
    mock.restoreAll();
  });

  it("returns 400 for non-JSON body", async () => {
    POST = (await import("@/app/api/analyze/route")).POST;
    const req = {
      json: () => Promise.reject(new Error("not json")),
    } as NextRequest;
    const res = await POST(req);
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.code, "INVALID_REQUEST");
  });

  it("returns 400 for missing repo field", async () => {
    POST = (await import("@/app/api/analyze/route")).POST;
    const req = {
      json: () => Promise.resolve({ prNumber: 42 }),
    } as NextRequest;
    const res = await POST(req);
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.code, "INVALID_REQUEST");
  });

  it("returns 400 for missing prNumber field", async () => {
    POST = (await import("@/app/api/analyze/route")).POST;
    const req = {
      json: () => Promise.resolve({ repo: "owner/repo" }),
    } as NextRequest;
    const res = await POST(req);
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.code, "INVALID_REQUEST");
  });

  it("returns 404 when GitHub returns PR_NOT_FOUND", async () => {
    POST = (await import("@/app/api/analyze/route")).POST;
    global.fetch = mock.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ message: "Not Found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    const req = {
      json: () => Promise.resolve({ repo: "owner/repo", prNumber: 999 }),
    } as NextRequest;
    const res = await POST(req);
    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.strictEqual(body.code, "PR_NOT_FOUND");
  });

  it("returns 429 when GitHub rate limits", async () => {
    POST = (await import("@/app/api/analyze/route")).POST;
    global.fetch = mock.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ message: "Rate limited" }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    const req = {
      json: () => Promise.resolve({ repo: "owner/repo", prNumber: 1 }),
    } as NextRequest;
    const res = await POST(req);
    assert.strictEqual(res.status, 429);
    const body = await res.json();
    assert.strictEqual(body.code, "RATE_LIMITED");
  });

  it("returns 503 when Nemotron is misconfigured", async () => {
    delete process.env.NEMOTRON_BASE_URL;
    POST = (await import("@/app/api/analyze/route")).POST;
    const mockPR = {
      title: "Test",
      user: { login: "testuser" },
      base: { ref: "main" },
      head: { ref: "feature", sha: "abc123" },
    };
    const mockFiles: unknown[] = [];
    const mockRef = { object: { sha: "base_sha" } };
    const mockTree = { tree: [] };

    global.fetch = mock.fn((input: URL | RequestInfo): Promise<Response> => {
      const u = input.toString();
      if (u.includes("/pulls/1") && !u.includes("/files")) {
        return Promise.resolve(
          new Response(JSON.stringify(mockPR), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      if (u.includes("/pulls/1/files")) {
        return Promise.resolve(
          new Response(JSON.stringify(mockFiles), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      if (u.includes("/git/ref/")) {
        return Promise.resolve(
          new Response(JSON.stringify(mockRef), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      if (u.includes("/git/trees/")) {
        return Promise.resolve(
          new Response(JSON.stringify(mockTree), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      return Promise.resolve(new Response("{}", { status: 404 }));
    });

    const req = {
      json: () => Promise.resolve({ repo: "owner/repo", prNumber: 1 }),
    } as NextRequest;
    const res = await POST(req);
    assert.strictEqual(res.status, 503);
    const body = await res.json();
    assert.strictEqual(body.code, "MISSING_CONFIG");
  });

  it("returns 504 when Nemotron times out", async () => {
    POST = (await import("@/app/api/analyze/route")).POST;
    const mockPR = {
      title: "Test",
      user: { login: "testuser" },
      base: { ref: "main" },
      head: { ref: "feature", sha: "abc123" },
    };
    const mockFiles: unknown[] = [];
    const mockRef = { object: { sha: "base_sha" } };
    const mockTree = { tree: [] };

    global.fetch = mock.fn((input: URL | RequestInfo): Promise<Response> => {
      const u = input.toString();
      if (u.includes("/pulls/1") && !u.includes("/files")) {
        return Promise.resolve(
          new Response(JSON.stringify(mockPR), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      if (u.includes("/pulls/1/files")) {
        return Promise.resolve(
          new Response(JSON.stringify(mockFiles), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      if (u.includes("/git/ref/")) {
        return Promise.resolve(
          new Response(JSON.stringify(mockRef), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      if (u.includes("/git/trees/")) {
        return Promise.resolve(
          new Response(JSON.stringify(mockTree), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      // Nemotron call: simulate timeout by rejecting with AbortError
      return new Promise((_resolve, reject) => {
        setTimeout(() => {
          const err = new Error("The operation was aborted.");
          err.name = "AbortError";
          reject(err);
        }, 10);
      });
    });

    const req = {
      json: () => Promise.resolve({ repo: "owner/repo", prNumber: 1 }),
    } as NextRequest;
    const res = await POST(req);
    assert.strictEqual(res.status, 504);
    const body = await res.json();
    assert.strictEqual(body.code, "TIMEOUT");
  });

  it("returns 200 with valid report on success", async () => {
    POST = (await import("@/app/api/analyze/route")).POST;
    const mockPR = {
      title: "Test PR",
      user: { login: "testuser" },
      base: { ref: "main" },
      head: { ref: "feature", sha: "abc123" },
    };
    const mockFiles = [
      {
        filename: "src/test.ts",
        status: "modified",
        additions: 10,
        deletions: 2,
        patch: "@@ -1 +1 @@\n-old\n+new",
      },
    ];
    const mockRef = { object: { sha: "base_sha" } };
    const mockTree = { tree: [] };

    const validReport = {
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

    global.fetch = mock.fn((input: URL | RequestInfo): Promise<Response> => {
      const u = input.toString();
      if (u.includes("/pulls/1") && !u.includes("/files")) {
        return Promise.resolve(
          new Response(JSON.stringify(mockPR), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      if (u.includes("/pulls/1/files")) {
        return Promise.resolve(
          new Response(JSON.stringify(mockFiles), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      if (u.includes("/git/ref/")) {
        return Promise.resolve(
          new Response(JSON.stringify(mockRef), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      if (u.includes("/git/trees/")) {
        return Promise.resolve(
          new Response(JSON.stringify(mockTree), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      // Nemotron call: return valid report
      return Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(validReport) } }],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      );
    });

    const req = {
      json: () => Promise.resolve({ repo: "owner/repo", prNumber: 1 }),
    } as NextRequest;
    const res = await POST(req);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.title, "Test PR");
    assert.strictEqual(body.prUrl, "https://github.com/owner/repo/pull/1");
    assert.ok(body.metadata);
    assert.strictEqual(body.metadata.source, "live");
    assert.strictEqual(body.metadata.headSha, "abc123");
    assert.strictEqual(body.nodes[0].id, "test-node");
    assert.strictEqual(body.affectedFiles[0].path, "src/test.ts");
    assert.strictEqual(body.affectedFiles[0].additions, 10);
    assert.strictEqual(body.affectedFiles[0].deletions, 2);
  });
});
