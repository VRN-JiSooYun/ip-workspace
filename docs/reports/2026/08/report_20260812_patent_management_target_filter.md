# Patent Management Target DB 필터 구현 보고서

## 작업 목적

특허 관리 화면의 `Target` 카드에 있던 프론트엔드 목업 목록을 제거하고, `patent.target`에 실제 저장된 Target과 건수를 표시한다. 선택한 Target에 해당하는 `관리 특허`만 서버에서 조회하도록 연결한다.

## 변경 내용

### Backend

- `GET /api/patent-records/targets`를 추가했다.
  - `patent.target`을 값별로 그룹화한다.
  - Target이 `NULL` 또는 빈 문자열인 행은 목록에서 제외한다.
  - 응답은 `{ target, count }[]`이며 기본 정렬은 Target 이름 오름차순이다.
- `GET /api/patent-records`에 반복 query parameter `targets`를 추가했다.
  - 예: `?targets=EGFR&targets=KRAS`
  - 여러 값은 `target IN (...)` 조건, 즉 OR 의미로 적용한다.
  - `targets`가 없거나 유효한 값이 하나도 없으면 Target 조건 없이 전체를 조회한다.
  - 값당 최대 200자, 최대 100개로 검증한다.

### Frontend API

- `PatentRecord` 타입에 DB 응답의 `target` 필드를 반영했다.
- `patentRecordApi.targets()`를 추가했다.
- 배열 query parameter를 같은 key의 반복 형식으로 직렬화하도록 목록 query 생성기를 확장했다.

### Patent Management UI

- `COMPOUNDS` 목업과 초기 선택값을 제거했다.
- 화면 진입 시 DB Target 목록과 각 Target의 관리 특허 건수를 조회한다.
- Target을 선택하거나 해제하면 다음 동작을 수행한다.
  - `관리 특허` 탭으로 자동 전환
  - 목록 page를 1로 초기화
  - 선택된 Target 조건으로 관리 특허 API 재조회
- Target을 여러 개 선택하면 선택값 중 하나에 해당하는 관리 특허를 합쳐서 보여준다.
- 모든 Target을 해제하면 전체 관리 특허를 보여준다.
- Target 이름 검색, 이름순/건수순 정렬, 긴 목록 스크롤, 로딩·오류·빈 결과 상태를 추가했다.
- CSV 적용, 관리 특허 추가·수정·삭제 후 Target 목록과 건수를 다시 조회한다.

## DB Schema·Migration·ERD 정합성

- 기존 `patent.target` 컬럼을 조회 및 필터에 사용했으며 table, column, constraint, index, relation은 변경하지 않았다.
- 따라서 Prisma schema, migration SQL, ERD 변경은 없다.

## 검증 결과

- 변경 파일에 대해 `git diff --check`를 통과했다.
- 프론트엔드의 반복 `targets` 직렬화와 백엔드 DTO 배열 변환 형식이 일치함을 정적으로 확인했다.
- Target 선택 없음/단일 선택/복수 선택에 대한 조회 조건 분기를 정적으로 확인했다.
- 정적 route인 `/targets`가 동적 `/:id`보다 앞에 선언되어 있음을 확인했다.
- 관련 파일 외 사용자의 기존 변경은 수정하지 않았다.

## 미실행 항목

- 저장소 지침에 따라 빌드, 테스트, 개발 서버 및 DB 연결 실행은 수행하지 않았다.
- 실제 DB 데이터에 대한 Target 집계 및 브라우저 UI 동작은 사용자가 실행 환경에서 확인해야 한다.
