/**
 * Tests for PR comment publishing.
 *
 * Verifies comment creation, updates, idempotency, URL encoding, auth errors,
 * rate limiting, and secret redaction. All tests are mocked and credential-free.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  buildCommentBody,
  buildPrismComment,
  publishPrComment,
  type CommentPublisherConfig,
  type PublishResult,
} from "@/lib/github/app/comment-publisher";
import type { NormalizedWebhookEvent } from "@/lib/github/app/contracts";
import type { Clock, JwtCrypto } from "@/lib/github/app/jwt";
import type { FetchFn } from "@/lib/github/app/token";

/**
 * A test webhook event.
 */
const TEST_EVENT: NormalizedWebhookEvent = {
  type: "pull_request",
  action: "opened",
  deliveryId: "test-delivery-123",
  installationId: 99999,
  repositoryFullName: "test-owner/test-repo",
  prNumber: 42,
  prUrl: "https://github.com/test-owner/test-repo/pull/42",
  prTitle: "Test pull request",
  headSha: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
};

/**
 * Test publisher config.
 */
const TEST_CONFIG: CommentPublisherConfig = {
  appId: 12345,
  privateKey: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCv\n-----END PRIVATE KEY-----",
  appSlug: "prism",
  appUrl: "https://prism.example.com",
};

/**
 * A mock clock that returns a fixed timestamp.
 */
const FIXED_CLOCK: Clock = {
  nowSeconds(): number {
    return 1700000000;
  },
};

/**
 * A mock JWT crypto that always succeeds with a deterministic signature.
 */
const MOCK_JWT_CRYPTO: JwtCrypto = {
  async importKey(): Promise<CryptoKey> {
    return {} as CryptoKey;
  },
  async sign(): Promise<string> {
    return "mock-signature";
  },
};

/**
 * Build a mock fetch function that returns staged responses.
 */
function mockFetch(
  responses: Array<{ url: string | RegExp; method?: string; status: number; headers?: Record<string, string>; json?: unknown }>
): FetchFn {
  return async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const match = responses.find((r) => {
      if (typeof r.url === "string") {
        if (r.url !== url) return false;
      } else {
        if (!r.url.test(url)) return false;
      }
      if (r.method && r.method !== method) return false;
      return true;
    });

    const body = match?.json !== undefined ? JSON.stringify(match.json) : "";
    const headers = new Headers(match?.headers ?? {});
    headers.set("Content-Type", "application/json");

    return new Response(body, {
      status: match?.status ?? 200,
      headers,
    });
  };
}

