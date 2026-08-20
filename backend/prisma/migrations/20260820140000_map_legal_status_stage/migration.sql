-- 운영 DB에 실제로 존재하는 legal_status 4종을 진행 단계에 연결한다.
-- (2026-08-20 기준: 출원 2건 / 등록 2건 / 취하간주 2건 / "출원 (File closing)" 1건)
--
-- 값이 Google Sheets 원문이라 줄바꿈이 섞여 있다("출원\n(File closing)"). 그래서
-- 공백을 한 칸으로 정규화해 비교한다. 이미 사람이 매핑해 둔 행은 덮어쓰지 않도록
-- stage_code IS NULL 조건을 둔다.
--
-- 정의와 판단 근거는 docs/patent_stage_definitions.md.

UPDATE "legal_status"
SET "stage_code" = 'FILED'
WHERE "stage_code" IS NULL
  AND regexp_replace(btrim("status"), '\s+', ' ', 'g') = '출원';

UPDATE "legal_status"
SET "stage_code" = 'REGISTERED'
WHERE "stage_code" IS NULL
  AND regexp_replace(btrim("status"), '\s+', ' ', 'g') = '등록';

UPDATE "legal_status"
SET "stage_code" = 'CLOSED'
WHERE "stage_code" IS NULL
  AND regexp_replace(btrim("status"), '\s+', ' ', 'g') = '취하간주';

-- "출원 (File closing)"은 라벨은 출원이지만 File closing이 붙은 건이다. 운영 시트의
-- 해당 건(A22W001, PCT)은 "개별국 진입 X"로 관리가 끝난 상태여서 종결로 본다.
-- IP팀 판단이 다르면 이 한 줄만 'FILED'로 바꾸면 된다.
UPDATE "legal_status"
SET "stage_code" = 'CLOSED'
WHERE "stage_code" IS NULL
  AND regexp_replace(btrim("status"), '\s+', ' ', 'g') = '출원 (File closing)';
