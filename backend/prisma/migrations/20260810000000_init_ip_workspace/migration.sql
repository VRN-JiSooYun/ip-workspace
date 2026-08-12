-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "WorkspaceModule" AS ENUM ('PATENT_ANALYSIS');

-- CreateEnum
CREATE TYPE "NotificationRecipientImportMode" AS ENUM ('DRY_RUN', 'APPLY');

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
CREATE TABLE "notification_recipient_import_run" (
    "id" UUID NOT NULL,
    "batchId" UUID,
    "mode" "NotificationRecipientImportMode" NOT NULL,
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
ALTER TABLE "notification_recipient" ADD CONSTRAINT "notification_recipient_linkedUserId_fkey" FOREIGN KEY ("linkedUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipient_import_run" ADD CONSTRAINT "notification_recipient_import_run_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "notification_recipient_import_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipient_import_run" ADD CONSTRAINT "notification_recipient_import_run_startedByUserId_fkey" FOREIGN KEY ("startedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipient_import_batch" ADD CONSTRAINT "notification_recipient_import_batch_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipient_import_issue" ADD CONSTRAINT "notification_recipient_import_issue_runId_fkey" FOREIGN KEY ("runId") REFERENCES "notification_recipient_import_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
