# 작업 보고서 — 우측 상시 사이드바(레일) 도입

- 작업일: 2026.08.24
- 선행 작업: [`report_20260824_dashboard_tier1.md`](report_20260824_dashboard_tier1.md)
- 요청: 문서 뷰어·일정·To-do 관리 컴포넌트를 우측 상시 사이드바로 옮긴다. 토스증권 우측
  사이드바 UI를 참고한다. 레일 최상단에 열기·닫기 화살표를 두고 전환에 애니메이션을 넣는다.

## 배경 — 왜 레일인가

직전 작업에서 대시보드를 만들면서 "특허 관리의 캘린더·To-do를 대시보드로 옮길지"를 논의했고,
화면마다 패널을 등록하는 방식(패널 레지스트리 양쪽 등록)을 제안했다. 사용자가 제3안으로
**전역 우측 레일**을 제시했고, 이쪽이 더 맞다:

- 문서 뷰어·일정·To-do는 **특정 화면의 내용이 아니라 어느 화면에서든 곁에 두는 도구**다.
  트리(MovableGrid)에 넣으면 화면마다 배치를 따로 만들어야 하고, 화면을 옮기면 사라진다.
- 역할 분리가 깔끔해진다: **레일 = 관리/편집, 대시보드 기한 보드 = 조망/진입점.**
  사용자의 표현("Todo **관리** 컴포넌트")과 정확히 일치한다.

조사에서 확인한 뒷받침:

| 확인 | 의미 |
| --- | --- |
| `PatentDocumentViewer`에 이미 `variant: 'card' \| 'plain'`이 있다 | 두 화면이 다른 프레임으로 쓰도록 만들어져 있어 세 번째 자리에 바로 들어간다 |
| `SIDE_PANEL_DEFAULT_WIDTH = 520`, 토스 관심목록 패널은 ~380px | **하나의 고정폭을 쓸 수 없다.** 폭을 항목별로 따로 가져야 한다 |
| `selectedCalendarDate`가 캘린더 자신의 선택 링에만 쓰인다(전수 조사) | 캘린더는 특허 관리 목록과 **결합이 없다** → 위치가 자유롭다 |
| `schedule` 응답의 `todos`는 지연 3건 + 예정 7건 **하드캡** | 기존 To-do 패널은 관리 화면으로 쓸 수 없었다(8번째는 아예 안 보인다) |

---

## 1. 레일 구조

`MainLayout`의 root `<Layout>`에 좌측 `Sider`와 **대칭**으로 붙였다. 화면(children) 밖이라
라우트가 바뀌어도 그대로 남는다 — 그게 이 기능의 목적이다.

```
.rs-root (height: 100vh)
├── .rs-shell            ← 애니메이션 대상. [핸들][패널]을 감싸고 overflow:hidden
│   ├── resize handle
│   └── panel (문서 | 일정 | To-do)
└── .rs-rail (56px, 상시)
    ├── .rs-rail-toggle  ← 최상단 열기·닫기 화살표
    ├── .rs-rail-divider
    └── 항목 3개 (아이콘 + 라벨)
```

### 상태 seam

레일은 모든 화면 밖이라 화면이 레일에 무언가를 넣으려면 props가 아니라 store를 거쳐야 한다.
`useUIStore`가 `headerContent`를 다루는 것과 같은 이유·같은 방식으로
`store/useRightSidebarStore.ts`를 두었다.

- `activeItem` / `lastItem` / `widths` / `documentContext` / `todoRevision`
- `documentContext.source`: **넣은 화면을 가리킨다.** 화면을 떠날 때 자기가 넣은 것만 지운다
  (다른 화면이 이미 새로 채웠다면 지우면 안 된다)
- `todoRevision`: 특허 관리의 To-do 모달이 값을 바꿨을 때 레일에 알리는 숫자 하나.
  화면과 레일이 서로를 직접 알지 않아도 된다

### 저장

