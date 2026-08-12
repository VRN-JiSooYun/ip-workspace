# 특허 전문 검색 API 구현

- 날짜: 2026-08-11
- 대상: `search_client.ipynb`의 `/patents/search` 클라이언트를 백엔드 endpoint와 프론트엔드 service로 구현
- 기준 문서: [patent_search_api.md](../../../patent_search_api.md)

## 작업 목적

저장소 루트의 `search_client.ipynb`는 외부 FastAPI(`http://172.16.1.210:10000/patents/search`)를
직접 호출하는 Python 프로토타입이다. 이 검색(OA·의견서·보정서 전문 검색)을 IP Workspace에서
쓸 수 있도록 NestJS endpoint와 프론트엔드 service로 옮겼다.

## 왜 Prisma 조회가 아니라 중계인가

로컬 특허 도메인 14개 table(`docs/patent_database_schema.md`)은 외부 스키마와 동일하지만,
현재 IP팀 CSV 임포트로 `patent`와 코드 테이블만 채워져 있고 `office_action`·`response` 본문은
비어 있다. 검색 대상인 문서 전문이 외부에만 있으므로 Prisma 조회로는 결과가 나올 수 없다.
따라서 `PatentAnalysisHelperClient`와 같은 중계 방식으로 구현했다.

## 변경 내용

### 신규 — backend `src/patent-search/`

| 파일 | 역할 |
| --- | --- |
| `patent-search.module.ts` | `HttpModule` 기반 module |
| `patent-search.controller.ts` | `POST /api/patent-search`, 권한 `patentAnalysis.read`, `@SkipTimeout()` |
| `patent-search.service.ts` | camelCase DTO ↔ 외부 snake_case 변환, 응답 정규화 |
| `patent-search.client.ts` | axios 호출, timeout·오류 code 매핑 |
| `patent-search.types.ts` | 외부 wire 형식(snake_case) 정의 |
| `dto/patent-search.dto.ts` | 중첩 조건 검증 DTO |
| `patent-search.service.spec.ts` | 매핑 단위 테스트 14개 |

### 신규 — frontend

- `src/services/patentSearchApi.ts`: 타입, `patentSearchApi.search()`, 라벨 상수.
  기존 `patentRecordApi.ts`의 `request`/base URL 규약을 그대로 따랐다.

### 수정

- `src/config/configuration.ts`: `patentSearch.apiUrl`, `patentSearch.timeoutMs`(기본 60s) 추가
- `src/config/env.validation.ts`: `PATENT_SEARCH_API_URL`(URL), `PATENT_SEARCH_API_TIMEOUT_MS`(숫자) 검증
- `src/app.module.ts`: `PatentSearchModule` 등록
- `package.json`: jest `setupFiles: ["reflect-metadata"]` 추가.
  decorator가 붙은 DTO를 import하는 첫 spec이라 없으면 `Reflect.getMetadata is not a function`으로 suite가 죽는다.

## 계약 설계 판단

- **결과 단위는 특허가 아니라 OA 1건**이다. 같은 특허의 OA가 여러 건이면 여러 행으로 나온다.
  응답 field명을 `officeActionId` 기준으로 두고 `office_action_content` → `content`로 줄였다.
- `responses` → `submissions`로 개명. TS의 `Response`와 겹친다.
- `legal_statutes` → `rejections`로 개명. `rejection_id`·`claim`이 rejection의 column이라
  실제 내용이 rejection 행이다.
- `response.type`(1/2)에 `kind`(`OPINION`/`AMENDMENT`)를 덧붙였다. 미정의 코드는 `kind`만 `null`이 되고
  `typeCode`는 원본을 유지해 정보가 사라지지 않게 했다.
- `includeContent: false` 옵션 추가. 본문이 건당 10KB를 넘어 `size=100`이면 응답이 2.7MB다.
  목록 화면에서 본문을 빼고 `contentLength`만 받을 수 있게 했다.
- 응답의 `page`/`size`는 외부 값이 아니라 **요청값**을 돌려준다. 외부는 범위를 넘는 page도
  그대로 반사하므로 요청과 일치시키는 편이 예측 가능하다.

## 외부 API 결함 2건 (기능 제한으로 반영)

검증 중 발견했다. 둘 다 어떤 입력으로도 성공할 수 없어 우리 계약에서 제외했다.
되돌리는 방법은 기준 문서에 적어 두었다.

1. **keyword의 target 2개 이상 → 외부 500**
   `index should have a `WITH (key_field='...')` option`. operator와 무관하다.
   외부 스키마의 `targets` 기본값이 3개 전부라 `targets`를 **생략해도** 실패한다.
   → 우리 DTO는 배열 `targets` 대신 단일 `target`을 받는다. 여러 문서를 조건에 넣으려면
   항목을 여러 개 보내며 항목 간에는 AND다(notebook 예시와 동일한 방식).

