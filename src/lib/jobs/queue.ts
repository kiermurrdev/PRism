/**
 * Internal job queue interface.
 *
 * Abstracts the worker layer so PRism can swap implementations
 * (Trigger.dev, Inngest, etc.) without touching core code.
 *
 * SERVER-ONLY.
 */

import type { JobStatus } from "@/lib/db/schema";

/**
 * Payload for an analysis job.
 */
export interface AnalysisJobPayload {
  /** Repository UUID in PRism database. */
  repositoryId: string;
  /** PR number. */
  prNumber: number;
  /** Commit SHA to analyze. */
  headSha: string;
  /** The webhook action that triggered this job. */
  action: "opened" | "reopened" | "synchronize";
  /** Installation ID for GitHub App auth. */
  installationId: number;
  /** Optional credential ID from repository settings. */
  credentialId: string | null;
  /** Prompt version for idempotency. */
  promptVersion: string;
  /** Whether to post a PR comment when done. */
  autoComment: boolean;
}

/**
 * Current state of a job.
 */
export interface JobState {
  /** Job ID. */
  id: string;
  /** Current status. */
  status: JobStatus;
  /** Error message, if failed. */
  errorMessage?: string;
  /** Number of attempts. */
  attemptCount: number;
}

/**
 * Internal job queue interface.
 */
export interface JobQueue {
  /**
   * Enqueue an analysis job.
   * Returns the job ID immediately; the job runs asynchronously.
   */
  enqueueAnalysis(payload: AnalysisJobPayload): Promise<string>;

  /**
   * Get the current state of a job.
   */
  getJobState(jobId: string): Promise<JobState | null>;
}
