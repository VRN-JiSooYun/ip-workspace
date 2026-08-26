# 작업 보고서 — 대시보드 Tier 1 구현

- 작업일: 2026.08.24
- 계획서: [`plan_20260824_dashboard_tier1.md`](../../../plans/2026/08/plan_20260824_dashboard_tier1.md)
- 범위: Tier 1 위젯 4종 (기한 보드 / KPI 스트립 / 진행 현황 퍼널 / 데이터 품질)

## 채택한 결정 (계획서의 "열린 결정 사항" 4건, 전부 권장안)

| # | 결정 | 근거 |
| --- | --- | --- |
| 1 | 권한은 **위젯 단위 게이팅** | `/` 가 `/dashboard`로 리다이렉트되므로 라우트에 권한을 걸면 권한 없는 사용자가 로그인 직후 튕긴다 |
| 2 | 레이아웃 엔진을 **`components/workspace/`로 이동** | 대시보드가 `components/patent-management/` 아래서 import하는 것은 구조 냄새. 지금이 손댈 파일이 가장 적다 |
| 3 | "등록 대기" = **`stageCode = ALLOWANCE`** | 대분류 `REG`에는 이미 등록이 끝난 `REGISTERED`가 함께 들어 있어 "대기"의 뜻이 흐려진다 |
| 4 | 목록 API에 **`quality` enum 파라미터 추가** | 건수만 있고 갈 곳이 없는 품질 카드는 아무도 보지 않는다. 컬럼별 필터 난립을 막으려 단일 enum으로 |

---

## Phase 0 — 기반 정리

### 레이아웃 엔진 이동

`components/patent-management/workspace/` → `components/workspace/` (git mv 7개 파일)

```
MovableGrid.tsx  PanelFrame.tsx  Splitter.tsx  DropOverlay.tsx
AddPanelMenu.tsx  useContainerSize.ts  workspace.css
```

`PatentWorkspaceContext.tsx`와 `panels/`는 특허 관리 도메인 소유이므로 남겼다.
**엔진 리팩터링은 불필요했다** — `MovableGrid`는 이미 `root / onChange / allTabs / describeTab / renderTab`만 받는 완전 범용 컴포넌트였다. import 경로 갱신만 했다(외부 importer는 `PatentManagement.tsx`, `dev/workspaceHarness.tsx` 2곳).

### D-day CSS 분리

`utils/patentCalendar.ts`의 `ddayClassName()`이 돌려주는 `.pm-dday*` 규칙이 `pages/PatentManagement.css`에 있어 대시보드가 재사용할 수 없었다. `styles/dday.css`로 분리하고 다크 테마 변형을 추가했다(기존에는 없어서 다크에서 배지가 묻혔다).

---

## Phase 1 — 백엔드

### 마이그레이션

`20260824100000_add_patent_expected_expiry_index/` — `patent(expected_expiry_date)` 인덱스.
다른 날짜 column(`application_date`, `publication_date`)에는 이미 인덱스가 있는데 이것만 빠져 있어 만료 임박 집계가 full scan이 되던 것을 보완했다. `IF NOT EXISTS`로 재실행에 안전하다.

### 신규 엔드포인트

**`GET /api/patent-records/deadlines?from&to&targets[]&limit`**

- 마감으로 세는 것은 **두 가지뿐**: 미완료 `patent_todo.dueDate`, `patent.expectedExpiryDate`
- 출원일·공개일·등록일은 **제외**. 이미 일어난 사실이지 마감이 아니다. (등록일은 `String` column이라 범위 조회 자체가 불가능하다 — `parseRegistrationDate` 참고)
- `to`는 포함(상한을 다음 날 자정으로 잡는다)
- `limit`으로 잘려도 `total`로 전체 건수를 함께 준다 → 화면이 "N건 더 있습니다"를 정확히 표시

**`GET /api/patent-records/summary`**

KPI와 품질 집계를 한 번에 준다. 위젯마다 따로 부르면 첫 렌더에 요청이 여러 번 나가고 화면 안에서 숫자가 서로 다른 시점을 본다.

`quality` 파라미터가 들어와도 **무시한다** — 품질 조건으로 걸러 놓고 그 품질 건수를 세면 순환이다.

