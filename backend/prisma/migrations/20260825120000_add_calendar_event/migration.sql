-- 대시보드 일정 위젯의 사용자 일정.
--
-- 지금까지는 브라우저(localStorage)에만 있었다. 기기를 옮기면 따라오지 않고 팀과 나눌 수도
-- 없어서 서버로 옮긴다. 기존 브라우저 값은 검증용이라 이관하지 않는다.
CREATE TYPE "CalendarEventVisibility" AS ENUM ('PRIVATE', 'TEAM');

CREATE TABLE "calendar_event" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    -- visibility가 TEAM일 때만 채워진다.
    "team_id" UUID,
    "visibility" "CalendarEventVisibility" NOT NULL DEFAULT 'PRIVATE',
    "title" TEXT NOT NULL,
    -- 달력이 다루는 것은 "며칠"이라 시각 없는 date다. timestamp면 시간대에 따라 하루가 밀린다.
    "start_date" DATE NOT NULL,
    -- 종료일은 그날을 포함한다.
    "end_date" DATE NOT NULL,
    "all_day" BOOLEAN NOT NULL DEFAULT true,
    -- 'HH:mm' 벽시계 시각. 종일이면 둘 다 NULL이다.
    "start_time" VARCHAR(5),
    "end_time" VARCHAR(5),
    "color" VARCHAR(20) NOT NULL DEFAULT 'purple',
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_event_pkey" PRIMARY KEY ("id")
);

-- 목록 조회는 늘 "기간이 겹치는 것"을 묻는다(내 것 또는 내 팀 것).
CREATE INDEX "calendar_event_owner_id_start_date_end_date_idx"
ON "calendar_event"("owner_id", "start_date", "end_date");

CREATE INDEX "calendar_event_team_id_start_date_end_date_idx"
ON "calendar_event"("team_id", "start_date", "end_date");

ALTER TABLE "calendar_event"
ADD CONSTRAINT "calendar_event_owner_id_fkey"
FOREIGN KEY ("owner_id") REFERENCES "user"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "calendar_event"
ADD CONSTRAINT "calendar_event_team_id_fkey"
FOREIGN KEY ("team_id") REFERENCES "team"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- 새 테이블에 앱 롤 권한을 붙인다.
--
-- 마이그레이션을 소유자 롤로 적용하면 새 테이블에는 앱 롤 권한이 따라오지 않아 런타임에
-- "permission denied for table calendar_event"가 난다. 환경마다 롤 이름이 달라 하드코딩할
-- 수 없으므로, 같은 스키마의 기존 테이블(team)에 부여된 권한을 그대로 복사한다.
-- GRANT는 멱등이라 재실행해도 안전하다.
-- (20260820150000_grant_patent_stage_privileges와 같은 방식이다.)
DO $$
DECLARE
  grant_row record;
  granted_count int := 0;
BEGIN
  FOR grant_row IN
    SELECT DISTINCT grantee, privilege_type
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = 'team'
      -- PUBLIC은 키워드라 %I로 따옴표를 씌우면 안 되고, 소유자는 이미 전권이다.
      AND grantee NOT IN ('PUBLIC', current_user)
  LOOP
    EXECUTE format(
      'GRANT %s ON TABLE calendar_event TO %I',
      grant_row.privilege_type,
      grant_row.grantee
    );
    granted_count := granted_count + 1;
  END LOOP;

  IF granted_count = 0 THEN
    RAISE NOTICE 'team에 복사할 GRANT가 없다. 앱과 마이그레이션이 같은 롤을 쓰는 환경으로 본다.';
  END IF;
END
$$;
