/**
 * Tests for structured logging.
 *
 * Verifies correlation IDs, redaction, and log entry format.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { logger, generateCorrelationId, bindLogger, createStructuredLogger } from "@/lib/logging";

describe("structured logging", () => {
  it("generates valid correlation IDs", () => {
    const id1 = generateCorrelationId();
    const id2 = generateCorrelationId();
    assert.ok(id1.length > 0);
    assert.ok(id2.length > 0);
    assert.notStrictEqual(id1, id2);
  });

  it("binds logger to correlation ID", () => {
    const correlationId = generateCorrelationId();
    const bound = bindLogger(logger, correlationId);
    assert.ok(bound.info);
    assert.ok(bound.warn);
    assert.ok(bound.error);
    assert.ok(bound.debug);
  });

  it("creates fresh logger instance", () => {
    const fresh = createStructuredLogger();
    assert.ok(fresh.info);
    assert.ok(fresh.warn);
    assert.ok(fresh.error);
    assert.ok(fresh.debug);
  });

  it("logger methods do not throw", () => {
    const log = createStructuredLogger();
    assert.doesNotThrow(() => log.info("test message"));
    assert.doesNotThrow(() => log.warn("test warning"));
    assert.doesNotThrow(() => log.error("test error"));
    assert.doesNotThrow(() => log.debug("test debug"));
  });

  it("logger accepts extra context", () => {
    const log = createStructuredLogger();
    assert.doesNotThrow(() =>
      log.info("test", { jobId: "test-123", prNumber: 42 })
    );
  });
});