`right-sidebar:v1` 한 키에 `activeItem` / `lastItem` / `widths`를 담는다. 문서 내용은
저장하지 않는다(화면이 다시 넣어 준다). 그래서 `activeItem`이 `documents`로 저장돼 있으면
**접힌 상태로 시작**한다 — 빈 뷰어를 펼쳐 놓지 않는다.

---

## 2. 패널 3종

| 패널 | 데이터 | 기본 폭 |
| --- | --- | --- |
| 문서 | 화면이 `showDocuments()`로 밀어 넣는다 (스스로 조회하지 않는다) | 520px |
| 일정 | `/patent-records/schedule` — 스스로 조회 | 320px |
| To-do | `/patent-records/deadlines` — 스스로 조회, TODO만 필터 | 340px |

폭이 항목마다 다른 이유는 문서 뷰어가 PDF를 읽을 만큼 넓어야 하고 일정·To-do는 좁아도 되기
때문이다. 일정이 320px 아래로 못 가는 이유는 7칸 격자에서 날짜가 겹치기 때문이다.

### 일정 패널

`SchedulePanel`의 달력 부분을 `components/patent-management/PatentCalendar.tsx`로
**props만 받는 프레젠테이션 컴포넌트**로 추출했다(`PatentProgressPipeline`과 같은 방식).
`.pm-calendar-*` 규칙도 `pages/PatentManagement.css`에서 `styles/calendar.css`로 옮겼다 —
레일이 페이지 CSS를 끌어올 수 없기 때문이며, `styles/dday.css`와 같은 이유다.
좁은 자리용 `.pm-calendar-compact` 수정자를 두어 예전 `.pm-schedule-panel` 한정 규칙을 대체했다.

**기능이 하나 늘었다**: 고른 날의 일정 목록. 특허 관리에서는 달력이 점만 찍어서 tooltip으로만
볼 수 있었다.

### To-do 패널

`deadlines` 엔드포인트(직전 작업에서 만든 것)를 재사용해 **상한 없는 전체 목록**을 준다.
지연/예정 두 구획, D-day 배지, 완료 체크박스, 클릭 시 해당 특허로 이동.

- 완료는 `patentAnalysis.manage`가 있을 때만 (없으면 읽기 전용 목록)
- 새로 만들기·수정은 특허 관리의 `PatentTodoModal`이 계속 갖는다. 레일은 훑고 끝내는 용도
- `LIMIT`(200)에 걸리면 그 사실을 화면에 밝힌다 (조용한 절단 금지)

---

## 3. 특허 관리 화면 정리

`schedule` / `todo` / `documentViewer`가 트리에서 빠졌다.

- `PATENT_WORKSPACE_LAYOUT_SCHEMA_VERSION` **1 → 2**. 저장된 v1 배치는 없어진 패널을 담고
  있어 복원하면 빈 자리가 생기므로 기본 배치로 되돌린다
- `withDocumentViewer()` 삭제 (뷰어 자리를 만들 필요가 없어졌다)
- 기본 배치: 상단 2칸(상세 검색 | 진행 현황) + 하단(Target | 목록). 상단 minWidth 합이
  **1044px → 544px**로 줄어 우측 레일이 먹는 폭을 상쇄한다. 상단 비중도 0.42 → 0.34로 줄여
  이 화면의 본체인 목록에 높이를 더 줬다

### 죽은 코드 제거

이동으로 참조가 사라진 것들을 함께 걷어냈다:

- `usePatentWorkspaceState`의 일정·캘린더 상태 전부. **아무도 안 보는데 마운트마다
  `/patent-records/schedule`을 조회하고 있었다.** 사용처를 전수 조사해 확인했다
  (`schedule`, `calendarCells`, `moveCalendarMonth`, `selectedCalendarDate`, `getHolidayName`,
  `todayKey`, `reloadSchedule` 모두 소비자 0)
- `activeDocumentId` / `activeDocument` — 어느 통지서를 보는지는 이제 레일 store가 소유한다
- `SchedulePanel.tsx`, `TodoPanel.tsx`, `DocumentViewerPanel.tsx` 파일
- `PatentManagement.css`의 `.pm-doc-panel*`, `.pm-todo-panel*`, `.pm-todo-list`,
  `.pm-deadline-*` (454줄 → 388줄)

