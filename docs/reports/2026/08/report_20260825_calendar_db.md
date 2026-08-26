# 일정 데이터 DB 이관 (localStorage → PostgreSQL)

- 작업일: 2026-08-25
- 선행 작업: [대시보드 일정(캘린더) 위젯](report_20260825_dashboard_calendar.md)
- 범위: backend(schema·migration·API) + frontend(저장 계층 교체·공개 범위 UI)

## 무엇이 달라졌나

일정이 브라우저(localStorage)가 아니라 서버에 저장된다. 기기를 옮겨도 따라오고, **팀과
나눠 볼 수 있다.**

사용자와 정한 두 가지:
- 공개 범위는 **개인 + 팀 공유** 두 단계다(전사 공개는 두지 않았다).
- 브라우저에 쌓여 있던 값은 **이관하지 않는다**(검증용이었다).

## 공개 범위 규칙

| | 보이는 사람 | 고치고 지울 수 있는 사람 |
| --- | --- | --- |
| 비공개(PRIVATE) | 만든 사람 | 만든 사람 |
| 팀 공개(TEAM) | 그 팀의 팀원 | **만든 사람만** |

팀 공개는 '보이는 범위'일 뿐 '고칠 권한'이 아니다. 그래서 남의 팀 일정을 누르면 팝업에
수정·삭제 버튼이 아예 그려지지 않고, 대신 누가 만든 것인지가 보인다. 그 판단(`canEdit`)은
서버가 계산해 준다 — 규칙이 화면과 서버 두 곳에 있으면 언젠가 갈린다.

공개 범위는 화면에서 **한 칸**으로 고른다(`비공개` / `<팀 이름> 팀 공개`). 값은 둘
(visibility + teamId)이지만 사용자가 정하는 것은 "누구에게 보일까" 하나이고, 칸을 둘로
나누면 '팀 공개인데 팀을 안 고른' 상태를 사용자가 만들 수 있다.

## 백엔드

### schema / migration

`calendar_event` table과 `CalendarEventVisibility` enum을 추가했다. 자세한 설명과 ERD는
[일정 Database Schema](../../../calendar_database_schema.md)에 있다.

문서를 새로 만든 이유: `AGENTS.md`는 DB 변경 시 `docs/auth_database_schema.md`를 갱신하라고
하는데 그 문서가 저장소에 없다. 특허 도메인 문서(`patent_database_schema.md`)에 넣기에는
도메인이 다르므로(이 table의 FK는 `user`·`team`이다), 같은 형식의 문서를 따로 두었다.

- Migration: `backend/prisma/migrations/20260825120000_add_calendar_event/`
- 날짜는 시각 없는 `date`, 시각은 `HH:mm` 문자열이다. `timestamp` 하나로 두면 시간대에 따라
  하루가 밀려 보인다.
- 새 table이라 앱 롤 GRANT 복사 블록을 함께 넣었다(`team`의 권한을 복사).

정합성 확인: `schema.prisma`의 model·index·FK와 migration SQL, ERD 문서의 column 목록이
서로 같은지 눈으로 대조했다(table 1개, index 2개, FK 2개, enum 1개).

### API — `/api/calendar-events`

| method | path | 하는 일 |
| --- | --- | --- |
| GET | `?from=&to=` | 기간이 겹치는 일정(내 것 + 내 팀 공개) |
| POST | `/` | 등록 |
| PUT | `/:id` | 수정(전체 교체) |
| DELETE | `/:id` | 삭제 |

- 권한은 `patentAnalysis.read` 하나만 요구한다. 여기서 만드는 것은 **자기 일정**이라 관리자
  권한(`manage`)의 대상이 아니다. 남의 것을 못 건드리게 하는 일은 권한이 아니라 소유자
  검사(service)가 한다.
- PATCH가 아니라 PUT인 이유: 값들이 서로 얽혀 있다(종일이면 시각이 없어야 하고, 팀 공개면
  팀이 있어야 한다). 부분 수정을 받으면 "기존 값 + 새 값"의 조합마다 그 규칙을 다시 따져야 한다.
