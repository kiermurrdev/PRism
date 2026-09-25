import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { createDrizzleClient } from "../lib/db/client";
import {
  users,
  accounts,
  sessions,
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
} from "../lib/db/schema";
import { eq, and } from "drizzle-orm";

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/prism_test";

describe("Database domain models and repositories", () => {
  let db: ReturnType<typeof createDrizzleClient>;

  before(async () => {
    db = createDrizzleClient(TEST_DB_URL);
  });

  after(async () => {
    // Clean up tables instead of dropping database (connection is already to it)
    const tables = [
      "pr_comments",
      "reports",
      "analysis_jobs",
      "repository_settings",
      "provider_credentials",
      "repositories",
      "installations",
      "account_memberships",
      "tenant_accounts",
      "sessions",
      "accounts",
      "users",
      "verification_tokens",
      "encryption_keys",
    ];
    for (const t of tables) {
      await db.execute(`DROP TABLE IF EXISTS "${t}" CASCADE`);
    }
  });

  it("should have all required tables", async () => {
    const result = await db.execute(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    const tables = result.map((r: any) => r.table_name);
    const expected = [
      "account_memberships",
      "accounts",
      "analysis_jobs",
      "encryption_keys",
      "installations",
      "pr_comments",
      "provider_credentials",
      "reports",
      "repositories",
      "repository_settings",
      "sessions",
      "tenant_accounts",
      "users",
      "verification_tokens",
    ];
    for (const t of expected) {
      assert.ok(
        tables.includes(t),
        `Table ${t} should exist`,
      );
    }
  });

  it("should enforce unique constraints on users", async () => {
    await db.insert(users).values({
      email: "test@example.com",
      githubLogin: "testuser",
      githubId: BigInt(12345),
    });

    await assert.rejects(
      db.insert(users).values({
        email: "test@example.com",
        githubLogin: "other",
      }),
      /unique/,
    );

    await assert.rejects(
      db.insert(users).values({
        email: "other@example.com",
        githubId: BigInt(12345),
      }),
      /unique/,
    );

    await db.delete(users);
  });

  it("should enforce unique constraints on installations", async () => {
    const account = await db
      .insert(tenantAccounts)
      .values({ name: "Test Org", ownerId: crypto.randomUUID() })
      .returning();

    await db.insert(installations).values({
      githubInstallationId: 999,
      accountId: account[0].id,
      appId: 1,
      appSlug: "prism-test",
    });

    await assert.rejects(
      db.insert(installations).values({
        githubInstallationId: 999,
        accountId: account[0].id,
        appId: 1,
        appSlug: "prism-test",
      }),
      /unique/,
    );

    await db.delete(installations);
    await db.delete(tenantAccounts);
  });

  it("should enforce unique constraints on repositories", async () => {
    const account = await db
      .insert(tenantAccounts)
      .values({ name: "Test Org", ownerId: crypto.randomUUID() })
      .returning();
    const installation = await db
      .insert(installations)
      .values({
        githubInstallationId: 888,
        accountId: account[0].id,
        appId: 1,
        appSlug: "prism-test",
      })
      .returning();

    await db.insert(repositories).values({
      githubRepoId: 100,
      fullName: "owner/repo",
      installationId: installation[0].id,
    });

    await assert.rejects(
      db.insert(repositories).values({
        githubRepoId: 100,
        fullName: "owner/repo",
        installationId: installation[0].id,
      }),
      /unique/,
    );

    await db.delete(repositories);
    await db.delete(installations);
    await db.delete(tenantAccounts);
  });

  it("should enforce idempotency key on analysis jobs", async () => {
    const account = await db
      .insert(tenantAccounts)
      .values({ name: "Test Org", ownerId: crypto.randomUUID() })
      .returning();
    const installation = await db
      .insert(installations)
      .values({
        githubInstallationId: 777,
        accountId: account[0].id,
        appId: 1,
        appSlug: "prism-test",
      })
      .returning();
    const repo = await db
      .insert(repositories)
      .values({
        githubRepoId: 200,
        fullName: "owner/repo2",
        installationId: installation[0].id,
      })
      .returning();
    const credential = await db
      .insert(providerCredentials)
      .values({
        userId: crypto.randomUUID(),
        provider: "nvidia",
        model: "nemotron-4-340b",
        encryptedApiKey: "fake-encrypted-key",
        maskedSuffix: "****abcd",
      })
      .returning();

    await db.insert(analysisJobs).values({
      repositoryId: repo[0].id,
      prNumber: 42,
      headSha: "abc123",
      credentialId: credential[0].id,
      promptVersion: "v1",
    });

    await assert.rejects(
      db.insert(analysisJobs).values({
        repositoryId: repo[0].id,
        prNumber: 42,
        headSha: "abc123",
        credentialId: credential[0].id,
        promptVersion: "v1",
      }),
      /unique/,
    );

    await db.delete(analysisJobs);
    await db.delete(providerCredentials);
    await db.delete(repositories);
    await db.delete(installations);
    await db.delete(tenantAccounts);
  });

  it("should support cascading deletes", async () => {
    const user = await db
      .insert(users)
      .values({ email: "cascade@example.com" })
      .returning();
    const account = await db
      .insert(tenantAccounts)
      .values({ name: "Cascade Org", ownerId: user[0].id })
      .returning();
    const membership = await db
      .insert(accountMemberships)
      .values({ accountId: account[0].id, userId: user[0].id })
      .returning();
    const installation = await db
      .insert(installations)
      .values({
        githubInstallationId: 666,
        accountId: account[0].id,
        appId: 1,
        appSlug: "prism-test",
      })
      .returning();
    const repo = await db
      .insert(repositories)
      .values({
        githubRepoId: 300,
        fullName: "owner/repo3",
        installationId: installation[0].id,
      })
      .returning();
    const job = await db
      .insert(analysisJobs)
      .values({
        repositoryId: repo[0].id,
        prNumber: 1,
        headSha: "def456",
      })
      .returning();
    const report = await db
      .insert(reports)
      .values({
        jobId: job[0].id,
        userId: user[0].id,
        repositoryId: repo[0].id,
        prUrl: "https://github.com/owner/repo3/pull/1",
        headSha: "def456",
        title: "Test",
        summary: "Test",
      })
      .returning();
    await db.insert(prComments).values({
      repositoryId: repo[0].id,
      prNumber: 1,
      reportId: report[0].id,
      headSha: "def456",
    });

    await db.delete(tenantAccounts).where(eq(tenantAccounts.id, account[0].id));

    const remainingInstallations = await db.select().from(installations).where(
      eq(installations.id, installation[0].id),
    );
    assert.strictEqual(
      remainingInstallations.length,
      0,
      "Installation should be cascade-deleted",
    );

    const remainingJobs = await db.select().from(analysisJobs).where(
      eq(analysisJobs.id, job[0].id),
    );
    assert.strictEqual(remainingJobs.length, 0, "Job should be cascade-deleted");

    const remainingReports = await db.select().from(reports).where(
      eq(reports.id, report[0].id),
    );
    assert.strictEqual(
      remainingReports.length,
      0,
      "Report should be cascade-deleted",
    );

    await db.delete(users);
  });

  it("should store report data as JSONB", async () => {
    const account = await db
      .insert(tenantAccounts)
      .values({ name: "Test Org", ownerId: crypto.randomUUID() })
      .returning();
    const installation = await db
      .insert(installations)
      .values({
        githubInstallationId: 555,
        accountId: account[0].id,
        appId: 1,
        appSlug: "prism-test",
      })
      .returning();
    const repo = await db
      .insert(repositories)
      .values({
        githubRepoId: 400,
        fullName: "owner/repo4",
        installationId: installation[0].id,
      })
      .returning();
    const job = await db
      .insert(analysisJobs)
      .values({
        repositoryId: repo[0].id,
        prNumber: 10,
        headSha: "jsonb123",
        status: "completed",
      })
      .returning();

    const nodes = [
      {
        id: "node-1",
        label: "API Service",
        kind: "backend",
        impact: "direct",
        description: "Test",
        reason: "Test",
        filePaths: ["src/api.ts"],
        position: { x: 0, y: 0 },
      },
    ];
    const edges = [{ id: "edge-1", source: "node-1", target: "node-2" }];
    const findings = [
      { id: "f1", severity: "high", title: "Test", description: "Test", affectedNodes: ["node-1"] },
    ];
    const qaItems = [{ id: "qa1", description: "Test", checked: false }];
    const affectedFiles = [{ path: "src/api.ts", status: "modified", additions: 10, deletions: 5, changeType: "logic" }];

    const report = await db
      .insert(reports)
      .values({
        jobId: job[0].id,
        userId: crypto.randomUUID(),
        repositoryId: repo[0].id,
        prUrl: "https://github.com/owner/repo4/pull/10",
        headSha: "jsonb123",
        title: "JSONB Test",
        summary: "Testing JSONB storage",
        nodes,
        edges,
        findings,
        qaItems,
        affectedFiles,
      })
      .returning();

    assert.deepStrictEqual(report[0].nodes, nodes);
    assert.deepStrictEqual(report[0].edges, edges);
    assert.deepStrictEqual(report[0].findings, findings);
    assert.deepStrictEqual(report[0].qaItems, qaItems);
    assert.deepStrictEqual(report[0].affectedFiles, affectedFiles);

    await db.delete(reports);
    await db.delete(analysisJobs);
    await db.delete(repositories);
    await db.delete(installations);
    await db.delete(tenantAccounts);
  });

  it("should support repository settings with credential reference", async () => {
    const account = await db
      .insert(tenantAccounts)
      .values({ name: "Test Org", ownerId: crypto.randomUUID() })
      .returning();
    const installation = await db
      .insert(installations)
      .values({
        githubInstallationId: 444,
        accountId: account[0].id,
        appId: 1,
        appSlug: "prism-test",
      })
      .returning();
    const repo = await db
      .insert(repositories)
      .values({
        githubRepoId: 500,
        fullName: "owner/repo5",
        installationId: installation[0].id,
      })
      .returning();
    const credential = await db
      .insert(providerCredentials)
      .values({
        userId: crypto.randomUUID(),
        provider: "openai",
        model: "gpt-4",
        encryptedApiKey: "fake-encrypted-key",
        maskedSuffix: "****abcd",
      })
      .returning();

    const settings = await db
      .insert(repositorySettings)
      .values({
        repositoryId: repo[0].id,
        credentialId: credential[0].id,
        autoComment: true,
      })
      .returning();

    assert.strictEqual(settings[0].credentialId, credential[0].id);

    const afterCredentialDelete = await db
      .select()
      .from(repositorySettings)
      .where(eq(repositorySettings.id, settings[0].id));
    await db.delete(providerCredentials).where(
      eq(providerCredentials.id, credential[0].id),
    );

    const refreshed = await db
      .select()
      .from(repositorySettings)
      .where(eq(repositorySettings.id, settings[0].id));
    assert.strictEqual(refreshed[0].credentialId, null);

    await db.delete(repositorySettings);
    await db.delete(repositories);
    await db.delete(installations);
    await db.delete(tenantAccounts);
  });

  it("should enforce unique PR comment per repository/PR", async () => {
    const account = await db
      .insert(tenantAccounts)
      .values({ name: "Test Org", ownerId: crypto.randomUUID() })
      .returning();
    const installation = await db
      .insert(installations)
      .values({
        githubInstallationId: 333,
        accountId: account[0].id,
        appId: 1,
        appSlug: "prism-test",
      })
      .returning();
    const repo = await db
      .insert(repositories)
      .values({
        githubRepoId: 600,
        fullName: "owner/repo6",
        installationId: installation[0].id,
      })
      .returning();
    const job = await db
      .insert(analysisJobs)
      .values({
        repositoryId: repo[0].id,
        prNumber: 5,
        headSha: "comment123",
        status: "completed",
      })
      .returning();
    const report = await db
      .insert(reports)
      .values({
        jobId: job[0].id,
        userId: crypto.randomUUID(),
        repositoryId: repo[0].id,
        prUrl: "https://github.com/owner/repo6/pull/5",
        headSha: "comment123",
        title: "Comment Test",
        summary: "Test",
      })
      .returning();

    await db.insert(prComments).values({
      repositoryId: repo[0].id,
      prNumber: 5,
      reportId: report[0].id,
      headSha: "comment123",
    });

    await assert.rejects(
      db.insert(prComments).values({
        repositoryId: repo[0].id,
        prNumber: 5,
        reportId: crypto.randomUUID(),
        headSha: "comment123",
      }),
      /unique/,
    );

    await db.delete(prComments);
    await db.delete(reports);
    await db.delete(analysisJobs);
    await db.delete(repositories);
    await db.delete(installations);
    await db.delete(tenantAccounts);
  });
});
