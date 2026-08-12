# 관리 특허 To-do CRUD 구현 보고서

## 작업 목적

관리 특허 1건에 여러 To-do를 할당하고 제목, 설명, 마감일, 완료 여부를 CRUD할 수 있는 UI와 API를 제공한다. 이번 단계에서는 알림을 발송하지 않지만, 향후 알림 설정이 개별 To-do를 참조할 수 있는 독립 ID 구조로 만든다.

## 변경 내용

### DB Schema 및 migration

- `patent_todo` table을 추가했다.
  - `id`: autoincrement PK
  - `patent_id`: 관리 특허 FK
  - `title`: 할 일 제목
  - `description`: 선택 설명
  - `due_date`: 선택 마감일
  - `completed`, `completed_at`: 완료 상태와 완료 시각
  - `source_key`: 기존 단일 마감일/CSV 동기화를 위한 nullable unique 내부 key
  - `created_at`, `updated_at`: 생성·변경 시각
- 관리 특허 삭제 시 연결된 To-do가 함께 삭제되도록 `ON DELETE CASCADE`를 적용했다.
- 미완료 마감 조회를 위해 `(completed, due_date)` index를 추가했다.
- 기존 `patent.todo_due_date`가 있는 행은 `기존 To-do`라는 제목으로 자동 이관한다.

### To-do CRUD API

- `GET /api/patent-todos?patentId=<id>`: 특허별 전체 To-do 조회
- `POST /api/patent-todos`: To-do 추가
- `PATCH /api/patent-todos/:id`: 제목·설명·마감일·완료 상태 변경
- `DELETE /api/patent-todos/:id`: To-do 삭제
- 조회는 `patentAnalysis.read`, 변경은 `patentAnalysis.manage` 권한을 요구한다.
- 완료 처리 시 `completed_at`을 기록하고 완료를 취소하면 비운다.

### Patent Management UI

- `관리 특허` 행 작업 영역에 `To-do 관리` 버튼을 추가했다.
- To-do 관리 modal에서 제목·설명·마감일 추가, 편집, 완료 상태 변경, 삭제를 제공한다.
- 완료 항목은 취소선으로 표시한다.
- To-do 변경 후 왼쪽 일정과 To-do 요약을 즉시 다시 조회한다.

### 일정·To-do 요약 연동

- 기존 `patent.todo_due_date` 직접 조회를 `patent_todo` 조회로 전환했다.
- 달력에는 마감일이 있고 미완료인 To-do만 표시한다.
- 왼쪽 To-do 요약에는 미완료 항목 중 최근 기한 경과 3건과 가까운 예정 7건을 표시한다.
- 여러 To-do가 같은 특허나 같은 날짜에 있어도 개별 `todoId`로 구분한다.
- Target 선택 시 연결 특허의 Target을 기준으로 일정과 To-do를 함께 필터링한다.

### CSV 호환

- 기존 CSV의 `To-do 마감일` column은 계속 지원한다.
- CSV 적용 시 `source_key=PATENT_TODO_DUE_DATE:<patentId>` 항목을 upsert해 반복 업로드에도 중복 생성되지 않는다.
- CSV에서 마감일을 비우면 해당 source To-do를 제거한다.
- UI에서 직접 만든 To-do는 `source_key=NULL`이라 CSV 동기화의 영향을 받지 않는다.

## 향후 알림 연동 기준

- 알림 설정은 `patent_todo.id`를 FK로 참조하도록 확장할 수 있다.
- 알림 채널, 사전 알림 시간, 수신자, 발송 상태/이력은 이번 범위에 포함하지 않았다.
- To-do CRUD와 알림 발송 책임을 분리해 알림 추가 시 기존 To-do 데이터 모델을 변경하지 않도록 했다.

## Schema·Migration·ERD 정합성

- Prisma: `PatentTodo` model과 `Patent.todos` relation 반영
- Migration: table, 기존 데이터 이관, unique/index/FK/cascade 정책 반영
- ERD: `patent ||--o{ patent_todo` 관계와 전체 column/table 설명 반영
- schema, migration, ERD의 table/column명, nullability, FK와 cascade 정책이 일치함을 정적으로 확인했다.

## 검증 결과

- 변경 파일에 대해 `git diff --check`를 통과했다.
- To-do API DTO와 프론트엔드 payload의 제목 200자, 설명 2,000자, nullable 마감일 계약을 확인했다.
- 생성·수정·완료·완료 취소·삭제 후 일정 재조회 흐름을 정적으로 확인했다.
- 기존 `todo_due_date` 이관과 CSV upsert가 동일한 `source_key` 규칙을 사용하는 것을 확인했다.
- 관련 파일 외 사용자의 기존 변경은 수정하지 않았다.

## 미실행 항목

- 저장소 지침에 따라 Prisma migration 실행, client 생성, 빌드, 테스트, 개발 서버 실행은 수행하지 않았다.
- 실제 DB에서 migration 적용 후 기존 마감일 이관과 CRUD 동작을 확인해야 한다.
