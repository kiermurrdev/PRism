import { strict as assert } from "node:assert";
import { describe, it, beforeEach, afterEach } from "node:test";
import { loadGitHubAppConfig } from "@/lib/github/app/config";

describe("GitHub App configuration loading", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear all GitHub App env vars before each test
    delete process.env.GITHUB_APP_ID;
    delete process.env.GITHUB_APP_PRIVATE_KEY;
    delete process.env.GITHUB_WEBHOOK_SECRET;
    delete process.env.GITHUB_APP_SLUG;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  afterEach(() => {
    process.env.GITHUB_APP_ID = originalEnv.GITHUB_APP_ID;
    process.env.GITHUB_APP_PRIVATE_KEY = originalEnv.GITHUB_APP_PRIVATE_KEY;
    process.env.GITHUB_WEBHOOK_SECRET = originalEnv.GITHUB_WEBHOOK_SECRET;
    process.env.GITHUB_APP_SLUG = originalEnv.GITHUB_APP_SLUG;
    process.env.NEXT_PUBLIC_APP_URL = originalEnv.NEXT_PUBLIC_APP_URL;
  });

  it("returns a valid config when all variables are set correctly", () => {
    process.env.GITHUB_APP_ID = "12345";
    process.env.GITHUB_APP_PRIVATE_KEY = "FAKE_PRIVATE_KEY";
    process.env.GITHUB_WEBHOOK_SECRET = "FAKE_SECRET";
    process.env.GITHUB_APP_SLUG = "prism-review";
    process.env.NEXT_PUBLIC_APP_URL = "https://prism.example.com";

    const result = loadGitHubAppConfig();

    assert.ok(result.ok, "Should succeed with valid config");
    if (result.ok) {
      assert.strictEqual(result.config.appId, 12345);
      assert.strictEqual(result.config.privateKey, "FAKE_PRIVATE_KEY");
      assert.strictEqual(result.config.webhookSecret, "FAKE_SECRET");
      assert.strictEqual(result.config.appSlug, "prism-review");
      assert.strictEqual(result.config.appUrl, "https://prism.example.com");
    }
  });

  it("returns MISSING_GITHUB_APP_ID when GITHUB_APP_ID is not set", () => {
    const result = loadGitHubAppConfig();

    assert.ok(!result.ok);
    if (!result.ok) {
      assert.strictEqual(result.error.code, "MISSING_GITHUB_APP_ID");
    }
  });

  it("returns INVALID_GITHUB_APP_ID when GITHUB_APP_ID is not a positive integer", () => {
    process.env.GITHUB_APP_ID = "not-a-number";
    const result = loadGitHubAppConfig();

    assert.ok(!result.ok);
    if (!result.ok) {
      assert.strictEqual(result.error.code, "INVALID_GITHUB_APP_ID");
    }
  });

  it("returns INVALID_GITHUB_APP_ID when GITHUB_APP_ID is zero", () => {
    process.env.GITHUB_APP_ID = "0";
    const result = loadGitHubAppConfig();

    assert.ok(!result.ok);
    if (!result.ok) {
      assert.strictEqual(result.error.code, "INVALID_GITHUB_APP_ID");
    }
  });

  it("returns MISSING_GITHUB_APP_PRIVATE_KEY when not set", () => {
    process.env.GITHUB_APP_ID = "12345";
    const result = loadGitHubAppConfig();

    assert.ok(!result.ok);
    if (!result.ok) {
      assert.strictEqual(result.error.code, "MISSING_GITHUB_APP_PRIVATE_KEY");
    }
  });

  it("returns MISSING_GITHUB_WEBHOOK_SECRET when not set", () => {
    process.env.GITHUB_APP_ID = "12345";
    process.env.GITHUB_APP_PRIVATE_KEY = "FAKE_KEY";
    const result = loadGitHubAppConfig();

    assert.ok(!result.ok);
    if (!result.ok) {
      assert.strictEqual(result.error.code, "MISSING_GITHUB_WEBHOOK_SECRET");
    }
  });

  it("returns MISSING_GITHUB_APP_SLUG when not set", () => {
    process.env.GITHUB_APP_ID = "12345";
    process.env.GITHUB_APP_PRIVATE_KEY = "FAKE_KEY";
    process.env.GITHUB_WEBHOOK_SECRET = "FAKE_SECRET";
    const result = loadGitHubAppConfig();

    assert.ok(!result.ok);
    if (!result.ok) {
      assert.strictEqual(result.error.code, "MISSING_GITHUB_APP_SLUG");
    }
  });

  it("returns MISSING_APP_URL when NEXT_PUBLIC_APP_URL is not set", () => {
    process.env.GITHUB_APP_ID = "12345";
    process.env.GITHUB_APP_PRIVATE_KEY = "FAKE_KEY";
    process.env.GITHUB_WEBHOOK_SECRET = "FAKE_SECRET";
    process.env.GITHUB_APP_SLUG = "prism-review";
    const result = loadGitHubAppConfig();

    assert.ok(!result.ok);
    if (!result.ok) {
      assert.strictEqual(result.error.code, "MISSING_APP_URL");
    }
  });

  it("returns INVALID_APP_URL when NEXT_PUBLIC_APP_URL is not a valid URL", () => {
    process.env.GITHUB_APP_ID = "12345";
    process.env.GITHUB_APP_PRIVATE_KEY = "FAKE_KEY";
    process.env.GITHUB_WEBHOOK_SECRET = "FAKE_SECRET";
    process.env.GITHUB_APP_SLUG = "prism-review";
    process.env.NEXT_PUBLIC_APP_URL = "not-a-url";
    const result = loadGitHubAppConfig();

    assert.ok(!result.ok);
    if (!result.ok) {
      assert.strictEqual(result.error.code, "INVALID_APP_URL");
    }
  });

  it("validates variables in order and reports the first missing one", () => {
    // Only set GITHUB_APP_ID, leave everything else unset
    process.env.GITHUB_APP_ID = "12345";
    const result = loadGitHubAppConfig();

    assert.ok(!result.ok);
    if (!result.ok) {
      // Should fail on the first missing variable after GITHUB_APP_ID
      assert.strictEqual(result.error.code, "MISSING_GITHUB_APP_PRIVATE_KEY");
    }
  });
});
