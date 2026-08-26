-- 대시보드 기한 보드/KPI가 expected_expiry_date를 범위로 조회한다
-- (GET /api/patent-records/deadlines, /summary).
--
-- 다른 날짜 column(application_date, publication_date)에는 이미 index가 있는데
-- expected_expiry_date만 빠져 있어 만료 임박 집계가 full scan이 된다.
-- IF NOT EXISTS로 두어 재실행에 안전하게 만든다.
CREATE INDEX IF NOT EXISTS "patent_expected_expiry_date_idx"
  ON "patent"("expected_expiry_date");
