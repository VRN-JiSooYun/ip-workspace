# 대시보드 일정(캘린더) 위젯

- 작업일: 2026-08-25
- 범위: 프론트엔드만 (`frontend/src`). 백엔드·DB 변경 없음.

## 무엇을 만들었나

그룹웨어 캘린더 형태의 **일정 패널**을 대시보드 위젯으로 추가했다.

- 일간 / 주간 / 월간 세 보기, `‹ 2026.08 ›` 이동, `오늘` 버튼
- 월간: 요일 머리글(Sun~Sat), 주말·공휴일 색, 오늘 표시, 여러 날에 걸친 일정 막대,
  칸에 다 못 그린 일정은 `+N`(누르면 그날의 일간 보기로 이동)
- 주간·일간: 상단 종일 줄 + 24시간 격자. 겹친 시각 일정은 폭을 나눠 나란히 선다
- **특허 일정 겹쳐 보기** — 출원·공개·등록·국제출원·국제공개·심사·예상 만료일과 To-do 마감을
  같은 격자에 함께 찍는다. 툴바의 `특허 일정` 체크로 끄고 켠다
- **일정을 누르면 작은 팝업** — `기간 → 시간 → 제목` 순으로 보여 주고 `수정` / `삭제` / `닫기`
  (특허 일정은 읽기 전용 팝업 — 같은 세 줄 + 특허·출원번호, 버튼은 `특허 열기` / `닫기`)
- **날짜 칸을 누르면 등록 모달** — 제목, 기간, 종일, 시간, 색, 메모.
  시간 격자에서 누르면 그 시각(30분 단위)이 미리 채워진다
- 삭제는 확인 창을 한 번 거친다

## 두 종류가 한 격자에 놓인다

| | 내 일정 | 특허 일정 |
| --- | --- | --- |
| 출처 | 사용자가 만든다 | 서버(`/patent-record/schedule`) |
| 편집 | 등록·수정·삭제 | 읽기 전용 |
| 생김새 | 색이 **채워진** 막대 | **테두리만** 그린 막대 |
| 누르면 | 수정/삭제 팝업 | 특허 정보 + `특허 열기` |

배치 계산(`utils/calendarEvents`)은 출처를 모른다. 둘을 `CalendarItem`이라는 한 모양으로
맞춰 넘기고(`utils/scheduleEntries`), 그리는 쪽만 `source`를 보고 스타일과 팝업을 고른다.

조회는 **달 단위**다(서버 API가 `year`/`month`를 받는다). 달력이 "지금 보이는 날짜가 걸치는
달"을 계산해 패널에 알리고(`onMonthsChange`), 패널이 그 달만 부른다. 월 격자는 앞뒤 달의
며칠을 함께 보여 주므로 보통 두세 달이다. 한 번 부른 달은 캐시한다 — 달을 앞뒤로 넘겨 보는
것이 이 화면의 기본 동작이라 캐시가 없으면 같은 요청이 반복된다. Target 필터가 바뀌면
모집단이 달라지므로 캐시를 통째로 버린다.

특허 일정 조회가 실패해도 달력은 그대로 쓴다. 한 줄짜리 안내만 위에 얹는다
("특허 일정을 불러오지 못했습니다. 내 일정만 표시합니다.").

## 저장 위치 — 브라우저 (이후 DB로 옮김)

> 이 절은 최초 구현 당시의 내용이다. 같은 날 서버로 옮겼다 —
> [일정 데이터 DB 이관](report_20260825_calendar_db.md) 참고.


백엔드에 범용 일정(Event) 모델이 없다. 특허 라이프사이클 날짜와 `PatentTodo`뿐이고,
`PatentTodo`는 `patentId`가 필수라 특허와 무관한 일정을 담을 수 없다. 사용자와 협의해
이번에는 **localStorage에 사용자별로 저장**하고, 서버로 옮길 때 손댈 곳이 한 곳이 되도록
계층을 갈라 두었다.

```
ScheduleCalendar (화면)  ←  SchedulePanel  ←  useCalendarEvents (훅)  ←  calendarEventStore (저장)
                                                    ↑ 서버가 생기면 이 두 칸만 바뀐다
```

- 키: `dashboard-calendar:<userId>:v1` (대시보드 배치 저장과 같은 규약)
- 읽을 때 건별로 검사해 **깨진 한 건만 버린다**. 사용자가 직접 만든 값이라 하나 때문에
  전부를 잃게 하면 안 된다.

## 추가·변경 파일

추가
- `frontend/src/utils/calendarEvents.ts` — 자료형과 순수 계산(막대 줄 배치, 시간 겹침,
  입력 다듬기, 저장값 검증). 화면과 분리해 harness에서 단정으로 확인한다.
- `frontend/src/services/calendarEventStore.ts` — localStorage 저장소
- `frontend/src/hooks/useCalendarEvents.ts` — 목록 + 등록·수정·삭제
- `frontend/src/components/dashboard/widgets/ScheduleCalendar.tsx` — 달력 본체
- `frontend/src/components/dashboard/widgets/ScheduleEventPopover.tsx` — 일정 팝업 내용
- `frontend/src/components/dashboard/widgets/ScheduleEventModal.tsx` — 등록·수정 모달
- `frontend/src/components/dashboard/widgets/PatentSchedulePopover.tsx` — 특허 일정 팝업(읽기 전용)
- `frontend/src/utils/scheduleEntries.ts` — 내 일정/특허 일정을 한 모양으로 맞추는 변환과 색 표
- `frontend/src/hooks/usePatentScheduleEvents.ts` — 보이는 달만 부르는 조회 + 달 캐시
- `frontend/src/components/dashboard/panels/SchedulePanel.tsx` — 위젯 배선

