import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  uniqueIndex,
  bigint,
} from "drizzle-orm/pg-core";

/* =========================
   Auth / Users
   ========================= */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }),
    githubLogin: varchar("github_login", { length: 255 }),
    githubId: bigint("github_id", { mode: "bigint" }),
    image: varchar("image", { length: 512 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_email_unique").on(t.email),
    uniqueIndex("users_github_id_unique").on(t.githubId),
    index("users_github_login_idx").on(t.githubLogin),
  ],
);

// Auth.js accounts table (GitHub OAuth)
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 50 }).notNull(), // "oauth", "oidc", "email"
    provider: varchar("provider", { length: 50 }).notNull(), // "github"
    providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expiresAt: integer("expires_at"),
    token_type: varchar("token_type", { length: 50 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("accounts_provider_providerAccountId_unique").on(
      t.provider,
      t.providerAccountId,
    ),
    index("accounts_user_id_idx").on(t.userId),
  ],
);

// Auth.js sessions table
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionToken: varchar("session_token", { length: 255 }).notNull(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("sessions_sessionToken_unique").on(t.sessionToken),
    index("sessions_user_id_idx").on(t.userId),
  ],
);

// Auth.js verification tokens
export const verificationTokens = pgTable("verification_tokens", {
  identifier: varchar("identifier", { length: 255 }).notNull(),
  token: varchar("token", { length: 255 }).notNull(),
  expires: timestamp("expires").notNull(),
});

/* =========================
   Multi-tenancy: Accounts & Memberships
   ========================= */

export const tenantAccounts = pgTable(
  "tenant_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("tenant_accounts_owner_id_idx").on(t.ownerId)],
);

export const accountMemberships = pgTable(
  "account_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => tenantAccounts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull().default("member"), // "owner" | "member"
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("account_memberships_account_user_unique").on(
      t.accountId,
      t.userId,
    ),
    index("account_memberships_user_id_idx").on(t.userId),
  ],
);

/* =========================
   GitHub App Installations & Repositories
   ========================= */

export const installations = pgTable(
  "installations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    githubInstallationId: integer("github_installation_id").notNull(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => tenantAccounts.id, { onDelete: "cascade" }),
    appId: integer("app_id").notNull(),
    appSlug: varchar("app_slug", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("installations_github_installation_id_unique").on(
      t.githubInstallationId,
    ),
    index("installations_account_id_idx").on(t.accountId),
  ],
);

export const repositories = pgTable(
  "repositories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    githubRepoId: integer("github_repo_id").notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(), // "owner/repo"
    installationId: uuid("installation_id")
      .notNull()
      .references(() => installations.id, { onDelete: "cascade" }),
    isPrivate: boolean("is_private").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("repositories_github_repo_id_unique").on(t.githubRepoId),
    uniqueIndex("repositories_full_name_unique").on(t.fullName),
    index("repositories_installation_id_idx").on(t.installationId),
  ],
);

/* =========================
   Provider Credentials (Encrypted)
   ========================= */

export const providerCredentials = pgTable(
  "provider_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 50 }).notNull(), // "nvidia", "openai", "anthropic"
    model: varchar("model", { length: 255 }).notNull(),
    encryptedApiKey: text("encrypted_api_key").notNull(), // AES-256-GCM encrypted
    maskedSuffix: varchar("masked_suffix", { length: 255 }).notNull(), // e.g. "****abcd"
    keyVersion: integer("key_version").notNull().default(1),
    label: varchar("label", { length: 255 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("provider_credentials_user_id_idx").on(t.userId)],
);

/* =========================
   Repository Settings
   ========================= */

export const repositorySettings = pgTable(
  "repository_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    credentialId: uuid("credential_id").references(
      () => providerCredentials.id,
      { onDelete: "set null" },
    ),
    promptVersion: varchar("prompt_version", { length: 50 }).notNull().default("v1"),
    autoComment: boolean("auto_comment").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("repository_settings_repository_id_unique").on(t.repositoryId),
  ],
);

/* =========================
   Analysis Jobs
   ========================= */

