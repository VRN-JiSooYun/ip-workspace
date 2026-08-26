# 특허 전문 검색 API

OA(의견제출통지서)·의견서·보정서 **전문(full-text) 검색** 기능의 기준 문서다.
`backend/src/patent-search/`와 `frontend/src/services/patentSearchApi.ts`가 이 문서를 따른다.

## 왜 외부 API를 중계하는가

로컬 `patent` table 묶음(`docs/patent_database_schema.md`)에는 특허 본체와 코드 테이블만
IP팀 CSV로 적재되어 있고 `office_action`·`response` 본문은 비어 있다. 검색 대상 문서 전문은
외부 서비스에만 있으므로 이 검색은 Prisma 조회가 아니라 외부 API 중계로 구현했다.

- 외부 endpoint: `POST {PATENT_SEARCH_API_URL}/patents/search` (FastAPI, OpenAPI 제공)
- 기본값: `http://172.16.1.210:10000`
- 외부 DB 구조는 로컬 Prisma 특허 도메인과 유사하지만 코드 ID가 같다고 가정하지 않는다.
  외부 `country`·`legal_status`·`exam_status`는 `/api/oa-lookups` 응답으로 해석한다.

## 우리 endpoint

```
POST /api/patent-search       (권한: patentAnalysis.read)
```

조건이 중첩 객체라 GET이 아닌 POST를 쓴다. 로컬 CRUD인 `api/patent-records`,
특허 분석 helper 중계인 `api/patents`와는 별개 prefix다.

### Request

```jsonc
{
  "page": 1,              // 1부터. 최소 1
  "size": 20,             // 1~100
  "includeContent": true, // false면 본문 대신 contentLength만 받는다
  "includePatentDetail": false, // true면 각 결과에 patent 상세를 붙인다 (아래 참고)
  "filters": {
    "legalStatusText": ["등록"],     // legal_status.status 원문
    "examStatusText": ["심사중"],
    "examRequested": true,           // 심사청구 여부
    "attorneyNames": ["홍길동"],
    "examinerNames": ["김심사"],
    "hasOpinion": true,              // 의견서가 제출된 OA만
    "hasAmendment": true,            // 보정서가 제출된 OA만
    "ipc": [{ "section": "A", "classCode": "61", "subclass": "K",
              "mainGroup": "31", "subgroup": "00" }],
    "statutes": [{ "lawTypeText": "특허법", "lawType": 1,
                   "article": 29, "paragraph": 2, "subParagraph": 1 }],
    "dateRanges": [{ "field": "applicationDate",
                     "from": "2023-01-01", "to": "2023-12-31" }]
  },
  "keywords": [
    { "query": "egfr", "target": "officeAction", "operator": "AND" },
    { "query": "egfr", "target": "opinion", "operator": "AND" }
  ]
}
```

- `filters`·`keywords`를 모두 생략하면 조건 없이 전체를 조회한다.
- `keywords` 항목이 여러 개면 **서로 AND**로 묶인다.
- `statutes[].lawTypeText`와 `lawType`을 함께 주면 명칭(`lawTypeText`)이 우선한다.
  외부 API가 `law_type`을 `int | str`로 받기 때문이다.
- 값이 비어 있는 `ipc`/`statutes`/`dateRanges` 항목과 빈 배열은 서버가 제거하고 보내지 않는다.

`dateRanges[].field`는 다음 5개다.

| 값 | column |
| --- | --- |
| `applicationDate` | `application_date` |
| `publicationDate` | `publication_date` |
| `intApplicationDate` | `int_application_date` |
| `intPublicationDate` | `int_publication_date` |
| `examDate` | `exam_date` |

`keywords[].target`은 `officeAction`(의견제출통지서) / `opinion`(의견서) / `amendment`(보정서),
`operator`는 `AND` / `OR` / `NOT`(생략 시 `AND`)이다.

### Response

결과 1건은 **특허가 아니라 OA 1건**이다. 같은 특허에 OA가 여러 건이면 여러 행으로 나온다.

