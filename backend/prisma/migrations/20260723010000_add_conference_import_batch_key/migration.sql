ALTER TABLE "conference_import_run"
    ADD COLUMN "batchKey" TEXT;

UPDATE "conference_import_run"
SET "batchKey" = 'legacy-' || "id"::text
WHERE "batchKey" IS NULL;

ALTER TABLE "conference_import_run"
    ALTER COLUMN "batchKey" SET NOT NULL;
