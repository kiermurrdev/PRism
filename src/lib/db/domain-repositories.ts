import { eq, and, sql } from "drizzle-orm";
import { db } from "./client";
import {
  tenantAccounts,
  accountMemberships,
  installations,
  repositories,
  providerCredentials,
  repositorySettings,
  analysisJobs,
  reports,
  prComments,
  encryptionKeys,
} from "./schema";
import type {
  NewTenantAccount,
  NewAccountMembership,
  NewInstallation,
  NewRepository,
  NewProviderCredential,
  NewRepositorySettings,
  NewAnalysisJob,
  NewReport,
  NewPrComment,
} from "./schema";

export class TenantAccountRepository {
  async findById(id: string) {
    return db.select().from(tenantAccounts).where(eq(tenantAccounts.id, id)).limit(1);
  }

  async findByUserId(userId: string) {
    return db
      .select()
      .from(tenantAccounts)
      .where(eq(tenantAccounts.ownerId, userId))
      .orderBy(tenantAccounts.createdAt);
  }

  async create(data: NewTenantAccount) {
    return db.insert(tenantAccounts).values(data).returning();
  }

  async listByOwnerId(ownerId: string) {
    return db
      .select()
      .from(tenantAccounts)
      .where(eq(tenantAccounts.ownerId, ownerId))
      .orderBy(tenantAccounts.createdAt);
  }
}

export class AccountMembershipRepository {
  async findByAccountAndUser(accountId: string, userId: string) {
    return db
      .select()
      .from(accountMemberships)
      .where(
        and(
          eq(accountMemberships.accountId, accountId),
          eq(accountMemberships.userId, userId),
        ),
      )
      .limit(1);
  }

  async create(data: NewAccountMembership) {
    return db.insert(accountMemberships).values(data).returning();
  }

  async listByAccount(accountId: string) {
    return db
      .select()
      .from(accountMemberships)
      .where(eq(accountMemberships.accountId, accountId));
  }

  async listByUser(userId: string) {
    return db
      .select()
      .from(accountMemberships)
      .where(eq(accountMemberships.userId, userId));
  }

  async delete(accountId: string, userId: string) {
    return db
      .delete(accountMemberships)
      .where(
        and(
          eq(accountMemberships.accountId, accountId),
          eq(accountMemberships.userId, userId),
        ),
      );
  }
}

export class InstallationRepository {
  async findById(id: string) {
    return db.select().from(installations).where(eq(installations.id, id)).limit(1);
  }

  async findByGithubInstallationId(githubId: number) {
    return db
      .select()
      .from(installations)
      .where(eq(installations.githubInstallationId, githubId))
      .limit(1);
  }

  async listByAccount(accountId: string) {
    return db
      .select()
      .from(installations)
      .where(eq(installations.accountId, accountId));
  }

  async create(data: NewInstallation) {
    return db.insert(installations).values(data).returning();
  }

  async update(id: string, data: Partial<NewInstallation>) {
    return db
      .update(installations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(installations.id, id))
      .returning();
  }

  async delete(id: string) {
    return db.delete(installations).where(eq(installations.id, id));
  }
}

export class RepositoryRepository {
  async findById(id: string) {
    return db.select().from(repositories).where(eq(repositories.id, id)).limit(1);
  }

  async findByGithubRepoId(githubId: number) {
    return db
      .select()
      .from(repositories)
      .where(eq(repositories.githubRepoId, githubId))
      .limit(1);
  }

  async findByFullName(fullName: string) {
    return db
      .select()
      .from(repositories)
      .where(eq(repositories.fullName, fullName))
      .limit(1);
  }

  async listByInstallation(installationId: string) {
    return db
      .select()
      .from(repositories)
      .where(eq(repositories.installationId, installationId));
  }

  async create(data: NewRepository) {
    return db.insert(repositories).values(data).returning();
  }

