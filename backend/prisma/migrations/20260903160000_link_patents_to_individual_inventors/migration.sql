-- 기존 patent.inventors의 쉼표 구분 문자열을 발명자 개인으로 분리하고,
-- 특허와 발명자를 다대다 연결로 전환한다.
CREATE TABLE "patent_inventor_link" (
    "patent_id" INTEGER NOT NULL,
    "inventor_id" INTEGER NOT NULL,
    "ordinal" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "patent_inventor_link_pkey" PRIMARY KEY ("patent_id", "inventor_id")
);

CREATE INDEX "patent_inventor_link_inventor_id_idx"
ON "patent_inventor_link"("inventor_id");

ALTER TABLE "patent_inventor_link"
  ADD CONSTRAINT "patent_inventor_link_patent_id_fkey"
  FOREIGN KEY ("patent_id") REFERENCES "patent"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "patent_inventor_link"
  ADD CONSTRAINT "patent_inventor_link_inventor_id_fkey"
  FOREIGN KEY ("inventor_id") REFERENCES "patent_inventor"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 운영 시트의 발명자 셀은 쉼표를 기본 구분자로 쓰며, 전각 쉼표·일본식 구분점·세미콜론·
-- 개행도 함께 허용한다. 빈 조각은 버리고 사람 이름만 코드 테이블에 등록한다.
WITH split_inventors AS (
  SELECT DISTINCT trim(parts.name) AS inventor
  FROM "patent" AS p
  CROSS JOIN LATERAL regexp_split_to_table(
    p."inventors",
    E'\\s*[,，、;\\n\\r]+\\s*'
  ) AS parts(name)
  WHERE p."inventors" IS NOT NULL
    AND trim(parts.name) <> ''
)
INSERT INTO "patent_inventor" ("inventor")
SELECT inventor
FROM split_inventors
ON CONFLICT ("inventor") DO NOTHING;

WITH split_inventors AS (
  SELECT
    p."id" AS patent_id,
    trim(parts.name) AS inventor,
    parts.ordinality::INTEGER - 1 AS ordinal
  FROM "patent" AS p
  CROSS JOIN LATERAL regexp_split_to_table(
    p."inventors",
    E'\\s*[,，、;\\n\\r]+\\s*'
  ) WITH ORDINALITY AS parts(name, ordinality)
  WHERE p."inventors" IS NOT NULL
    AND trim(parts.name) <> ''
)
INSERT INTO "patent_inventor_link" ("patent_id", "inventor_id", "ordinal")
SELECT split_inventors.patent_id, inventor.id, split_inventors.ordinal
FROM split_inventors
JOIN "patent_inventor" AS inventor
  ON inventor."inventor" = split_inventors.inventor
ON CONFLICT ("patent_id", "inventor_id") DO NOTHING;

ALTER TABLE "patent" DROP CONSTRAINT IF EXISTS "patent_inventors_fkey";
DROP INDEX IF EXISTS "patent_inventors_idx";
ALTER TABLE "patent" DROP COLUMN "inventors";

-- 최초 코드 마이그레이션이 만든 '여러 명을 합친 코드'만 정리한다. 직접 등록한 개인 코드와
-- 위에서 분리해 실제 연결된 코드는 보존한다.
DELETE FROM "patent_inventor" AS inventor
WHERE inventor."inventor" ~ E'[,，、;\\n\\r]'
  AND NOT EXISTS (
    SELECT 1
    FROM "patent_inventor_link" AS link
    WHERE link."inventor_id" = inventor."id"
  );

-- 환경별 앱 role 이름을 하드코딩하지 않고 patent 테이블의 권한을 연결 테이블에 복사한다.
DO $$
DECLARE
  grant_row record;
BEGIN
  FOR grant_row IN
    SELECT DISTINCT grantee, privilege_type
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = 'patent'
      AND grantee NOT IN ('PUBLIC', current_user)
  LOOP
    EXECUTE format(
      'GRANT %s ON TABLE patent_inventor_link TO %I',
      grant_row.privilege_type,
      grant_row.grantee
    );
  END LOOP;
END
$$;
