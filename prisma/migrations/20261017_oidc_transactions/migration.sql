CREATE TABLE "oidc_transactions" (
    "id" UUID NOT NULL,
    "state_hash" CHAR(64) NOT NULL,
    "browser_binding_hash" CHAR(64) NOT NULL,
    "provider" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "account_id" UUID,
    "session_id" UUID,
    "secret_ciphertext" TEXT NOT NULL,
    "return_to" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oidc_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "oidc_transactions_state_hash_key" ON "oidc_transactions"("state_hash");
CREATE INDEX "oidc_transactions_expires_at_idx" ON "oidc_transactions"("expires_at");
CREATE INDEX "oidc_transactions_account_id_session_id_idx" ON "oidc_transactions"("account_id", "session_id");

ALTER TABLE "oidc_transactions"
  ADD CONSTRAINT "oidc_transactions_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "oidc_transactions"
  ADD CONSTRAINT "oidc_transactions_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "auth_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
