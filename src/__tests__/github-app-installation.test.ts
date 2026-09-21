import { strict as assert } from "node:assert";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  buildInstallationUrl,
  isGitHubAppConfigured,
  getGitHubAppSlug,
  parseInstallationCallback,
} from "@/lib/github/app/installation";

describe("GitHub App installation helpers", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_GITHUB_APP_SLUG;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_GITHUB_APP_SLUG = originalEnv.NEXT_PUBLIC_GITHUB_APP_SLUG;
    process.env.NEXT_PUBLIC_APP_URL = originalEnv.NEXT_PUBLIC_APP_URL;
  });

  describe("buildInstallationUrl", () => {
    it("builds the correct base URL with state parameter", () => {
      const url = buildInstallationUrl({
        appSlug: "prism",
        redirectUrl: "https://prism.app/github-install",
      });

      assert.ok(url.includes("https://github.com/apps/prism/installations/new"));
      assert.ok(url.includes("state=https%3A%2F%2Fprism.app%2Fgithub-install"));
    });

    it("includes repository IDs when provided", () => {
      const url = buildInstallationUrl({
        appSlug: "prism",
        redirectUrl: "https://prism.app/github-install",
        repositoryIds: "123,456",
      });

      assert.ok(url.includes("permissions=123%2C456"));
    });
  });

  describe("isGitHubAppConfigured", () => {
    it("returns true when NEXT_PUBLIC_GITHUB_APP_SLUG is set", () => {
      process.env.NEXT_PUBLIC_GITHUB_APP_SLUG = "prism";
      assert.strictEqual(isGitHubAppConfigured(), true);
    });

    it("returns false when NEXT_PUBLIC_GITHUB_APP_SLUG is not set", () => {
      assert.strictEqual(isGitHubAppConfigured(), false);
    });
  });

  describe("getGitHubAppSlug", () => {
    it("returns the slug when set", () => {
      process.env.NEXT_PUBLIC_GITHUB_APP_SLUG = "prism";
      assert.strictEqual(getGitHubAppSlug(), "prism");
    });

    it("returns undefined when not set", () => {
      assert.strictEqual(getGitHubAppSlug(), undefined);
    });
  });

  describe("parseInstallationCallback", () => {
    it("parses a valid installed callback", () => {
      const params = new URLSearchParams({
        setup_action: "installed",
        installation_id: "12345",
      });

      const result = parseInstallationCallback(params);
      assert.ok(result.ok);
      if (result.ok) {
        assert.strictEqual(result.setupAction, "installed");
        assert.strictEqual(result.installationId, 12345);
      }
    });

    it("parses a valid updated callback", () => {
      const params = new URLSearchParams({
        setup_action: "updated",
        installation_id: "99999",
      });

      const result = parseInstallationCallback(params);
      assert.ok(result.ok);
      if (result.ok) {
        assert.strictEqual(result.setupAction, "updated");
        assert.strictEqual(result.installationId, 99999);
      }
    });

    it("parses a valid uninstalled callback", () => {
      const params = new URLSearchParams({
        setup_action: "uninstalled",
        installation_id: "1",
      });

      const result = parseInstallationCallback(params);
      assert.ok(result.ok);
      if (result.ok) {
        assert.strictEqual(result.setupAction, "uninstalled");
        assert.strictEqual(result.installationId, 1);
      }
    });

    it("rejects missing setup_action", () => {
      const params = new URLSearchParams({ installation_id: "123" });
      const result = parseInstallationCallback(params);
      assert.ok(!result.ok);
      if (!result.ok) {
        assert.ok(result.reason.includes("setup_action"));
      }
    });

    it("rejects missing installation_id", () => {
      const params = new URLSearchParams({ setup_action: "installed" });
      const result = parseInstallationCallback(params);
      assert.ok(!result.ok);
      if (!result.ok) {
        assert.ok(result.reason.includes("installation_id"));
      }
    });

    it("rejects invalid installation_id (non-numeric)", () => {
      const params = new URLSearchParams({
        setup_action: "installed",
        installation_id: "abc",
      });
      const result = parseInstallationCallback(params);
      assert.ok(!result.ok);
      if (!result.ok) {
        assert.ok(result.reason.includes("installation_id"));
      }
    });

    it("rejects invalid installation_id (negative)", () => {
      const params = new URLSearchParams({
        setup_action: "installed",
        installation_id: "-1",
      });
      const result = parseInstallationCallback(params);
      assert.ok(!result.ok);
      if (!result.ok) {
        assert.ok(result.reason.includes("installation_id"));
      }
    });

    it("rejects unknown setup_action", () => {
      const params = new URLSearchParams({
        setup_action: "deleted",
        installation_id: "123",
      });
      const result = parseInstallationCallback(params);
      assert.ok(!result.ok);
      if (!result.ok) {
        assert.ok(result.reason.includes("setup action"));
      }
    });
  });
});