### 의견제출통지서 화면도 레일로 전환했다

처음에는 "그 화면에서는 문서가 본문"이라는 이유로 자체 뷰어를 남겨 뒀다. **판단이 틀렸다.**
같은 화면 안에 뷰어가 둘(이 화면 것 + 레일 것) 생기면서 서로 다른 문서를 보여 주는 상태가
가능해졌고, 사용자가 동기화되지 않는다고 지적했다.

- 카드를 고르면 `showDocuments()`로 레일에 통지서 한 건을 올린다
- **고른 문서를 로컬 state로 갖지 않는다.** 목록의 선택 강조도 레일 store에서 읽어
  (`documentContext.source === 'office-action' ? activeId : null`), 뷰어에 뜬 문서와 목록에서
  강조된 카드가 **어긋날 수 없게** 했다. 상태가 하나뿐이면 동기화 문제가 생기지 않는다
- `items`에 검색 결과 전체를 넣지 않는다. 뷰어의 통지서 선택 Segmented가 결과 수만큼 늘어나
  쓸 수 없게 된다. 목록에서 고르는 것이 이 화면의 방식이다
- 검색을 다시 하면 레일에서도 내린다(이전 선택이 목록에 더 이상 없을 수 있다)

같이 걷어낸 것: `OfficeActionAnalysis.css`의 뷰어 전용 규칙 66줄
(`.oa-page-viewer-open`의 본문/패널 폭 배분, sticky pane, 1200px 이하에서 뷰어를 목록 아래로
내리는 처리). 남은 뷰어 관련 주석도 "뷰어 폭에 종속" → "레일 폭에 종속"으로 갱신했다.

**레일 패널 머리줄에 문서 이름을 붙였다.** 두 화면이 같은 뷰어를 공유하게 되면서 "지금 어느
특허의 문서를 보고 있는지"가 안 보이면 화면을 옮긴 뒤 헷갈린다. `RailDocumentContext.label`이
그때서야 제 역할을 하게 되었다(그 전까지는 정의만 있고 쓰이지 않았다).

`RailDocumentContext.patentId`도 `number | null`로 바꿨다. 검색 결과 항목
(`PatentSearchItem.patentId`)은 이 값이 없을 수 있다.

---

## 4. 상단 화살표와 애니메이션

### 화살표

레일 맨 위에 두고 아래에 구분선을 넣었다(토스와 같은 구성). 방향으로 **지금 상태와 누르면
어디로 움직이는지**를 함께 알린다.

| 상태 | 아이콘 | aria-label |
| --- | --- | --- |
| 펼침 | `ChevronsRight` (오른쪽 = 닫기) | 사이드바 접기 |
| 접힘 | `ChevronsLeft` (왼쪽 = 열기) | 사이드바 펼치기 |

접힌 상태에서 누르면 **마지막으로 보던 항목**이 열린다. 그래서 store에 `lastItem`을 두었다
(`activeItem`이 null이 되어도 남는다). 저장값이 없으면 `schedule`로 시작한다 — 문서는 화면이
넣어 줘야 볼 것이 생기므로 화살표만 눌러 여는 첫 경험에 맞지 않는다.

패널 머리줄에 있던 접기 버튼은 **제거**했다. 같은 일을 하는 컨트롤이 두 곳에 있을 이유가 없고,
토스도 레일에만 둔다.

### 애니메이션

`.rs-shell`(핸들+패널을 감싸는 래퍼)의 `width`만 전환한다. `overflow: hidden`이라 폭이 0으로
줄 때 내용이 **찌그러지지 않고 잘리며 밀려 들어간다**.

```css
transition: width 200ms cubic-bezier(0.2, 0, 0, 1);
```

세 가지를 함께 처리했다:

1. **드래그 중에는 전환을 끈다** (`.rs-shell-instant`). 켜 두면 패널이 커서를 뒤늦게 따라와
   뻣뻣해진다. `ResizableSidePanel`에 `onResizingChange` prop을 추가해 드래그 상태를 받는다.