### 목록 `quality` 필터

`PatentStageQueryDto`에 `quality` enum 추가(목록·진행 현황 집계가 공유). `stageGroup`/`stageCode`와 달리 값을 검증한다 — DB 코드 목록이 아니라 서버가 정의한 고정 집합이고, 없는 값을 조용히 0건으로 만들면 링크 오타를 "해당 없음"으로 착각하게 된다.

### 단일 정의 원칙

`patent-quality.ts`를 새로 두어 품질 조건 표를 **한 곳에만** 뒀다. DTO와 service 양쪽이 참조한다(순환 참조를 피해 service를 import하지 않는다).

부수 효과로 `buildListWhere`의 `stageGroup === UNMAPPED` 분기도 이 표의 `unmappedStatus`를 그대로 쓰게 바꿨다. 전에는 같은 조건식이 두 곳에 복제돼 있어 한쪽만 바뀔 수 있었다.

마감 버킷 계산도 `countDeadlineBuckets()` 하나로 묶어 `deadlines`와 `summary`가 같은 함수를 쓴다. 버킷은 **서로 겹치지 않는다**(한 건이 기한 보드에 한 줄만 그려져야 한다):

```
overdue  … date <  오늘
today    … date == 오늘
within7  … 오늘   <  date <= 오늘+7
within30 … 오늘+7 <  date <= 오늘+30
```

### 테스트

`patent-record-deadlines.spec.ts` — **18건 신규, 전부 통과**.

Prisma를 통째로 가짜로 세우고 **어떤 where로 물었는지**를 검증한다(경계값이 실제 DB 없이 확인해야 하는 부분이다). `jest.mock("../database/prisma.client")`이 필요했다 — 실물 client는 import만으로 `DATABASE_URL`을 요구하고, 생성 코드가 `import.meta`를 써서 ts-jest(CJS)에서 파싱되지 않는다.

검증 항목: `to` 포함 여부, 완료 To-do 제외, Target 필터 양쪽 적용/공백 다듬기/빈 배열 무시, 버킷 4개의 정확한 경계와 비겹침, 두 원본 병합 정렬, `limit` 절단 시 `total` 정확성, `dueDate` null 제외, 만료 임박 366일 상한, `ALLOWANCE` 기준, `summary`가 `quality`를 무시하는지, 목록 `quality` 필터가 AND에 담기는지.

---

## Phase 2~3 — 프런트

### 서비스 계층

`services/patentRecordApi.ts`에 타입(`PatentDeadlineItem`, `PatentDeadlineCounts`, `PatentDeadlineResult`, `PatentSummary`, `PatentQualityFilter`)과 메서드(`deadlines`, `summary`)를 추가했다. 별도 파일을 만들지 않은 이유: 같은 컨트롤러이고 기존 `request()`/`toQueryString()` 헬퍼와 인증 실패 처리를 그대로 승계한다.

### 위젯 4종 (`components/dashboard/widgets/`)

전부 **props만 받는 순수 컴포넌트**다. 그래서 harness에서 목 데이터로 검증할 수 있다.

| 위젯 | 비고 |
| --- | --- |
| `KpiStrip` | 타일 6개. 눌러서 갈 곳이 있는 타일만 커서·hover가 붙는다(죽은 숫자와 진입점 구분) |
| `DeadlineBoard` | 버킷 4개 그룹. 국내(KR) 건만 영업일 보정 |
| `StageFunnel` | `PatentProgressPipeline`을 **그대로 재사용**. 이쪽 타일은 필터가 아니라 링크라 `isRowActive`는 항상 false |
| `DataQualityCard` | 전 항목 0이면 카드를 접는다. `patentAnalysis.manage`가 없으면 조치 링크를 감추고 건수만 |

**영업일 보정**은 `country === 'KR'`인 건에만 붙는다. `/api/holidays`에 국가 파라미터가 없어 한국 공휴일만 알기 때문이다. 해외 건에 같은 보정을 하면 틀린 날짜를 자신 있게 보여 주게 된다. 화면에서는 국가 배지로 구분한다.

