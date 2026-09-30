import { db } from "./client";
import { analysisJobs, reports } from "./schema";
import {
  analysisJobRepository,
  reportRepository,
  repositoryRepository,
} from "./domain-repositories";
import type { NewAnalysisJob, NewReport } from "./schema";
import type { ReportData } from "@/types/report";

export class AnalysisService {
  async findOrCreateJob(
    repositoryId: string,
    prNumber: number,
    headSha: string,
    credentialId: string | null,
    promptVersion: string,
  ): Promise<{ job: typeof analysisJobs.$inferSelect; isNew: boolean }> {
    const existing = await analysisJobRepository.findIdempotent(
      repositoryId,
      prNumber,
      headSha,
      credentialId,
      promptVersion,
    );

    if (existing.length > 0) {
      return { job: existing[0], isNew: false };
    }

    const newJob = await analysisJobRepository.create({
      repositoryId,
      prNumber,
      headSha,
      credentialId,
      promptVersion,
      status: "queued",
      attemptCount: 0,
    } as NewAnalysisJob);

    return { job: newJob[0], isNew: true };
  }

  async updateJobStatus(
    jobId: string,
    status: typeof analysisJobs.$inferSelect["status"],
    errorMessage?: string,
  ) {
    const completedAt =
      status === "completed" || status === "failed" ? new Date() : undefined;
    return analysisJobRepository.update(jobId, {
      status,
      errorMessage,
      completedAt,
    });
  }

  async persistReport(
    jobId: string,
    repositoryId: string,
    userId: string,
    reportData: ReportData,
    options: {
      headSha: string;
      provider?: string;
      model?: string;
      promptVersion?: string;
      schemaVersion?: string;
    },
  ) {
    const newReport = await reportRepository.create({
      jobId,
      repositoryId,
      userId,
      headSha: options.headSha,
      provider: options.provider,
      model: options.model,
      promptVersion: options.promptVersion ?? "v1",
      title: reportData.title,
      prUrl: reportData.prUrl,
      summary: reportData.summary,
      nodes: reportData.nodes,
      edges: reportData.edges,
      findings: reportData.findings,
      qaItems: reportData.qaItems,
      affectedFiles: reportData.affectedFiles,
      schemaVersion: options.schemaVersion ?? "v1",
    } as NewReport);

    await this.updateJobStatus(jobId, "completed");
    return newReport[0];
  }

  async getReportForPR(
    repositoryId: string,
    prNumber: number,
    headSha: string,
  ) {
    const jobs = await analysisJobRepository.findByRepositoryAndPR(
      repositoryId,
      prNumber,
    );

    const matchingJob = jobs.find(
      (j) => j.headSha === headSha && j.status === "completed",
    );

    if (!matchingJob) return null;

    const reportsList = await reportRepository.findByJob(matchingJob.id);
    return reportsList[0] ?? null;
  }
}

export class RepositoryService {
  async getOrCreateRepository(
    githubRepoId: number,
    fullName: string,
    installationId: string,
    isPrivate: boolean,
  ) {
    const existing = await repositoryRepository.findByGithubRepoId(githubRepoId);
    if (existing.length > 0) {
      return existing[0];
    }

    const newRepo = await repositoryRepository.create({
      githubRepoId,
      fullName,
      installationId,
      isPrivate,
    });

    return newRepo[0];
  }
}

export const analysisService = new AnalysisService();
export const repositoryService = new RepositoryService();