2. **접히는 동안 내용을 유지한다.** `activeItem`이 null이 되는 순간 언마운트하면 슬라이드가
   빈 칸을 접는 모양이 된다. 전환이 끝난 뒤 치운다.
3. `transitionend`가 아니라 **타이머**로 치운다. `prefers-reduced-motion`으로 전환이 꺼진
   환경에서는 그 이벤트가 오지 않아 내용이 영원히 남는다.

`aria-expanded`(화살표)와 `aria-hidden`(접힌 셸)도 함께 움직여, 접힌 패널이 키보드·스크린리더에
잡히지 않는다.

---

## 5. 드래그가 "딱딱하게" 느껴진 문제 — 계측과 수정

사용자 지적으로 계측했고, **네 가지 모두 이 작업에서 `ResizableSidePanel`을 controlled 모드로
레일에 넣을 때 생긴 것**이었다.

| # | 원인 | 수정 | 확인 |
| --- | --- | --- | --- |
| 1 | mousemove마다 `localStorage.setItem` | 폭 저장을 300ms 디바운스 + 같은 값이면 조기 반환 | `Storage.prototype.setItem` 후킹: 40회 드래그당 **40회 → 0회**(완료 후 1회) |
| 2 | ResizeObserver 되먹임 — 관찰 대상 `.rs-root`가 패널 폭에 따라 커진다 | 드래그 중에는 재클램프를 건너뛴다 | `.rs-root` 518px vs 패널 447px로 추적 확인 |
| 3 | 폭이 바뀔 때마다 패널 본문 전체 리컨실(달력 42칸 + Tooltip) | `panelBody`를 `useMemo`로 고정 | — |
| 4 | 본문 최소 폭 보호가 죽어 있었다 | 상한을 창 폭에서 계산 + `clamp()`에 viewport 폴백 | 극단 드래그 시 본문 **129px → 479px** |

1번은 아이러니하다. `PatentManagement.tsx`가 **바로 이 이유로** 300ms 디바운스를 두고 주석까지
남겨뒀는데("분할선 드래그 한 번에 수십 번 쓴다") 레일에서 그 교훈을 따르지 않았다.

4번이 가장 컸다. 레일에서는 핸들이 `.rs-root`의 **첫 자식**이라
`handle.previousElementSibling`이 `null`이고, 기존 `clamp()`는 그러면 보호를 **조용히
건너뛴다**. 이제 형제가 없으면 viewport를 경계로 쓰도록 고쳐 보호가 소리 없이 죽지 않는다.

### 파생 개선 — 저장값과 렌더값 분리

옵저버가 나중에 폭을 바로잡아 주기를 기다리는 구조 자체가 취약했다. 넓은 모니터에서 900px로
저장하고 노트북에서 열면 본문을 짓누른 채 시작한다(실제로 재현: 본문 129px).

그래서 저장된 900px은 **"사용자가 원한 폭"**으로 그대로 두고, 그릴 때 **"지금 화면에 들어가는
폭"**으로 자른다. 1100px 창에서 550px로 렌더되고 본문 479px이 보장되며, 창이 넓어지면 900px로
되돌아온다.

---

## 6. 검증 결과

`frontend/rail-harness.html` + `src/dev/railHarness.tsx`를 추가했다
(`http://localhost:5173/ip-workspace/rail-harness.html`).

**다른 harness와 다른 점**: 레일 패널은 스스로 조회하므로 컨텍스트를 가짜로 채우는 것으로는
부족하다. 그래서 **네트워크 경계(fetch)만** 스텁하고 그 위(서비스 계층·권한 컨텍스트·패널
컴포넌트)는 전부 실제 코드를 쓴다. 확인하려는 것이 "실제 응답을 받았을 때 어떻게 그려지는가"라서다.
레일이 쓰는 endpoint만 가로채고 나머지는 흘려보내, 스텁이 조용히 다른 요청을 삼키지 않게 했다.

