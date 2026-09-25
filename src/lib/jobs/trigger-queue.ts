/**
 * Trigger.dev implementation of the JobQueue interface.
 *
 * SERVER-ONLY. Never import this into client-side code.
 */

import { tasks } from "@trigger.dev/sdk/v3";
import type { JobQueue, AnalysisJobPayload } from "./queue";
import type { JobState } from "./queue";
import { db } from "@/lib/db/client";
import { analysisJobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Trigger task ID for the analysis pipeline.
 */
const ANALYSIS_TASK_ID = "analysis-pipeline";

/**
 * Trigger.dev-based job queue.
 */
export class TriggerJobQueue implements JobQueue {
  async enqueueAnalysis(payload: AnalysisJobPayload): Promise<string> {
    const result = await tasks.trigger(ANALYSIS_TASK_ID, payload);
    return result.id;
  }

  async getJobState(jobId: string): Promise<JobState | null> {
    const rows = await db.select().from(analysisJobs).where(eq(analysisJobs.id, jobId));
    if (rows.length === 0) return null;

    const job = rows[0];
    return {
      id: job.id,
      status: job.status as JobState["status"],
      errorMessage: job.errorMessage ?? undefined,
      attemptCount: job.attemptCount,
    };
  }
}

/**
 * Singleton instance.
 */
export const jobQueue = new TriggerJobQueue();
