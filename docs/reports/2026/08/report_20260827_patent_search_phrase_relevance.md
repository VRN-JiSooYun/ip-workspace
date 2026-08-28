# Patent Search 다중 단어 phrase 관련도 개선

## 현상

`epidermal squamous cell carcinoma`처럼 여러 단어를 검색하면 정확한 구문보다 개별 단어가
많이 반복된 의견서가 먼저 노출됐다.

## 원인

- 기존 matches 검색은 raw query의 BM25 점수만 사용했다.
- 설치된 `pg_search 0.23.4`에서 raw query는 여러 token의 broad match로 동작한다.
- response target은 같은 OA의 여러 response 점수를 합산해 문서 수가 많은 OA에도 유리했다.
- 실데이터에서 broad 검색은 1,374 response였지만 exact phrase는 2 response뿐이었다.
- 기존 상위 20건에서 두 exact phrase 문서는 각각 4위와 7위였다.

## 최초 변경 내용

- 당시에는 broad BM25 후보 집합을 그대로 유지했다.
- 공백으로 구분된 다중 단어 query만 phrase-aware scoring을 적용한다.
- BM25 후보에 속한 target 문서만 materialize하고, 대소문자를 무시한 원문 exact phrase를
  검사한다.
- exact phrase OA에는 `해당 조건의 최고 BM25 점수 + 1`을 보너스로 더해 모든 non-phrase
  결과보다 먼저 정렬되도록 했다.
- response target의 OA별 점수 집계는 `sum`에서 `max`로 바꿔 response 문서 개수에 따른
  랭킹 왜곡을 제거했다.
- 단일 단어 검색과 NOT literal 판정 방식은 유지했다.

## 최초 성능 및 검증

- `epidermal squamous cell carcinoma` broad 결과는 변경 전과 동일한 1,233 OA다.
- exact phrase 2개 OA가 최상위 tier로 승격되는 조합을 OA DB에서 확인했다.
- 별도 BM25 phrase query를 추가하는 방식은 약 4.09초였고, 후보 문서 literal 판정 방식은
  약 2.55초로 OA DB의 5초 statement timeout 안에 들어왔다.
- DB schema, migration 및 ERD 변경은 없다.
- 저장소 지침에 따라 프로젝트 빌드와 테스트 러너 실행은 수행하지 않았다.

## 2026-08-28 현재 동작

- 기획 원칙에 맞춰 다중 token 후보를 broad OR에서 `conjunction_mode => true`인 ALL semantics로
  변경했다.
- 따라서 위 최초 검증의 1,233 OA recall 유지 정책은 더 이상 현재 동작이 아니다.
- 같은 예시는 모든 token을 가진 5개 response, 4개 OA만 후보가 되고 exact phrase 2개 OA가
  상단에 놓인다.
- 최종 ALL + phrase SQL은 5초 statement timeout 아래에서 약 1.64초였다.