- 서버도 화면과 같은 규칙을 다시 본다(종일/시각, 기간 순서, 팀 소속). API는 화면 말고도
  부를 수 있고, 어긋난 조합이 들어오면 달력이 그리지 못한다.

## 프런트엔드

저장 계층만 갈아 끼웠다. 달력 컴포넌트는 그대로다 — 그러라고 계층을 나눠 두었다.

```
ScheduleCalendar → SchedulePanel → useCalendarEvents → CalendarEventGateway
                                                        ├ calendarEventApi (실제 화면)
                                                        └ 메모리 구현 (harness)
```

- 추가: `frontend/src/services/calendarEventApi.ts`
- 삭제: `frontend/src/services/calendarEventStore.ts`(localStorage)
- `hooks/useCalendarEvents.ts`: 보이는 기간을 받아 조회하고, 등록·수정·삭제 뒤에는 목록을
  다시 부른다. 캐시하지 않는다 — 사용자가 방금 고칠 수 있는 값이라 오래된 목록을 들고 있으면
  다른 자리에서 만든 일정이 안 보이거나 지운 일정이 남는다.
- `utils/calendarEvents.ts`: `CalendarEvent`가 서버 응답 모양이 됐다(`visibility`, `teamId`,
  `teamName`, `owner`, `canEdit`). 브라우저 저장용이던 `createCalendarEvent`/`parseCalendarEvent`는
  없앴다(id·작성자·시각 도장은 이제 서버가 찍는다).
- `ScheduleEventModal`: `공개 범위` 칸 추가. 속한 팀이 없으면 비공개만 고를 수 있다.
- `ScheduleEventPopover`: `공개` 줄 추가, 남의 일정이면 수정·삭제 대신 작성자를 보여 준다.
- 머리글의 새로고침이 일정도 다시 부른다(`refreshToken`).

## 확인한 것

- 백엔드 `jest src/calendar-event` — **17건 통과**
  - 기간이 "겹치는" 조건으로 묻는가(시작일만 보지 않는가)
  - 내 것 + 내 팀 공개만 가져오는가, 팀이 없으면 팀 조건이 아무것도 걸지 않는가
  - 종일이면 시각을 버리는가, 반쪽 시각은 종일로 되돌리는가
  - 하루 안에서 거꾸로 된 시각·거꾸로 된 기간을 거절하는가
  - 여러 날짜 일정은 끝 시각이 앞서도 받는가(다음 날이므로)
  - 내가 속하지 않은 팀으로 공개할 수 없는가, 비공개면 팀 연결을 끊는가
  - 남의 일정은 팀에 공개돼 있어도 고치거나 지울 수 없는가
- 백엔드 전체 `jest` — 98건 통과. 기존에도 실패하던 suite 5개는 그대로다(생성된 Prisma
  client가 `import.meta`를 써서 ts-jest가 파싱하지 못하는 문제로, 이번 변경과 무관하다.
  `app.module.ts` 변경분을 stash하고 다시 돌려 같은 결과를 확인했다).
- 프런트 `tsc -b` 통과, harness 단정 **43건 통과**(localStorage 저장 단정 5건이 빠지고
  공개 범위 단정 3건이 들어왔다).
- harness에서 손으로: 남이 만든 팀 일정 팝업에 `닫기`만 있는 것, 팀 공개로 등록하면 팝업
  `공개` 줄에 `IP 팀 공개`가 뜨고 내 일정이라 수정·삭제가 보이는 것.

실제 화면(AuthGate 뒤)과 실물 DB 연결은 확인하지 못했다. 마이그레이션 적용과 백엔드 기동은
사용자가 한다(`AGENTS.md`).

## 다음에 할 일

- `cd backend && bun run prisma:migrate:deploy`(또는 `migrate:dev`)로 마이그레이션 적용.
  적용 전에는 일정 위젯이 "일정을 불러오지 못했습니다"만 보여 준다.
- 남은 것: 반복 일정, 끌어서 옮기기, 알림. 전사 공개가 필요해지면 enum에 값을 더한다
  (column은 그대로 쓴다).