변경
- `frontend/src/config/dashboardLayout.ts` — `schedule` 위젯 추가, 기본 배치에 편입,
  **스키마 버전 1 → 2**(저장해 둔 배치는 한 번 초기화되고 새 기본값을 받는다)
- `frontend/src/components/dashboard/panels/index.tsx` — 위젯 등록
- `frontend/src/hooks/useDashboardState.ts` — 저장 키에 쓸 `userId`와 특허 일정 조회
  (`loadPatentScheduleEvents`, 머리글의 Target 필터를 그대로 적용) 노출
- `frontend/src/components/dashboard/dashboard.css` — `.db-cal-*` 규칙
- `frontend/src/index.css` — 일정 색 토큰(라이트/다크 각 6색)
- `frontend/src/dev/dashboardMock.ts`, `frontend/src/dev/dashboardHarness.tsx` —
  harness에 `일정 표본` / `일정 비우기` 버튼, 특허 일정 표본 loader, 단정 24건 추가

### 주의: JS 상수와 CSS 값이 짝을 이룬다

막대 좌표를 JS가 px로 계산하므로 `ScheduleCalendar.tsx`의 `LANE_HEIGHT(19)`,
`DAY_HEAD_HEIGHT(24)`, `HOUR_HEIGHT(44)`는 `dashboard.css`의 같은 값과 **함께** 바꿔야 한다.
한쪽만 바꾸면 막대가 칸을 넘는다. 두 파일 모두 주석으로 남겨 두었다.

## 확인한 것

`bun run build`의 앞단인 `tsc -b` 통과. 화면 검증은 `dashboard-harness.html`
(실제 화면은 AuthGate에 막혀 dev 브라우저에서 열 수 없다).

- 순수 함수 단정 **45건 전부 통과** (기존 21건 + 이번 24건)
  - 주 경계에서 막대가 잘리고 `continuesBefore/After`가 선다
  - 겹치는 일정은 다른 줄, 겹치지 않으면 맨 윗줄
  - 겹친 시각 일정이 폭을 나눈다 / 종일 일정은 시간 격자에 놓이지 않는다
  - 거꾸로 된 기간·시각을 뒤집고, 시각이 없으면 종일로 되돌린다
  - `2026-13-45` 같은 값은 일정으로 읽지 않는다(Date가 조용히 다음 해로 넘기므로
    형식 검사만으로는 못 걸러 왕복 비교로 판정한다)
  - 특허 일정은 종일 하루짜리로 놓이고, 막대 글자는 `날짜 이름 · 내부관리번호`다
    (To-do만 마감 이름 대신 To-do 제목을 쓴다 — label이 'To-do 마감일'로 고정이라
    무엇 때문의 마감인지가 사라지기 때문)
  - 같은 특허가 같은 날 두 종류의 일정을 가져도 id가 겹치지 않는다
  - 내 일정과 특허 일정이 같은 날이면 서로 다른 줄을 받는다
- 손으로 확인: 월/주/일 보기 전환, 일정 팝업(기간·시간·제목 + 세 버튼), 날짜 칸 클릭 →
  등록, 시간 격자 클릭 → 14:00~15:00 미리 채움, 수정 모달, 삭제 확인 후 반영,
  라이트·다크 두 테마
- 특허 일정: 앞뒤 달(7월·9월) 것까지 월 격자에 함께 찍히는 것, 주간 보기의 종일 줄에
  내 일정과 나란히 놓이는 것, 읽기 전용 팝업(`특허 일정 · 읽기 전용` 표시 + `특허 열기`),
  토글을 끄면 사라지고 켜면 다시 부르지 않고 되살아나는 것(캐시), 조회 실패 시 안내 한 줄만
  뜨고 내 일정은 그대로인 것

## 남겨 둔 것

- ~~**서버 저장**~~ → 같은 날 [DB로 옮겼다](report_20260825_calendar_db.md). 예고한 대로
  훅과 저장소만 바뀌었고 달력 컴포넌트는 그대로다.
- **특허 일정의 양**: 한 달에 걸린 특허 일정이 많으면 칸이 `+N`으로 접힌다. 지금은 종류를
  가릴 방법이 토글 하나뿐이라, 필요해지면 종류별(출원·등록·마감…) 필터를 붙여야 한다.
- **To-do 완료 처리**: 특허 일정 팝업에서 할 수 있는 것은 '특허 열기'뿐이다. To-do를 그 자리에서
  끝내려면 To-do API를 여기서도 불러야 하는데, 그러면 이 달력이 편집하는 대상이 둘이 된다.
- **반복 일정**, **끌어서 옮기기**: 자료형에 자리를 비워 두지 않았다. 필요해지면
  `CalendarEvent`에 필드를 더하고 스키마 버전을 올리면 된다.