`utils/patentCalendar.ts`에 `shiftDateKey()`, `nextBusinessDay()`를 추가했다. `nextBusinessDay`는 `maxLookahead`(기본 14일)를 넘으면 `null`을 돌려 보정을 포기한다 — 틀린 날짜를 보여 주는 것보다 낫다.

---

## Phase 4 — 딥링크

`PatentManagement`은 URL query param을 **전혀 읽지 않았다**. 이 단계를 빼면 KPI 타일은 눌러도 아무 일이 없는 죽은 숫자가 된다.

`utils/patentListQueryParams.ts`에 파서와 빌더를 **한 파일에** 뒀다(한쪽만 바뀌는 것을 막는다). 받는 파라미터는 백엔드 DTO에 이미 있는 것만: `q, targets, stageGroup, stageCode, countryId, legalStatusId, examStatusId, quality`.

`usePatentWorkspaceState`에서 **state 초기값으로만** 시드한다:
- effect로 나중에 넣으면 기본값으로 한 번 조회하고 다시 조회하는 왕복이 생긴다
- 계속 따라가면 사용자가 화면에서 바꾼 조건을 URL이 되돌린다

형식이 깨진 값은 조용히 버린다(저장된 배치 복원과 같은 태도).

`quality`는 select로 고를 수 없는 조건이라 `stageCode`와 같은 **닫기 가능한 칩**으로 되짚는다. UI로 지울 수 없는 조건을 URL로만 걸 수 있게 두면 사용자가 지우는 방법을 못 찾는다.

### 의도적으로 하지 않은 것

**마감 관련 KPI 타일은 목록으로 딥링크하지 않는다.** `PatentRecordListQuery`에 마감일 범위 필터가 없어 링크로 표현할 조건이 없다. 대신 같은 화면의 기한 보드 해당 버킷으로 스크롤 + 강조한다. 목록 API에 `dueDate` 필터를 넣는 것은 후속 과제로 남겼다.

---

## Phase 5 — 조립

| 파일 | 역할 |
| --- | --- |
| `config/dashboardLayout.ts` | 위젯 정의 + 저장(`dashboard-layout:{userId}:v1`). `patentWorkspaceLayout.ts`를 미러링 |
| `hooks/useDashboardState.ts` | summary/deadlines/stages 로드, Target 필터, 이동, KPI 타일 조립 |
| `components/dashboard/DashboardContext.tsx` | 위젯이 트리 어디에든 마운트되므로 props 경로가 없다 |
| `components/dashboard/panels/` | 위젯 타입 → 컴포넌트 표 + 얇은 래퍼 4개 |
| `pages/Dashboard.tsx` | 전면 재작성 |
| `pages/Dashboard.css` | 페이지 골격 + 헤더줄 |

기본 배치 — 기한 보드가 가장 넓은 자리를 받는다. 이 화면이 답해야 하는 질문("지금 뭐가 급한가")을 유일하게 직접 답하는 위젯이다.

```
column(0.16)
├── kpi (전폭, closable: false)
└── row(0.58): 기한 | column(0.5): 진행 현황 / 데이터 품질
```

**제거한 것**: 하드코딩 Documents 카드, 고정 날짜 `2025.04.14 ~ 2025.04.21`, 동작 없는 `What's New` 버튼, 미사용 `layoutPreset`/resize 리스너.

`routes.tsx`의 `// Need to Create IP Dashboard` 주석을 권한 설계 근거로 교체했다.

---

## Phase 6 — 검증 결과

실제 화면은 AuthGate(Groupware 팝업 로그인) 안이라 dev 브라우저로 열 수 없다. `workspace-harness.html` 선례를 따라 전용 harness를 만들었다.

- `frontend/dashboard-harness.html`
- `src/dev/dashboardHarness.tsx` — 실제 위젯 + 순수 함수 단정
- `src/dev/dashboardMock.ts` — 시나리오 4종(정상/빈 상태/에러/로딩)

URL: `http://localhost:5173/ip-workspace/dashboard-harness.html`

### 통과 결과