  async update(id: string, data: Partial<NewRepository>) {
    return db
      .update(repositories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(repositories.id, id))
      .returning();
  }
}

export class ProviderCredentialRepository {
  async findById(id: string) {
    return db
      .select()
      .from(providerCredentials)
      .where(eq(providerCredentials.id, id))
      .limit(1);
  }

  async listByUser(userId: string) {
    return db
      .select()
      .from(providerCredentials)
      .where(eq(providerCredentials.userId, userId))
      .orderBy(providerCredentials.createdAt);
  }

  async create(data: NewProviderCredential) {
    return db.insert(providerCredentials).values(data).returning();
  }

  async update(id: string, data: Partial<NewProviderCredential>) {
    return db
      .update(providerCredentials)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(providerCredentials.id, id))
      .returning();
  }

  async delete(id: string) {
    return db.delete(providerCredentials).where(eq(providerCredentials.id, id));
  }
}

export class RepositorySettingsRepository {
  async findByRepository(repositoryId: string) {
    return db
      .select()
      .from(repositorySettings)
      .where(eq(repositorySettings.repositoryId, repositoryId))
      .limit(1);
  }

  async create(data: NewRepositorySettings) {
    return db.insert(repositorySettings).values(data).returning();
  }

  async update(id: string, data: Partial<NewRepositorySettings>) {
    return db
      .update(repositorySettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(repositorySettings.id, id))
      .returning();
  }

  async upsertByRepository(repositoryId: string, data: Omit<NewRepositorySettings, "id" | "createdAt" | "updatedAt" | "repositoryId">) {
    const existing = await this.findByRepository(repositoryId);
    if (existing.length > 0) {
      return (await this.update(existing[0].id, data))[0];
    }
    return (await this.create({ repositoryId, ...data }))[0];
  }
}

export class AnalysisJobRepository {
  async findById(id: string) {
    return db.select().from(analysisJobs).where(eq(analysisJobs.id, id)).limit(1);
  }

  async findIdempotent(
    repositoryId: string,
    prNumber: number,
    headSha: string,
    credentialId: string | null,
    promptVersion: string,
  ) {
    return db
      .select()
      .from(analysisJobs)
      .where(
        and(
          eq(analysisJobs.repositoryId, repositoryId),
          eq(analysisJobs.prNumber, prNumber),
          eq(analysisJobs.headSha, headSha),
          credentialId ? eq(analysisJobs.credentialId, credentialId) : eq(analysisJobs.credentialId, null as any),
          eq(analysisJobs.promptVersion, promptVersion),
        ),
      )
      .limit(1);
  }

  async findByRepositoryAndPR(repositoryId: string, prNumber: number) {
    return db
      .select()
      .from(analysisJobs)
      .where(
        and(
          eq(analysisJobs.repositoryId, repositoryId),
          eq(analysisJobs.prNumber, prNumber),
        ),
      )
      .orderBy((t) => t.createdAt);
  }

  async create(data: NewAnalysisJob) {
    return db.insert(analysisJobs).values(data).returning();
  }

  async update(id: string, data: Partial<NewAnalysisJob>) {
    const now = new Date();
    return db
      .update(analysisJobs)
      .set({ ...data, updatedAt: now })
      .where(eq(analysisJobs.id, id))
      .returning();
  }

