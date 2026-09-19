import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { parseGitHubPRUrl, createInvalidUrlError } from "@/lib/github/url";

describe("parseGitHubPRUrl", () => {
  it("parses a valid canonical PR URL", () => {
    const result = parseGitHubPRUrl("https://github.com/owner/repo/pull/42");
    assert.deepStrictEqual(result, {
      owner: "owner",
      repo: "repo",
      prNumber: 42,
    });
  });

  it("handles owner with dots, hyphens, and underscores", () => {
    const result = parseGitHubPRUrl(
      "https://github.com/my-org.team_/repo-name/pull/1"
    );
    assert.deepStrictEqual(result, {
      owner: "my-org.team_",
      repo: "repo-name",
      prNumber: 1,
    });
  });

  it("handles repo with dots, hyphens, and underscores", () => {
    const result = parseGitHubPRUrl(
      "https://github.com/owner/my.repo_test/pull/99"
    );
    assert.deepStrictEqual(result, {
      owner: "owner",
      repo: "my.repo_test",
      prNumber: 99,
    });
  });

  it("lowercases owner and repo", () => {
    const result = parseGitHubPRUrl("https://github.com/Owner/Repo/pull/1");
    assert.strictEqual(result?.owner, "owner");
    assert.strictEqual(result?.repo, "repo");
  });

  it("trims whitespace", () => {
    const result = parseGitHubPRUrl("  https://github.com/a/b/pull/1  ");
    assert.deepStrictEqual(result, {
      owner: "a",
      repo: "b",
      prNumber: 1,
    });
  });

  it("returns null for non-PR URL (issue)", () => {
    assert.strictEqual(
      parseGitHubPRUrl("https://github.com/owner/repo/issues/42"),
      null
    );
  });

  it("returns null for compare URL", () => {
    assert.strictEqual(
      parseGitHubPRUrl("https://github.com/owner/repo/compare/main...branch"),
      null
    );
  });

  it("returns null for commit URL", () => {
    assert.strictEqual(
      parseGitHubPRUrl("https://github.com/owner/repo/commit/abc123"),
      null
    );
  });

  it("returns null for repo URL without PR", () => {
    assert.strictEqual(
      parseGitHubPRUrl("https://github.com/owner/repo"),
      null
    );
  });

  it("returns null for non-github.com domain", () => {
    assert.strictEqual(
      parseGitHubPRUrl("https://gitlab.com/owner/repo/pull/42"),
      null
    );
  });

  it("returns null for http instead of https", () => {
    assert.strictEqual(
      parseGitHubPRUrl("http://github.com/owner/repo/pull/42"),
      null
    );
  });

  it("returns null for missing PR number", () => {
    assert.strictEqual(
      parseGitHubPRUrl("https://github.com/owner/repo/pull/"),
      null
    );
  });

  it("returns null for non-numeric PR number", () => {
    assert.strictEqual(
      parseGitHubPRUrl("https://github.com/owner/repo/pull/abc"),
      null
    );
  });

  it("returns null for zero PR number", () => {
    assert.strictEqual(
      parseGitHubPRUrl("https://github.com/owner/repo/pull/0"),
      null
    );
  });

  it("returns null for negative PR number", () => {
    assert.strictEqual(
      parseGitHubPRUrl("https://github.com/owner/repo/pull/-1"),
      null
    );
  });

  it("returns null for empty string", () => {
    assert.strictEqual(parseGitHubPRUrl(""), null);
  });

  it("returns null for whitespace-only string", () => {
    assert.strictEqual(parseGitHubPRUrl("   "), null);
  });
});

describe("createInvalidUrlError", () => {
  it("creates an error with INVALID_URL code", () => {
    const error = createInvalidUrlError();
    assert.strictEqual(error.code, "INVALID_URL");
    assert.ok(typeof error.message === "string");
  });

  it("accepts a custom message", () => {
    const error = createInvalidUrlError("Custom message");
    assert.strictEqual(error.code, "INVALID_URL");
    assert.strictEqual(error.message, "Custom message");
  });
});
