# 대시보드 Tier 1 구현 계획

- 작성일: 2026.08.24
- 대상: `/dashboard` (현재 placeholder)
- 범위: Tier 1 위젯 4종 — 기한 보드 / KPI 스트립 / 진행 현황 퍼널 / 데이터 품질
- 제외(후속): Target×국가 매트릭스, 출원 추이, OA 대응 현황, 거절이유 Top N, 즐겨찾기, 구독 Target, 임포트 이력

---

## 0. 사전 조사 결과 (계획을 바꾼 사실들)

계획을 짜기 전 실제 코드를 확인한 결과, 애초 가정과 다른 점이 있었다. 아래가 계획의 전제다.

| # | 확인 사실 | 계획에 준 영향 |
|---|---|---|
| 1 | `MovableGrid`는 이미 완전히 범용이다. props가 `root / onChange / allTabs / describeTab / renderTab`뿐이고 도메인 타입을 모른다 (`components/patent-management/workspace/MovableGrid.tsx:39-53`) | **엔진 리팩터링 불필요.** 대시보드는 config만 새로 쓰면 된다 |
| 2 | `PatentProgressPipeline`은 순수 프레젠테이션 컴포넌트다 (`summary/loading/error/activeGroup/onToggleGroup/onPickRow/isRowActive` props). 컨텍스트에 묶인 건 얇은 래퍼 `StagePipelinePanel`뿐이다 | 퍼널 위젯은 **기존 컴포넌트 재사용 + 새 래퍼**로 끝난다 |
| 3 | `patentCalendar.ts`에 `calendarDayDifference`, `ddayLabel`, `ddayClassName`, `toLocalDateKey`가 이미 있다 | 기한 보드의 D-day 표시는 신규 코드가 거의 없다 |
| 4 | `/patent-records/stages`가 `unmapped` 버킷(미매핑 legal_status 목록 + 건수)을 이미 내려준다 | 데이터 품질 카드의 절반이 공짜 |
| 5 | `/patent-records/schedule`은 **월 단위**이고, `todos`는 지연 3건 + 예정 7건으로 **하드캡**돼 있다 (`patent-record.service.ts:352-575`) | 기한 보드용 **범위 조회 엔드포인트 신설 필요.** 기존 schedule은 캘린더 전용으로 그대로 둔다 |
| 6 | `patent.registrationDate`는 `String` 컬럼이라 `startsWith` prefix로만 필터한다 (`parseRegistrationDate`) | 기한 보드에서 **등록일 제외.** 애초에 등록일은 과거 사실이지 마감이 아니다 |
| 7 | `PatentManagement`은 **URL query param을 전혀 읽지 않는다** (`useSearchParams` 사용 없음) | KPI 타일을 "진입점"으로 만들려면 딥링크 수신부를 새로 만들어야 한다 (Phase 4) |
| 8 | 실제 라우트는 `/patent-management`다. `/patents/manage`는 `EmptyPage` placeholder이고, `*`의 폴백도 `/patent-management`다 (`routes.tsx`) | 딥링크 목적지는 `/patent-management` |
| 9 | `/dashboard` 라우트에 **permission이 없다.** 그리고 `/` → `/dashboard` 리다이렉트가 있다 | 라우트에 권한을 걸면 권한 없는 사용자가 첫 화면에서 튕긴다 → **위젯 단위 게이팅** 선택 |
| 10 | `patent.expectedExpiryDate`에 **인덱스가 없다.** (인덱스는 countryId, attorneyNumber, legalStatusId, examStatusId, target, applicationDate, publicationDate, ref*) | 마이그레이션 1건 필요 + AGENTS.md 규칙에 따라 schema·migration·ERD 동시 갱신 |
| 11 | `patent_todo`에는 `@@index([completed, dueDate])`가 이미 있다 | To-do 범위 조회는 인덱스 그대로 사용 |
| 12 | `/api/holidays`는 `?year=`만 받는다. 국가 파라미터가 없다 (한국 공휴일 전용) | 영업일 보정은 **KR 건에만** 적용. 해외 건은 역일 기준 + 표시로 구분 |
| 13 | 실제 화면은 AuthGate(그룹웨어 팝업 로그인) 안이라 dev 브라우저로 열 수 없다. 그래서 `workspace-harness.html` + `src/dev/` 선례가 있다 | 검증은 **전용 harness**로 한다 (Phase 6) |
| 14 | Tier 1 위젯 4종 중 차트가 필요한 게 없다 (퍼널=기존 타일 UI, KPI=stat tile, 기한=리스트, 품질=리스트) | **echarts 추가 사용 없음.** 번들 영향 없음 |

