-- 기존 자유 텍스트 값을 코드 테이블의 초기 데이터로 사용한다.
UPDATE "patent" SET "applicant" = NULLIF(BTRIM("applicant"), '');
UPDATE "patent" SET "inventors" = NULLIF(BTRIM("inventors"), '');

CREATE TABLE "patent_applicant" (
  "id" SERIAL NOT NULL,
  "applicant" TEXT NOT NULL,
  CONSTRAINT "patent_applicant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "patent_inventor" (
  "id" SERIAL NOT NULL,
  "inventor" TEXT NOT NULL,
  CONSTRAINT "patent_inventor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "patent_applicant_applicant_key"
  ON "patent_applicant"("applicant");
CREATE UNIQUE INDEX "patent_inventor_inventor_key"
  ON "patent_inventor"("inventor");

INSERT INTO "patent_applicant" ("applicant")
SELECT DISTINCT "applicant" FROM "patent" WHERE "applicant" IS NOT NULL;

INSERT INTO "patent_inventor" ("inventor")
SELECT DISTINCT "inventors" FROM "patent" WHERE "inventors" IS NOT NULL;

CREATE INDEX "patent_applicant_idx" ON "patent"("applicant");
CREATE INDEX "patent_inventors_idx" ON "patent"("inventors");

ALTER TABLE "patent"
  ADD CONSTRAINT "patent_applicant_fkey"
  FOREIGN KEY ("applicant") REFERENCES "patent_applicant"("applicant")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "patent"
  ADD CONSTRAINT "patent_inventors_fkey"
  FOREIGN KEY ("inventors") REFERENCES "patent_inventor"("inventor")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 환경별 앱 롤 이름을 하드코딩하지 않고 기존 patent_target 권한을 복사한다.
DO $$
DECLARE
  grant_row record;
BEGIN
  FOR grant_row IN
    SELECT DISTINCT grantee, privilege_type
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = 'patent_target'
      AND grantee NOT IN ('PUBLIC', current_user)
  LOOP
    EXECUTE format(
      'GRANT %s ON TABLE patent_applicant, patent_inventor TO %I',
      grant_row.privilege_type,
      grant_row.grantee
    );
  END LOOP;

  FOR grant_row IN
    SELECT DISTINCT grantee
    FROM information_schema.role_usage_grants
    WHERE object_schema = 'public'
      AND object_name = 'patent_target_id_seq'
      AND grantee NOT IN ('PUBLIC', current_user)
  LOOP
    EXECUTE format(
      'GRANT USAGE ON SEQUENCE patent_applicant_id_seq, patent_inventor_id_seq TO %I',
      grant_row.grantee
    );
  END LOOP;
END
$$;
