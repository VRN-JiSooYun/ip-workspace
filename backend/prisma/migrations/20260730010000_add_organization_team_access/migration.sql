CREATE TYPE "WorkspaceModule" AS ENUM (
    'CONFERENCE',
    'PATENT_ANALYSIS',
    'SAR_TABLE',
    'DESIGN',
    'SYNTHESIS'
);

CREATE TABLE "organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "member" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "member_pkey" PRIMARY KEY ("id")
);

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

CREATE TABLE "team" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "team_member" (
    "id" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "team_member_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "team_alias" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "displayAlias" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "team_alias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "groupware_team_assignment" (
    "userId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "rawTeamName" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "groupware_team_assignment_pkey" PRIMARY KEY ("userId")
);

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

ALTER TABLE "session"
    ADD COLUMN "activeOrganizationId" UUID,
    ADD COLUMN "activeTeamId" UUID;

CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");
CREATE UNIQUE INDEX "member_organizationId_userId_key" ON "member"("organizationId", "userId");
CREATE INDEX "member_userId_idx" ON "member"("userId");
CREATE INDEX "invitation_organizationId_idx" ON "invitation"("organizationId");
CREATE INDEX "invitation_email_idx" ON "invitation"("email");
CREATE INDEX "team_organizationId_idx" ON "team"("organizationId");
CREATE UNIQUE INDEX "team_member_teamId_userId_key" ON "team_member"("teamId", "userId");
CREATE INDEX "team_member_userId_idx" ON "team_member"("userId");
CREATE UNIQUE INDEX "team_alias_organizationId_normalizedAlias_key"
    ON "team_alias"("organizationId", "normalizedAlias");
CREATE INDEX "team_alias_teamId_idx" ON "team_alias"("teamId");
CREATE INDEX "groupware_team_assignment_teamId_idx"
    ON "groupware_team_assignment"("teamId");
CREATE UNIQUE INDEX "team_module_access_teamId_module_key"
    ON "team_module_access"("teamId", "module");
CREATE INDEX "team_module_access_module_canRead_idx"
    ON "team_module_access"("module", "canRead");

ALTER TABLE "member"
    ADD CONSTRAINT "member_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "member"
    ADD CONSTRAINT "member_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invitation"
    ADD CONSTRAINT "invitation_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invitation"
    ADD CONSTRAINT "invitation_inviterId_fkey"
    FOREIGN KEY ("inviterId") REFERENCES "user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invitation"
    ADD CONSTRAINT "invitation_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "team"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "team"
    ADD CONSTRAINT "team_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_member"
    ADD CONSTRAINT "team_member_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "team"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_member"
    ADD CONSTRAINT "team_member_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_alias"
    ADD CONSTRAINT "team_alias_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_alias"
    ADD CONSTRAINT "team_alias_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "team"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "groupware_team_assignment"
    ADD CONSTRAINT "groupware_team_assignment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "groupware_team_assignment"
    ADD CONSTRAINT "groupware_team_assignment_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "team"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_module_access"
    ADD CONSTRAINT "team_module_access_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "team"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_module_access"
    ADD CONSTRAINT "team_module_access_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "organization" ("id", "name", "slug", "createdAt")
VALUES (
    '00000000-0000-4000-8000-000000000001',
    'Medichem Workspace',
    'medichem-workspace',
    CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