```jsonc
{
  "total": 96,
  "page": 1,
  "size": 20,
  "items": [{
    "officeActionId": 11933,
    "relevanceScore": 3.0359515666390378, // 키워드가 없으면 null
    "adminId": 108858,
    "content": "발송번호: ...",   // includeContent=false면 null
    "contentLength": 3135,        // 항상 원문 길이
    "documentPath": "http://172.16.1.210:8888/oa/2023/..._의견제출통지서_20260526.pdf",
    "actionDate": "2026-05-26T00:00:00",
    "action": "의견제출통지서",
    "actionNumber": "952026047366213",
    "patentId": 10625,
    "applicationNumber": "1020237016326",
    "koreanTitle": "...", "englishTitle": "...", "applicant": "...",
    "legalStatusId": 1, "examStatusId": 1, "exam": true,
    "examiners": [{ "id": 949, "office": "지식재산처", "bureau": "특허심사기획국",
                    "department": "가전제품심사과", "name": "김재호" }],
    "submissions": [{ "id": 9369, "typeCode": 1, "kind": "OPINION",
                      "content": "# 의견서...", "contentLength": 547,
                      "documentPath": "..." }],
    "rejections": [{ "rejectionId": 11933, "claim": "청구항 제4항, 제15항 내지 제19항",
                     "lawType": 1, "article": 42, "paragraph": 4, "subParagraph": 2 }]
  }]
}
```

이름을 바꾼 부분은 다음과 같다.

| 외부 응답 | 우리 응답 | 이유 |
| --- | --- | --- |
| `office_action_content` | `content` | item 자체가 OA라 접두어가 중복된다 |
| `office_action_document_path` | `documentPath` | 같음 |
| `admin_id`, `admin_id_ref` | `adminId` | 두 값이 항상 같아 하나만 내보낸다 |
| `responses` | `submissions` | TS `Response`와 이름이 겹친다 |
| `legal_statutes` | `rejections` | `rejection_id`·`claim`이 rejection의 column이라 실제로 rejection 행이다 |
| `legal_status`, `exam_status` | `legalStatusId`, `examStatusId` | FK int임을 드러낸다 |

`legalStatus`는 기존 호환을 위해 알려진 `legalStatusId` 1~10을 이름으로 옮긴 값이다. UI의
filter option과 문서 레일 상태 표시는 외부 DB를 직접 읽는 `/api/oa-lookups`를 정본으로 사용한다.

| id | status |
| --- | --- |
| 1 | 공개 |
| 2 | 취하 |
| 3 | 거절 |
| 4 | 등록 |
| 5 | 포기 |
| 6 | 소멸 (등록료불납) |
| 7 | 소멸 (취소) |
| 8 | 소멸 (포기) |
| 9 | 소멸 (기각) |
| 10 | 소멸 ( ) |

`examStatusId`의 이름도 `/api/oa-lookups`의 `examStatuses`에서 찾는다.

## `includePatentDetail` — 검색 응답에 없는 column 채우기

검색 응답에는 **출원일자·공개번호·공개일자·등록번호·등록일자**가 없다. 목록 카드가 이 값들을
쓰기 때문에 `includePatentDetail: true`를 주면 서버가 결과의 출원번호마다
`GET /patents/?application_number=...`를 한 번 더 불러 `patent`에 붙인다.

- 출원번호를 **중복 제거한 뒤 병렬로** 조회한다. 같은 특허에 OA가 여러 건이면 한 번만 부른다.
- 20건 기준 0.2초 내로 끝난다(측정값).
- 개별 조회가 실패하면 해당 항목의 `patent`만 `null`이 되고 검색 결과는 그대로 쓴다.
- 응답에 함께 오는 `title_embedding`(벡터)은 전달하지 않는다.
- 필요 없는 호출자에게 비용을 지우지 않으려고 기본값은 `false`다.

```jsonc
"patent": {
  "applicationDate": "2021-05-25T00:00:00",
  "registrationNumber": null,
  "registrationDate": null,
  "publicationNumber": "1020230015954",
  "publicationDate": "2023-01-31T00:00:00",
  "intApplicationNumber": "PCT/US2021/034000",
  "intApplicationDate": "2021-05-25T00:00:00",
  "intPublicationNumber": "WO2021242728",
  "intPublicationDate": "2021-12-02T00:00:00",
  "parentApplicationNumber": null,
  "examDate": "2024-05-13T00:00:00",
  "countryId": 1,
  "attorneyNumber": null
}
```

## 정렬

외부 API에 별도 정렬 parameter는 없다. 대신 검색 조건에 따라 다음 순서를 자동 적용한다.

- 키워드 있음: `relevance_score` 내림차순. 중계 API는 이를 `relevanceScore`로 전달한다.
- 키워드 없음: 의견제출통지서 발행일자(`action_date`) 내림차순.

프런트의 Sort By도 마지막으로 실행한 검색의 키워드 유무에 따라 `관련도순` 또는
`의견제출통지서 발행일자순`을 자동 표시한다. 전체 결과는 외부 API에서 정렬되므로 현재
페이지의 항목만 프런트에서 다시 정렬하지 않는다.

