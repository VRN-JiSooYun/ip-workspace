# Patent Search 전체 경량 매칭 API

## 작업 목적

키워드 결과를 100건씩 반복 호출하고 모든 page가 끝날 때까지 UI가 보이지 않던 흐름을 단일 경량 응답으로 교체한다.

## 원인

- 외부 FastAPI `/patents/search`는 page/size 방식만 제공하며 경량 endpoint가 없다.
- 기존 프런트는 첫 응답의 total을 기준으로 나머지 page를 최대 4개씩 요청했다.
- 모든 요청이 끝난 뒤에만 기준 목록을 구성해 결과가 많으면 UI가 수분간 loading 상태에 머물 수 있었다.
- 외부 OpenAPI를 확인한 결과 `/patents/search` 외의 검색 endpoint는 제공되지 않았다.

## 변경 내용

- `POST /api/patent-search/matches`를 추가했다.
- OA PostgreSQL의 기존 ParadeDB BM25 인덱스로 `officeAction`, `opinion`, `amendment` target을 검색한다.
- 한 condition 내부의 token은 ALL, OR로 이어진 condition은 합집합, AND 그룹 사이는 OA ID
  교집합으로 처리한다.
- NOT 조건은 BM25 token 매칭이 아니라 target 본문의 대소문자 무시 literal substring으로
  확인해 차집합 처리한다. ParadeDB analyzer가 본문에 보이는 문자열을 매칭하지 못해 제외 대상이
  결과에 남는 불일치를 방지한다.
- 포함 조건으로 좁힌 OA의 target 문서만 materialize한 뒤 NOT 문자열을 검사해 전체 response
  본문에 반복적으로 `lower`를 적용하지 않는다.
- 포함 조건별 score 평균을 관련도로 반환한다. response target은 OA별 최고 BM25 score를 쓰고,
  OR 그룹은 대안 중 최고 score, 다중 단어 exact phrase에는 별도 관련도 보너스를 적용한다.
- 응답은 전체 `officeActionId`, `relevanceScore`, `total`만 포함하고 본문과 카드 관계 데이터는 포함하지 않는다.
- 프런트의 100건 page 반복 호출과 동시성 loop를 제거하고 matches endpoint를 검색 버튼 클릭 시 한 번만 호출한다.
- 받은 ID를 기존 content 없는 OA 인덱스와 결합해 상세 필터와 UI 페이지네이션은 계속 프런트에서 처리한다.
- 기존 page 기반 `POST /api/patent-search`는 다른 호출자의 호환성을 위해 유지한다.

## 성능 및 검증

- OA DB에 `office_action.content`, `response.content`용 BM25 인덱스가 존재함을 확인했다.
- OA DB의 5초 statement timeout과 같은 조건에서 `진보성` 1,343건 전체 ID 및 관련도 정렬 쿼리를 실행했다.
- 실행 시간은 약 53ms였고 BM25 인덱스가 사용됐다.
- 의견서 `EGFR` 포함 결과에서 의견서 `진보성`을 BM25 NOT으로 제외했을 때 102건 중 64건에
  실제 `진보성` 문자열이 남는 현상을 재현했다.
- 같은 조건의 NOT을 literal substring 판정으로 바꾼 쿼리는 38건을 반환했고 약 0.72초에
  완료돼 OA DB의 5초 statement timeout 안에 들어왔다.
- OA·response 본문을 응답이나 JSON으로 조립하지 않는지 확인했다. NOT 및 다중 단어 phrase
  판정이 있을 때만 포함 후보로 좁힌 target 본문을 내부 CTE에서 검사한다.
- 서비스 단위 테스트에 단일 OA 검색, response target + NOT, 제외 조건 단독 거부 사례를 추가했다.
- DB schema, migration 및 ERD 변경은 없다.
- 변경 diff의 공백 오류를 확인했다.

## 미실행 항목

- 저장소 지침에 따라 프로젝트 빌드와 테스트 러너 실행은 수행하지 않았다.