  async incrementAttempt(id: string) {
    return db
      .update(analysisJobs)
      .set({
        attemptCount: sql`${analysisJobs.attemptCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(analysisJobs.id, id))
      .returning();
  }
}

export class ReportRepository {
  async findById(id: string) {
    return db.select().from(reports).where(eq(reports.id, id)).limit(1);
  }

  async findByJob(jobId: string) {
    return db.select().from(reports).where(eq(reports.jobId, jobId)).limit(1);
  }

  async findByRepository(repositoryId: string) {
    const rows = await db
      .select({
        report: reports,
        job: analysisJobs,
      })
      .from(reports)
      .innerJoin(analysisJobs, eq(reports.jobId, analysisJobs.id))
      .where(eq(analysisJobs.repositoryId, repositoryId))
      .orderBy((t) => t.report.analyzedAt);
    return rows.map((r) => ({
      ...r.report,
      prNumber: r.job.prNumber,
    }));
  }

  async findByRepositoryAndPR(repositoryId: string, prNumber: number) {
    // Join with analysisJobs to filter by PR number
    const rows = await db
      .select({
        report: reports,
        job: analysisJobs,
      })
      .from(reports)
      .innerJoin(analysisJobs, eq(reports.jobId, analysisJobs.id))
      .where(
        and(
          eq(analysisJobs.repositoryId, repositoryId),
          eq(analysisJobs.prNumber, prNumber),
        ),
      )
      .orderBy((t) => t.report.analyzedAt);
    return rows.map((r) => r.report);
  }

  async findLatestByRepositoryAndPR(repositoryId: string, prNumber: number) {
    const rows = await db
      .select({
        report: reports,
        job: analysisJobs,
      })
      .from(reports)
      .innerJoin(analysisJobs, eq(reports.jobId, analysisJobs.id))
      .where(
        and(
          eq(analysisJobs.repositoryId, repositoryId),
          eq(analysisJobs.prNumber, prNumber),
        ),
      )
      .orderBy((t) => t.report.analyzedAt)
      .limit(1);
    return rows.length > 0 ? rows[0].report : null;
  }

  async findByUser(userId: string, limit: number = 50) {
    return db
      .select()
      .from(reports)
      .where(eq(reports.userId, userId))
      .orderBy((t) => t.analyzedAt)
      .limit(limit);
  }

  async create(data: NewReport) {
    return db.insert(reports).values(data).returning();
  }
}

export class PrCommentRepository {
  async findById(id: string) {
    return db.select().from(prComments).where(eq(prComments.id, id)).limit(1);
  }

  async findByRepositoryAndPR(repositoryId: string, prNumber: number) {
    return db
      .select()
      .from(prComments)
      .where(
        and(
          eq(prComments.repositoryId, repositoryId),
          eq(prComments.prNumber, prNumber),
        ),
      )
      .limit(1);
  }

  async findByGithubCommentId(commentId: number) {
    return db
      .select()
      .from(prComments)
      .where(eq(prComments.githubCommentId, commentId))
      .limit(1);
  }

  async create(data: NewPrComment) {
    return db.insert(prComments).values(data).returning();
  }

  async update(id: string, data: Partial<NewPrComment>) {
    return db
      .update(prComments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(prComments.id, id))
      .returning();
  }
}

export class EncryptionKeyRepository {
  async findActive() {
    return db
      .select()
      .from(encryptionKeys)
      .where(eq(encryptionKeys.active, true))
      .limit(1);
  }

  async findById(id: number) {
    return db.select().from(encryptionKeys).where(eq(encryptionKeys.id, id)).limit(1);
  }

  async create(encryptedKeyMaterial: string) {
    return db
      .insert(encryptionKeys)
      .values({ encryptedKeyMaterial, active: true })
      .returning();
  }

  async deactivate(id: number) {
    return db
      .update(encryptionKeys)
      .set({ active: false })
      .where(eq(encryptionKeys.id, id))
      .returning();
  }
}

export const tenantAccountRepository = new TenantAccountRepository();
export const accountMembershipRepository = new AccountMembershipRepository();
export const installationRepository = new InstallationRepository();
export const repositoryRepository = new RepositoryRepository();
export const providerCredentialRepository = new ProviderCredentialRepository();
export const repositorySettingsRepository = new RepositorySettingsRepository();
export const analysisJobRepository = new AnalysisJobRepository();
export const reportRepository = new ReportRepository();
export const prCommentRepository = new PrCommentRepository();
export const encryptionKeyRepository = new EncryptionKeyRepository();
