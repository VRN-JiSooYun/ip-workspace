# Patent Management 일정·To-do DB 연동 보고서

## 작업 목적

특허 관리 화면의 고정 2024년 목업 달력과 To-do 목록을 제거하고, `patent` table에 실제 저장된 날짜를 기준으로 일정 및 마감 정보를 제공한다.

## 변경 내용

### 일정 API

- `GET /api/patent-records/schedule`를 추가했다.
- 요청 parameter:
  - `year`: 2000~2100
  - `month`: 1~12
  - `targets`: 선택 사항, 반복 parameter로 복수 Target 필터 지원
- 월별 일정에 포함하는 `patent` column:
  - `application_date`: 출원일
  - `registration_date`: 등록일
  - `publication_date`: 공개일
  - `int_application_date`: 국제출원일
  - `int_publication_date`: 국제공개일
  - `exam_date`: 심사일
  - `todo_due_date`: To-do 마감일
  - `expected_expiry_date`: 예상 만료일
- `registration_date`는 text column이므로 `YYYY-MM-DD` 또는 `YYYY.MM.DD` 형식으로 유효하게 해석되는 값만 포함한다.
- To-do 응답은 `todo_due_date`가 있는 특허를 대상으로 한다.
  - 최근 기한 경과 3건
  - 오늘 이후 가까운 마감 7건
  - 전체 마감 등록 건수
- `patent`에는 To-do 완료 여부 column이 없으므로 완료/미완료를 판별하지 않고 `todo_due_date`가 있는 행을 모두 대상으로 한다.
- To-do의 오늘 기준은 서비스 운영 시간대인 `Asia/Seoul`로 계산한다.

### 일정 UI

- 고정 `2024년 5월`과 목업 일정 표시를 제거했다.
- 진입 시 현재 연·월을 표시하고 이전 달/다음 달 버튼으로 API를 다시 조회한다.
- 실제 일정이 있는 날짜를 브랜드 색상으로 표시한다.
- 날짜 hover/focus 시 일정 종류와 관리번호를 tooltip으로 제공한다.
- 날짜를 선택하면 달력 아래에 해당 날짜의 일정 종류, 관리번호/출원번호, 국가를 표시한다.
- 로딩, 오류, 선택 날짜의 빈 일정 상태를 처리한다.

### To-do UI

- 고정 `DEADLINES` 목록을 제거했다.
- 실제 `todo_due_date` 기준으로 관리번호/출원번호, 국가, 마감일을 표시한다.
- 오늘을 기준으로 `D+N`, `D-Day`, `D-N`을 계산한다.
- 전체 To-do 등록 건수와 로딩·오류·빈 상태를 표시한다.

### 필터 및 갱신

- 특허 관리 화면에서 Target을 선택하면 일정과 To-do에도 같은 Target OR 필터가 적용된다.
- 특허 추가·수정·삭제 및 CSV 적용 후 일정과 To-do를 다시 조회한다.

## DB Schema·Migration·ERD 정합성

- 기존 `patent` 날짜 column만 조회하며 table, column, relation, constraint, index는 변경하지 않았다.
- 따라서 이 작업에서 추가적인 Prisma schema, migration SQL, ERD 변경은 없다.

## 검증 결과

- 변경 파일에 대해 `git diff --check`를 통과했다.
- 기존 일정 목업 상수(`DEADLINES`, `CALENDAR_YEAR`, `CALENDAR_MONTH`, `SELECTED_DAY`, `DUE_DAYS`)가 제거된 것을 확인했다.
- API DTO와 프론트엔드 query의 `year`, `month`, 반복 `targets` 계약이 일치함을 정적으로 확인했다.
- 모든 화면 날짜는 공통 `formatDisplayDateOnly`를 사용해 `YYYY.mm.dd`로 표시한다.
- 관련 파일 외 사용자의 기존 변경은 수정하지 않았다.

## 미실행 항목

- 저장소 지침에 따라 빌드, 테스트, 개발 서버 및 DB 연결 실행은 수행하지 않았다.
- 사용자는 실행 환경에서 실제 DB 데이터의 월별 표시와 Target 필터 동작을 확인해야 한다.