describe("comment-publisher", () => {
  describe("buildCommentBody", () => {
    it("builds a Markdown comment with PR context and analysis link", () => {
      const body = buildCommentBody(
        "Fix login bug",
        "https://github.com/owner/repo/pull/10",
        "abcdef1234567890abcdef1234567890abcdef12",
        "https://prism.example.com",
      );

      assert.ok(body.includes("PRism Analysis"));
      assert.ok(body.includes("Fix login bug"));
      assert.ok(body.includes("abcdef1"));
      assert.ok(body.includes("/analyze?pr="));
      assert.ok(body.includes("Opening the link runs or refreshes the analysis"));
    });

    it("uses the short SHA (first 7 chars)", () => {
      const body = buildCommentBody(
        "Test",
        "https://github.com/owner/repo/pull/1",
        "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
        "https://prism.example.com",
      );

      assert.ok(body.includes("deadbee"));
      assert.ok(!body.includes("deadbeefdeadbeef"));
    });

    it("encodes the PR URL in the analysis link", () => {
      const body = buildCommentBody(
        "Test",
        "https://github.com/owner/repo/pull/1",
        "abc123",
        "https://prism.example.com",
      );

      const encoded = btoa("https://github.com/owner/repo/pull/1");
      assert.ok(body.includes(`/analyze?pr=${encoded}`));
    });
  });

  describe("buildPrismComment", () => {
    it("wraps the comment body with markers", () => {
      const comment = buildPrismComment(
        "owner/repo",
        42,
        "Test PR",
        "https://github.com/owner/repo/pull/42",
        "abc123def456",
        "https://prism.example.com",
      );

      assert.ok(comment.includes("<!-- PRISM_ANALYSIS_START:repo=owner/repo:pr=42:sha=abc123def456 -->"));
      assert.ok(comment.includes("<!-- PRISM_ANALYSIS_END -->"));
      assert.ok(comment.includes("PRism Analysis"));
    });

    it("creates a unique marker per PR/SHA combination", () => {
      const c1 = buildPrismComment("owner/repo", 42, "PR", "url", "sha1", "https://prism.example.com");
      const c2 = buildPrismComment("owner/repo", 42, "PR", "url", "sha2", "https://prism.example.com");
      const c3 = buildPrismComment("owner/repo", 43, "PR", "url", "sha1", "https://prism.example.com");

      assert.ok(c1.includes("sha=sha1"));
      assert.ok(c2.includes("sha=sha2"));
      assert.ok(c3.includes("pr=43"));
    });
  });

  describe("publishPrComment", () => {
    it("creates a new comment when none exists", async () => {
      const fetchFn = mockFetch([
        {
          url: "https://api.github.com/app/installations/99999/access_tokens",
          method: "POST",
          status: 201,
          json: { token: "ghs_mock_token", expires_at: "2026-01-01T00:00:00Z" },
        },
        {
          url: "https://api.github.com/repos/test-owner/test-repo/issues/42/comments",
          method: "GET",
          status: 200,
          json: [],
        },
        {
          url: "https://api.github.com/repos/test-owner/test-repo/issues/42/comments",
          method: "POST",
          status: 201,
          json: { id: 111111 },
        },
      ]);

      const result = await publishPrComment({
        event: TEST_EVENT,
        config: TEST_CONFIG,
        fetchFn,
        clock: FIXED_CLOCK,
        jwtCrypto: MOCK_JWT_CRYPTO,
      });

      assert.ok(result.ok);
      assert.strictEqual(result.action, "created");
      assert.strictEqual(result.commentId, 111111);
    });

    it("updates an existing PRism comment when SHA differs", async () => {
      const existingComment = {
        id: 222222,
        body: `<!-- PRISM_ANALYSIS_START:repo=test-owner/test-repo:pr=42:sha=deadbeef123456789abcdef0 -->\nOld content\n<!-- PRISM_ANALYSIS_END -->`,
        user: { login: "prism[bot]", type: "Bot" },
      };

      const fetchFn = mockFetch([
        {
          url: "https://api.github.com/app/installations/99999/access_tokens",
          method: "POST",
          status: 201,
          json: { token: "ghs_mock_token", expires_at: "2026-01-01T00:00:00Z" },
        },
        {
          url: "https://api.github.com/repos/test-owner/test-repo/issues/42/comments",
          method: "GET",
          status: 200,
          json: [existingComment],
        },
        {
          url: "https://api.github.com/repos/test-owner/test-repo/issues/comments/222222",
          method: "PATCH",
          status: 200,
          json: { id: 222222 },
        },
      ]);

      const result = await publishPrComment({
        event: TEST_EVENT,
        config: TEST_CONFIG,
        fetchFn,
        clock: FIXED_CLOCK,
        jwtCrypto: MOCK_JWT_CRYPTO,
      });

      assert.ok(result.ok);
      assert.strictEqual(result.action, "updated");
      assert.strictEqual(result.commentId, 222222);
    });

    it("returns no-op when existing comment already has current SHA", async () => {
      const existingComment = {
        id: 333333,
        body: `<!-- PRISM_ANALYSIS_START:repo=test-owner/test-repo:pr=42:sha=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 -->\nCurrent content\n<!-- PRISM_ANALYSIS_END -->`,
        user: { login: "prism[bot]", type: "Bot" },
      };

      const fetchFn = mockFetch([
        {
          url: "https://api.github.com/app/installations/99999/access_tokens",
          method: "POST",
          status: 201,
          json: { token: "ghs_mock_token", expires_at: "2026-01-01T00:00:00Z" },
        },
        {
          url: "https://api.github.com/repos/test-owner/test-repo/issues/42/comments",
          method: "GET",
          status: 200,
          json: [existingComment],
        },
      ]);

      const result = await publishPrComment({
        event: TEST_EVENT,
        config: TEST_CONFIG,
        fetchFn,
        clock: FIXED_CLOCK,
        jwtCrypto: MOCK_JWT_CRYPTO,
      });

      assert.ok(result.ok);
      assert.strictEqual(result.action, "no-op");
      assert.ok(result.reason.includes("current SHA"));
    });

    it("ignores comments from other bots", async () => {
      const otherBotComment = {
        id: 444444,
        body: `<!-- PRISM_ANALYSIS_START:repo=test-owner/test-repo:pr=42:sha=aabbcc -->\nFake\n<!-- PRISM_ANALYSIS_END -->`,
        user: { login: "some-other-bot[bot]", type: "Bot" },
      };

      const fetchFn = mockFetch([
        {
          url: "https://api.github.com/app/installations/99999/access_tokens",
          method: "POST",
          status: 201,
          json: { token: "ghs_mock_token", expires_at: "2026-01-01T00:00:00Z" },
        },
        {
          url: "https://api.github.com/repos/test-owner/test-repo/issues/42/comments",
          method: "GET",
          status: 200,
          json: [otherBotComment],
        },
        {
          url: "https://api.github.com/repos/test-owner/test-repo/issues/42/comments",
          method: "POST",
          status: 201,
          json: { id: 555555 },
        },
      ]);

      const result = await publishPrComment({
        event: TEST_EVENT,
        config: TEST_CONFIG,
        fetchFn,
        clock: FIXED_CLOCK,
        jwtCrypto: MOCK_JWT_CRYPTO,
      });

      assert.ok(result.ok);
      assert.strictEqual(result.action, "created");
    });

    it("ignores comments without valid markers", async () => {
      const humanComment = {
        id: 666666,
        body: "Looks good to me!",
        user: { login: "human-user", type: "User" },
      };

      const fetchFn = mockFetch([
        {
          url: "https://api.github.com/app/installations/99999/access_tokens",
          method: "POST",
          status: 201,
          json: { token: "ghs_mock_token", expires_at: "2026-01-01T00:00:00Z" },
        },
        {
          url: "https://api.github.com/repos/test-owner/test-repo/issues/42/comments",
          method: "GET",
          status: 200,
          json: [humanComment],
        },
        {
          url: "https://api.github.com/repos/test-owner/test-repo/issues/42/comments",
          method: "POST",
          status: 201,
          json: { id: 777777 },
        },
      ]);

      const result = await publishPrComment({
        event: TEST_EVENT,
        config: TEST_CONFIG,
        fetchFn,
        clock: FIXED_CLOCK,
        jwtCrypto: MOCK_JWT_CRYPTO,
      });

      assert.ok(result.ok);
      assert.strictEqual(result.action, "created");
    });

    it("ignores PRism comments for different PRs", async () => {
      const otherPrComment = {
        id: 888888,
        body: `<!-- PRISM_ANALYSIS_START:repo=test-owner/test-repo:pr=99:sha=abc123 -->\nOther\n<!-- PRISM_ANALYSIS_END -->`,
        user: { login: "prism[bot]", type: "Bot" },
      };

      const fetchFn = mockFetch([
        {
          url: "https://api.github.com/app/installations/99999/access_tokens",
          method: "POST",
          status: 201,
          json: { token: "ghs_mock_token", expires_at: "2026-01-01T00:00:00Z" },
        },
        {
          url: "https://api.github.com/repos/test-owner/test-repo/issues/42/comments",
          method: "GET",
          status: 200,
          json: [otherPrComment],
        },
        {
          url: "https://api.github.com/repos/test-owner/test-repo/issues/42/comments",
          method: "POST",
          status: 201,
          json: { id: 999999 },
        },
      ]);

      const result = await publishPrComment({
        event: TEST_EVENT,
        config: TEST_CONFIG,
        fetchFn,
        clock: FIXED_CLOCK,
        jwtCrypto: MOCK_JWT_CRYPTO,
      });

      assert.ok(result.ok);
      assert.strictEqual(result.action, "created");
    });

    it("handles rate limiting on token request", async () => {
      const fetchFn = mockFetch([
        {
          url: "https://api.github.com/app/installations/99999/access_tokens",
          method: "POST",
          status: 429,
          headers: { "X-RateLimit-Remaining": "0" },
          json: { message: "Rate limited" },
        },
      ]);

      const result = await publishPrComment({
        event: TEST_EVENT,
        config: TEST_CONFIG,
        fetchFn,
        clock: FIXED_CLOCK,
        jwtCrypto: MOCK_JWT_CRYPTO,
      });

      assert.ok(!result.ok);
      assert.strictEqual(result.error.code, "RATE_LIMITED");
    });

    it("handles auth rejection on token request", async () => {
      const fetchFn = mockFetch([
        {
          url: "https://api.github.com/app/installations/99999/access_tokens",
          method: "POST",
          status: 401,
          json: { message: "Bad credentials" },
        },
      ]);

      const result = await publishPrComment({
        event: TEST_EVENT,
        config: TEST_CONFIG,
        fetchFn,
        clock: FIXED_CLOCK,
        jwtCrypto: MOCK_JWT_CRYPTO,
      });

      assert.ok(!result.ok);
      assert.strictEqual(result.error.code, "AUTH_FAILED");
    });

    it("handles GitHub error when listing comments", async () => {
      const fetchFn = mockFetch([
        {
          url: "https://api.github.com/app/installations/99999/access_tokens",
          method: "POST",
          status: 201,
          json: { token: "ghs_mock_token", expires_at: "2026-01-01T00:00:00Z" },
        },
        {
          url: "https://api.github.com/repos/test-owner/test-repo/issues/42/comments",
          method: "GET",
          status: 500,
          json: { message: "Internal error" },
        },
      ]);

      const result = await publishPrComment({
        event: TEST_EVENT,
        config: TEST_CONFIG,
        fetchFn,
        clock: FIXED_CLOCK,
        jwtCrypto: MOCK_JWT_CRYPTO,
      });

      assert.ok(!result.ok);
      assert.strictEqual(result.error.code, "GITHUB_ERROR");
    });

    it("handles rate limiting when creating comment", async () => {
      const fetchFn = mockFetch([
        {
          url: "https://api.github.com/app/installations/99999/access_tokens",
          method: "POST",
          status: 201,
          json: { token: "ghs_mock_token", expires_at: "2026-01-01T00:00:00Z" },
        },
        {
          url: "https://api.github.com/repos/test-owner/test-repo/issues/42/comments",
          method: "GET",
          status: 200,
          json: [],
        },
        {
          url: "https://api.github.com/repos/test-owner/test-repo/issues/42/comments",
          method: "POST",
          status: 429,
          headers: { "X-RateLimit-Remaining": "0" },
          json: { message: "Rate limited" },
        },
      ]);

      const result = await publishPrComment({
        event: TEST_EVENT,
        config: TEST_CONFIG,
        fetchFn,
        clock: FIXED_CLOCK,
        jwtCrypto: MOCK_JWT_CRYPTO,
      });

      assert.ok(!result.ok);
      assert.strictEqual(result.error.code, "RATE_LIMITED");
    });

    it("handles network error gracefully", async () => {
      const fetchFn: FetchFn = async () => {
        throw new Error("Network failure");
      };

      const result = await publishPrComment({
        event: TEST_EVENT,
        config: TEST_CONFIG,
        fetchFn,
        clock: FIXED_CLOCK,
        jwtCrypto: MOCK_JWT_CRYPTO,
      });

      assert.ok(!result.ok);
      assert.strictEqual(result.error.code, "AUTH_FAILED");
    });

    it("handles missing installation ID", async () => {
      const fetchFn: FetchFn = async () => new Response("{}");

      const result = await publishPrComment({
        event: {
          ...TEST_EVENT,
          installationId: 0,
        },
        config: TEST_CONFIG,
        fetchFn,
        clock: FIXED_CLOCK,
        jwtCrypto: MOCK_JWT_CRYPTO,
      });

      assert.ok(!result.ok);
      assert.ok(result.error.code === "AUTH_FAILED");
    });
  });

  describe("secret redaction", () => {
    it("does not leak private key in error messages", async () => {
      const fetchFn: FetchFn = async () => new Response(JSON.stringify({}), { status: 200 });

      const result = await publishPrComment({
        event: TEST_EVENT,
        config: {
          ...TEST_CONFIG,
          privateKey: "SUPER_SECRET_KEY_MATERIAL",
        },
        fetchFn,
        clock: FIXED_CLOCK,
        jwtCrypto: MOCK_JWT_CRYPTO,
      });

      const serialized = JSON.stringify(result);
      assert.ok(!serialized.includes("SUPER_SECRET_KEY_MATERIAL"));
    });

    it("does not leak installation token in error messages", async () => {
      const fetchFn = mockFetch([
        {
          url: "https://api.github.com/app/installations/99999/access_tokens",
          method: "POST",
          status: 201,
          json: { token: "ghs_super_secret_token", expires_at: "2026-01-01T00:00:00Z" },
        },
        {
          url: "https://api.github.com/repos/test-owner/test-repo/issues/42/comments",
          method: "GET",
          status: 401,
          json: { message: "Unauthorized" },
        },
      ]);

      const result = await publishPrComment({
        event: TEST_EVENT,
        config: TEST_CONFIG,
        fetchFn,
        clock: FIXED_CLOCK,
        jwtCrypto: MOCK_JWT_CRYPTO,
      });

      const serialized = JSON.stringify(result);
      assert.ok(!serialized.includes("ghs_super_secret_token"));
    });
  });

  describe("synchronize and reopened actions", () => {
    it("updates comment on synchronize event", async () => {
      const existingComment = {
        id: 101010,
        body: `<!-- PRISM_ANALYSIS_START:repo=test-owner/test-repo:pr=42:sha=deadbeef123456789abcdef0 -->\nOld\n<!-- PRISM_ANALYSIS_END -->`,
        user: { login: "prism[bot]", type: "Bot" },
      };

      const syncEvent: NormalizedWebhookEvent = {
        ...TEST_EVENT,
        action: "synchronize",
        headSha: "newsha1234567890abcdef1234567890abcdef",
      };

      const fetchFn = mockFetch([
        {
          url: "https://api.github.com/app/installations/99999/access_tokens",
          method: "POST",
          status: 201,
          json: { token: "ghs_mock_token", expires_at: "2026-01-01T00:00:00Z" },
        },
        {
          url: "https://api.github.com/repos/test-owner/test-repo/issues/42/comments",
          method: "GET",
          status: 200,
          json: [existingComment],
        },
        {
          url: "https://api.github.com/repos/test-owner/test-repo/issues/comments/101010",
          method: "PATCH",
          status: 200,
          json: { id: 101010 },
        },
      ]);

      const result = await publishPrComment({
        event: syncEvent,
        config: TEST_CONFIG,
        fetchFn,
        clock: FIXED_CLOCK,
        jwtCrypto: MOCK_JWT_CRYPTO,
      });

      assert.ok(result.ok);
      assert.strictEqual(result.action, "updated");
    });

    it("creates comment on reopened event when none exists", async () => {
      const reopenedEvent: NormalizedWebhookEvent = {
        ...TEST_EVENT,
        action: "reopened",
      };

      const fetchFn = mockFetch([
        {
          url: "https://api.github.com/app/installations/99999/access_tokens",
          method: "POST",
          status: 201,
          json: { token: "ghs_mock_token", expires_at: "2026-01-01T00:00:00Z" },
        },
        {
          url: "https://api.github.com/repos/test-owner/test-repo/issues/42/comments",
          method: "GET",
          status: 200,
          json: [],
        },
        {
          url: "https://api.github.com/repos/test-owner/test-repo/issues/42/comments",
          method: "POST",
          status: 201,
          json: { id: 121212 },
        },
      ]);

      const result = await publishPrComment({
        event: reopenedEvent,
        config: TEST_CONFIG,
        fetchFn,
        clock: FIXED_CLOCK,
        jwtCrypto: MOCK_JWT_CRYPTO,
      });

      assert.ok(result.ok);
      assert.strictEqual(result.action, "created");
    });
  });

  describe("duplicate prevention", () => {
    it("never creates a second comment when one already exists", async () => {
      const existingComment = {
        id: 131313,
        body: `<!-- PRISM_ANALYSIS_START:repo=test-owner/test-repo:pr=42:sha=deadbeef123456789abcdef0 -->\nOld\n<!-- PRISM_ANALYSIS_END -->`,
        user: { login: "prism[bot]", type: "Bot" },
      };

      let updateCallCount = 0;
      let createCallCount = 0;

      const fetchFn: FetchFn = async (url, init) => {
        if (url.includes("access_tokens") && init?.method === "POST") {
          return new Response(JSON.stringify({ token: "ghs_mock_token", expires_at: "2026-01-01T00:00:00Z" }), { status: 201 });
        }

        if (url.includes("/issues/42/comments") && init?.method === "GET") {
          return new Response(JSON.stringify([existingComment]), { status: 200 });
        }

        if (url.includes("/issues/comments/") && init?.method === "PATCH") {
          updateCallCount++;
          return new Response(JSON.stringify({ id: 131313 }), { status: 200 });
        }

        if (url.includes("/issues/42/comments") && init?.method === "POST") {
          createCallCount++;
          return new Response(JSON.stringify({ id: 999999 }), { status: 201 });
        }

        return new Response(JSON.stringify({}), { status: 404 });
      };

      // Call publishPrComment multiple times — only updates should occur
      for (let i = 0; i < 3; i++) {
        const result = await publishPrComment({
          event: TEST_EVENT,
          config: TEST_CONFIG,
          fetchFn,
          clock: FIXED_CLOCK,
          jwtCrypto: MOCK_JWT_CRYPTO,
        });
        assert.ok(result.ok);
        assert.strictEqual(result.action, "updated");
      }

      assert.strictEqual(updateCallCount, 3);
      assert.strictEqual(createCallCount, 0);
    });
  });
});