| 검증 | 결과 |
| --- | --- |
| 프런트 타입체크 | 통과 |
| 백엔드 테스트 `src/patent-record` | 37건 통과 |
| 레일 harness 단정 | **20건 통과** |
| 대시보드 harness | 21건 통과 |
| 레이아웃 엔진 harness | 61건 통과 |
| 일정·To-do·문서 패널 | 실제 응답으로 렌더 확인 |
| To-do 완료 처리 | 5건 → 4건, 구획 건수 동시 갱신 확인 |
| 라이트·다크 | 양쪽 확인 |
| 좁은 화면(≤900px) | 내용 패널만 숨고 아이콘 레일 56px 유지 |
| 항목별 폭 독립 | 일정 520 / To-do 340 각각 유지 확인 |
| 상단 화살표 | `aria-expanded`·아이콘 방향·`aria-hidden` 전환 확인 |
| 애니메이션 | `transition: width 0.2s cubic-bezier(...)` 적용, 드래그 시 `rs-shell-instant`로 해제, 접힘 후 언마운트 확인 |
| 두 화면 문서 공유 | 나중에 넣은 화면이 뷰어를 차지, source별 강조 격리, 밀려난 화면의 정리가 남의 문서를 지우지 않음 |
| 문서 이름 표시 | 레일 머리줄에 `문서  A25W001` 확인 |

### 검증 중 발견해 고친 것

1. **레일 항목 tooltip이 화면에 남았다.** 실제 클릭 후 마우스를 옮겨도 사라지지 않았다
   (레이아웃이 바뀌는 버튼에서 `mouseleave`를 놓친다). 그런데 원인을 보다가 **아이콘 아래에
   라벨이 이미 보이는데 tooltip이 같은 글자를 반복**하고 있음을 알았다. 중복을 없애 버그도
   함께 사라졌다.
2. **harness 결함**: 레일 harness의 단정이 실제 store를 조작해서 복원된 사용자 상태(펼쳐 둔
   항목·폭)를 지우고 저장까지 했다. 스냅샷 후 복원하도록 바꿨다
   (workspaceHarness가 저장 단정에 별도 키를 쓰는 것과 같은 이유).
3. **workspaceHarness의 stale 기대값 10건.** 패널 목록이 6개 → 4개가 되었으므로 예상된
   실패였고, 옛 패널 구성을 하드코딩한 단정을 갱신했다(패널 수, `documentViewer` 380px 기준,
   `schedule`/`todo` 탭 id, storage 키의 스키마 버전). 61건 전부 통과로 돌아왔다.

### 측정 환경 주의

브라우저 페인이 숨겨진 상태에서는 `requestAnimationFrame`·`ResizeObserver` 콜백과 **CSS 전환이
진행되지 않고**, CDP 뷰포트 변경은 `resize` 이벤트를 발생시키지 않는다. 그래서 애니메이션 진행
경과는 이 환경에서 측정할 수 없어, 전환 설정(property·duration·easing)과 최종 레이아웃
(셸 334 = 패널 320 + 핸들 14)을 각각 확인하는 방식으로 나눠 검증했다. 창 확대 반영도 `resize`
이벤트를 직접 보내 확인했다.

---

## 7. 문서 뷰어 정리와 탭 상태 기억

### 죽은 `variant='card'` 제거

의견제출통지서 화면이 레일로 넘어오면서 `PatentDocumentViewer`의 호출자가 레일 패널 하나만
남았고, 그쪽은 항상 `variant='plain'`을 넘긴다. 도달 불가가 된 코드를 걷어냈다.

- `variant` / `onClose` props, `variant === 'card'` 머리줄 분기, `X` 아이콘 import
- `PatentDocumentViewer.css`의 `.pm-doc-viewer-card` / `-header` / `-title` 29줄

### 문서를 바꿔도 보고 있던 탭을 유지

예전에는 `<Tabs key={item.officeActionId} …>`로 **문서가 바뀌면 Tabs를 다시 마운트**했다
(주석도 "선택이 바뀌면 첫 tab부터 다시 보여준다"였다). `문서 전문`을 보다가 다른 문서를 고르면
매번 첫 탭으로 돌아갔다.