2. **`registrationDate` 기간 조건 → 외부 500**
   `operator does not exist: text >= timestamp without time zone`.
   `patent.registration_date`가 text column이기 때문이다(로컬 Prisma도 `String?`).
   → 날짜 field 목록에서 제외했다. 나머지 5개는 정상이다.

추가 방어: `page: 0`은 외부에서 `OFFSET must not be negative` 500이 되므로 `@Min(1)`로,
`size`는 응답 크기 때문에 `@Max(100)`으로 막았다.

## 검증 결과

### 단위 테스트

```
bunx jest src/patent-search
Test Suites: 1 passed, 1 total
Tests:       14 passed, 14 total
```

### 실제 외부 API 연동 검증

service가 생성한 payload를 그대로 외부 API에 전송해 확인했다(조건별 13건 전부 HTTP 200).

| 조건 | 결과 |
| --- | --- |
| 조건 없음 | 200, total 13,488 |
| notebook 예시(hasOpinion+hasAmendment+keyword 2개) | 200, total 96 — notebook 실행 결과와 동일 |
| `dateRanges` (출원일 2023) | 200, total 1,021 |
| 허용된 날짜 field 5개 동시 | 200, total 6,319 |
| `ipc` (A61) | 200, total 11,643 |
| `statutes` 코드 / 명칭 | 200, total 9,131 / 9,824 |
| `legalStatusText` (등록) | 200, total 7,329 |
| `examinerNames` | 200, total 65 |
| `examRequested` | 200, total 13,488 |
| keyword `NOT` / `OR` | 200, total 107 / 155 |
| `includeContent: false`, size 5 | 200, 5행 |

DTO가 막아야 할 입력 8종(`page: 0`, `size: 101`, 알 수 없는 날짜 field·target·operator,
빈 query, 미허용 top-level key, 구형 `targets` 배열)은 전부 거부됨을 확인했다.

### 응답 매핑 검증 (실데이터 25건)

- 매핑 후 `null`로 남은 field 없음
- `submissions[].kind` 전부 해석됨(`OPINION`/`AMENDMENT`), 미해석 0건
- `examiners`·`submissions`·`rejections` 25건 모두 채워짐
- `includeContent: false`에서 본문 유출 없음, `contentLength`는 유지됨

### 정적 검사

- backend `tsc --noEmit`: 이 작업 범위에서 오류 없음
- backend `eslint src/patent-search/**`: 통과
- frontend `tsc --noEmit`: 전체 통과

## UI 연동 (특허 관리 페이지)

`frontend/src/pages/PatentManagement.tsx`의 **관련 특허 목록**이 검색 결과를 그리고,
행을 클릭하면 오른쪽 **문서 뷰어**가 그 문서를 렌더링한다.

### 출처 토글

관련 특허 목록에 `Segmented`을 넣어 두 출처를 바꿔 본다. 기본값은 `문서 검색`이다.

| 값 | API | 조회 조건 | 비고 |
| --- | --- | --- | --- |
| `문서 검색` | `/api/patent-search` | 문서 전문 키워드 + 대상 문서, 의견서/보정서 제출 여부 | 행 클릭 → 문서 뷰어 |
| `관리 특허` | `/api/patent-records` | 관리번호·출원번호·명칭·출원인 부분 일치 | 추가·CSV 업로드·변경·삭제 |

두 출처를 합치지 않고 토글로 나눈 이유는 **조회할 수 있는 조건과 할 수 있는 일이 다르기**
때문이다. 검색 API에는 출원번호·명칭 부분 일치 검색이 없고(전문 키워드와 구조화된 filter만
있다), 결과 행이 OA라 로컬 `patent.id`가 없어 변경·삭제 대상으로 쓸 수 없다. 반대로 로컬
table에는 문서 본문이 없어 뷰어를 채울 수 없다. 어느 한쪽으로 합치면 기존 CRUD가 사라지거나
문서 뷰어가 비게 된다.

### 목록 (문서 검색)

- column: 출원번호 · 통지일 · 명칭 · 출원인 · 심사관 · 법적 상태 · 심사 상태 · 거절이유 · 문서
- `문서` column은 붙어 있는 문서를 badge로 보여준다(통지서 / 의견서 n / 보정서 n).
- 법적·심사 상태는 검색 API가 int만 주므로 `patentRecordApi.lookups()`의 코드 테이블로
  명칭을 찾아 표시한다. lookup을 못 받으면 `-`로 남는다.
