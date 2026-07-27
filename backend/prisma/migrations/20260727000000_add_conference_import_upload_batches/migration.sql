CREATE TYPE "ConferenceImportBatchStatus" AS ENUM (
  'UPLOADING',
  'READY',
  'INVALID',
  'ARCHIVED'
);

CREATE TYPE "ConferenceImportBatchKind" AS ENUM (
  'LEGACY',
  'API_METADATA'
);

CREATE TABLE "conference_import_batch" (
  "id" UUID NOT NULL,
  "batchKey" TEXT NOT NULL,
  "kind" "ConferenceImportBatchKind" NOT NULL,
  "status" "ConferenceImportBatchStatus" NOT NULL DEFAULT 'UPLOADING',
  "sourceChecksum" TEXT,
  "fileCount" INTEGER NOT NULL DEFAULT 0,
  "excelCount" INTEGER NOT NULL DEFAULT 0,
  "totalByteSize" BIGINT NOT NULL DEFAULT 0,
  "hasManifest" BOOLEAN NOT NULL DEFAULT false,
  "uploadedByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "readyAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),

  CONSTRAINT "conference_import_batch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "conference_import_batch_counts_check" CHECK (
    "fileCount" >= 0
    AND "excelCount" >= 0
    AND "excelCount" <= "fileCount"
    AND "totalByteSize" >= 0
  ),
  CONSTRAINT "conference_import_batch_ready_check" CHECK (
    ("status" = 'READY' AND "sourceChecksum" IS NOT NULL AND "readyAt" IS NOT NULL)
    OR "status" <> 'READY'
  ),
  CONSTRAINT "conference_import_batch_archived_check" CHECK (
    ("status" = 'ARCHIVED' AND "archivedAt" IS NOT NULL)
    OR "status" <> 'ARCHIVED'
  )
);

CREATE TABLE "conference_import_batch_file" (
  "id" UUID NOT NULL,
  "batchId" UUID NOT NULL,
  "logicalPath" TEXT NOT NULL,
  "originalFilename" TEXT NOT NULL,
  "mimeType" TEXT,
  "byteSize" BIGINT NOT NULL,
  "sha256" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "conference_import_batch_file_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "conference_import_batch_file_size_check" CHECK ("byteSize" > 0),
  CONSTRAINT "conference_import_batch_file_sha256_check" CHECK (
    "sha256" ~ '^[0-9a-f]{64}$'
  )
);

ALTER TABLE "conference_import_run"
ADD COLUMN "batchId" UUID;

CREATE UNIQUE INDEX "conference_import_batch_batchKey_key"
ON "conference_import_batch"("batchKey");

CREATE UNIQUE INDEX "conference_import_batch_sourceChecksum_key"
ON "conference_import_batch"("sourceChecksum");

CREATE INDEX "conference_import_batch_status_createdAt_idx"
ON "conference_import_batch"("status", "createdAt");

CREATE INDEX "conference_import_batch_uploadedByUserId_createdAt_idx"
ON "conference_import_batch"("uploadedByUserId", "createdAt");

CREATE UNIQUE INDEX "conference_import_batch_file_batchId_logicalPath_key"
ON "conference_import_batch_file"("batchId", "logicalPath");

CREATE INDEX "conference_import_batch_file_sha256_idx"
ON "conference_import_batch_file"("sha256");

CREATE INDEX "conference_import_run_batchId_startedAt_idx"
ON "conference_import_run"("batchId", "startedAt");

ALTER TABLE "conference_import_batch"
ADD CONSTRAINT "conference_import_batch_uploadedByUserId_fkey"
FOREIGN KEY ("uploadedByUserId") REFERENCES "user"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "conference_import_batch_file"
ADD CONSTRAINT "conference_import_batch_file_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "conference_import_batch"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "conference_import_run"
ADD CONSTRAINT "conference_import_run_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "conference_import_batch"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
