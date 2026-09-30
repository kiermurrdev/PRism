CREATE TABLE "account_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" varchar(50),
	"scope" varchar(255),
	"id_token" text,
	"session_state" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analysis_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"pr_number" integer NOT NULL,
	"head_sha" varchar(255) NOT NULL,
	"credential_id" uuid,
	"prompt_version" varchar(50) DEFAULT 'v1' NOT NULL,
	"status" varchar(20) DEFAULT 'queued' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "encryption_keys" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "encryption_keys_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"encrypted_key_material" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_installation_id" integer NOT NULL,
	"account_id" uuid NOT NULL,
	"app_id" integer NOT NULL,
	"app_slug" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pr_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"pr_number" integer NOT NULL,
	"report_id" uuid NOT NULL,
	"github_comment_id" integer,
	"head_sha" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"model" varchar(255) NOT NULL,
	"encrypted_api_key" text NOT NULL,
	"key_version" integer DEFAULT 1 NOT NULL,
	"label" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"title" varchar(512) NOT NULL,
	"pr_url" varchar(512) NOT NULL,
	"summary" text NOT NULL,
	"nodes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"edges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"findings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"qa_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"affected_files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"schema_version" varchar(50) DEFAULT 'v1' NOT NULL,
	"analyzed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_repo_id" integer NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"installation_id" uuid NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repository_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"credential_id" uuid,
	"prompt_version" varchar(50) DEFAULT 'v1' NOT NULL,
	"auto_comment" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_token" varchar(255) NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"github_login" varchar(255),
	"github_id" bigint,
	"image" varchar(512),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_memberships" ADD CONSTRAINT "account_memberships_account_id_tenant_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."tenant_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_memberships" ADD CONSTRAINT "account_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_jobs" ADD CONSTRAINT "analysis_jobs_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_jobs" ADD CONSTRAINT "analysis_jobs_credential_id_provider_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."provider_credentials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installations" ADD CONSTRAINT "installations_account_id_tenant_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."tenant_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_comments" ADD CONSTRAINT "pr_comments_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_comments" ADD CONSTRAINT "pr_comments_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_credentials" ADD CONSTRAINT "provider_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_job_id_analysis_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."analysis_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_installation_id_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_settings" ADD CONSTRAINT "repository_settings_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_settings" ADD CONSTRAINT "repository_settings_credential_id_provider_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."provider_credentials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_accounts" ADD CONSTRAINT "tenant_accounts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_memberships_account_user_unique" ON "account_memberships" USING btree ("account_id","user_id");--> statement-breakpoint
CREATE INDEX "account_memberships_user_id_idx" ON "account_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_unique" ON "accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "analysis_jobs_idempotency_key" ON "analysis_jobs" USING btree ("repository_id","pr_number","head_sha","credential_id","prompt_version");--> statement-breakpoint
CREATE INDEX "analysis_jobs_repository_pr_idx" ON "analysis_jobs" USING btree ("repository_id","pr_number");--> statement-breakpoint
CREATE INDEX "analysis_jobs_status_idx" ON "analysis_jobs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "installations_github_installation_id_unique" ON "installations" USING btree ("github_installation_id");--> statement-breakpoint
CREATE INDEX "installations_account_id_idx" ON "installations" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pr_comments_repository_pr_unique" ON "pr_comments" USING btree ("repository_id","pr_number");--> statement-breakpoint
CREATE INDEX "pr_comments_github_comment_id_idx" ON "pr_comments" USING btree ("github_comment_id");--> statement-breakpoint
CREATE INDEX "provider_credentials_user_id_idx" ON "provider_credentials" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reports_job_id_idx" ON "reports" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "repositories_github_repo_id_unique" ON "repositories" USING btree ("github_repo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "repositories_full_name_unique" ON "repositories" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX "repositories_installation_id_idx" ON "repositories" USING btree ("installation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "repository_settings_repository_id_unique" ON "repository_settings" USING btree ("repository_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_sessionToken_unique" ON "sessions" USING btree ("session_token");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tenant_accounts_owner_id_idx" ON "tenant_accounts" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_github_id_unique" ON "users" USING btree ("github_id");--> statement-breakpoint
CREATE INDEX "users_github_login_idx" ON "users" USING btree ("github_login");