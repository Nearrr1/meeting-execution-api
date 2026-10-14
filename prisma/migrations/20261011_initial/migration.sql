-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "account_status" AS ENUM ('pending_email', 'active', 'disabled', 'deletion_pending', 'deleted');

-- CreateEnum
CREATE TYPE "challenge_purpose" AS ENUM ('email_verification', 'password_recovery');

-- CreateEnum
CREATE TYPE "deletion_request_status" AS ENUM ('scheduled', 'completed');

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "status" "account_status" NOT NULL DEFAULT 'pending_email',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "deletion_requested_at" TIMESTAMPTZ(6),
    "purge_at" TIMESTAMPTZ(6),

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_deletion_requests" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purge_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),
    "status" "deletion_request_status" NOT NULL DEFAULT 'scheduled',

    CONSTRAINT "account_deletion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_spaces" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personal_spaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_emails" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "address_submitted" TEXT NOT NULL,
    "address_normalized" TEXT NOT NULL,
    "verified_at" TIMESTAMPTZ(6),
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "local_credentials" (
    "account_id" UUID NOT NULL,
    "password_hash" TEXT NOT NULL,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "local_credentials_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "auth_challenges" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "email_id" UUID NOT NULL,
    "purpose" "challenge_purpose" NOT NULL,
    "verifier_digest" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idle_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "absolute_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "reauthenticated_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "user_agent_label" TEXT,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "federated_identities" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "issuer" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_email" TEXT,
    "provider_email_verified" BOOLEAN NOT NULL DEFAULT false,
    "linked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "federated_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_events" (
    "id" BIGSERIAL NOT NULL,
    "scope" TEXT NOT NULL,
    "identifier_digest" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_quota_windows" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "email_quota_windows_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "email_change_requests" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "new_email_submitted" TEXT NOT NULL,
    "new_email_normalized" TEXT NOT NULL,
    "pending_email_normalized" TEXT,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_audit_events" (
    "id" UUID NOT NULL,
    "account_id" UUID,
    "event_type" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_deletion_requests_account_id_key" ON "account_deletion_requests"("account_id");

-- CreateIndex
CREATE INDEX "account_deletion_requests_status_purge_at_idx" ON "account_deletion_requests"("status", "purge_at");

-- CreateIndex
CREATE UNIQUE INDEX "personal_spaces_account_id_key" ON "personal_spaces"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_emails_address_normalized_key" ON "account_emails"("address_normalized");

-- CreateIndex
CREATE INDEX "account_emails_account_id_is_primary_idx" ON "account_emails"("account_id", "is_primary");

-- CreateIndex
CREATE INDEX "auth_challenges_email_id_purpose_created_at_idx" ON "auth_challenges"("email_id", "purpose", "created_at");

-- CreateIndex
CREATE INDEX "auth_challenges_expires_at_idx" ON "auth_challenges"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_token_hash_key" ON "auth_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "auth_sessions_account_id_revoked_at_idx" ON "auth_sessions"("account_id", "revoked_at");

-- CreateIndex
CREATE INDEX "federated_identities_account_id_idx" ON "federated_identities"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "federated_identities_issuer_subject_key" ON "federated_identities"("issuer", "subject");

-- CreateIndex
CREATE INDEX "rate_limit_events_scope_identifier_digest_created_at_idx" ON "rate_limit_events"("scope", "identifier_digest", "created_at");

-- CreateIndex
CREATE INDEX "email_quota_windows_expires_at_idx" ON "email_quota_windows"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "email_change_requests_pending_email_normalized_key" ON "email_change_requests"("pending_email_normalized");

-- CreateIndex
CREATE INDEX "email_change_requests_account_id_consumed_at_created_at_idx" ON "email_change_requests"("account_id", "consumed_at", "created_at");

-- CreateIndex
CREATE INDEX "email_change_requests_expires_at_idx" ON "email_change_requests"("expires_at");

-- CreateIndex
CREATE INDEX "security_audit_events_account_id_created_at_idx" ON "security_audit_events"("account_id", "created_at");

-- AddForeignKey
ALTER TABLE "account_deletion_requests" ADD CONSTRAINT "account_deletion_requests_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_spaces" ADD CONSTRAINT "personal_spaces_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_emails" ADD CONSTRAINT "account_emails_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "local_credentials" ADD CONSTRAINT "local_credentials_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_challenges" ADD CONSTRAINT "auth_challenges_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_challenges" ADD CONSTRAINT "auth_challenges_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "account_emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "federated_identities" ADD CONSTRAINT "federated_identities_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_change_requests" ADD CONSTRAINT "email_change_requests_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_audit_events" ADD CONSTRAINT "security_audit_events_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