| 검증 | 결과 |
| --- | --- |
| 프런트 타입체크 (`tsc --noEmit -p tsconfig.app.json`) | **통과** |
| 백엔드 타입체크 (`tsc --noEmit -p tsconfig.json`) | **통과** |
| 백엔드 테스트 `src/patent-record` | **37건 통과** (신규 18건 포함) |
| harness 순수 함수 단정 | **21건 통과** |
| 정상 / 빈 상태 / 에러 / 로딩 | 4종 모두 확인 |
| 라이트 / 다크 | 양쪽 확인 |
| 768px 이하 세로 스택 | 확인 (KPI 타일 auto-fit 2줄 줄바꿈, 위젯별 개별 스크롤) |

harness 단정 항목: 배치 저장·복원, 스키마 버전 불일치/깨진 JSON/KPI 누락 시 기본값 폴백, 모르는 위젯 id 정규화, 기본 배치가 위젯 4종을 모두 올리는지, 마감 버킷 비겹침·빈틈 없음(−400~+400일 전수), 영업일 보정 4케이스, 날짜 이동 경계(월/연/윤년), 딥링크 query 왕복·잘못된 값 폐기·빈 Target 제거.

### 검증 중 발견해 고친 것

1. **0건에 경고색이 붙었다.** "지연 마감 0"이 빨간색으로 표시돼 문제가 있는 것처럼 읽혔다. 0은 좋은 소식이다. `tile.value > 0`일 때만 tone class를 붙이도록 고쳤다.
2. **다크 테마에 D-day 배지 변형이 없었다.** 기존에도 없던 문제로, `styles/dday.css`를 만들면서 함께 추가했다.
3. harness 단정 4건이 실패했는데 **코드가 아니라 단정 방식의 문제**였다. `makeNodeId()`가 호출마다 새 UUID를 주므로 `buildDefaultDashboardLayout()`을 두 번 부르면 모양이 같아도 JSON이 다르다. 노드 id를 제외하고 비교하는 `shapeOf()`를 넣었다.

---

## schema · migration · ERD 정합성 확인 (AGENTS.md 규칙)

DB 변경은 인덱스 추가 1건이며 세 곳을 같은 작업에서 갱신했다.

| 대상 | 내용 | 확인 |
| --- | --- | --- |
| `backend/prisma/schema.prisma` | `Patent`에 `@@index([expectedExpiryDate])` 추가 (`publicationDate` 인덱스 다음) | 완료 |
| `backend/prisma/migrations/20260824100000_add_patent_expected_expiry_index/migration.sql` | `CREATE INDEX IF NOT EXISTS "patent_expected_expiry_date_idx" ON "patent"("expected_expiry_date")` | 완료 |
| `docs/patent_database_schema.md` | 마이그레이션 목록에 신규 항목 추가 + **`### Index` 절 신설**(기존에 인덱스 문서화 절이 없었다) | 완료 |

- 인덱스 이름은 기존 규칙(`patent_<column>_idx`)을 따랐다. `20260810120000_add_patent_domain`의 `patent_application_date_idx` 등과 같은 형식이다.
- table·column·enum·relation·FK·unique·nullability·soft delete 정책 변경은 **없다**. 인덱스 1건뿐이다.
- 백엔드 타입체크가 통과하므로 Prisma 스키마 문법과 생성 타입의 정합성이 확인된다.
- 마이그레이션 적용은 사용자가 수행한다(AGENTS.md: 빌드·실행은 사용자 담당).

---

## 남긴 후속 과제

| 과제 | 이유 |
| --- | --- |
| 심사청구 기한 파생 계산(출원일+3년 등) | 국가별 규칙 테이블이 필요하다. `patent_stage.scope`가 이미 국가 범위를 갖고 있어 그것을 확장하는 별도 과제 |
| 목록 API `dueDate` 범위 필터 | 있으면 마감 KPI 타일도 목록으로 딥링크할 수 있다 |
| `index.css`의 `.dashboard-card*` 규칙 제거 | 옛 placeholder Dashboard 전용이었고 지금은 참조가 없다(dead CSS 약 80줄) |
| Tier 2 | Target×국가 매트릭스, 출원 추이, 미대응 OA, 거절이유 Top N |
| Tier 3 | 즐겨찾기, 구독 Target, 임포트 이력 |

## 실행이 필요한 것 (사용자)

```bash
cd backend && bunx prisma migrate deploy
```

인덱스 마이그레이션 1건이다. 프런트는 빌드만 하면 된다.
