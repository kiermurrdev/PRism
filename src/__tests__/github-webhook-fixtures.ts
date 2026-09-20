/**
 * Deterministic GitHub webhook payload fixtures.
 *
 * These are safe, self-contained payloads for testing the webhook handler
 * without network access or real secrets.
 */

import type { PullRequestAction } from "@/lib/github/app/contracts";

/**
 * A minimal, valid pull_request webhook payload.
 *
 * @param action - The pull_request action to simulate.
 * @param overrides - Optional overrides for specific fields.
 */
export function buildPullRequestPayload(
  action: PullRequestAction = "opened",
  overrides?: Record<string, unknown>
) {
  return {
    "X-GitHub-Delivery": "test-delivery-123",
    installation: {
      id: 99999,
    },
    repository: {
      id: 12345,
      full_name: "test-owner/test-repo",
      private: false,
    },
    pull_request: {
      number: 42,
      html_url: "https://github.com/test-owner/test-repo/pull/42",
      title: "Test pull request",
      action,
      head: {
        sha: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
        ref: "test-branch",
        repo: {
          full_name: "test-owner/test-repo",
        },
      },
      base: {
        ref: "main",
      },
    },
    ...overrides,
  };
}

/**
 * A fixture for a "pull_request.opened" event.
 */
export const PULL_REQUEST_OPENED_PAYLOAD = buildPullRequestPayload("opened");

/**
 * A fixture for a "pull_request.reopened" event.
 */
export const PULL_REQUEST_REOPENED_PAYLOAD = buildPullRequestPayload("reopened");

/**
 * A fixture for a "pull_request.synchronize" event.
 */
export const PULL_REQUEST_SYNCHRONIZE_PAYLOAD = buildPullRequestPayload("synchronize");

/**
 * A fixture for a "pull_request.closed" event (unsupported action).
 */
export const PULL_REQUEST_CLOSED_PAYLOAD = buildPullRequestPayload("opened", {
  pull_request: {
    ...buildPullRequestPayload("opened").pull_request,
    action: "closed",
  },
});

/**
 * A fixture for a "push" event (unsupported event type).
 */
export const PUSH_PAYLOAD = {
  "X-GitHub-Delivery": "test-delivery-456",
  ref: "refs/heads/main",
  installation: {
    id: 99999,
  },
  repository: {
    id: 12345,
    full_name: "test-owner/test-repo",
  },
};

/**
 * A placeholder webhook secret for testing.
 */
export const TEST_WEBHOOK_SECRET = "test-webhook-secret-123";