## 외부 코드 테이블

`GET /api/oa-lookups`는 검색 API의 단건 코드 조회 endpoint와 별도로 OA PostgreSQL을 직접
읽어 전체 select 목록을 제공한다. 2026-08-25 확인값은 `country` 3건,
`exam_status` 14건(빈 값 1건은 제외), `legal_status` 10건이다. 연결 설정과 전체 응답 계약은
[`oa_database.md`](./oa_database.md)를 따른다.

`legal_status`의 전체 값과 건수(합 13,486 / 전체 13,488):

| 등록 | 공개 | 거절 | 취하 | 포기 | 소멸 (등록료불납) |
| --- | --- | --- | --- | --- | --- |
| 7,329 | 3,102 | 2,474 | 158 | 177 | 246 |

`law_type`은 1=특허법(13,488) / 2=특허법 시행령(2,452)뿐이고 3 이상은 0건이다.
명칭으로 넘길 때는 공백까지 정확해야 한다("특허법시행령"은 0건).

`documentPath`는 **우리 서비스를 거치는 경로**로 바꿔서 내려간다.

```
저장·상류:  http://172.16.1.210:8888/oa/2022/….pdf
응답:       /patent-documents/oa/2022/….pdf
```

이유는 파일 호스트(SeaweedFS)에 **인증이 없기 때문이다.** 주소만 알면 누구나 받아 갈 수
있고 주소도 규칙적이라(`/oa/{연도}/{출원번호}_{문서종류}_{YYYYMMDD}.pdf`), 그 호스트를
밖에 열면 5만여 건이 전부 공개된다. 대신 `GET /api/patent-documents/*`가 중계하고 거기에
기존 세션·권한(`patentAnalysis.read`)이 걸린다. 설명 편집기 이미지를
`/patent-records/:id/note-images/:fileName`으로 내보내는 것과 같은 방식이다.

- **origin만 바꾸고 경로는 그대로 둔다.** 화면이 이 주소에서 파일명과 날짜를 읽어
  타임라인을 만든다(`patentDocumentNodes.ts`). 질의 문자열에 경로를 담는 식으로 모양을
  바꾸면 그 파싱이 조용히 깨진다.
- 돌려주는 값은 **API 기준 상대 경로**다. 브라우저가 이 서버를 어떤 주소로 부르는지
  서버는 모르므로(앞단 nginx의 `/ip-workspace/` prefix), 완성은 화면이 한다
  (`patentRecordApi.documentDisplayUrl`).
- 중계는 `Range`를 그대로 넘긴다. PDF.js가 첫 화면만 먼저 받아 그리는데, 삼키면 매번
  파일 전체를 받아야 열린다(상류는 `Accept-Ranges: bytes`를 준다).
- 통과시키는 경로는 `/oa/**`와 `/response/**`뿐이다(`common/document-url.ts`). 이 목록이
  곧 열린 프록시가 되지 않게 막는 문이다.
- **저장은 원본 그대로 한다.** 중계 경로는 배포 구조지 데이터가 아니다 — 저장해 두면
  구조가 바뀔 때마다 쌓인 주소가 전부 틀린 값이 된다.
- `PATENT_DOCUMENT_FILE_ORIGIN`을 비우면 중계하지 않고 상류 주소를 그대로 내보낸다.
  그때는 브라우저가 파일 호스트로 직접 가므로 사내망에서만 열린다.

자격증명은 **주소에 따라 다르다.** 하나로 고정하면 둘 중 하나가 반드시 깨진다.

| 주소 | origin | 자격증명 |
| --- | --- | --- |
| 중계 경로(`/patent-documents/…`) | 우리와 같다 | **보내야 한다.** 세션이 있어야 권한 검사를 통과한다 |
| 상류 주소(중계를 끄면) | 파일 호스트 | **보내면 안 된다.** `Access-Control-Allow-Origin: *`라 브라우저가 막는다(`'include'` 실패 / `'omit'` 200 확인) |

`PatentDocumentPdfPane`이 주소를 보고 정한다 — 서버가 준 값이 중계 경로면
`withCredentials: true`, 상류 주소 그대로면 `false`다.

`submissions[].typeCode`는 외부 `response.type` 원본이고 `kind`는 그 해석값이다.

| `typeCode` | `kind` | 문서 |
| --- | --- | --- |
| 1 | `OPINION` | 의견서 |
| 2 | `AMENDMENT` | 보정서 |