- `includeContent: true`로 받는다. 검색 API에 단건 조회 endpoint가 없어 클릭 후 본문만
  따로 가져올 방법이 없다. 20건 기준 응답이 약 400KB다.
- 문서가 없는 행은 `pm-row-inert`로 클릭을 막는다(`hasDocuments()`).

### 문서 뷰어

`frontend/src/components/patent-management/PatentDocumentViewer.tsx` (신규)

- tab을 문서 단위로 만든다: 의견제출통지서 → 의견서 → 보정서 → 정보.
  같은 종류가 여러 건이면 `의견서 1`, `의견서 2`로 번호를 붙이고,
  `kind`를 해석하지 못한 문서도 `기타 문서` tab으로 남긴다.
- 본문은 외부 API가 평문(markdown 유사)으로 주므로 렌더러 없이 `pm-doc-body`에서
  줄바꿈만 살려 원문 그대로 보여준다.
- 문서마다 `documentPath`로 `PDF 원본 열기` 링크를 둔다.
- `정보` tab에 출원 정보, 심사관 소속, 거절이유(`제29조 제2항` 형식 + 대상 청구항)를 모은다.
- 선택이 없으면 안내 문구만 보여준다. 기존 하드코딩 placeholder(`ACTIVE_DOCUMENT`)는 제거했다.

### 확인한 화면 동작

임시로 patent-search만 올린 backend(포트 3001)와 dev server로 확인했다.

- 목록이 실데이터를 그린다: 조건 없음 총 13,488건, 20행
- 키워드 `egfr` + 의견서·보정서 제출 조건 → 총 117건, 전 행 badge가 `통지서+의견서+보정서`
- 행 클릭 → 뷰어가 해당 문서로 갱신(출원번호·통지일·문서구분·PDF 링크),
  선택 행에 `pm-row-selected` 강조
- OA 본문 11,492자, 의견서 본문 24,036자가 실제로 렌더링됨.
  의견서 tab의 PDF 경로가 `/response/opinion/...`으로 문서별로 다르게 붙는다
- `정보` tab에 심사관(이준혁, 특허청·디지털융합심사국·바이오헬스케어심사과)과
  거절이유 6건이 표시됨
- 다른 행 클릭 시 tab이 첫 문서로 초기화됨(`Tabs`에 `key` 지정)
- 출처를 `관리 특허`로 바꾸면 column과 컨트롤이 로컬 table 것으로 바뀌고 검색 filter가 사라짐
- 다크 모드에서 badge·선택 행·본문 모두 정상. 신규 CSS는 전부 공용 custom property를 쓴다
- console 오류 없음(기존 antd `destroyOnClose` deprecation 경고와 미탑재 endpoint 404 제외)

**수정한 버그**: 가운데 열이 좁아 카드 헤더가 넘칠 때 `관련 특허 목록` 제목이 한 글자씩
세로로 접혔다. `pm-list-header`로 줄바꿈을 허용하고 제목을 `flex-shrink: 0`으로 고정했다.

## 미실행 항목
- **법적·심사 상태 명칭은 로컬 DB가 떠 있어야 보인다.** 검색 API는 int만 주므로
  `patentRecordApi.lookups()`로 해석한다. 검증 환경에는 Postgres를 띄우지 않아 이 두 column을
  `-`로만 확인했다. 코드 값 자체(1, 4 등)는 로컬 `legal_status`·`exam_status`와 동일하다.
- **화면의 왼쪽·가운데 상단 패널(마감 일정, 화합물 목록, 단계 pipeline)은 그대로 placeholder다.**
  이번 작업 범위가 아니다. 화합물 선택과 단계 선택은 아직 목록 조회에 반영되지 않는다.
- **본문 키워드 하이라이트는 넣지 않았다.** 검색어가 본문 어디에 걸렸는지 표시하려면 별도 작업이다.
- **`examStatusText: ["심사중"]`은 0건**이다. 외부 `exam_status.status`의 실제 문자열을
  확인하지 못했다. 필터 자체는 동작하며(200), 값만 실데이터와 맞추면 된다.
- **DB schema·ERD 변경 없음.** 외부 API 중계라 Prisma schema·migration을 건드리지 않았고
  `docs/patent_database_schema.md`도 갱신 대상이 아니다.

## 기존 문제 (이 작업과 무관)

`backend/src/app.module.ts`가 작업 트리에서 삭제된 conference module 6개를 계속 import하고 있어
`tsc`와 jest suite 5개가 실패한다. 진행 중인 conference 제거 작업의 잔재로 보여 손대지 않았다.
`bunx jest` 기준 이 작업 전 6 suites 실패 / 9 tests 통과 → 이후 5 suites 실패 / 21 tests 통과다.
