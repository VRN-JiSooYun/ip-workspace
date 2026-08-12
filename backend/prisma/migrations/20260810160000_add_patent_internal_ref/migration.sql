-- AlterTable
ALTER TABLE "patent" ADD COLUMN     "internal_ref" TEXT,
ADD COLUMN     "ref_country" TEXT,
ADD COLUMN     "ref_origin" TEXT,
ADD COLUMN     "ref_serial" INTEGER,
ADD COLUMN     "ref_type" TEXT,
ADD COLUMN     "ref_year" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "patent_internal_ref_key" ON "patent"("internal_ref");

-- CreateIndex
CREATE INDEX "patent_ref_origin_ref_year_ref_type_ref_serial_idx" ON "patent"("ref_origin", "ref_year", "ref_type", "ref_serial");

