# 공휴일 캘린더 연동 (Google Calendar)

특허 관리 > 일정 달력의 공휴일 빨간색 표시에 쓰이는 데이터 소스 설정 문서다.

## 구조

```
프런트 (PatentManagement)
  └─ useHolidayName(years)         frontend/src/hooks/useHolidayName.ts
       ├─ GET /api/holidays?year=  성공 → 이 값을 쓴다
       └─ koreanHolidays.ts        실패·미설정 → 로컬 표로 폴백
백엔드 (HolidayModule)
  └─ HolidayService               연 단위 캐시(기본 12h), 캘린더 병합, 기념일 제외
       └─ GoogleCalendarClient    서비스 계정 JWT → Calendar API events.list
```

프런트가 Google을 직접 부르지 않는 이유는 세 가지다. 자격증명이 브라우저에 노출되고,
Calendar API는 브라우저 출처에 CORS를 열어주지 않으며, 캐시가 서버에 있어야 사용자 수와
무관하게 상위 호출량이 일정하다.

**자격증명이 없어도 화면은 정상 동작한다.** 그 경우 `/api/holidays`는 오류가 아니라
`{ configured: false, holidays: [] }`를 주고, 프런트는 `koreanHolidays.ts` 표를 쓴다.

## 설정 절차

### 1. 서비스 계정 만들기

1. [GCP 콘솔](https://console.cloud.google.com) → 프로젝트 선택 → **API 및 서비스 > 라이브러리**
   에서 **Google Calendar API** 사용 설정
2. **IAM 및 관리자 > 서비스 계정 > 서비스 계정 만들기**
   - 이름 예: `ipws-calendar-reader`
   - 역할 부여는 **필요 없다** (GCP IAM 역할이 아니라 캘린더 공유로 권한을 준다)
3. 만든 서비스 계정 → **키 > 키 추가 > 새 키 만들기 > JSON** → 다운로드
4. 서비스 계정 이메일을 복사해 둔다 (`...@<project>.iam.gserviceaccount.com`)

### 2. 키 배치

내려받은 JSON을 아래 경로에 둔다.

```
secrets/google/calendar-sa.json      →  /run/secrets/google/calendar-sa.json
```

그리고 `docker-compose.yml`에서 두 줄의 주석을 함께 푼다.

- `volumes:`의 `./secrets/google/calendar-sa.json:...:ro` 마운트
- `.env`(또는 배포 환경)에 `GOOGLE_CALENDAR_SA_FILE=/run/secrets/google/calendar-sa.json`

마운트를 기본 활성으로 두지 않은 이유는, 파일이 없는 상태로 `docker compose up`을 하면
compose가 그 경로에 **디렉터리를 만들어 버려** 나중에 키를 넣기 어려워지기 때문이다.

> 이 파일은 절대 커밋하지 않는다. `secrets/`는 `.gitignore:76`에 이미 들어 있다.

### 3. 캘린더 공유

공개 공휴일 캘린더(`ko.south_korea#holiday@group.v.calendar.google.com`)는 공개라
별도 공유가 필요 없다. **사내 캘린더**를 붙일 때만 아래를 한다.

1. Google Calendar에서 해당 캘린더 → **설정 및 공유**
2. **특정 사용자와 공유** → 1번에서 복사한 서비스 계정 이메일 추가
3. 권한은 **"모든 일정 세부정보 보기"** (읽기 전용)

Workspace 관리자 권한이나 도메인 전체 위임(DWD)은 필요하지 않다.

### 4. 환경변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `GOOGLE_CALENDAR_SA_FILE` | (빈 값 = 비활성) | 서비스 계정 JSON 경로. 켤 때 `/run/secrets/google/calendar-sa.json`을 넣는다 |
| `GOOGLE_HOLIDAY_CALENDAR_IDS` | `ko.south_korea#holiday@group.v.calendar.google.com` | 읽을 캘린더 ID, CSV. 앞에 있는 캘린더가 같은 날짜에서 이긴다 |
| `GOOGLE_HOLIDAY_OBSERVANCE_MARKERS` | `observance,관습일,기념일,절기,season` | 이 문자열이 `description`에 있으면 공휴일로 보지 않는다 |
| `GOOGLE_CALENDAR_API_TIMEOUT_MS` | `15000` | |
| `HOLIDAY_CACHE_TTL_MS` | `43200000` (12h) | |

사내 휴무 캘린더를 추가할 때는 **코드 수정 없이** ID만 덧붙인다:

```
GOOGLE_HOLIDAY_CALENDAR_IDS=ko.south_korea#holiday@group.v.calendar.google.com,company-holidays@voronoi.io
```

## 확인해야 할 것 (첫 연동 시)

Google 공휴일 캘린더에는 공휴일이 아닌 기념일(어버이날, 발렌타인데이 등)도 함께 들어 있고
`description` 필드로만 구분된다. 이 표기가 로케일·시점에 따라 달라질 수 있어서
`GOOGLE_HOLIDAY_OBSERVANCE_MARKERS`의 기본값은 **추정치**다.

연동 직후 아래를 확인할 것:

1. 백엔드 로그에서 `HolidayService`의 `Loaded N holidays for 2026` 건수 확인
   → 연 15~20건 수준이면 정상. 40건을 넘으면 기념일이 섞여 들어온 것이다.
2. debug 로그의 `skipped N observance events (...)` 줄에 실제 `description` 값이 찍힌다.
   그 값을 보고 `GOOGLE_HOLIDAY_OBSERVANCE_MARKERS`를 조정한다.
3. 달력에서 5월 8일(어버이날)이 빨간색이면 필터가 안 먹은 것이다.

## 로컬 폴백 표 관리

`frontend/src/utils/koreanHolidays.ts`의 `LUNAR_BASED_HOLIDAYS`는 2024–2030년만 담고 있다.
API 연동이 정상 동작하는 동안에는 쓰이지 않지만, 폴백으로 남겨 두었으므로
2031년 이후를 대비하려면 표를 연장하거나 폴백을 제거해야 한다.
임시공휴일(선거일 등)은 표로는 잡히지 않고 API로만 들어온다.
