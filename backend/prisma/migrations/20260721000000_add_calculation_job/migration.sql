CREATE TYPE "CalculationProvider" AS ENUM ('THREE_D_PSA');
CREATE TYPE "CalculationJobType" AS ENUM ('PSA', 'ESOL');
CREATE TYPE "CalculationJobStatus" AS ENUM ('SUBMITTING', 'QUEUED', 'COMPLETED', 'FAILED');

CREATE TABLE "calculation_job" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "compoundDraftKey" TEXT NOT NULL,
    "provider" "CalculationProvider" NOT NULL DEFAULT 'THREE_D_PSA',
    "jobType" "CalculationJobType" NOT NULL,
    "externalKey" TEXT NOT NULL,
    "externalJobId" TEXT,
    "smiles" TEXT NOT NULL,
    "status" "CalculationJobStatus" NOT NULL DEFAULT 'SUBMITTING',
    "resultData" JSONB,
    "errorMessage" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "callbackReceivedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calculation_job_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "calculation_job_externalKey_key" ON "calculation_job"("externalKey");
CREATE INDEX "calculation_job_userId_compoundDraftKey_deletedAt_idx" ON "calculation_job"("userId", "compoundDraftKey", "deletedAt");
CREATE INDEX "calculation_job_status_deletedAt_updatedAt_idx" ON "calculation_job"("status", "deletedAt", "updatedAt");

ALTER TABLE "calculation_job"
    ADD CONSTRAINT "calculation_job_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
