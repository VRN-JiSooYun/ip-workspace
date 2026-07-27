CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE "ConferenceStatus" AS ENUM ('OPEN', 'NOT_OPENED');
CREATE TYPE "ConferenceAssetKind" AS ENUM ('LOGO');
CREATE TYPE "ConferenceAbstractAssetKind" AS ENUM ('POSTER', 'DOCUMENT', 'VIDEO', 'REFERENCE_IMAGE', 'ATTACHMENT');
CREATE TYPE "ConferenceStorageProvider" AS ENUM ('LEGACY_HTTP', 'NAS');
CREATE TYPE "ConferenceAssetMigrationStatus" AS ENUM ('NOT_PLANNED', 'PENDING', 'MIGRATING', 'READY', 'FAILED');
CREATE TYPE "ConferenceImportStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED');
CREATE TYPE "ConferenceImportMode" AS ENUM ('DRY_RUN', 'APPLY');
CREATE TYPE "ConferenceImportIssueSeverity" AS ENUM ('WARNING', 'ERROR');

CREATE TABLE "conference" (
    "id" UUID NOT NULL,
    "legacyId" INTEGER,
    "sourceSystem" TEXT NOT NULL DEFAULT 'LEGACY_DJANGO',
    "status" "ConferenceStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "fullTitle" TEXT,
    "year" INTEGER NOT NULL,
    "sourceUrl" TEXT,
    "dateStart" DATE,
    "dateEnd" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "conference_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "conference_date_range_check" CHECK ("dateStart" IS NULL OR "dateEnd" IS NULL OR "dateStart" <= "dateEnd")
);

CREATE TABLE "conference_abstract" (
    "id" UUID NOT NULL,
    "conferenceId" UUID NOT NULL,
    "legacyId" INTEGER,
    "sourceSystem" TEXT NOT NULL DEFAULT 'LEGACY_DJANGO',
    "title" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "firstAuthorName" TEXT,
    "firstAuthorOrganization" TEXT,
    "firstAuthorUrl" TEXT,
    "authors" JSONB,
    "authorOrganizations" JSONB,
    "organizations" JSONB,
    "contents" JSONB,
    "meeting" TEXT,
    "meetingUrl" TEXT,
    "sessionType" TEXT,
    "sessionTypeUrl" TEXT,
    "sessionTitle" TEXT,
    "sessionTitleUrl" TEXT,
    "track" TEXT,
    "trackUrl" TEXT,
    "subTrack" TEXT,
    "subTrackUrl" TEXT,
    "abstractNumber" TEXT,
    "posterNumber" TEXT,
    "clinicalTrialRegistrationNumber" TEXT,
    "dateOpen" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "conference_abstract_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conference_asset" (
    "id" UUID NOT NULL,
    "conferenceId" UUID NOT NULL,
    "kind" "ConferenceAssetKind" NOT NULL,
    "storageProvider" "ConferenceStorageProvider" NOT NULL DEFAULT 'LEGACY_HTTP',
    "legacySourceUrl" TEXT,
    "storageKey" TEXT,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT,
    "byteSize" BIGINT,
    "sha256" TEXT,
    "migrationStatus" "ConferenceAssetMigrationStatus" NOT NULL DEFAULT 'NOT_PLANNED',
    "migrationError" TEXT,
    "migratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conference_asset_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "conference_asset_byte_size_check" CHECK ("byteSize" IS NULL OR "byteSize" >= 0)
);

CREATE TABLE "conference_abstract_asset" (
    "id" UUID NOT NULL,
    "abstractId" UUID NOT NULL,
    "kind" "ConferenceAbstractAssetKind" NOT NULL,
    "storageProvider" "ConferenceStorageProvider" NOT NULL DEFAULT 'LEGACY_HTTP',
    "legacySourceUrl" TEXT,
    "storageKey" TEXT,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT,
    "byteSize" BIGINT,
    "sha256" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "migrationStatus" "ConferenceAssetMigrationStatus" NOT NULL DEFAULT 'NOT_PLANNED',
    "migrationError" TEXT,
    "migratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conference_abstract_asset_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "conference_abstract_asset_byte_size_check" CHECK ("byteSize" IS NULL OR "byteSize" >= 0),
    CONSTRAINT "conference_abstract_asset_sort_order_check" CHECK ("sortOrder" >= 0)
);

CREATE TABLE "conference_bookmark" (
    "userId" UUID NOT NULL,
    "conferenceId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conference_bookmark_pkey" PRIMARY KEY ("userId", "conferenceId")
);

CREATE TABLE "conference_abstract_bookmark" (
    "userId" UUID NOT NULL,
    "abstractId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conference_abstract_bookmark_pkey" PRIMARY KEY ("userId", "abstractId")
);

CREATE TABLE "conference_abstract_comment" (
    "id" UUID NOT NULL,
    "abstractId" UUID NOT NULL,
    "authorUserId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "conference_abstract_comment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "conference_abstract_comment_content_check" CHECK (length(btrim("content")) BETWEEN 1 AND 10000)
);

CREATE TABLE "conference_abstract_comment_mention" (
    "commentId" UUID NOT NULL,
    "mentionedUserId" UUID NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conference_abstract_comment_mention_pkey" PRIMARY KEY ("commentId", "mentionedUserId")
);

CREATE TABLE "conference_import_run" (
    "id" UUID NOT NULL,
    "status" "ConferenceImportStatus" NOT NULL DEFAULT 'PENDING',
    "mode" "ConferenceImportMode" NOT NULL,
    "profileVersion" TEXT NOT NULL,
    "sourceChecksum" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "insertedCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "startedByUserId" UUID NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "conference_import_run_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "conference_import_run_counts_check" CHECK (
        "insertedCount" >= 0 AND "updatedCount" >= 0 AND "skippedCount" >= 0 AND "errorCount" >= 0
    )
);

CREATE TABLE "conference_import_issue" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "sourceFile" TEXT NOT NULL,
    "rowNumber" INTEGER,
    "entityType" TEXT NOT NULL,
    "severity" "ConferenceImportIssueSeverity" NOT NULL,
    "errorCode" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sourceSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conference_import_issue_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "conference_import_issue_row_number_check" CHECK ("rowNumber" IS NULL OR "rowNumber" > 0)
);

