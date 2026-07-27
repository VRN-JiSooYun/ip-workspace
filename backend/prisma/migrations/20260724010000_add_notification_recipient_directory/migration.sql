CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE "NotificationRecipientSource" AS ENUM ('GROUPWARE_IMPORT', 'WORKSPACE_USER');
CREATE TYPE "NotificationRecipientStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "NotificationRecipientImportStatus" AS ENUM ('RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED');
CREATE TYPE "NotificationRecipientImportIssueSeverity" AS ENUM ('WARNING', 'ERROR');

CREATE TABLE "notification_recipient" (
    "id" UUID NOT NULL,
    "memberId" INTEGER,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "linkedUserId" UUID,
    "source" "NotificationRecipientSource" NOT NULL,
    "status" "NotificationRecipientStatus" NOT NULL DEFAULT 'ACTIVE',
    "mailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sourceChecksum" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notification_recipient_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notification_recipient_name_check" CHECK (length(btrim("name")) BETWEEN 1 AND 200),
    CONSTRAINT "notification_recipient_email_check" CHECK (
        "email" = btrim("email")
        AND "normalizedEmail" = lower(btrim("email"))
        AND length("normalizedEmail") BETWEEN 3 AND 320
    ),
    CONSTRAINT "notification_recipient_member_id_check" CHECK ("memberId" IS NULL OR "memberId" > 0)
);

CREATE UNIQUE INDEX "notification_recipient_memberId_key"
    ON "notification_recipient"("memberId");
CREATE UNIQUE INDEX "notification_recipient_normalizedEmail_key"
    ON "notification_recipient"("normalizedEmail");
CREATE UNIQUE INDEX "notification_recipient_linkedUserId_key"
    ON "notification_recipient"("linkedUserId");
CREATE INDEX "notification_recipient_status_mailEnabled_name_idx"
    ON "notification_recipient"("status", "mailEnabled", "name");
CREATE INDEX "notification_recipient_lastSyncedAt_idx"
    ON "notification_recipient"("lastSyncedAt");

ALTER TABLE "notification_recipient"
    ADD CONSTRAINT "notification_recipient_linkedUserId_fkey"
    FOREIGN KEY ("linkedUserId") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "notification_recipient" (
    "id",
    "name",
    "email",
    "normalizedEmail",
    "linkedUserId",
    "source",
    "status",
    "mailEnabled",
    "lastSyncedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid(),
    CASE
        WHEN btrim("name") = '' OR lower(btrim("name")) = lower(btrim("email"))
            THEN btrim("email")
        ELSE btrim("name")
    END,
    btrim("email"),
    lower(btrim("email")),
    "id",
    'WORKSPACE_USER'::"NotificationRecipientSource",
    CASE
        WHEN "status" = 'ACTIVE' THEN 'ACTIVE'::"NotificationRecipientStatus"
        ELSE 'INACTIVE'::"NotificationRecipientStatus"
    END,
    "status" = 'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "user";

ALTER TABLE "conference_abstract_comment_mention"
    ADD COLUMN "mentionedRecipientId" UUID;

UPDATE "conference_abstract_comment_mention" AS mention
SET "mentionedRecipientId" = recipient."id"
FROM "notification_recipient" AS recipient
WHERE recipient."linkedUserId" = mention."mentionedUserId";

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "conference_abstract_comment_mention"
        WHERE "mentionedRecipientId" IS NULL
    ) THEN
        RAISE EXCEPTION 'Unable to map an existing comment mention to notification_recipient';
    END IF;
END $$;

ALTER TABLE "conference_abstract_comment_mention"
    DROP CONSTRAINT "conference_abstract_comment_mention_mentionedUserId_fkey";
DROP INDEX "conference_abstract_comment_mention_mentionedUserId_readAt_createdAt_idx";
ALTER TABLE "conference_abstract_comment_mention"
    DROP CONSTRAINT "conference_abstract_comment_mention_pkey";
ALTER TABLE "conference_abstract_comment_mention"
    DROP COLUMN "mentionedUserId";
ALTER TABLE "conference_abstract_comment_mention"
    ALTER COLUMN "mentionedRecipientId" SET NOT NULL;
ALTER TABLE "conference_abstract_comment_mention"
    ADD CONSTRAINT "conference_abstract_comment_mention_pkey"
    PRIMARY KEY ("commentId", "mentionedRecipientId");
ALTER TABLE "conference_abstract_comment_mention"
    ADD CONSTRAINT "conference_abstract_comment_mention_mentionedRecipientId_fkey"
    FOREIGN KEY ("mentionedRecipientId") REFERENCES "notification_recipient"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "conference_abstract_comment_mention_mentionedRecipientId_readAt_createdAt_idx"
    ON "conference_abstract_comment_mention"("mentionedRecipientId", "readAt", "createdAt");

CREATE TABLE "notification_recipient_import_run" (
    "id" UUID NOT NULL,
    "mode" "ConferenceImportMode" NOT NULL,
    "status" "NotificationRecipientImportStatus" NOT NULL DEFAULT 'RUNNING',
    "profileVersion" TEXT NOT NULL,
    "sourceChecksum" TEXT NOT NULL,
    "sourceCount" INTEGER NOT NULL DEFAULT 0,
    "insertedCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "unchangedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "conflictCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "startedByUserId" UUID NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "notification_recipient_import_run_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notification_recipient_import_run_counts_check" CHECK (
        "sourceCount" >= 0
        AND "insertedCount" >= 0
        AND "updatedCount" >= 0
        AND "unchangedCount" >= 0
        AND "skippedCount" >= 0
        AND "conflictCount" >= 0
        AND "errorCount" >= 0
    )
);

CREATE UNIQUE INDEX "notification_recipient_import_run_sourceChecksum_profileVersion_mode_key"
    ON "notification_recipient_import_run"("sourceChecksum", "profileVersion", "mode");
CREATE INDEX "notification_recipient_import_run_status_startedAt_idx"
    ON "notification_recipient_import_run"("status", "startedAt");
CREATE INDEX "notification_recipient_import_run_startedByUserId_startedAt_idx"
    ON "notification_recipient_import_run"("startedByUserId", "startedAt");

ALTER TABLE "notification_recipient_import_run"
    ADD CONSTRAINT "notification_recipient_import_run_startedByUserId_fkey"
    FOREIGN KEY ("startedByUserId") REFERENCES "user"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "notification_recipient_import_issue" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "rowNumber" INTEGER,
    "severity" "NotificationRecipientImportIssueSeverity" NOT NULL,
    "errorCode" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "memberId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_recipient_import_issue_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notification_recipient_import_issue_row_number_check"
        CHECK ("rowNumber" IS NULL OR "rowNumber" > 0)
);

CREATE INDEX "notification_recipient_import_issue_runId_severity_rowNumber_idx"
    ON "notification_recipient_import_issue"("runId", "severity", "rowNumber");
CREATE INDEX "notification_recipient_import_issue_errorCode_idx"
    ON "notification_recipient_import_issue"("errorCode");

ALTER TABLE "notification_recipient_import_issue"
    ADD CONSTRAINT "notification_recipient_import_issue_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "notification_recipient_import_run"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
