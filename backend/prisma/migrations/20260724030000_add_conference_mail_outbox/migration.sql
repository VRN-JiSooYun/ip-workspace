CREATE TYPE "ConferenceMailOutboxType" AS ENUM ('COMMENT_MENTION');
CREATE TYPE "ConferenceMailOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'RETRY', 'SENT', 'FAILED');

CREATE TABLE "conference_mail_outbox" (
    "id" UUID NOT NULL,
    "type" "ConferenceMailOutboxType" NOT NULL DEFAULT 'COMMENT_MENTION',
    "status" "ConferenceMailOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "commentId" UUID NOT NULL,
    "recipientId" UUID NOT NULL,
    "recipientEmailSnapshot" TEXT NOT NULL,
    "recipientNameSnapshot" TEXT NOT NULL,
    "subjectSnapshot" TEXT NOT NULL,
    "textBodySnapshot" TEXT NOT NULL,
    "htmlBodySnapshot" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "conference_mail_outbox_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "conference_mail_outbox_attempt_check" CHECK (
        "attemptCount" >= 0 AND "maxAttempts" BETWEEN 1 AND 20
    ),
    CONSTRAINT "conference_mail_outbox_snapshot_check" CHECK (
        length(btrim("recipientEmailSnapshot")) BETWEEN 3 AND 320
        AND length(btrim("recipientNameSnapshot")) BETWEEN 1 AND 200
        AND length(btrim("subjectSnapshot")) BETWEEN 1 AND 500
        AND length("textBodySnapshot") BETWEEN 1 AND 100000
        AND length("htmlBodySnapshot") BETWEEN 1 AND 200000
        AND length(btrim("messageId")) BETWEEN 3 AND 500
    ),
    CONSTRAINT "conference_mail_outbox_state_check" CHECK (
        ("status" = 'SENT' AND "sentAt" IS NOT NULL AND "leaseOwner" IS NULL AND "leaseExpiresAt" IS NULL)
        OR
        ("status" IN ('PENDING', 'RETRY', 'FAILED') AND "sentAt" IS NULL AND "leaseOwner" IS NULL AND "leaseExpiresAt" IS NULL)
        OR
        ("status" = 'PROCESSING' AND "sentAt" IS NULL AND "leaseOwner" IS NOT NULL AND "leaseExpiresAt" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "conference_mail_outbox_messageId_key"
    ON "conference_mail_outbox"("messageId");
CREATE UNIQUE INDEX "conference_mail_outbox_type_commentId_recipientId_key"
    ON "conference_mail_outbox"("type", "commentId", "recipientId");
CREATE INDEX "conference_mail_outbox_status_nextAttemptAt_idx"
    ON "conference_mail_outbox"("status", "nextAttemptAt");
CREATE INDEX "conference_mail_outbox_leaseExpiresAt_idx"
    ON "conference_mail_outbox"("leaseExpiresAt");
CREATE INDEX "conference_mail_outbox_commentId_createdAt_idx"
    ON "conference_mail_outbox"("commentId", "createdAt");
CREATE INDEX "conference_mail_outbox_recipientId_createdAt_idx"
    ON "conference_mail_outbox"("recipientId", "createdAt");

ALTER TABLE "conference_mail_outbox"
    ADD CONSTRAINT "conference_mail_outbox_commentId_fkey"
    FOREIGN KEY ("commentId") REFERENCES "conference_abstract_comment"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conference_mail_outbox"
    ADD CONSTRAINT "conference_mail_outbox_recipientId_fkey"
    FOREIGN KEY ("recipientId") REFERENCES "notification_recipient"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
