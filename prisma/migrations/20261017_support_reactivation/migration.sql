ALTER TABLE "security_audit_events"
ADD COLUMN "actor" TEXT NOT NULL DEFAULT 'account';