---

## Phase 0 — 사전 결정과 기반 정리

### 0.1 권한 모델 결정 `[결정 필요]`

`/dashboard`는 랜딩 페이지(`/` 리다이렉트 대상)인데 표시 내용은 전부 특허 데이터다.

- **채택안: 위젯 단위 게이팅.** 라우트는 무권한 유지, 각 위젯이 `/api/access-context`의 `modules`를 보고 자신을 숨긴다. 권한 없는 사용자는 빈 대시보드가 아니라 "접근 가능한 모듈이 없습니다" 안내를 본다.
- 반대안(라우트에 `patentAnalysis.read`)은 권한 없는 신규 사용자가 로그인 직후 튕기는 문제가 있어 제외.
- 구현: `useAccessContext` 계열 훅으로 `patentAnalysis.read` 확인 → `dashboardLayout`의 `allTabs`에서 제외(패널 추가 메뉴에도 안 뜨게).

### 0.2 레이아웃 엔진 위치 이동 `[선택 / 권장]`

대시보드가 `components/patent-management/workspace/`에서 import하는 건 구조 냄새다. 아래 7개를 `components/workspace/`로 이동(순수 mechanical, import 경로만 변경):

```
MovableGrid.tsx  PanelFrame.tsx  Splitter.tsx  DropOverlay.tsx
AddPanelMenu.tsx  useContainerSize.ts  workspace.css
```

`PatentWorkspaceContext.tsx`와 `panels/`는 **이동하지 않는다** (특허 관리 도메인 소유).
비용이 부담되면 건너뛰고 현재 위치에서 import해도 동작은 같다. 단 Phase 5 이후에 하면 손댈 파일이 늘어난다.

### 0.3 "등록 대기" 정의 확정 `[결정 필요]`

KPI 타일에 넣을 지표인데 정의가 모호하다. `docs/patent_stage_definitions.md`의 stage group 기준으로 못 박는다.

- 제안: `stageGroup ∈ {EXAM, RESPONSE}` = "심사/대응 진행 중", `stageCode = ALLOWANCE` = "등록 대기(등록료 납부 전)"
- `ALLOWANCE` 건수를 쓰는 편이 실무 의미가 분명하다.

---

## Phase 1 — 백엔드: 기한 범위 조회 + 요약 집계

기존 `schedule` / `stages`는 **건드리지 않는다.** 캘린더와 파이프라인이 그 계약에 의존한다.

### 1.1 마이그레이션: `expectedExpiryDate` 인덱스

```prisma
@@index([expectedExpiryDate])
```

AGENTS.md의 DB 동기화 규칙에 따라 같은 커밋에서 함께 갱신:
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/<ts>_add_patent_expected_expiry_index/migration.sql`
- `docs/auth_database_schema.md`의 Mermaid ERD·테이블 설명

### 1.2 `GET /api/patent-records/deadlines`

```
?from=YYYY-MM-DD&to=YYYY-MM-DD&targets[]=&limit=
```

- **소스 2종만.** 미완료 `patent_todo.dueDate` 범위 + `patent.expectedExpiryDate` 범위
- `registrationDate` / `applicationDate` / `publicationDate` / `intApplication*` 는 **과거 사실**이라 제외 (조사 #6)
- `examDate`는 기록/예정이 섞여 있어 이번 범위에서 제외 → 1.5 참고

응답:

```ts
type DeadlineItem = {
  patentId: number;
  todoId?: number;
  internalRef: string | null;
  applicationNumber: string;
  title: string | null;       // koreanTitle ?? englishTitle
  country: string;
  target: string | null;
  type: 'TODO' | 'EXPECTED_EXPIRY';
  label: string;              // 'To-do 마감일' | '예상 만료일'
  date: string;               // YYYY-MM-DD (date-only key)
};

