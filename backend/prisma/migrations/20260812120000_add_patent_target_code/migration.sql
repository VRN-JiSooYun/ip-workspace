-- 기존 자유 문자열 Target을 관리 가능한 코드 테이블로 승격한다.
CREATE TABLE "patent_target" (
    "id" SERIAL NOT NULL,
    "target" TEXT NOT NULL,

    CONSTRAINT "patent_target_pkey" PRIMARY KEY ("id")
);

-- 공백뿐인 기존 값은 코드가 아니므로 NULL로 정리한다.
UPDATE "patent"
SET "target" = NULL
WHERE "target" IS NOT NULL AND BTRIM("target") = '';

-- 사용 중인 기존 Target은 모두 보존해 코드 목록의 초기값으로 삼는다.
INSERT INTO "patent_target" ("target")
SELECT DISTINCT "target"
FROM "patent"
WHERE "target" IS NOT NULL
ORDER BY "target";

CREATE UNIQUE INDEX "patent_target_target_key"
ON "patent_target"("target");

CREATE INDEX "patent_target_idx" ON "patent"("target");

ALTER TABLE "patent"
ADD CONSTRAINT "patent_target_fkey"
FOREIGN KEY ("target") REFERENCES "patent_target"("target")
ON DELETE SET NULL ON UPDATE CASCADE;
