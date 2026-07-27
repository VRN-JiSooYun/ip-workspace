CREATE TYPE "ConferenceCommentSource" AS ENUM ('WORKSPACE', 'LEGACY_DJANGO');

ALTER TABLE "conference_abstract_comment"
    ALTER COLUMN "authorUserId" DROP NOT NULL,
    ADD COLUMN "legacyAuthorRecipientId" UUID,
    ADD COLUMN "authorNameSnapshot" TEXT,
    ADD COLUMN "sourceSystem" "ConferenceCommentSource" NOT NULL DEFAULT 'WORKSPACE',
    ADD COLUMN "legacyCommentKey" TEXT,
    ADD COLUMN "legacyCommentId" INTEGER,
    ADD COLUMN "legacyOrder" INTEGER,
    ADD COLUMN "sourceCreatedAt" TIMESTAMP(3);

ALTER TABLE "conference_abstract_comment"
    ADD CONSTRAINT "conference_abstract_comment_legacyAuthorRecipientId_fkey"
    FOREIGN KEY ("legacyAuthorRecipientId") REFERENCES "notification_recipient"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "conference_abstract_comment"
    ADD CONSTRAINT "conference_abstract_comment_author_source_check"
    CHECK (
        (
            "sourceSystem" = 'WORKSPACE'
            AND "authorUserId" IS NOT NULL
            AND "legacyAuthorRecipientId" IS NULL
            AND "legacyCommentKey" IS NULL
            AND "legacyCommentId" IS NULL
            AND "legacyOrder" IS NULL
            AND "authorNameSnapshot" IS NULL
        )
        OR
        (
            "sourceSystem" = 'LEGACY_DJANGO'
            AND "authorUserId" IS NULL
            AND "legacyAuthorRecipientId" IS NOT NULL
            AND "authorNameSnapshot" IS NOT NULL
            AND length(btrim("authorNameSnapshot")) BETWEEN 1 AND 200
            AND "legacyCommentKey" IS NOT NULL
            AND "legacyCommentId" IS NOT NULL
            AND "legacyCommentId" >= 0
            AND "legacyOrder" IS NOT NULL
            AND "legacyOrder" >= 0
        )
    );

CREATE UNIQUE INDEX "conference_abstract_comment_legacyCommentKey_key"
    ON "conference_abstract_comment"("legacyCommentKey");
CREATE INDEX "conference_abstract_comment_legacyAuthorRecipientId_deletedAt_idx"
    ON "conference_abstract_comment"("legacyAuthorRecipientId", "deletedAt");
