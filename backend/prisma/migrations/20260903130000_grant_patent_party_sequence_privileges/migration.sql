-- 20260903120000에서 새 코드 table 권한은 복사됐지만, 기존 patent_target sequence에
-- 명시적인 USAGE grant가 없는 환경에서는 sequence 권한을 복사할 기준 행이 없었다.
-- 새 table에 INSERT 권한이 있는 앱 role을 정본으로 삼아 SERIAL sequence 권한을 보완한다.
DO $$
DECLARE
  grant_row record;
  granted_count int := 0;
BEGIN
  FOR grant_row IN
    SELECT DISTINCT grantee
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name IN ('patent_applicant', 'patent_inventor')
      AND privilege_type = 'INSERT'
      AND grantee NOT IN ('PUBLIC', current_user)
  LOOP
    EXECUTE format(
      'GRANT USAGE, SELECT ON SEQUENCE patent_applicant_id_seq, patent_inventor_id_seq TO %I',
      grant_row.grantee
    );
    granted_count := granted_count + 1;
  END LOOP;

  IF granted_count = 0 THEN
    RAISE NOTICE '새 코드 table에 INSERT 권한이 있는 별도 앱 role이 없어 sequence grant를 생략한다.';
  END IF;
END
$$;
