-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "WorkspaceModule" AS ENUM ('CONFERENCE', 'PATENT_ANALYSIS');

-- CreateEnum
CREATE TYPE "ConferenceStatus" AS ENUM ('OPEN', 'NOT_OPENED');

-- CreateEnum
CREATE TYPE "ConferenceAssetKind" AS ENUM ('LOGO');

-- CreateEnum
CREATE TYPE "ConferenceAbstractAssetKind" AS ENUM ('POSTER', 'DOCUMENT', 'VIDEO', 'REFERENCE_IMAGE', 'ATTACHMENT');

-- CreateEnum
CREATE TYPE "ConferenceStorageProvider" AS ENUM ('LEGACY_HTTP', 'NAS');

-- CreateEnum
CREATE TYPE "ConferenceAssetMigrationStatus" AS ENUM ('NOT_PLANNED', 'PENDING', 'MIGRATING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ConferenceImportStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "ConferenceImportMode" AS ENUM ('DRY_RUN', 'APPLY');

-- CreateEnum
CREATE TYPE "ConferenceImportIssueSeverity" AS ENUM ('WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "ConferenceImportBatchStatus" AS ENUM ('UPLOADING', 'READY', 'INVALID', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ConferenceImportBatchKind" AS ENUM ('LEGACY', 'API_METADATA');

-- CreateEnum
CREATE TYPE "ConferenceCommentSource" AS ENUM ('WORKSPACE', 'LEGACY_DJANGO');

-- CreateEnum
CREATE TYPE "ConferenceMailOutboxType" AS ENUM ('COMMENT_MENTION');

-- CreateEnum
CREATE TYPE "ConferenceMailOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'RETRY', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationRecipientSource" AS ENUM ('GROUPWARE_IMPORT', 'WORKSPACE_USER');

-- CreateEnum
CREATE TYPE "NotificationRecipientStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "NotificationRecipientImportStatus" AS ENUM ('RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationRecipientImportBatchStatus" AS ENUM ('UPLOADING', 'READY', 'INVALID', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "NotificationRecipientImportIssueSeverity" AS ENUM ('WARNING', 'ERROR');

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "team" TEXT,
    "fullname" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT,
    "teamId" UUID,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "inviterId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_member" (
    "id" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_alias" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "displayAlias" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_alias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groupware_team_assignment" (
    "userId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "rawTeamName" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "groupware_team_assignment_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "team_module_access" (
    "id" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "module" "WorkspaceModule" NOT NULL,
    "canRead" BOOLEAN NOT NULL DEFAULT false,
    "canWrite" BOOLEAN NOT NULL DEFAULT false,
    "canManage" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_module_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conference" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
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

    CONSTRAINT "conference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

    CONSTRAINT "conference_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

    CONSTRAINT "conference_abstract_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conference_abstract_bookmark" (
    "userId" UUID NOT NULL,
    "abstractId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conference_abstract_bookmark_pkey" PRIMARY KEY ("userId","abstractId")
);

-- CreateTable
CREATE TABLE "conference_abstract_comment" (
    "id" UUID NOT NULL,
    "abstractId" UUID NOT NULL,
    "authorUserId" UUID,
    "legacyAuthorRecipientId" UUID,
    "authorNameSnapshot" TEXT,
    "sourceSystem" "ConferenceCommentSource" NOT NULL DEFAULT 'WORKSPACE',
    "legacyCommentKey" TEXT,
    "legacyCommentId" INTEGER,
    "legacyOrder" INTEGER,
    "sourceCreatedAt" TIMESTAMP(3),
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "conference_abstract_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conference_abstract_comment_mention" (
    "commentId" UUID NOT NULL,
    "mentionedRecipientId" UUID NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conference_abstract_comment_mention_pkey" PRIMARY KEY ("commentId","mentionedRecipientId")
);

-- CreateTable
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

    CONSTRAINT "notification_recipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conference_mail_outbox" (
    "id" UUID NOT NULL,
    "type" "ConferenceMailOutboxType" NOT NULL DEFAULT 'COMMENT_MENTION',
    "status" "ConferenceMailOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "commentId" UUID NOT NULL,
    "recipientId" UUID,
    "recipientEmailSnapshot" TEXT NOT NULL,
    "recipientNormalizedEmail" TEXT NOT NULL,
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

    CONSTRAINT "conference_mail_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_recipient_import_run" (
    "id" UUID NOT NULL,
    "batchId" UUID,
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

    CONSTRAINT "notification_recipient_import_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

    CONSTRAINT "notification_recipient_import_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_recipient_import_issue" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "rowNumber" INTEGER,
    "severity" "NotificationRecipientImportIssueSeverity" NOT NULL,
    "errorCode" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "memberId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_recipient_import_issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

    CONSTRAINT "conference_import_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conference_import_batch_file" (
    "id" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "logicalPath" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT,
    "byteSize" BIGINT NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conference_import_batch_file_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conference_import_run" (
    "id" UUID NOT NULL,
    "batchId" UUID,
    "status" "ConferenceImportStatus" NOT NULL DEFAULT 'PENDING',
    "mode" "ConferenceImportMode" NOT NULL,
    "batchKey" TEXT NOT NULL,
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

    CONSTRAINT "conference_import_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

    CONSTRAINT "conference_import_issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "impersonatedBy" TEXT,
    "activeOrganizationId" UUID,
    "activeTeamId" UUID,
    "userId" UUID NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" UUID NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "tokenValidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" UUID NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_audit_log" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "targetUserId" UUID,
    "eventType" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "errorCode" TEXT,
    "requestId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_role_status_idx" ON "user"("role", "status");

-- CreateIndex
CREATE INDEX "user_team_idx" ON "user"("team");

-- CreateIndex
CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");

-- CreateIndex
CREATE INDEX "member_userId_idx" ON "member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "member_organizationId_userId_key" ON "member"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "invitation_organizationId_idx" ON "invitation"("organizationId");

-- CreateIndex
CREATE INDEX "invitation_email_idx" ON "invitation"("email");

-- CreateIndex
CREATE INDEX "team_organizationId_idx" ON "team"("organizationId");

-- CreateIndex
CREATE INDEX "team_member_userId_idx" ON "team_member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "team_member_teamId_userId_key" ON "team_member"("teamId", "userId");

-- CreateIndex
CREATE INDEX "team_alias_teamId_idx" ON "team_alias"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "team_alias_organizationId_normalizedAlias_key" ON "team_alias"("organizationId", "normalizedAlias");

-- CreateIndex
CREATE INDEX "groupware_team_assignment_teamId_idx" ON "groupware_team_assignment"("teamId");

-- CreateIndex
CREATE INDEX "team_module_access_module_canRead_idx" ON "team_module_access"("module", "canRead");

-- CreateIndex
CREATE UNIQUE INDEX "team_module_access_teamId_module_key" ON "team_module_access"("teamId", "module");

-- CreateIndex
CREATE INDEX "conference_dateStart_dateEnd_deletedAt_idx" ON "conference"("dateStart", "dateEnd", "deletedAt");

-- CreateIndex
CREATE INDEX "conference_organizationId_deletedAt_idx" ON "conference"("organizationId", "deletedAt");

-- CreateIndex
CREATE INDEX "conference_year_deletedAt_idx" ON "conference"("year", "deletedAt");

-- CreateIndex
CREATE INDEX "conference_status_deletedAt_idx" ON "conference"("status", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "conference_sourceSystem_legacyId_key" ON "conference"("sourceSystem", "legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "conference_abbreviation_year_key" ON "conference"("abbreviation", "year");

-- CreateIndex
CREATE INDEX "conference_abstract_conferenceId_deletedAt_abstractNumber_idx" ON "conference_abstract"("conferenceId", "deletedAt", "abstractNumber");

-- CreateIndex
CREATE INDEX "conference_abstract_conferenceId_dateOpen_idx" ON "conference_abstract"("conferenceId", "dateOpen");

-- CreateIndex
CREATE INDEX "conference_abstract_conferenceId_sourceUrl_idx" ON "conference_abstract"("conferenceId", "sourceUrl");

-- CreateIndex
CREATE UNIQUE INDEX "conference_abstract_sourceSystem_legacyId_key" ON "conference_abstract"("sourceSystem", "legacyId");

-- CreateIndex
CREATE INDEX "conference_asset_conferenceId_kind_idx" ON "conference_asset"("conferenceId", "kind");

-- CreateIndex
CREATE INDEX "conference_asset_migrationStatus_idx" ON "conference_asset"("migrationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "conference_asset_conferenceId_kind_legacySourceUrl_key" ON "conference_asset"("conferenceId", "kind", "legacySourceUrl");

-- CreateIndex
CREATE INDEX "conference_abstract_asset_abstractId_kind_sortOrder_idx" ON "conference_abstract_asset"("abstractId", "kind", "sortOrder");

-- CreateIndex
CREATE INDEX "conference_abstract_asset_migrationStatus_idx" ON "conference_abstract_asset"("migrationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "conference_abstract_asset_abstractId_kind_legacySourceUrl_key" ON "conference_abstract_asset"("abstractId", "kind", "legacySourceUrl");

-- CreateIndex
CREATE INDEX "conference_abstract_bookmark_abstractId_createdAt_idx" ON "conference_abstract_bookmark"("abstractId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "conference_abstract_comment_legacyCommentKey_key" ON "conference_abstract_comment"("legacyCommentKey");

-- CreateIndex
CREATE INDEX "conference_abstract_comment_abstractId_deletedAt_createdAt_idx" ON "conference_abstract_comment"("abstractId", "deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "conference_abstract_comment_authorUserId_deletedAt_idx" ON "conference_abstract_comment"("authorUserId", "deletedAt");

-- CreateIndex
CREATE INDEX "conference_abstract_comment_legacyAuthorRecipientId_deleted_idx" ON "conference_abstract_comment"("legacyAuthorRecipientId", "deletedAt");

-- CreateIndex
CREATE INDEX "conference_abstract_comment_mention_mentionedRecipientId_re_idx" ON "conference_abstract_comment_mention"("mentionedRecipientId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_recipient_memberId_key" ON "notification_recipient"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_recipient_normalizedEmail_key" ON "notification_recipient"("normalizedEmail");

-- CreateIndex
CREATE UNIQUE INDEX "notification_recipient_linkedUserId_key" ON "notification_recipient"("linkedUserId");

-- CreateIndex
CREATE INDEX "notification_recipient_status_mailEnabled_name_idx" ON "notification_recipient"("status", "mailEnabled", "name");

-- CreateIndex
CREATE INDEX "notification_recipient_lastSyncedAt_idx" ON "notification_recipient"("lastSyncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "conference_mail_outbox_messageId_key" ON "conference_mail_outbox"("messageId");

-- CreateIndex
CREATE INDEX "conference_mail_outbox_status_nextAttemptAt_idx" ON "conference_mail_outbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "conference_mail_outbox_leaseExpiresAt_idx" ON "conference_mail_outbox"("leaseExpiresAt");

-- CreateIndex
CREATE INDEX "conference_mail_outbox_commentId_createdAt_idx" ON "conference_mail_outbox"("commentId", "createdAt");

-- CreateIndex
CREATE INDEX "conference_mail_outbox_recipientId_createdAt_idx" ON "conference_mail_outbox"("recipientId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "conference_mail_outbox_type_comment_email_key" ON "conference_mail_outbox"("type", "commentId", "recipientNormalizedEmail");

-- CreateIndex
CREATE INDEX "notification_recipient_import_run_batchId_startedAt_idx" ON "notification_recipient_import_run"("batchId", "startedAt");

-- CreateIndex
CREATE INDEX "notification_recipient_import_run_status_startedAt_idx" ON "notification_recipient_import_run"("status", "startedAt");

-- CreateIndex
CREATE INDEX "notification_recipient_import_run_startedByUserId_startedAt_idx" ON "notification_recipient_import_run"("startedByUserId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_recipient_import_run_sourceChecksum_profileVer_key" ON "notification_recipient_import_run"("sourceChecksum", "profileVersion", "mode");

-- CreateIndex
CREATE UNIQUE INDEX "notification_recipient_import_batch_batchKey_key" ON "notification_recipient_import_batch"("batchKey");

-- CreateIndex
CREATE UNIQUE INDEX "notification_recipient_import_batch_sourceChecksum_key" ON "notification_recipient_import_batch"("sourceChecksum");

-- CreateIndex
CREATE INDEX "notification_recipient_import_batch_status_createdAt_idx" ON "notification_recipient_import_batch"("status", "createdAt");

-- CreateIndex
CREATE INDEX "notification_recipient_import_batch_uploadedByUserId_create_idx" ON "notification_recipient_import_batch"("uploadedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "notification_recipient_import_issue_runId_severity_rowNumbe_idx" ON "notification_recipient_import_issue"("runId", "severity", "rowNumber");

-- CreateIndex
CREATE INDEX "notification_recipient_import_issue_errorCode_idx" ON "notification_recipient_import_issue"("errorCode");

-- CreateIndex
CREATE UNIQUE INDEX "conference_import_batch_batchKey_key" ON "conference_import_batch"("batchKey");

-- CreateIndex
CREATE UNIQUE INDEX "conference_import_batch_sourceChecksum_key" ON "conference_import_batch"("sourceChecksum");

-- CreateIndex
CREATE INDEX "conference_import_batch_status_createdAt_idx" ON "conference_import_batch"("status", "createdAt");

-- CreateIndex
CREATE INDEX "conference_import_batch_uploadedByUserId_createdAt_idx" ON "conference_import_batch"("uploadedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "conference_import_batch_file_sha256_idx" ON "conference_import_batch_file"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "conference_import_batch_file_batchId_logicalPath_key" ON "conference_import_batch_file"("batchId", "logicalPath");

-- CreateIndex
CREATE INDEX "conference_import_run_batchId_startedAt_idx" ON "conference_import_run"("batchId", "startedAt");

-- CreateIndex
CREATE INDEX "conference_import_run_status_startedAt_idx" ON "conference_import_run"("status", "startedAt");

-- CreateIndex
CREATE INDEX "conference_import_run_startedByUserId_startedAt_idx" ON "conference_import_run"("startedByUserId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "conference_import_run_sourceChecksum_profileVersion_mode_key" ON "conference_import_run"("sourceChecksum", "profileVersion", "mode");

-- CreateIndex
CREATE UNIQUE INDEX "conference_import_run_idempotencyKey_key" ON "conference_import_run"("idempotencyKey");

-- CreateIndex
CREATE INDEX "conference_import_issue_runId_severity_rowNumber_idx" ON "conference_import_issue"("runId", "severity", "rowNumber");

-- CreateIndex
CREATE INDEX "conference_import_issue_errorCode_idx" ON "conference_import_issue"("errorCode");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "session_expiresAt_idx" ON "session"("expiresAt");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "account_providerId_accountId_key" ON "account"("providerId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "account_userId_providerId_key" ON "account"("userId", "providerId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "verification_expiresAt_idx" ON "verification"("expiresAt");

-- CreateIndex
CREATE INDEX "auth_audit_log_actorUserId_createdAt_idx" ON "auth_audit_log"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "auth_audit_log_targetUserId_createdAt_idx" ON "auth_audit_log"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "auth_audit_log_eventType_createdAt_idx" ON "auth_audit_log"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "auth_audit_log_requestId_idx" ON "auth_audit_log"("requestId");

-- CreateIndex
CREATE INDEX "auth_audit_log_createdAt_idx" ON "auth_audit_log"("createdAt");

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team" ADD CONSTRAINT "team_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_alias" ADD CONSTRAINT "team_alias_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_alias" ADD CONSTRAINT "team_alias_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groupware_team_assignment" ADD CONSTRAINT "groupware_team_assignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groupware_team_assignment" ADD CONSTRAINT "groupware_team_assignment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_module_access" ADD CONSTRAINT "team_module_access_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_module_access" ADD CONSTRAINT "team_module_access_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference" ADD CONSTRAINT "conference_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_abstract" ADD CONSTRAINT "conference_abstract_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "conference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_asset" ADD CONSTRAINT "conference_asset_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "conference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_abstract_asset" ADD CONSTRAINT "conference_abstract_asset_abstractId_fkey" FOREIGN KEY ("abstractId") REFERENCES "conference_abstract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_abstract_bookmark" ADD CONSTRAINT "conference_abstract_bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_abstract_bookmark" ADD CONSTRAINT "conference_abstract_bookmark_abstractId_fkey" FOREIGN KEY ("abstractId") REFERENCES "conference_abstract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_abstract_comment" ADD CONSTRAINT "conference_abstract_comment_abstractId_fkey" FOREIGN KEY ("abstractId") REFERENCES "conference_abstract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_abstract_comment" ADD CONSTRAINT "conference_abstract_comment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_abstract_comment" ADD CONSTRAINT "conference_abstract_comment_legacyAuthorRecipientId_fkey" FOREIGN KEY ("legacyAuthorRecipientId") REFERENCES "notification_recipient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_abstract_comment_mention" ADD CONSTRAINT "conference_abstract_comment_mention_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "conference_abstract_comment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_abstract_comment_mention" ADD CONSTRAINT "conference_abstract_comment_mention_mentionedRecipientId_fkey" FOREIGN KEY ("mentionedRecipientId") REFERENCES "notification_recipient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipient" ADD CONSTRAINT "notification_recipient_linkedUserId_fkey" FOREIGN KEY ("linkedUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_mail_outbox" ADD CONSTRAINT "conference_mail_outbox_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "conference_abstract_comment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_mail_outbox" ADD CONSTRAINT "conference_mail_outbox_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "notification_recipient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipient_import_run" ADD CONSTRAINT "notification_recipient_import_run_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "notification_recipient_import_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipient_import_run" ADD CONSTRAINT "notification_recipient_import_run_startedByUserId_fkey" FOREIGN KEY ("startedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipient_import_batch" ADD CONSTRAINT "notification_recipient_import_batch_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipient_import_issue" ADD CONSTRAINT "notification_recipient_import_issue_runId_fkey" FOREIGN KEY ("runId") REFERENCES "notification_recipient_import_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_import_batch" ADD CONSTRAINT "conference_import_batch_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_import_batch_file" ADD CONSTRAINT "conference_import_batch_file_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "conference_import_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_import_run" ADD CONSTRAINT "conference_import_run_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "conference_import_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_import_run" ADD CONSTRAINT "conference_import_run_startedByUserId_fkey" FOREIGN KEY ("startedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_import_issue" ADD CONSTRAINT "conference_import_issue_runId_fkey" FOREIGN KEY ("runId") REFERENCES "conference_import_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_audit_log" ADD CONSTRAINT "auth_audit_log_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_audit_log" ADD CONSTRAINT "auth_audit_log_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Default organization seed.
--
-- Carried over from 20260730010000_add_organization_team_access, which the
-- squash replaced. This row is NOT optional: DEFAULT_ORGANIZATION_SLUG in
-- src/authorization/team-membership-sync.service.ts looks the organization up
-- by this slug, and team membership sync plus the whole permission layer fail
-- without it.
INSERT INTO "organization" ("id", "name", "slug", "createdAt")
VALUES (
    '00000000-0000-4000-8000-000000000001',
    'Medichem Workspace',
    'medichem-workspace',
    CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
