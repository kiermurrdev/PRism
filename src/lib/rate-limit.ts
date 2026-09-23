/**
 * In-memory rate limiter with sliding window.
 *
 * Provides rate limiting for:
 * - Sign-in attempts
 * - Credential tests
 * - Manual analysis jobs
 * - Webhook deliveries
 * - Retries
 * - Report access
 *
 * Uses a simple sliding window counter. In production, replace with Redis.
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now - entry.windowStart > 3600_000) {
      store.delete(key);
    }
  }
}, 300_000);

// Prevent interval from keeping process alive in test environments
if (typeof (globalThis as unknown as { __stopCleanup?: () => void }).__stopCleanup !== "function") {
  (globalThis as unknown as { __stopCleanup: () => void }).__stopCleanup = () => clearInterval(cleanupInterval);
}

export interface RateLimitConfig {
  /** Maximum requests allowed in the window. */
  maxRequests: number;
  /** Window duration in milliseconds. */
  windowMs: number;
  /** Error message returned when rate limited. */
  errorMessage?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
  signin: {
    maxRequests: 5,
    windowMs: 60_000, // 5 attempts per minute
    errorMessage: "Too many sign-in attempts. Please try again later.",
  },
  credential_test: {
    maxRequests: 10,
    windowMs: 60_000, // 10 tests per minute
    errorMessage: "Too many credential tests. Please try again later.",
  },
  analysis_job: {
    maxRequests: 20,
    windowMs: 60_000, // 20 jobs per minute per user
    errorMessage: "Too many analysis jobs queued. Please try again later.",
  },
  webhook: {
    maxRequests: 100,
    windowMs: 60_000, // 100 webhooks per minute per repo
    errorMessage: "Webhook rate limit exceeded.",
  },
  retry: {
    maxRequests: 10,
    windowMs: 60_000, // 10 retries per minute per user
    errorMessage: "Too many retry attempts. Please try again later.",
  },
  report_access: {
    maxRequests: 60,
    windowMs: 60_000, // 60 views per minute per user
    errorMessage: "Too many report requests. Please try again later.",
  },
};

export function checkRateLimit(
  key: string,
  config?: RateLimitConfig
): RateLimitResult {
  const effectiveConfig = config || DEFAULT_CONFIGS[key] || {
    maxRequests: 60,
    windowMs: 60_000,
    errorMessage: "Rate limit exceeded.",
  };

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart > effectiveConfig.windowMs) {
    // New window
    store.set(key, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: effectiveConfig.maxRequests - 1,
      resetAt: now + effectiveConfig.windowMs,
    };
  }

  entry.count++;
  const resetAt = entry.windowStart + effectiveConfig.windowMs;

  if (entry.count > effectiveConfig.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt,
    };
  }

  return {
    allowed: true,
    remaining: effectiveConfig.maxRequests - entry.count,
    resetAt,
  };
}

/**
 * Get the rate limit config for a given key.
 */
export function getRateLimitConfig(key: string): RateLimitConfig | undefined {
  return DEFAULT_CONFIGS[key];
}
