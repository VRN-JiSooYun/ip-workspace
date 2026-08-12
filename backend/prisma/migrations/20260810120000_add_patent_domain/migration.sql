-- CreateTable
CREATE TABLE "country" (
    "id" SERIAL NOT NULL,
    "country" TEXT NOT NULL,

    CONSTRAINT "country_pkey" PRIMARY KEY ("id")
);

-- Insert country data
INSERT INTO "country" ("country") VALUES
    ('KR'),
    ('US'),
    ('JP'),
    ('CN'),
    ('EP'),
    ('TW'),
    ('CA'),
    ('AU'),
    ('SG'),
    ('IN'),
    ('BR'),
    ('MX'),
    ('RU'),
    ('ZA'),
    ('FR'),
    ('DE'),
    ('GB'),
    ('IT'),
    ('ES'),
    ('NL');

-- CreateTable
CREATE TABLE "attorney" (
    "attorney_number" INTEGER NOT NULL,
    "attorney_name" TEXT,

    CONSTRAINT "attorney_pkey" PRIMARY KEY ("attorney_number")
);

-- CreateTable
CREATE TABLE "legal_status" (
    "id" SERIAL NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "legal_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_status" (
    "id" SERIAL NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "exam_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patent" (
    "id" SERIAL NOT NULL,
    "country" INTEGER NOT NULL,         
    "korean_title" TEXT,
    "english_title" TEXT,
    "application_number" TEXT NOT NULL,
    "application_date" TIMESTAMP(3),
    "applicant" TEXT,
    "attorney_number" INTEGER,
    "registration_number" TEXT,
    "registration_date" TEXT,
    "publication_number" TEXT,
    "publication_date" TIMESTAMP(3),
    "int_application_number" TEXT,
    "int_application_date" TIMESTAMP(3),
    "int_publication_number" TEXT,
    "int_publication_date" TIMESTAMP(3),
    "parent_application_number" TEXT,
    "legal_status" INTEGER,
    "exam_status" INTEGER,
    "exam" BOOLEAN,
    "exam_date" TIMESTAMP(3),

    CONSTRAINT "patent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipc" (
    "id" SERIAL NOT NULL,
    "ipc_code" TEXT NOT NULL,
    "section" TEXT,
    "class_code" TEXT,
    "subclass" TEXT,
    "main_group" TEXT,
    "subgroup" TEXT,

    CONSTRAINT "ipc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patent_ipc" (
    "id" SERIAL NOT NULL,
    "patent_id" INTEGER NOT NULL,
    "ipc_id" INTEGER NOT NULL,
    "ordinal" INTEGER NOT NULL,

    CONSTRAINT "patent_ipc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin" (
    "id" SERIAL NOT NULL,
    "patent_id" INTEGER NOT NULL,
    "action_date" TIMESTAMP(3),
    "action" TEXT,
    "action_number" TEXT,

    CONSTRAINT "admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "office_action" (
    "id" SERIAL NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "content" TEXT,
    "document_path" TEXT,

    CONSTRAINT "office_action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "response" (
    "id" SERIAL NOT NULL,
    "oa_id" INTEGER NOT NULL,
    "type" INTEGER,
    "content" TEXT,
    "document_path" TEXT,

    CONSTRAINT "response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "examiner" (
    "id" SERIAL NOT NULL,
    "office" TEXT,
    "bureau" TEXT,
    "department" TEXT,
    "name" TEXT NOT NULL,

    CONSTRAINT "examiner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oa_examiner" (
    "id" SERIAL NOT NULL,
    "oa_id" INTEGER NOT NULL,
    "examiner_id" INTEGER NOT NULL,

    CONSTRAINT "oa_examiner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_statutes" (
    "id" SERIAL NOT NULL,
    "law_type" INTEGER,
    "article" INTEGER,
    "paragraph" INTEGER,
    "sub_paragraph" INTEGER,

    CONSTRAINT "legal_statutes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rejection" (
    "id" SERIAL NOT NULL,
    "oa_id" INTEGER NOT NULL,
    "claim" TEXT,
    "statute_id" INTEGER,

    CONSTRAINT "rejection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "country_country_key" ON "country"("country");

-- CreateIndex
CREATE UNIQUE INDEX "patent_application_number_key" ON "patent"("application_number");

-- CreateIndex
CREATE INDEX "patent_country_idx" ON "patent"("country");

-- CreateIndex
CREATE INDEX "patent_attorney_number_idx" ON "patent"("attorney_number");

-- CreateIndex
CREATE INDEX "patent_legal_status_idx" ON "patent"("legal_status");

-- CreateIndex
CREATE INDEX "patent_exam_status_idx" ON "patent"("exam_status");

-- CreateIndex
CREATE INDEX "patent_application_date_idx" ON "patent"("application_date");

-- CreateIndex
CREATE INDEX "patent_publication_date_idx" ON "patent"("publication_date");

-- CreateIndex
CREATE UNIQUE INDEX "ipc_ipc_code_key" ON "ipc"("ipc_code");

-- CreateIndex
CREATE INDEX "patent_ipc_patent_id_idx" ON "patent_ipc"("patent_id");

-- CreateIndex
CREATE INDEX "patent_ipc_ipc_id_idx" ON "patent_ipc"("ipc_id");

-- CreateIndex
CREATE UNIQUE INDEX "patent_ipc_patent_id_ipc_id_key" ON "patent_ipc"("patent_id", "ipc_id");

-- CreateIndex
CREATE INDEX "admin_patent_id_idx" ON "admin"("patent_id");

-- CreateIndex
CREATE INDEX "admin_action_date_idx" ON "admin"("action_date");

-- CreateIndex
CREATE INDEX "office_action_admin_id_idx" ON "office_action"("admin_id");

-- CreateIndex
CREATE INDEX "response_oa_id_idx" ON "response"("oa_id");

-- CreateIndex
CREATE INDEX "oa_examiner_oa_id_idx" ON "oa_examiner"("oa_id");

-- CreateIndex
CREATE INDEX "oa_examiner_examiner_id_idx" ON "oa_examiner"("examiner_id");

-- CreateIndex
CREATE UNIQUE INDEX "oa_examiner_oa_id_examiner_id_key" ON "oa_examiner"("oa_id", "examiner_id");

-- CreateIndex
CREATE INDEX "rejection_oa_id_idx" ON "rejection"("oa_id");

-- CreateIndex
CREATE INDEX "rejection_statute_id_idx" ON "rejection"("statute_id");

-- AddForeignKey
ALTER TABLE "patent" ADD CONSTRAINT "patent_country_fkey" FOREIGN KEY ("country") REFERENCES "country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patent" ADD CONSTRAINT "patent_attorney_number_fkey" FOREIGN KEY ("attorney_number") REFERENCES "attorney"("attorney_number") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patent" ADD CONSTRAINT "patent_legal_status_fkey" FOREIGN KEY ("legal_status") REFERENCES "legal_status"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patent" ADD CONSTRAINT "patent_exam_status_fkey" FOREIGN KEY ("exam_status") REFERENCES "exam_status"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patent_ipc" ADD CONSTRAINT "patent_ipc_patent_id_fkey" FOREIGN KEY ("patent_id") REFERENCES "patent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patent_ipc" ADD CONSTRAINT "patent_ipc_ipc_id_fkey" FOREIGN KEY ("ipc_id") REFERENCES "ipc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin" ADD CONSTRAINT "admin_patent_id_fkey" FOREIGN KEY ("patent_id") REFERENCES "patent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "office_action" ADD CONSTRAINT "office_action_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response" ADD CONSTRAINT "response_oa_id_fkey" FOREIGN KEY ("oa_id") REFERENCES "office_action"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oa_examiner" ADD CONSTRAINT "oa_examiner_oa_id_fkey" FOREIGN KEY ("oa_id") REFERENCES "office_action"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oa_examiner" ADD CONSTRAINT "oa_examiner_examiner_id_fkey" FOREIGN KEY ("examiner_id") REFERENCES "examiner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rejection" ADD CONSTRAINT "rejection_oa_id_fkey" FOREIGN KEY ("oa_id") REFERENCES "office_action"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rejection" ADD CONSTRAINT "rejection_statute_id_fkey" FOREIGN KEY ("statute_id") REFERENCES "legal_statutes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

