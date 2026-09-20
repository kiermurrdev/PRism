import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  getInstallationAccessToken,
  type FetchFn,
} from "@/lib/github/app/token";

/**
 * Create a mock fetch that returns a predetermined response.
 */
function createMockFetch(
  status: number,
  body: unknown,
  headers?: Record<string, string>
): FetchFn {
  return async (_url: string, _init?: RequestInit): Promise<Response> => {
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    });
  };
}

/**
 * Create a mock fetch that throws (network failure).
 */
function createFailingFetch(): FetchFn {
  return async (_url: string): Promise<Response> => {
    throw new Error("Network error");
  };
}

describe("Installation access token", () => {
  it("returns token when GitHub responds successfully", async () => {
    const mockFetch = createMockFetch(201, {
      token: "ghs_fake_installation_token_12345",
      expires_at: "2026-01-01T00:00:00Z",
    });

    const result = await getInstallationAccessToken(
      {
        jwt: "fake_jwt_token",
        installationId: 99999,
      },
      mockFetch
    );

    assert.ok(result.ok, "Should succeed with valid 201 response");
    if (result.ok) {
      assert.strictEqual(result.token, "ghs_fake_installation_token_12345");
      assert.strictEqual(result.expiresAt, new Date("2026-01-01T00:00:00Z").getTime());
    }
  });

  it("calls the correct GitHub API endpoint", async () => {
    let capturedUrl: string | undefined;
    const mockFetch: FetchFn = async (url: string) => {
      capturedUrl = url;
      return new Response(JSON.stringify({ token: "tok", expires_at: "2026-01-01T00:00:00Z" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    };

    await getInstallationAccessToken(
      {
        jwt: "fake_jwt",
        installationId: 12345,
      },
      mockFetch
    );

    assert.strictEqual(
      capturedUrl,
      "https://api.github.com/app/installations/12345/access_tokens"
    );
  });

  it("sends correct Authorization header", async () => {
    let capturedHeaders: Record<string, string> | undefined;
    const mockFetch: FetchFn = async (_url: string, init?: RequestInit) => {
      capturedHeaders = init?.headers as Record<string, string>;
      return new Response(JSON.stringify({ token: "tok", expires_at: "2026-01-01T00:00:00Z" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    };

    await getInstallationAccessToken(
      {
        jwt: "my_jwt_token",
        installationId: 999,
      },
      mockFetch
    );

    assert.strictEqual(capturedHeaders?.Authorization, "Bearer my_jwt_token");
    assert.strictEqual(capturedHeaders?.Accept, "application/vnd.github+json");
  });

  it("returns MISSING_INSTALLATION_ID when installationId is zero", async () => {
    const result = await getInstallationAccessToken({
      jwt: "fake_jwt",
      installationId: 0,
    });

    assert.ok(!result.ok);
    if (!result.ok) {
      assert.strictEqual(result.error.code, "MISSING_INSTALLATION_ID");
    }
  });

  it("returns MISSING_INSTALLATION_ID when installationId is negative", async () => {
    const result = await getInstallationAccessToken({
      jwt: "fake_jwt",
      installationId: -1,
    });

    assert.ok(!result.ok);
    if (!result.ok) {
      assert.strictEqual(result.error.code, "MISSING_INSTALLATION_ID");
    }
  });

  it("returns JWT_SIGNING_FAILED when JWT is empty", async () => {
    const result = await getInstallationAccessToken({
      jwt: "",
      installationId: 99999,
    });

    assert.ok(!result.ok);
    if (!result.ok) {
      assert.strictEqual(result.error.code, "JWT_SIGNING_FAILED");
    }
  });
});

describe("Installation token error handling", () => {
  it("returns GITHUB_AUTH_REJECTED on 401", async () => {
    const mockFetch = createMockFetch(401, { message: "Bad credentials" });

    const result = await getInstallationAccessToken(
      { jwt: "bad_jwt", installationId: 999 },
      mockFetch
    );

    assert.ok(!result.ok);
    if (!result.ok) {
      assert.strictEqual(result.error.code, "GITHUB_AUTH_REJECTED");
      // Should not leak GitHub's internal message
      assert.ok(
        !result.error.message.includes("Bad credentials"),
        "Error should not leak upstream details"
      );
    }
  });

  it("returns GITHUB_AUTH_REJECTED on 403", async () => {
    const mockFetch = createMockFetch(403, { message: "Forbidden" });

    const result = await getInstallationAccessToken(
      { jwt: "fake_jwt", installationId: 999 },
      mockFetch
    );

    assert.ok(!result.ok);
    if (!result.ok) {
      assert.strictEqual(result.error.code, "GITHUB_AUTH_REJECTED");
    }
  });

  it("returns GITHUB_RATE_LIMITED on 429", async () => {
    const mockFetch = createMockFetch(429, { message: "Rate limited" });

    const result = await getInstallationAccessToken(
      { jwt: "fake_jwt", installationId: 999 },
      mockFetch
    );

    assert.ok(!result.ok);
    if (!result.ok) {
      assert.strictEqual(result.error.code, "GITHUB_RATE_LIMITED");
    }
  });

  it("returns GITHUB_RATE_LIMITED when X-RateLimit-Remaining is 0", async () => {
    const mockFetch = createMockFetch(403, { message: "Abuse detected" }, {
      "X-RateLimit-Remaining": "0",
    });

    const result = await getInstallationAccessToken(
      { jwt: "fake_jwt", installationId: 999 },
      mockFetch
    );

    assert.ok(!result.ok);
    if (!result.ok) {
      assert.strictEqual(result.error.code, "GITHUB_RATE_LIMITED");
    }
  });

  it("returns GITHUB_UPSTREAM_ERROR on 500", async () => {
    const mockFetch = createMockFetch(500, { message: "Internal error" });

    const result = await getInstallationAccessToken(
      { jwt: "fake_jwt", installationId: 999 },
      mockFetch
    );

    assert.ok(!result.ok);
    if (!result.ok) {
      assert.strictEqual(result.error.code, "GITHUB_UPSTREAM_ERROR");
    }
  });

  it("returns GITHUB_UPSTREAM_ERROR on 503", async () => {
    const mockFetch = createMockFetch(503, { message: "Service unavailable" });

    const result = await getInstallationAccessToken(
      { jwt: "fake_jwt", installationId: 999 },
      mockFetch
    );

    assert.ok(!result.ok);
    if (!result.ok) {
      assert.strictEqual(result.error.code, "GITHUB_UPSTREAM_ERROR");
    }
  });

  it("returns GITHUB_NETWORK_ERROR on fetch exception", async () => {
    const mockFetch = createFailingFetch();

    const result = await getInstallationAccessToken(
      { jwt: "fake_jwt", installationId: 999 },
      mockFetch
    );

    assert.ok(!result.ok);
    if (!result.ok) {
      assert.strictEqual(result.error.code, "GITHUB_NETWORK_ERROR");
    }
  });

  it("returns GITHUB_UPSTREAM_ERROR when token is missing from response", async () => {
    const mockFetch = createMockFetch(201, { expires_at: "2026-01-01T00:00:00Z" });

    const result = await getInstallationAccessToken(
      { jwt: "fake_jwt", installationId: 999 },
      mockFetch
    );

    assert.ok(!result.ok);
    if (!result.ok) {
      assert.strictEqual(result.error.code, "GITHUB_UPSTREAM_ERROR");
    }
  });

  it("never exposes the JWT in error messages", async () => {
    const secretJwt = "super_secret_jwt_token_do_not_leak";
    const mockFetch = createMockFetch(401, { message: "Invalid token" });

    const result = await getInstallationAccessToken(
      { jwt: secretJwt, installationId: 999 },
      mockFetch
    );

    assert.ok(!result.ok);
    if (!result.ok) {
      assert.ok(
        !result.error.message.includes(secretJwt),
        "Error must never include the JWT"
      );
    }
  });
});
