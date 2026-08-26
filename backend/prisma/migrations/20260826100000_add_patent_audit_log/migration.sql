-- 관리 특허의 변경 이력과 타임스탬프.
--
-- 지금까지 patent에는 감사 로그도 updated_at도 없어서 "어제 등록번호가 바뀌었는데 누가
-- 바꿨나"에 답할 수 없었다. 화면(모달)에서 필드를 고칠 때마다 이력을 남기고, 활동 피드로
-- 되짚을 수 있게 한다.

-- ---------------------------------------------------------------------------
-- 1) patent에 타임스탬프
-- ---------------------------------------------------------------------------
-- 기존 행의 실제 등록 시점은 어디에도 없다. NOT NULL을 채우려면 값이 필요하므로 마이그레이션
-- 시점을 넣는다. 즉 이 시점 이전에 만들어진 행의 created_at은 "언제 만들어졌는지 모른다"는
-- 뜻이고, 화면에서 그 이전 값을 등록 시점으로 읽으면 안 된다.
ALTER TABLE "patent"
ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ---------------------------------------------------------------------------
-- 2) patent_audit_log
-- ---------------------------------------------------------------------------
-- auth_audit_log와 나란한 개념이지만 별도 테이블이다. 그쪽은 사용자를 축으로 색인돼 있어
-- "이 특허의 이력"을 물으려면 metadata JSON을 훑어야 하고, 화면의 활동 피드는 그 접근을
-- 쓸 수 없다.
CREATE TABLE "patent_audit_log" (
    "id" UUID NOT NULL,
    -- 특허를 지워도 이력은 남긴다(ON DELETE SET NULL). "지웠다"는 기록까지 함께 사라지면
    -- 감사 로그의 뜻이 없다. 어느 건이었는지는 metadata의 출원번호로 읽는다.
    "patent_id" INTEGER,
    "actor_user_id" UUID,
    -- PATENT_CREATED | PATENT_FIELD_CHANGED | PATENT_IMPORTED | PATENT_DELETED
    "event_type" TEXT NOT NULL,
    -- 바뀐 컬럼 이름. PATENT_FIELD_CHANGED에만 있다.
    "field" TEXT,
    -- 코드 id가 아니라 사람이 읽는 값으로 굳혀 둔다. '1 → 2'는 피드에서 뜻이 없고,
    -- 코드 표의 이름이 나중에 바뀌면 과거 이력의 뜻까지 흔들린다.
    "before_value" TEXT,
    "after_value" TEXT,
    -- 한 요청에서 나온 행들을 묶는다. 화면이 한 덩이로 그린다.
    "request_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patent_audit_log_pkey" PRIMARY KEY ("id")
);

-- 활동 피드는 늘 "이 특허의 최신순"을 묻는다.
CREATE INDEX "patent_audit_log_patent_id_created_at_idx"
ON "patent_audit_log"("patent_id", "created_at");

CREATE INDEX "patent_audit_log_actor_user_id_created_at_idx"
ON "patent_audit_log"("actor_user_id", "created_at");

CREATE INDEX "patent_audit_log_created_at_idx"
ON "patent_audit_log"("created_at");

ALTER TABLE "patent_audit_log"
ADD CONSTRAINT "patent_audit_log_patent_id_fkey"
FOREIGN KEY ("patent_id") REFERENCES "patent"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- 사용자가 탈퇴해도 이력은 남는다. 행위자만 비워진다.
ALTER TABLE "patent_audit_log"
ADD CONSTRAINT "patent_audit_log_actor_user_id_fkey"
FOREIGN KEY ("actor_user_id") REFERENCES "user"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 3) 새 테이블에 앱 롤 권한
-- ---------------------------------------------------------------------------
-- 마이그레이션을 소유자 롤로 적용하면 새 테이블에는 앱 롤 권한이 따라오지 않아 런타임에
-- "permission denied for table patent_audit_log"가 난다. 환경마다 롤 이름이 달라
-- 하드코딩할 수 없으므로, 같은 스키마의 기존 테이블(patent)에 부여된 권한을 그대로
-- 복사한다. GRANT는 멱등이라 재실행해도 안전하다.
-- (20260825120000_add_calendar_event와 같은 방식이다.)
DO $$
DECLARE
  grant_row record;
  granted_count int := 0;
BEGIN
  FOR grant_row IN
    SELECT DISTINCT grantee, privilege_type
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = 'patent'
      -- PUBLIC은 키워드라 %I로 따옴표를 씌우면 안 되고, 소유자는 이미 전권이다.
      AND grantee NOT IN ('PUBLIC', current_user)
  LOOP
    EXECUTE format(
      'GRANT %s ON TABLE patent_audit_log TO %I',
      grant_row.privilege_type,
      grant_row.grantee
    );
    granted_count := granted_count + 1;
  END LOOP;

  IF granted_count = 0 THEN
    RAISE NOTICE 'patent에 복사할 GRANT가 없다. 앱과 마이그레이션이 같은 롤을 쓰는 환경으로 본다.';
  END IF;
END
$$;
