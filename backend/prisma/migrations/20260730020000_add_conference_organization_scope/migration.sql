ALTER TABLE "conference"
    ADD COLUMN "organizationId" UUID;

UPDATE "conference"
SET "organizationId" = '00000000-0000-4000-8000-000000000001'
WHERE "organizationId" IS NULL;

ALTER TABLE "conference"
    ALTER COLUMN "organizationId" SET NOT NULL;

CREATE INDEX "conference_organizationId_deletedAt_idx"
    ON "conference"("organizationId", "deletedAt");

ALTER TABLE "conference"
    ADD CONSTRAINT "conference_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
