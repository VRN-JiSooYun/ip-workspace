-- 새로 만든 patent_stage / patent_stage_group에 앱 롤 권한을 붙인다.
--
-- 마이그레이션을 소유자 롤로 적용하면 새 테이블에는 앱 롤 권한이 따라오지 않아
-- 런타임에 "permission denied for table patent_stage_group"이 난다. 환경마다 롤
-- 이름이 달라 하드코딩할 수 없으므로, 같은 스키마의 기존 테이블(legal_status)에
-- 부여된 권한을 그대로 복사한다. GRANT는 멱등이라 재실행해도 안전하다.
DO $$
DECLARE
  target_tables CONSTANT text := 'patent_stage, patent_stage_group';
  grant_row record;
  granted_count int := 0;
BEGIN
  FOR grant_row IN
    SELECT DISTINCT grantee, privilege_type
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = 'legal_status'
      -- PUBLIC은 키워드라 %I로 따옴표를 씌우면 안 되고, 소유자는 이미 전권이다.
      AND grantee NOT IN ('PUBLIC', current_user)
  LOOP
    EXECUTE format(
      'GRANT %s ON TABLE %s TO %I',
      grant_row.privilege_type,
      target_tables,
      grant_row.grantee
    );
    granted_count := granted_count + 1;
  END LOOP;

  IF granted_count = 0 THEN
    RAISE NOTICE 'legal_status에 복사할 GRANT가 없다. 앱과 마이그레이션이 같은 롤을 쓰는 환경으로 본다.';
  END IF;
END
$$;
