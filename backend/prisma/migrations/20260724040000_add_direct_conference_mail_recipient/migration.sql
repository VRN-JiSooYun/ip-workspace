ALTER TABLE "conference_mail_outbox"
    ALTER COLUMN "recipientId" DROP NOT NULL,
    ADD COLUMN "recipientNormalizedEmail" TEXT;

UPDATE "conference_mail_outbox"
SET "recipientNormalizedEmail" = lower(btrim("recipientEmailSnapshot"));

ALTER TABLE "conference_mail_outbox"
    ALTER COLUMN "recipientNormalizedEmail" SET NOT NULL,
    ADD CONSTRAINT "conference_mail_outbox_normalized_email_check" CHECK (
        "recipientNormalizedEmail" = lower(btrim("recipientNormalizedEmail"))
        AND length("recipientNormalizedEmail") BETWEEN 3 AND 320
    );

DROP INDEX "conference_mail_outbox_type_commentId_recipientId_key";

CREATE UNIQUE INDEX "conference_mail_outbox_type_comment_email_key"
    ON "conference_mail_outbox"("type", "commentId", "recipientNormalizedEmail");