type DeadlineResult = {
  from: string;
  to: string;
  items: DeadlineItem[];      // date asc
  total: number;              // limit로 잘린 경우의 전체 건수
  counts: { overdue: number; today: number; within7: number; within30: number };
};
```

- `today` 기준은 기존 `schedule`과 동일하게 **Asia/Seoul date-only UTC key** (`patent-record.service.ts:365-368` 방식 재사용)
- `counts`는 `from/to` 범위와 무관하게 오늘 기준으로 계산 — 그래야 KPI와 리스트가 어긋나지 않는다
- `limit` 기본 100, 상한 500. 잘린 경우 `total`로 드러낸다 (조용히 자르지 않음)

### 1.3 `GET /api/patent-records/summary`

KPI + 데이터 품질을 **한 번에** 준다. 대시보드 첫 렌더의 요청 수를 줄이는 것이 목적.

```ts
type PatentSummary = {
  total: number;
  deadlines: { overdue: number; today: number; within7: number; within30: number };
  expiringWithinYear: number;        // expectedExpiryDate <= today + 365d
  awaitingRegistration: number;      // Phase 0.3에서 확정한 정의
  quality: {
    unmappedStatus: number;          // stages().unmapped.count 재사용
    refParseFailed: number;          // internalRef != null AND refOrigin == null
    missingApplicationDate: number;
    missingExpectedExpiry: number;
    activeWithoutTodo: number;       // 진행 중(EXAM/RESPONSE)인데 미완료 to-do 0건
  };
};
```

- `quality.unmappedStatus`는 `stages()` 내부 로직을 함수로 뽑아 공유한다. 계산을 두 곳에 복제하면 숫자가 갈린다.
- 미대응 OA 건수는 Tier 2 항목이라 이번엔 넣지 않는다.

### 1.4 DTO·서비스·테스트

- `dto/patent-deadline-query.dto.ts` — `class-validator`. 컨트롤러가 `forbidNonWhitelisted`라 화이트리스트 누락 시 400이 난다 (프런트 타입도 같이 맞출 것)
- `patent-record.service.ts`에 `deadlines()`, `summary()` 추가
- 테스트: `patent-record-deadlines.spec.ts` (기존 `patent-csv.spec.ts`, `patent-record-documents.spec.ts` 패턴)
  - 경계: `from`=오늘 / `to`=오늘 포함 여부, 지연 건 포함, 완료 to-do 제외, `dueDate = null` 제외, `limit` 초과 시 `total` 정확성, targets 필터

### 1.5 후속으로 미루는 것 (이번 범위 아님)

**심사청구 기한**(예: 출원일 + 3년, `exam = false`인 건)은 파생 마감으로서 실무 가치가 크지만 국가별 규칙 테이블이 필요하다. `patent_stage.scope`가 이미 국가 범위를 갖고 있으니 그걸 확장하는 별도 과제로 둔다.

---

## Phase 2 — 프런트 서비스 계층

`services/patentRecordApi.ts`에 추가한다 (같은 컨트롤러이므로 별도 파일을 만들지 않는다).

- 타입: `DeadlineItem`, `DeadlineResult`, `PatentDeadlineQuery`, `PatentSummary`
- 메서드: `patentRecordApi.deadlines(query)`, `patentRecordApi.summary(query)`
- 기존 `request()` / `toQueryString()` 헬퍼 그대로 사용 (인증 실패 시 `notifyIfAuthRequired` 경로도 자동 승계)

---

## Phase 3 — 위젯 4종 (프레젠테이션 우선)

전부 **props만 받는 순수 컴포넌트**로 만든다. 데이터 주입은 Phase 5의 훅이 담당한다. 그래야 harness에서 목 데이터로 검증할 수 있다 (조사 #13).

위치: `components/dashboard/widgets/`

### 3.1 `KpiStrip.tsx`

- 타일 6개: `관리 특허 / 지연 마감 / 오늘 마감 / 7일 내 마감 / 등록 대기 / 만료 임박(1년)`
- 타일 = `{ label, value, tone: 'neutral'|'warn'|'danger', to?: string }`. `to`가 있으면 클릭 시 딥링크
- 숫자는 `formatNumberWithComma`
- 마감 관련 타일은 딥링크 대신 **기한 보드의 해당 버킷으로 스크롤/포커스**한다 → 이유는 Phase 4 참고

### 3.2 `DeadlineBoard.tsx` — 이 화면의 주인공

- 버킷 4개로 그룹핑: `지연 / 오늘 / 7일 내 / 30일 내`. 빈 버킷은 접어서 표시
- 행: `내부관리번호 · 국가 배지 · Target · 이벤트 라벨 · 제목 · D-day`
- D-day는 `ddayLabel` / `ddayClassName` 재사용 (조사 #3)
- **영업일 보정**: `country === 'KR'`인 건만 `holidayApi.findByYear` + `koreanHolidays.ts`로 "다음 영업일" 힌트 표시. 해외 건은 역일 기준이며 그 사실이 UI에서 구분되게 한다 (조사 #12)
- 행 클릭 → 해당 특허의 문서 뷰어 / To-do 모달로 이동
- `total > items.length`면 "N건 더 보기"를 명시 (조용한 절단 금지)

### 3.3 `StageFunnelWidget.tsx`

- `PatentProgressPipeline`을 그대로 렌더 (조사 #2)
- `onPickRow` → `/patent-management?stageCode=...` 또는 `?legalStatusId=...` 딥링크
- `activeGroup`은 대시보드 로컬 상태. 특허 관리의 선택 상태와 공유하지 않는다 (의미가 다르다)

### 3.4 `DataQualityCard.tsx`

- 5개 항목 각각 `건수 + 조치 링크`
  - 미매핑 Status → `/workspace/patent-code-admin`
  - 내부관리번호 규칙 불일치 → `/patent-management?refParseFailed=1`
  - 출원일/예상 만료일 누락 → 해당 필터 딥링크
  - to-do 없는 진행 건 → 딥링크
- 전 항목 0건이면 축하 문구가 아니라 **카드 자체를 접는다** (자리만 먹지 않게)
- `patentAnalysis.manage` 권한이 없으면 조치 링크를 숨기고 건수만 보여준다

---

## Phase 4 — 딥링크 (타일을 진입점으로 만들기)

조사 #7 때문에 이게 별도 단계다. 이 단계를 빼면 KPI 타일은 그냥 죽은 숫자가 된다.

### 4.1 `PatentManagement`에 query param 수신부 추가

- `useSearchParams`로 읽어 `usePatentWorkspaceState`의 초기 필터를 시드
- 지원 파라미터는 `PatentRecordListQuery`에 **이미 있는 것만**: `q, targets, countryId, legalStatusId, examStatusId, stageGroup, stageCode`
- 첫 마운트에서 한 번만 적용한다. 이후 사용자가 화면에서 바꾼 필터를 URL이 되돌리면 안 된다.
- 잘못된/미지의 파라미터는 무시하고 기본값으로 (기존 레이아웃 폴백 철학과 동일)

### 4.2 마감 관련 타일은 딥링크하지 않는다 `[의도적 축소]`

`PatentRecordListQuery`에 `dueDate` 범위 필터가 없다. 넣으려면 목록 API 필터를 확장해야 하는데, 그건 이 범위를 키운다. 대신:

- 마감 타일 클릭 → 같은 대시보드 안의 **기한 보드 해당 버킷으로 스크롤 + 하이라이트**
- 목록 쪽 `dueDate` 필터 추가는 후속 과제로 기록

### 4.3 품질 항목용 필터 `[범위 판단 필요]`

`refParseFailed`, `missingApplicationDate` 같은 조건은 목록 API에 없다. 두 선택지:

- **(a) 권장** 목록 API에 `quality=refParseFailed|missingApplicationDate|missingExpectedExpiry|noTodo` 단일 enum 파라미터 하나만 추가. 컬럼별 필터를 난립시키지 않는다.
- (b) 이번엔 건수만 보여주고 링크는 후속. 카드 가치가 절반으로 떨어진다.

(a)를 택하면 Phase 1에 작업 1건(목록 where 절 + DTO + 테스트)이 추가된다.

---

## Phase 5 — 페이지 조립

### 5.1 `hooks/useDashboardState.ts`

- `summary`, `deadlines` 로드 + `loading` / `error` / `refresh`
- 공통 필터: `targets`(다중 선택) — 위젯 전체에 같은 조건이 걸린다
- `stages`는 기존 `patentRecordApi.stages()` 그대로 호출
- 반환 타입을 `export type DashboardState = ReturnType<typeof useDashboardState>` 로 두어 `usePatentWorkspaceState` 선례와 같은 모양 유지

### 5.2 `config/dashboardLayout.ts`

`patentWorkspaceLayout.ts`를 **그대로 미러링**한다 (schemaVersion + normalize + 실패 시 기본값 폴백 + 사용자별 키).

```ts
export const DASHBOARD_LAYOUT_SCHEMA_VERSION = 1;
export const DASHBOARD_PANEL_TYPES = ['kpi', 'deadlines', 'stageFunnel', 'dataQuality'] as const;
```

- META: 각 위젯 `title / minWidth / minHeight / closable`
  - `kpi`는 `closable: false` (화면의 뼈대), 나머지는 닫기 허용
- 기본 배치:

```
column(0.18)
├── kpi (전폭)
└── row(0.58): deadlines | column(0.5): stageFunnel / dataQuality
```

- storage key: `dashboard-layout:${userId}:v${SCHEMA_VERSION}`
- 복원 시 `kpi` 패널이 없으면 기본값으로 되돌린다 (`patentList` 검사와 같은 이유)
- `DASHBOARD_STACK_BREAKPOINT = 768`

### 5.3 `components/dashboard/panels/index.tsx`

타입 → 컴포넌트 표. `PATENT_PANEL_COMPONENTS`와 동일한 구조.

### 5.4 `Dashboard.tsx` 재작성

- `useAuthSession().user.id`로 레이아웃 읽기/쓰기 (`PatentManagement.tsx:44-82` 패턴)
- `MovableGrid` + `DashboardProvider`(위젯이 트리 어디에든 마운트되므로 props 전달 경로가 없다)
- 상단에 `targets` 필터 + `새로고침`
- **제거할 것**: 하드코딩 Documents 카드, 고정 날짜 `2025.04.14 ~ 2025.04.21`, 동작 없는 `What's New` 버튼, 미사용 `layoutPreset`/`viewportWidth` resize 리스너
- Phase 0.1의 위젯 단위 권한 게이팅 적용

