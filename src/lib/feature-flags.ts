/**
 * Feature flags for gradual rollout.
 *
 * Supports environment-based and runtime-configurable flags.
 * Used to:
 * - Enable/disable the new job-based analysis flow
 * - Toggle legacy Nemotron-only/session-storage behavior
 * - Control new UI features
 */

export interface FeatureFlags {
  /** Use the new background job analysis flow instead of sync analysis. */
  newJobFlow: boolean;
  /** Enable the new dashboard UI. */
  newDashboard: boolean;
  /** Enable credential management. */
  credentialManagement: boolean;
  /** Enable GitHub App webhook-driven analysis. */
  webhookAnalysis: boolean;
  /** Enable the new report viewer. */
  newReportViewer: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  newJobFlow: true,
  newDashboard: true,
  credentialManagement: true,
  webhookAnalysis: true,
  newReportViewer: true,
};

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const lower = value.toLowerCase();
  return lower === "true" || lower === "1" || lower === "yes";
}

let cachedFlags: FeatureFlags | null = null;

export function getFeatureFlags(): FeatureFlags {
  if (cachedFlags) return cachedFlags;

  cachedFlags = {
    newJobFlow: parseBool(process.env.FEATURE_NEW_JOB_FLOW, DEFAULT_FLAGS.newJobFlow),
    newDashboard: parseBool(process.env.FEATURE_NEW_DASHBOARD, DEFAULT_FLAGS.newDashboard),
    credentialManagement: parseBool(process.env.FEATURE_CREDENTIAL_MANAGEMENT, DEFAULT_FLAGS.credentialManagement),
    webhookAnalysis: parseBool(process.env.FEATURE_WEBHOOK_ANALYSIS, DEFAULT_FLAGS.webhookAnalysis),
    newReportViewer: parseBool(process.env.FEATURE_NEW_REPORT_VIEWER, DEFAULT_FLAGS.newReportViewer),
  };

  return cachedFlags;
}

export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  return getFeatureFlags()[feature];
}

/**
 * Reset cached flags (for testing only).
 */
export function resetFeatureFlags(): void {
  cachedFlags = null;
}