정의되지 않은 코드가 오면 `kind`는 `null`이 되고 `typeCode`는 원본이 유지된다.

## 외부 API 결함으로 막아 둔 조건

아래 두 가지는 **어떤 입력으로도 성공할 수 없어** 우리 계약에서 제외했다. 외부에서 고쳐지면
표시한 위치만 되돌리면 된다.

### 1. keyword의 target 2개 이상 → 외부 500

`targets`에 2개 이상을 넣으면 operator와 무관하게 실패한다.

```
데이터베이스 에러: index should have a `WITH (key_field='...')` option
```

외부 스키마의 `targets` **기본값이 3개 전부**라 `targets`를 생략해도 이 오류가 난다.
그래서 우리 DTO는 배열 `targets`가 아니라 단일 `target`만 받는다. 여러 문서를 함께 조건에
넣으려면 항목을 여러 개 보내면 되고(항목 간 AND), notebook 예시도 같은 방식이다.

- 위치: `PatentSearchKeywordDto.target` (`backend/src/patent-search/dto/patent-search.dto.ts`)
- 되돌릴 때: `target` → `targets: string[]`로 바꾸고 service의 `toUpstreamKeyword`에서 배열을 그대로 전달

### 2. `registrationDate` 기간 조건 → 외부 500

```
operator does not exist: text >= timestamp without time zone
```

`patent.registration_date`가 timestamp가 아닌 **text** column이기 때문이다(로컬 Prisma도
`registrationDate String?`). 다른 5개 날짜 column은 정상 동작한다.

- 위치: `PATENT_SEARCH_DATE_FIELDS` (backend DTO / frontend `patentSearchApi.ts`)
- 되돌릴 때: 양쪽 배열에 `registrationDate`를 추가하고 service의 `DATE_FIELD_TO_UPSTREAM`에 매핑 추가

### 그 밖의 방어

| 입력 | 외부에서 일어나는 일 | 우리 처리 |
| --- | --- | --- |
| `page: 0` | `OFFSET must not be negative` 500 | DTO `@Min(1)`로 차단 |
| `size > 100` | 응답이 수 MB로 커진다 (건당 본문 10KB 초과) | DTO `@Max(100)`로 차단 |
| 범위를 넘는 `page` | `data: []`와 함께 요청한 page를 그대로 반사 | 그대로 전달. 응답의 `page`/`size`는 요청값을 돌려준다 |

## 오류 형식

외부 오류는 그대로 노출하지 않고 아래 code로 감싼다. 원문은 `detail`에 남긴다.

| code | HTTP | 상황 |
| --- | --- | --- |
| `PATENT_SEARCH_UPSTREAM_ERROR` | 502 | 외부가 4xx/5xx로 응답하거나 연결 불가. `upstreamStatus`에 원래 status |
| `PATENT_SEARCH_UPSTREAM_TIMEOUT` | 504 | `PATENT_SEARCH_API_TIMEOUT_MS` 초과 |
| `PATENT_SEARCH_UPSTREAM_INVALID_RESPONSE` | 502 | 200이지만 `data` 배열이 없는 응답 |

외부 API는 검증 실패를 FastAPI 형식(`{"detail": [...]}`)으로 주므로 `detail`을 보면 원인을 알 수 있다.

## 환경 변수

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `PATENT_SEARCH_API_URL` | `http://172.16.1.210:10000` | 외부 검색 API base URL |
| `PATENT_SEARCH_API_TIMEOUT_MS` | `60000` | 본문이 커서 전역 30s보다 길게 잡았다 |
| `PATENT_DOCUMENT_FILE_ORIGIN` | `http://172.16.1.210:8888` | OA 문서 PDF 파일 호스트. 서비스가 이 주소를 중계한다 |

controller에는 `@SkipTimeout()`이 붙어 있어 전역 `TimeoutInterceptor`가 적용되지 않는다.
실제 제한은 위 client timeout이다.

## 사용 예시 (frontend)

```ts
import { patentSearchApi } from '@/services/patentSearchApi';

// notebook의 예시와 같은 조건
const result = await patentSearchApi.search({
  filters: { hasOpinion: true, hasAmendment: true },
  keywords: [
    { query: 'egfr', target: 'officeAction' },
    { query: 'egfr', target: 'opinion' },
  ],
});

// 목록 화면: 본문 없이 조회해 응답 크기를 줄인다
const list = await patentSearchApi.search({ size: 50, includeContent: false });
```

원본 참고 구현은 저장소 루트의 `search_client.ipynb`다.