---

## Phase 6 — 검증

실제 화면이 AuthGate 뒤에 있어 dev 브라우저로 열 수 없다 (조사 #13). 그래서 선례를 따른다.

- `frontend/dashboard-harness.html` + `src/dev/dashboardHarness.tsx` + `src/dev/dashboardMock.ts`
  - `patentWorkspaceMock.ts`와 같은 방식. 앱 번들에 섞이지 않는 별도 진입점
- 확인 항목
  - 위젯 드래그/분할/닫기/`+`로 재추가, 새로고침 후 배치 복원
  - localStorage 값 손상 시 기본 배치 폴백
  - 768px 이하 세로 스택
  - 다크/라이트 양쪽
  - **빈 상태**: 마감 0건, 품질 이슈 0건, 특허 0건
  - **에러 상태**: `summary` 실패 시 다른 위젯이 같이 죽지 않는지
  - `total > items.length`일 때 "N건 더 보기" 노출
- 포맷 규칙 점검 (AGENTS.md)
  - 숫자 `formatNumberWithComma` — 단 출원번호·내부관리번호는 comma 미적용
  - 날짜 `formatDisplayDate` → `YYYY.mm.dd`
  - 색상: CSS는 `var(--brand-primary)`, 리터럴 필요 시 `useBrandPrimary()` / `getBrandPrimary()`. hex 직접 사용 금지
- 백엔드: `bun test`로 Phase 1.4 spec 통과 확인 (실행은 Docker 컨테이너 내)

---

## Phase 7 — 문서화

- 이 계획서: `docs/plans/2026/08/plan_20260824_dashboard_tier1.md`
- 작업 보고서: `docs/reports/2026/08/report_20260824_dashboard_tier1.md`
  - DB 변경(1.1)이 있으므로 **schema · migration · ERD 정합성 확인 결과를 반드시 기록** (AGENTS.md 규칙)
- `docs/auth_database_schema.md` ERD 갱신 (1.1과 같은 커밋)
- 후속 과제 기록: 심사청구 기한 파생(1.5), 목록 `dueDate` 필터(4.2), Tier 2 위젯

---

## 순서와 의존관계

```
Phase 0 (결정 3건)
   │
   ├─→ Phase 1 (백엔드) ─→ Phase 2 (서비스) ─┐
   │                                          ├─→ Phase 5 (조립) ─→ Phase 6 (검증) ─→ Phase 7 (문서)
   └─→ Phase 3 (위젯, 목 데이터로 선행 가능) ─┘
                                          
       Phase 4 (딥링크) — Phase 3와 병행 가능, Phase 5 전에 완료
```

Phase 1과 Phase 3은 **병행 가능**하다. 위젯을 순수 컴포넌트로 만들고 harness에서 목 데이터로 검증하는 이유가 이것이다.

---

## 열린 결정 사항 (착수 전 확인 필요)

1. **0.1 권한** — 위젯 단위 게이팅(권장) vs 라우트 권한
2. **0.2 엔진 이동** — `components/workspace/`로 옮길지 (권장, 지금이 가장 저렴)
3. **0.3 "등록 대기" 정의** — `stageCode = ALLOWANCE`(권장) vs 다른 기준
4. **4.3 품질 필터** — 목록 API에 `quality` enum 파라미터 추가(권장) vs 건수만 표시

---

## 이번 범위에서 의도적으로 뺀 것

- 월간 캘린더 (특허 관리 `SchedulePanel`에 이미 있음 — 대시보드는 리스트형 기한 보드)
- Insight 차트 복제 (시장 통계는 Insight의 몫)
- 미대응 OA / 거절이유 / Target 매트릭스 / 출원 추이 (Tier 2)
- 즐겨찾기 / 구독 Target / 임포트 이력 (Tier 3)
- 심사청구 기한 파생 계산 (국가별 규칙 테이블 필요)
