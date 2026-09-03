-- 일정에 관리 특허를 연결한다. 선택 사항이므로 NULL을 허용하고, 특허가 지워지면
-- 연결만 끊는다(ON DELETE SET NULL) — 일정 자체는 사람이 만든 값이라 남겨야 한다.
ALTER TABLE "calendar_event" ADD COLUMN "patent_id" INTEGER;

ALTER TABLE "calendar_event"
  ADD CONSTRAINT "calendar_event_patent_id_fkey"
  FOREIGN KEY ("patent_id") REFERENCES "patent"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "calendar_event_patent_id_idx" ON "calendar_event"("patent_id");
