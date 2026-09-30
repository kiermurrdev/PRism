/**
 * Tests for rate limiting.
 */

import { strict as assert } from "node:assert";
import { describe, it, before } from "node:test";
import { checkRateLimit, getRateLimitConfig } from "@/lib/rate-limit";

// Stop the cleanup interval to avoid interference
const stopCleanup = (globalThis as unknown as { __stopCleanup?: () => void }).__stopCleanup;
if (stopCleanup) stopCleanup();

describe("rate limiting", () => {
  it("allows requests within limit", () => {
    const result = checkRateLimit("test-rate:allow", {
      maxRequests: 5,
      windowMs: 60_000,
    });
    assert.strictEqual(result.allowed, true);
    assert.ok(result.remaining >= 0);
    assert.ok(result.resetAt > Date.now());
  });

  it("blocks after exceeding limit", () => {
    const key = "test-rate:block";
    const config = { maxRequests: 3, windowMs: 60_000 };

    checkRateLimit(key, config);
    checkRateLimit(key, config);
    checkRateLimit(key, config);
    const blocked = checkRateLimit(key, config);

    assert.strictEqual(blocked.allowed, false);
    assert.strictEqual(blocked.remaining, 0);
  });

  it("returns default config for known keys", () => {
    assert.ok(getRateLimitConfig("signin"));
    assert.ok(getRateLimitConfig("analysis_job"));
    assert.ok(getRateLimitConfig("webhook"));
    assert.ok(getRateLimitConfig("retry"));
    assert.ok(getRateLimitConfig("report_access"));
  });

  it("signin config is restrictive", () => {
    const config = getRateLimitConfig("signin");
    assert.ok(config);
    assert.ok(config.maxRequests <= 10);
  });

  it("analysis_job config exists", () => {
    const config = getRateLimitConfig("analysis_job");
    assert.ok(config);
    assert.ok(config.maxRequests > 0);
  });
});
