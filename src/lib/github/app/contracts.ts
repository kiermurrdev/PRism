/**
 * Canonical TypeScript contracts for the GitHub App integration.
 *
 * These types are used by the webhook handler, comment service, and configuration layer.
 * They are defined here so all consumers share the same shapes.
 */

/**
 * A validated GitHub webhook event envelope.
 */
export interface GitHubWebhookEvent {
  /** The GitHub event type (e.g., "pull_request"). */
  type: string;
  /** The action within the event (e.g., "opened", "reopened", "synchronize"). */
  action: string;
  /** The installation that triggered the event. */
  installation: {
    id: number;
  };
  /** The repository the event concerns. */
  repository: {
    id: number;
    full_name: string;
    private: boolean;
  };
  /** The pull request payload (present for "pull_request" events). */
  pull_request?: {
    number: number;
    head: {
      sha: string;
      ref: string;
      repo: {
        full_name: string;
      };
    };
    base: {
      ref: string;
    };
  };
}

/**
 * Identity of a GitHub App installation.
 */
export interface InstallationIdentity {
  /** The app's numeric ID. */
  appId: number;
  /** The app's URL-safe slug. */
  appSlug: string;
  /** The installation ID on the target account/org. */
  installationId: number;
}

/**
 * The PR comment marker header that identifies a PRism-generated comment.
 */
export interface PRCommentMarker {
  /** Full repository name (owner/repo). */
  repo: string;
  /** Pull request number. */
  prNumber: number;
  /** Head commit SHA at analysis time. */
  sha: string;
}

/**
 * A generated analysis URL for a specific PR.
 */
export interface AnalysisUrl {
  /** The full URL to the analysis report. */
  url: string;
  /** The repository (owner/repo). */
  repo: string;
  /** The PR number. */
  prNumber: number;
  /** The head SHA the analysis was run against. */
  sha: string;
}

/**
 * Error codes for GitHub App configuration issues.
 */
export type GitHubAppConfigErrorCode =
  | "MISSING_GITHUB_APP_ID"
  | "INVALID_GITHUB_APP_ID"
  | "MISSING_GITHUB_APP_PRIVATE_KEY"
  | "MISSING_GITHUB_WEBHOOK_SECRET"
  | "MISSING_GITHUB_APP_SLUG"
  | "MISSING_APP_URL"
  | "INVALID_APP_URL";

/**
 * A typed configuration error for the GitHub App integration.
 */
export interface GitHubAppConfigError {
  code: GitHubAppConfigErrorCode;
  message: string;
}

/**
 * Error codes for GitHub App authentication operations.
 */
export type GitHubAppAuthErrorCode =
  | "MISSING_GITHUB_APP_ID"
  | "MISSING_GITHUB_APP_PRIVATE_KEY"
  | "INVALID_GITHUB_APP_PRIVATE_KEY"
  | "JWT_SIGNING_FAILED"
  | "MISSING_INSTALLATION_ID"
  | "GITHUB_AUTH_REJECTED"
  | "GITHUB_RATE_LIMITED"
  | "GITHUB_NETWORK_ERROR"
  | "GITHUB_UPSTREAM_ERROR";

/**
 * A typed authentication error for the GitHub App integration.
 */
export interface GitHubAppAuthError {
  code: GitHubAppAuthErrorCode;
  message: string;
}

/**
 * Validated runtime configuration for the GitHub App.
 */
export interface GitHubAppConfig {
  appId: number;
  privateKey: string;
  webhookSecret: string;
  appSlug: string;
  appUrl: string;
}
