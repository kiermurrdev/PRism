/**
 * Server-side concurrency guard and in-memory cache for live PR analysis.
 *
 * - One analysis at a time (shared-demo prototype).
 * - Short-lived cache keyed by repo + prNumber + headSha.
 * - No database, no distributed lock, no persistence.
 */

import type { AnalysisResult } from "@/types/analysis";

/**
 * Configuration for the analysis guard and cache.
 */
interface GuardConfig {
  /** Maximum duration (ms) to wait for an in-flight analysis before rejecting. */
  maxWaitMs: number;
  /** Duration (ms) that a cached result is considered valid. */
  cacheTtlMs: number;
}

/**
 * A cached analysis result with its expiration timestamp.
 */
interface CacheEntry {
  result: AnalysisResult;
  expiresAt: number;
}

/**
 * Default configuration tuned for a shared hackathon demo:
 * - 10 second wait if another analysis is in progress
 * - 5 minute cache window for the same PR/SHA
 */
const DEFAULT_CONFIG: GuardConfig = {
  maxWaitMs: 150_000,
  cacheTtlMs: 5 * 60 * 1000,
};

/**
 * Singleton state — process-scoped, server-only.
 */
let state: {
  /** Currently running analysis promise, or null if idle. */
  inFlight: {
    key: string;
    promise: Promise<AnalysisResult>;
  } | null;
  /** In-memory cache of recent results. */
  cache: Map<string, CacheEntry>;
} = {
  inFlight: null,
  cache: new Map(),
};

/**
 * Build a stable cache key from repo, PR number, and head SHA.
 */
export function buildCacheKey(repo: string, prNumber: number, headSha: string): string {
  return `${repo}#${prNumber}#${headSha}`;
}

/**
 * Retrieve a cached result if it exists and has not expired.
 */
function getCached(key: string): AnalysisResult | null {
  const entry = state.cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    state.cache.delete(key);
    return null;
  }
  return entry.result;
}

/**
 * Store a result in the cache with TTL.
 */
function setCached(key: string, result: AnalysisResult, ttlMs: number): void {
  state.cache.set(key, {
    result,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * Wait for an in-flight analysis to complete, up to a timeout.
 *
 * @returns the completed result, or null if the timeout was reached
 */
async function waitForInFlight(config: GuardConfig): Promise<AnalysisResult | null> {
  if (!state.inFlight) return null;

  const timeout = new Promise<null>(() => {
    setTimeout(() => {}, config.maxWaitMs);
  });

  const result = await Promise.race([state.inFlight.promise, timeout]);
  return result as AnalysisResult | null;
}

/**
 * Guarded wrapper for running a live analysis.
 *
 * Ensures only one analysis runs at a time and reuses cached results
 * when the same PR/SHA is requested within the cache window.
 *
 * @param key - The cache key (repo + prNumber + headSha)
 * @param fn - The analysis function to run
 * @param config - Optional guard configuration
 * @returns The analysis result (cached or freshly computed)
 * @throws {Error} If another analysis is in progress and the wait timeout is reached
 */
export async function withAnalysisGuard(
  key: string,
  fn: () => Promise<AnalysisResult>,
  config: Partial<GuardConfig> = {}
): Promise<AnalysisResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // 1. Check cache first
  const cached = getCached(key);
  if (cached) {
    return cached;
  }

  // 2. If idle, start analysis
  if (!state.inFlight) {
    const promise = fn().finally(() => {
      state.inFlight = null;
    });
    state.inFlight = { key, promise };
    const result = await promise;
    setCached(key, result, cfg.cacheTtlMs);
    return result;
  }

  // 3. Another analysis is in progress
  const currentKey = state.inFlight.key;

  // If it's the same key, wait for it and use its result
  if (currentKey === key) {
    const waited = await waitForInFlight(cfg);
    if (waited) {
      setCached(key, waited, cfg.cacheTtlMs);
      return waited;
    }
    throw new Error("Another analysis is in progress. Please try again shortly.");
  }

  // Different key in flight — wait briefly, then queue ours
  const waited = await waitForInFlight(cfg);
  if (!waited) {
    throw new Error("Another analysis is in progress. Please try again shortly.");
  }

  // Completed — check cache again (may have been populated)
  const rechecked = getCached(key);
  if (rechecked) return rechecked;

  // 4. Start our analysis now that the guard is free
  if (!state.inFlight) {
    const promise = fn().finally(() => {
      state.inFlight = null;
    });
    state.inFlight = { key, promise };
    const result = await promise;
    setCached(key, result, cfg.cacheTtlMs);
    return result;
  }

  // Safety fallback (should not reach here)
  throw new Error("Analysis guard state error. Please try again.");
}

/**
 * Internal helper for testing: reset guard state.
 */
export function __resetGuardState(): void {
  state = {
    inFlight: null,
    cache: new Map(),
  };
}
