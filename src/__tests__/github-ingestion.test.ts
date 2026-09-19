import { strict as assert } from "node:assert";
import { describe, it, beforeEach, afterEach, mock } from "node:test";
import { ingestPR } from "@/lib/github/index";
import {
  MAX_CHANGED_FILES,
  MAX_PATCH_BYTES,
} from "@/lib/github/constants";

describe("ingestPR", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    mock.restoreAll();
  });

  it("rejects malformed URLs without making a network request", async () => {
    global.fetch = mock.fn(() => {
      throw new Error("fetch should not be called");
    });

    const result = await ingestPR("not-a-url");
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, "INVALID_URL");
  });

  it("rejects non-PR URLs without making a network request", async () => {
    global.fetch = mock.fn(() => {
      throw new Error("fetch should not be called");
    });

    const result = await ingestPR("https://github.com/owner/repo/issues/42");
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, "INVALID_URL");
  });

  it("returns error on GitHub API failure (404)", async () => {
    global.fetch = mock.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ message: "Not Found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const result = await ingestPR("https://github.com/owner/repo/pull/999");
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, "PR_NOT_FOUND");
  });

  it("returns error on rate limit (403 with header)", async () => {
    global.fetch = mock.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ message: "Rate limited" }), {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Remaining": "0",
          },
        })
      )
    );

    const result = await ingestPR("https://github.com/owner/repo/pull/1");
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, "RATE_LIMITED");
  });

  it("returns error on rate limit (429)", async () => {
    global.fetch = mock.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ message: "Too many requests" }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const result = await ingestPR("https://github.com/owner/repo/pull/1");
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, "RATE_LIMITED");
  });

  it("returns error on access denied (401)", async () => {
    global.fetch = mock.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ message: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const result = await ingestPR("https://github.com/owner/repo/pull/1");
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, "ACCESS_DENIED");
  });

  it("returns error on network failure", async () => {
    global.fetch = mock.fn(() => Promise.reject(new Error("network error")));

    const result = await ingestPR("https://github.com/owner/repo/pull/1");
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, "NETWORK_ERROR");
  });

  it("successfully ingests a small PR", async () => {
    const mockPR = {
      title: "Test PR",
      user: { login: "testuser" },
      base: { ref: "main" },
      head: { ref: "feature", sha: "abc123def456" },
    };

    const mockFiles = [
      {
        filename: "src/test.ts",
        status: "modified",
        additions: 10,
        deletions: 5,
        patch: "@@ -1,3 +1,8 @@\n+new line\n",
      },
    ];

    const mockTree = {
      tree: [
        { path: "src/test.ts", type: "blob" },
        { path: "package.json", type: "blob" },
      ],
    };

    const mockRef = {
      object: { sha: "base_sha_123" },
    };

    const mockContent = {
      content: Buffer.from("{}").toString("base64"),
      encoding: "base64",
    };

    let filesRequested = 0;

    global.fetch = mock.fn(
      (
        input: URL | RequestInfo,
        _init?: RequestInit
      ): Promise<Response> => {
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
        filesRequested++;
        if (filesRequested === 1) {
          return Promise.resolve(
            new Response(JSON.stringify(mockFiles), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      if (u.includes("/git/ref/heads/main")) {
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
      if (u.includes("/contents/")) {
        return Promise.resolve(
          new Response(JSON.stringify(mockContent), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      return Promise.resolve(new Response("{}", { status: 404 }));
    });

    const result = await ingestPR("https://github.com/owner/repo/pull/1");
    assert.strictEqual(result.ok, true);
    if (!result.ok) throw new Error("should be ok");

    const { snapshot } = result;
    assert.strictEqual(snapshot.repo, "owner/repo");
    assert.strictEqual(snapshot.prNumber, 1);
    assert.strictEqual(snapshot.title, "Test PR");
    assert.strictEqual(snapshot.author, "testuser");
    assert.strictEqual(snapshot.baseBranch, "main");
    assert.strictEqual(snapshot.headBranch, "feature");
    assert.strictEqual(snapshot.headSha, "abc123def456");
    assert.strictEqual(snapshot.changedFiles.length, 1);
    assert.strictEqual(snapshot.changedFiles[0].path, "src/test.ts");
    assert.ok(!snapshot.truncation.filesTruncated);
    assert.ok(!snapshot.truncation.patchesTruncated);
    assert.ok(!snapshot.truncation.treeTruncated);
    assert.ok(!snapshot.truncation.totalTextTruncated);
  });
});

describe("truncation behavior", () => {
  it("marks filesTruncated when exceeding MAX_CHANGED_FILES", async () => {
    const originalFetch = global.fetch;
    const manyFiles = Array.from({ length: MAX_CHANGED_FILES + 50 }, (_, i) => ({
      filename: `file${i}.ts`,
      status: "added",
      additions: 1,
      deletions: 0,
      patch: "+line\n",
    }));

    const mockPR = {
      title: "Big PR",
      user: { login: "user" },
      base: { ref: "main" },
      head: { ref: "branch", sha: "sha" },
    };

    const mockRef = { object: { sha: "base_sha" } };
    const mockTree = { tree: [] };

    global.fetch = mock.fn(
      (
        input: URL | RequestInfo,
        _init?: RequestInit
      ): Promise<Response> => {
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
        // Return all files on first page to test truncation
        return Promise.resolve(
          new Response(JSON.stringify(manyFiles), {
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

    try {
      const result = await ingestPR("https://github.com/owner/repo/pull/1");
      assert.strictEqual(result.ok, true);
      if (!result.ok) throw new Error("should be ok");
      assert.strictEqual(result.snapshot.changedFiles.length, MAX_CHANGED_FILES);
      assert.ok(result.snapshot.truncation.filesTruncated);
    } finally {
      global.fetch = originalFetch;
      mock.restoreAll();
    }
  });

  it("marks patchesTruncated when a patch exceeds MAX_PATCH_BYTES", async () => {
    const originalFetch = global.fetch;
    const bigPatch = "x".repeat(MAX_PATCH_BYTES + 1000);

    const mockPR = {
      title: "PR",
      user: { login: "user" },
      base: { ref: "main" },
      head: { ref: "branch", sha: "sha" },
    };

    const mockFiles = [
      {
        filename: "big.ts",
        status: "modified",
        additions: 10000,
        deletions: 10000,
        patch: bigPatch,
      },
    ];

    const mockRef = { object: { sha: "base_sha" } };
    const mockTree = { tree: [] };

    let bigPatchFilesRequested = 0;

    global.fetch = mock.fn(
      (
        input: URL | RequestInfo,
        _init?: RequestInit
      ): Promise<Response> => {
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
        bigPatchFilesRequested++;
        if (bigPatchFilesRequested === 1) {
          return Promise.resolve(
            new Response(JSON.stringify(mockFiles), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify([]), {
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

    try {
      const result = await ingestPR("https://github.com/owner/repo/pull/1");
      assert.strictEqual(result.ok, true);
      if (!result.ok) throw new Error("should be ok");
      assert.ok(result.snapshot.truncation.patchesTruncated);
      const patch = result.snapshot.changedFiles[0].patch;
      if (patch) {
        const bytes = new TextEncoder().encode(patch).length;
        assert.ok(bytes <= MAX_PATCH_BYTES);
      }
    } finally {
      global.fetch = originalFetch;
      mock.restoreAll();
    }
  });
});