CREATE UNIQUE INDEX "conference_sourceSystem_legacyId_key" ON "conference"("sourceSystem", "legacyId");
CREATE UNIQUE INDEX "conference_abbreviation_year_key" ON "conference"("abbreviation", "year");
CREATE INDEX "conference_dateStart_dateEnd_deletedAt_idx" ON "conference"("dateStart", "dateEnd", "deletedAt");
CREATE INDEX "conference_year_deletedAt_idx" ON "conference"("year", "deletedAt");
CREATE INDEX "conference_status_deletedAt_idx" ON "conference"("status", "deletedAt");
CREATE INDEX "conference_search_trgm_idx" ON "conference" USING GIN ((coalesce("title", '') || ' ' || coalesce("abbreviation", '') || ' ' || coalesce("fullTitle", '')) gin_trgm_ops);

CREATE UNIQUE INDEX "conference_abstract_sourceSystem_legacyId_key" ON "conference_abstract"("sourceSystem", "legacyId");
CREATE UNIQUE INDEX "conference_abstract_active_source_url_key" ON "conference_abstract"("conferenceId", "sourceUrl") WHERE "sourceUrl" IS NOT NULL AND "deletedAt" IS NULL;
CREATE INDEX "conference_abstract_conferenceId_deletedAt_abstractNumber_idx" ON "conference_abstract"("conferenceId", "deletedAt", "abstractNumber");
CREATE INDEX "conference_abstract_conferenceId_dateOpen_idx" ON "conference_abstract"("conferenceId", "dateOpen");
CREATE INDEX "conference_abstract_conferenceId_sourceUrl_idx" ON "conference_abstract"("conferenceId", "sourceUrl");
CREATE INDEX "conference_abstract_search_trgm_idx" ON "conference_abstract" USING GIN ((coalesce("title", '') || ' ' || coalesce("abstractNumber", '') || ' ' || coalesce("firstAuthorName", '') || ' ' || coalesce("firstAuthorOrganization", '') || ' ' || coalesce("meeting", '') || ' ' || coalesce("sessionTitle", '') || ' ' || coalesce("track", '')) gin_trgm_ops);

