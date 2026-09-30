/**
 * Tests for feature flags.
 */

import { strict as assert } from "node:assert";
import { describe, it, before, after } from "node:test";
import { getFeatureFlags, isFeatureEnabled, resetFeatureFlags } from "@/lib/feature-flags";

describe("feature flags", () => {
  before(() => {
    resetFeatureFlags();
  });

  it("returns default flags", () => {
    const flags = getFeatureFlags();
    assert.strictEqual(flags.newJobFlow, true);
    assert.strictEqual(flags.newDashboard, true);
    assert.strictEqual(flags.credentialManagement, true);
    assert.strictEqual(flags.webhookAnalysis, true);
    assert.strictEqual(flags.newReportViewer, true);
  });

  it("isFeatureEnabled works", () => {
    assert.strictEqual(isFeatureEnabled("newJobFlow"), true);
  });

  it("respects env override for true", () => {
    process.env.FEATURE_NEW_JOB_FLOW = "true";
    resetFeatureFlags();
    assert.strictEqual(isFeatureEnabled("newJobFlow"), true);
  });

  it("respects env override for false", () => {
    process.env.FEATURE_NEW_JOB_FLOW = "false";
    resetFeatureFlags();
    assert.strictEqual(isFeatureEnabled("newJobFlow"), false);
    delete process.env.FEATURE_NEW_JOB_FLOW;
    resetFeatureFlags();
  });

  it("respects numeric env override", () => {
    process.env.FEATURE_NEW_JOB_FLOW = "1";
    resetFeatureFlags();
    assert.strictEqual(isFeatureEnabled("newJobFlow"), true);
    process.env.FEATURE_NEW_JOB_FLOW = "0";
    resetFeatureFlags();
    assert.strictEqual(isFeatureEnabled("newJobFlow"), false);
    delete process.env.FEATURE_NEW_JOB_FLOW;
    resetFeatureFlags();
  });

  it("caches flags", () => {
    const flags1 = getFeatureFlags();
    const flags2 = getFeatureFlags();
    assert.strictEqual(flags1, flags2);
  });

  it("reset clears cache", () => {
    process.env.FEATURE_NEW_JOB_FLOW = "false";
    resetFeatureFlags();
    const flags1 = getFeatureFlags();
    assert.strictEqual(flags1.newJobFlow, false);

    delete process.env.FEATURE_NEW_JOB_FLOW;
    resetFeatureFlags();
    const flags2 = getFeatureFlags();
    assert.strictEqual(flags2.newJobFlow, true);
  });
});
