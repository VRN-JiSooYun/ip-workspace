CREATE TYPE "NotificationRecipientImportBatchStatus" AS ENUM (
  'UPLOADING',
  'READY',
  'INVALID',
  'ARCHIVED'
);

CREATE TABLE "notification_recipient_import_batch" (
  "id" UUID NOT NULL,
  "batchKey" TEXT NOT NULL,
  "status" "NotificationRecipientImportBatchStatus" NOT NULL DEFAULT 'UPLOADING',
  "sourceChecksum" TEXT,
  "originalFilename" TEXT NOT NULL,
  "mimeType" TEXT,
  "byteSize" BIGINT NOT NULL DEFAULT 0,
  "uploadedByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "readyAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),

  CONSTRAINT "notification_recipient_import_batch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_recipient_import_batch_size_check" CHECK ("byteSize" >= 0),
  CONSTRAINT "notification_recipient_import_batch_ready_check" CHECK (
    ("status" = 'READY' AND "sourceChecksum" IS NOT NULL AND "readyAt" IS NOT NULL AND "byteSize" > 0)
    OR "status" <> 'READY'
  ),
  CONSTRAINT "notification_recipient_import_batch_archived_check" CHECK (
    ("status" = 'ARCHIVED' AND "archivedAt" IS NOT NULL)
    OR "status" <> 'ARCHIVED'
  )
);

ALTER TABLE "notification_recipient_import_run"
ADD COLUMN "batchId" UUID;

CREATE UNIQUE INDEX "notification_recipient_import_batch_batchKey_key"
ON "notification_recipient_import_batch"("batchKey");

CREATE UNIQUE INDEX "notification_recipient_import_batch_sourceChecksum_key"
ON "notification_recipient_import_batch"("sourceChecksum");

CREATE INDEX "notification_recipient_import_batch_status_createdAt_idx"
ON "notification_recipient_import_batch"("status", "createdAt");

CREATE INDEX "notification_recipient_import_batch_uploadedByUserId_createdAt_idx"
ON "notification_recipient_import_batch"("uploadedByUserId", "createdAt");

CREATE INDEX "notification_recipient_import_run_batchId_startedAt_idx"
ON "notification_recipient_import_run"("batchId", "startedAt");

ALTER TABLE "notification_recipient_import_batch"
ADD CONSTRAINT "notification_recipient_import_batch_uploadedByUserId_fkey"
FOREIGN KEY ("uploadedByUserId") REFERENCES "user"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notification_recipient_import_run"
ADD CONSTRAINT "notification_recipient_import_run_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "notification_recipient_import_batch"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