CREATE UNIQUE INDEX "conference_asset_conferenceId_kind_legacySourceUrl_key" ON "conference_asset"("conferenceId", "kind", "legacySourceUrl");
CREATE UNIQUE INDEX "conference_asset_nas_storage_key" ON "conference_asset"("storageKey") WHERE "storageProvider" = 'NAS' AND "storageKey" IS NOT NULL;
CREATE INDEX "conference_asset_conferenceId_kind_idx" ON "conference_asset"("conferenceId", "kind");
CREATE INDEX "conference_asset_migrationStatus_idx" ON "conference_asset"("migrationStatus");

CREATE UNIQUE INDEX "conference_abstract_asset_abstractId_kind_legacySourceUrl_key" ON "conference_abstract_asset"("abstractId", "kind", "legacySourceUrl");
CREATE UNIQUE INDEX "conference_abstract_asset_nas_storage_key" ON "conference_abstract_asset"("storageKey") WHERE "storageProvider" = 'NAS' AND "storageKey" IS NOT NULL;
CREATE INDEX "conference_abstract_asset_abstractId_kind_sortOrder_idx" ON "conference_abstract_asset"("abstractId", "kind", "sortOrder");
CREATE INDEX "conference_abstract_asset_migrationStatus_idx" ON "conference_abstract_asset"("migrationStatus");

CREATE INDEX "conference_bookmark_conferenceId_createdAt_idx" ON "conference_bookmark"("conferenceId", "createdAt");
CREATE INDEX "conference_abstract_bookmark_abstractId_createdAt_idx" ON "conference_abstract_bookmark"("abstractId", "createdAt");
CREATE INDEX "conference_abstract_comment_abstractId_deletedAt_createdAt_idx" ON "conference_abstract_comment"("abstractId", "deletedAt", "createdAt");
CREATE INDEX "conference_abstract_comment_authorUserId_deletedAt_idx" ON "conference_abstract_comment"("authorUserId", "deletedAt");
CREATE INDEX "conference_abstract_comment_mention_mentionedUserId_readAt_createdAt_idx" ON "conference_abstract_comment_mention"("mentionedUserId", "readAt", "createdAt");
CREATE UNIQUE INDEX "conference_import_run_sourceChecksum_profileVersion_mode_key" ON "conference_import_run"("sourceChecksum", "profileVersion", "mode");
CREATE UNIQUE INDEX "conference_import_run_idempotencyKey_key" ON "conference_import_run"("idempotencyKey");
CREATE INDEX "conference_import_run_status_startedAt_idx" ON "conference_import_run"("status", "startedAt");
CREATE INDEX "conference_import_run_startedByUserId_startedAt_idx" ON "conference_import_run"("startedByUserId", "startedAt");
CREATE INDEX "conference_import_issue_runId_severity_rowNumber_idx" ON "conference_import_issue"("runId", "severity", "rowNumber");
CREATE INDEX "conference_import_issue_errorCode_idx" ON "conference_import_issue"("errorCode");

ALTER TABLE "conference_abstract" ADD CONSTRAINT "conference_abstract_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "conference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conference_asset" ADD CONSTRAINT "conference_asset_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "conference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conference_abstract_asset" ADD CONSTRAINT "conference_abstract_asset_abstractId_fkey" FOREIGN KEY ("abstractId") REFERENCES "conference_abstract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conference_bookmark" ADD CONSTRAINT "conference_bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conference_bookmark" ADD CONSTRAINT "conference_bookmark_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "conference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conference_abstract_bookmark" ADD CONSTRAINT "conference_abstract_bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conference_abstract_bookmark" ADD CONSTRAINT "conference_abstract_bookmark_abstractId_fkey" FOREIGN KEY ("abstractId") REFERENCES "conference_abstract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conference_abstract_comment" ADD CONSTRAINT "conference_abstract_comment_abstractId_fkey" FOREIGN KEY ("abstractId") REFERENCES "conference_abstract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conference_abstract_comment" ADD CONSTRAINT "conference_abstract_comment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conference_abstract_comment_mention" ADD CONSTRAINT "conference_abstract_comment_mention_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "conference_abstract_comment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conference_abstract_comment_mention" ADD CONSTRAINT "conference_abstract_comment_mention_mentionedUserId_fkey" FOREIGN KEY ("mentionedUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conference_import_run" ADD CONSTRAINT "conference_import_run_startedByUserId_fkey" FOREIGN KEY ("startedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conference_import_issue" ADD CONSTRAINT "conference_import_issue_runId_fkey" FOREIGN KEY ("runId") REFERENCES "conference_import_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
