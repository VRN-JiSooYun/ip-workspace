-- IP팀 운영 시트에만 있고 DB에는 없던 항목들을 patent에 추가한다.
-- CSV 템플릿의 컬럼 순서가 시트를 그대로 따르게 되면서, 이 컬럼들이 없으면
-- import 시 값이 조용히 버려진다.
--
-- 전부 nullable이라 기존 행에 영향이 없다.
ALTER TABLE "patent"
    ADD COLUMN "target"               TEXT,
    ADD COLUMN "inventors"            TEXT,
    ADD COLUMN "status_note"          TEXT,
    ADD COLUMN "todo_due_date"        TIMESTAMP(3),
    ADD COLUMN "relation_type"        TEXT,
    ADD COLUMN "license_agreement"    TEXT,
    ADD COLUMN "rights_change"        TEXT,
    ADD COLUMN "share_agreement"      TEXT,
    ADD COLUMN "expected_expiry_date" TIMESTAMP(3),
    ADD COLUMN "note"                 TEXT;