export const analysisJobs = pgTable(
  "analysis_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    prNumber: integer("pr_number").notNull(),
    headSha: varchar("head_sha", { length: 255 }).notNull(),
    credentialId: uuid("credential_id").references(
      () => providerCredentials.id,
      { onDelete: "set null" },
    ),
    promptVersion: varchar("prompt_version", { length: 50 }).notNull().default("v1"),
    status: varchar("status", { length: 20 }).notNull().default("queued"),
    attemptCount: integer("attempt_count").notNull().default(0),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (t) => [
    // Idempotency key: same PR + SHA + credential + prompt = same job
    uniqueIndex("analysis_jobs_idempotency_key").on(
      t.repositoryId,
      t.prNumber,
      t.headSha,
      t.credentialId,
      t.promptVersion,
    ),
    index("analysis_jobs_repository_pr_idx").on(t.repositoryId, t.prNumber),
    index("analysis_jobs_status_idx").on(t.status),
  ],
);

/* =========================
   Reports (Immutable)
   ========================= */

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => analysisJobs.id, { onDelete: "cascade" }),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    headSha: varchar("head_sha", { length: 255 }).notNull(),
    provider: varchar("provider", { length: 50 }),
    model: varchar("model", { length: 255 }),
    promptVersion: varchar("prompt_version", { length: 50 }).notNull().default("v1"),
    title: varchar("title", { length: 512 }).notNull(),
    prUrl: varchar("pr_url", { length: 512 }).notNull(),
    summary: text("summary").notNull(),
    nodes: jsonb("nodes").notNull().default([]), // ReportNode[]
    edges: jsonb("edges").notNull().default([]), // ReportEdge[]
    findings: jsonb("findings").notNull().default([]), // ImpactFinding[]
    qaItems: jsonb("qa_items").notNull().default([]), // QAItem[]
    affectedFiles: jsonb("affected_files").notNull().default([]), // AffectedFile[]
    schemaVersion: varchar("schema_version", { length: 50 }).notNull().default("v1"),
    analyzedAt: timestamp("analyzed_at").notNull().defaultNow(),
  },
  (t) => [
    index("reports_job_id_idx").on(t.jobId),
    index("reports_repository_pr_idx").on(t.repositoryId, t.headSha),
    index("reports_user_id_idx").on(t.userId),
  ],
);

/* =========================
   PR Comments
   ========================= */

export const prComments = pgTable(
  "pr_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    prNumber: integer("pr_number").notNull(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    githubCommentId: integer("github_comment_id"),
    headSha: varchar("head_sha", { length: 255 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("pr_comments_repository_pr_unique").on(t.repositoryId, t.prNumber),
    index("pr_comments_github_comment_id_idx").on(t.githubCommentId),
  ],
);

/* =========================
   Encryption Keys (Vault)
   ========================= */

export const encryptionKeys = pgTable("encryption_keys", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  encryptedKeyMaterial: text("encrypted_key_material").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* =========================
   Type exports
   ========================= */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type TenantAccount = typeof tenantAccounts.$inferSelect;
export type NewTenantAccount = typeof tenantAccounts.$inferInsert;

export type AccountMembership = typeof accountMemberships.$inferSelect;
export type NewAccountMembership = typeof accountMemberships.$inferInsert;

export type Installation = typeof installations.$inferSelect;
export type NewInstallation = typeof installations.$inferInsert;

export type Repository = typeof repositories.$inferSelect;
export type NewRepository = typeof repositories.$inferInsert;

export type ProviderCredential = typeof providerCredentials.$inferSelect;
export type NewProviderCredential = typeof providerCredentials.$inferInsert;

export type RepositorySettings = typeof repositorySettings.$inferSelect;
export type NewRepositorySettings = typeof repositorySettings.$inferInsert;

export type AnalysisJob = typeof analysisJobs.$inferSelect;
export type NewAnalysisJob = typeof analysisJobs.$inferInsert;

export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;

export type PrComment = typeof prComments.$inferSelect;
export type NewPrComment = typeof prComments.$inferInsert;

export type EncryptionKey = typeof encryptionKeys.$inferSelect;
export type NewEncryptionKey = typeof encryptionKeys.$inferInsert;

export type JobStatus =
  | "queued"
  | "ingesting"
  | "analyzing"
  | "persisting"
  | "commenting"
  | "completed"
  | "failed";