이제 `activeKey`를 제어해 같은 탭에 새 데이터가 들어온다.

**탭 key를 어디에 두는가**가 이 변경의 핵심이다. 뷰어 안에 두면 두 가지가 깨진다 — 문서가
바뀌면 내용이 통째로 갈리고, 레일이 접히면 뷰어가 언마운트된다(닫힘 애니메이션 후 정리).
그래서 레일 store에 `documentTabKey`를 두고 뷰어는 `activeTabKey` / `onActiveTabKeyChange`
props로 받는다. 뷰어가 레일을 import하지 않으므로 방향도 맞다(도메인 컴포넌트가 레이아웃
store를 알지 않는다).

**없는 탭은 첫 탭으로 떨어진다.** 문서마다 탭 구성이 다르다 — `의견제출통지서`·`문서 전문`·
`정보`는 어느 문서에나 있지만 `의견서`·`보정서` 탭은 그 문서에만 있다. 기억해 둔 key가 지금
문서의 탭 목록에 없으면 첫 탭을 연다(`resolvedTabKey`).

`documentTabKey`는 저장하지 않는다. 문서 내용도 저장하지 않으므로 새로고침 후에는 적용할
대상이 없다. `clearDocuments`로도 지우지 않는다 — 다음 문서를 열었을 때 같은 탭으로 이어지는
편이 자연스럽다.

`FullTextPane`은 손대지 않았다. 이미 `sources`에 대해 `activePath`를 clamp하고 있어 문서가
바뀌면 스스로 첫 PDF로 되돌아온다 — Tabs 리마운트가 없어져도 깨지지 않는다.

### 검증

| 검증 | 결과 |
| --- | --- |
| `문서 전문` → 다른 문서 | 탭 유지, 부제·탭 목록만 갱신 (`10-2026-0000002`, 의견서 탭 없음) |
| `의견서`(그 문서에만 있는 탭) → 다른 문서 | 첫 탭(`의견제출통지서`)으로 폴백 |
| `정보` → 레일 접기 → 다시 펼치기 | 탭 유지 |
| 레일 harness 단정 | **23건 통과** |

harness에 탭이 실제로 생기는 문서 두 건(`RAIL_DOCUMENTS`)을 넣었다. 한쪽에만 의견서 탭을 둬서
"공통 탭은 유지되고 그 문서에만 있는 탭은 폴백된다"를 함께 확인할 수 있다.

**harness 스냅샷 결함을 한 번 더 고쳤다.** store에 `documentTabKey`·`lastItem`을 더했는데
단정 전후 스냅샷에 넣지 않아, 검증이 그 값을 되돌리지 못하고 화면이 결과를 물려받았다. 앞서
고친 것과 같은 종류의 결함이라 "store에 상태를 더하면 스냅샷도 늘려야 한다"는 주석을 함께 남겼다.

---

## 8. schema · migration · ERD

**DB 변경 없음.** 이 작업은 프런트엔드 전용이고 기존 엔드포인트(`/patent-records/schedule`,
`/patent-records/deadlines`, `/patent-todos/:id`)만 쓴다. AGENTS.md의 DB 동기화 항목에 해당하는
변경이 없으므로 `docs/patent_database_schema.md`는 갱신하지 않았다.

---

## 9. 남긴 후속 과제

| 과제 | 이유 |
| --- | --- |
| 레일에서 To-do 새로 만들기·수정 | `PatentTodoModal`이 `PatentRecord`를 요구한다. 레일은 특허 레코드를 갖고 있지 않아 조회를 한 번 더 해야 한다 |
| 레일 항목 확장(즐겨찾기·최근 본) | Tier 3 대시보드 항목과 겹치는지 먼저 정리해야 한다 |
| `index.css`의 `.dashboard-card*` 제거 | 직전 작업에서 남은 dead CSS 약 80줄 |

## 실행이 필요한 것

없다. 프런트엔드 빌드만 하면 된다. (직전 작업의 인덱스 마이그레이션
`20260824100000_add_patent_expected_expiry_index`가 아직 적용되지 않았다면 그것은 여전히 필요하다.)
