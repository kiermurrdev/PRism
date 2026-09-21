import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  buildAnalysisUrl,
  buildWebhookUrl,
  parseAnalysisUrl,
} from "@/lib/github/app/url";

describe("GitHub App URL helpers", () => {
  const APP_URL = "https://prism.example.com";

  describe("buildAnalysisUrl", () => {
    it("builds a canonical analysis URL with correct query params", () => {
      const result = buildAnalysisUrl(
        APP_URL,
        "owner/repo",
        42,
        "abc123def456",
      );

      assert.strictEqual(
        result.url,
        "https://prism.example.com/analyze?repo=owner%2Frepo&pr=42&sha=abc123def456",
      );
      assert.strictEqual(result.repo, "owner/repo");
      assert.strictEqual(result.prNumber, 42);
      assert.strictEqual(result.sha, "abc123def456");
    });

    it("handles app URLs with trailing slashes", () => {
      const result = buildAnalysisUrl(
        "https://prism.example.com/",
        "owner/repo",
        99,
        "deadbeef",
      );

      assert.strictEqual(
        result.url,
        "https://prism.example.com/analyze?repo=owner%2Frepo&pr=99&sha=deadbeef",
      );
    });

    it("handles app URLs with subpaths", () => {
      const result = buildAnalysisUrl(
        "https://example.com/prism",
        "org/project",
        1,
        "0000000",
      );

      assert.strictEqual(
        result.url,
        "https://example.com/prism/analyze?repo=org%2Fproject&pr=1&sha=0000000",
      );
    });
  });

  describe("buildWebhookUrl", () => {
    it("builds the webhook endpoint URL", () => {
      const url = buildWebhookUrl(APP_URL);
      assert.strictEqual(url, "https://prism.example.com/api/github/webhook");
    });

    it("handles trailing slashes in app URL", () => {
      const url = buildWebhookUrl("https://prism.example.com/");
      assert.strictEqual(url, "https://prism.example.com/api/github/webhook");
    });
  });

  describe("parseAnalysisUrl", () => {
    it("parses a valid analysis URL", () => {
      const url = "https://prism.example.com/analyze?repo=owner%2Frepo&pr=42&sha=abc123";
      const result = parseAnalysisUrl(url);

      assert.ok(result);
      assert.strictEqual(result!.repo, "owner/repo");
      assert.strictEqual(result!.prNumber, 42);
      assert.strictEqual(result!.sha, "abc123");
    });

    it("roundtrips with buildAnalysisUrl", () => {
      const original = buildAnalysisUrl(
        APP_URL,
        "test/repo",
        123,
        "abcdef123456",
      );
      const parsed = parseAnalysisUrl(original.url);

      assert.ok(parsed);
      assert.strictEqual(parsed!.repo, original.repo);
      assert.strictEqual(parsed!.prNumber, original.prNumber);
      assert.strictEqual(parsed!.sha, original.sha);
    });

    it("returns null for a URL missing repo param", () => {
      const result = parseAnalysisUrl("https://prism.example.com/analyze?pr=1&sha=abc");
      assert.strictEqual(result, null);
    });

    it("returns null for a URL missing pr param", () => {
      const result = parseAnalysisUrl("https://prism.example.com/analyze?repo=x/y&sha=abc");
      assert.strictEqual(result, null);
    });

    it("returns null for a URL missing sha param", () => {
      const result = parseAnalysisUrl("https://prism.example.com/analyze?repo=x/y&pr=1");
      assert.strictEqual(result, null);
    });

    it("returns null for a URL with invalid pr number", () => {
      const result = parseAnalysisUrl("https://prism.example.com/analyze?repo=x/y&pr=abc&sha=abc");
      assert.strictEqual(result, null);
    });

    it("returns null for a URL with zero pr number", () => {
      const result = parseAnalysisUrl("https://prism.example.com/analyze?repo=x/y&pr=0&sha=abc");
      assert.strictEqual(result, null);
    });

    it("returns null for a completely invalid URL", () => {
      const result = parseAnalysisUrl("not-a-url");
      assert.strictEqual(result, null);
    });
  });
});
