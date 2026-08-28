# Patent Search NOT literal 판정 수정

## 현상

의견서 `EGFR` 포함 + 의견서 `진보성` 제외 조건으로 matches API를 호출해도 결과의 의견서
본문에서 `진보성`이 보였다.

## 원인

- 기존 SQL의 범위는 `NOT EXISTS`로 올바르게 OA 전체 의견서를 검사하고 있었다.
- 다만 제외 여부도 ParadeDB BM25의 `content @@@ query`로 판정했다.
- BM25 analyzer의 token 판정은 원문에 입력 문자열이 실제로 포함되어 있는지와 같지 않다.
- OA DB에서 해당 payload를 재현한 결과, BM25 NOT 결과 102건 중 64건의 의견서에 실제
  `진보성` 문자열이 있었다.

## 변경 내용

- AND 포함 조건과 관련도 계산은 기존 BM25 인덱스를 유지했다.
- NOT 조건만 `strpos(lower(content), lower(query)) > 0`인 literal substring 판정으로
  변경했다.
- opinion/amendment는 같은 OA에 속한 해당 type response 중 하나라도 문자열이 있으면
  `NOT EXISTS`에 의해 OA 전체를 제외한다.
- officeAction NOT도 동일한 대소문자 무시 literal 규칙을 적용했다.
- 포함 조건으로 OA를 먼저 좁히고 해당 OA의 제외 대상 문서만 materialize해, 전체 response
  본문에 대소문자 변환을 수행하는 비용을 피했다.
- response와 officeAction의 NOT SQL 생성을 확인하는 단위 테스트를 보강했다.

## 확인 결과

- 의견서 `EGFR` 포함 + 의견서 `진보성` 제외 조건은 38건으로 줄었다.
- 최적화 전 literal 쿼리는 약 3.73초였고, 후보 문서 materialize 적용 후 약 0.72초로 줄어
  OA DB의 5초 statement timeout 안에 들어왔다.
- DB schema, migration 및 ERD 변경은 없다.
- 저장소 지침에 따라 프로젝트 빌드와 테스트 러너 실행은 수행하지 않았다.
