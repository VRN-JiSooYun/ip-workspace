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
POST /api/patent-search/matches (권한: patentAnalysis.read, 전체 경량 ID 검색)
```

조건이 중첩 객체라 GET이 아닌 POST를 쓴다. 로컬 CRUD인 `api/patent-records`,
특허 분석 helper 중계인 `api/patents`와는 별개 prefix다.

## Content 없는 OA 필터 인덱스

`GET /api/patent-search/index`는 Office Actions 상세 필터를 브라우저에서 처리하기 위한 전체
OA 인덱스다. 외부 전문 검색 API를 반복 호출하지 않고 읽기 전용 OA DB에서 필터와 카드
렌더링에 필요한 구조만 조회한다.

- `office_action.content`와 `response.content`는 읽거나 응답하지 않는다.
- OA·제출 문서의 `documentPath`는 유지해 결과 선택 후 PDF를 열 수 있다.
- 법적상태, 심사진행상태, 심사관, 의견서·보정서 유무, 법조문, IPC, 대리인, 기간 필터용
  값을 포함한다.
- 출원·공개·등록 정보는 OA DB의 `patent` 행에서 함께 읽어 카드 하단을 채운다.
- OA DB의 5초 query timeout을 유지하기 위해 OA·제출 문서·심사관·법조문·IPC를 각각
  PK keyset 기준 최대 2,000행씩 나눠 읽고, Nest 서비스 메모리에서 관계를 조립한다.
- 프런트는 같은 브라우저 세션에서 응답 Promise를 캐시하고, 페이지에 다시 들어와도 재요청하지
  않는다. 요청 실패 시에는 캐시를 비워 다음 시도에서 재요청한다.

화면의 하이브리드 처리 기준은 다음과 같다.

| 조건 | 처리 위치 |
| --- | --- |
| 키워드 없음 | OA 인덱스를 프런트에서 상세 필터링·페이지네이션 |
| 키워드 있음 | `검색` 버튼 클릭 시에만 `POST /api/patent-search/matches`로 기준 목록 갱신 |
| 상세 필터 Enter·조건 적용·페이지 이동 | 마지막 기준 목록을 프런트에서 필터링·페이지네이션 |

검색어 입력창의 Enter는 조합 조건만 추가하고 Search API를 호출하지 않는다. 키워드 검색은
경량 matches endpoint에서 전체 `officeActionId`와 `relevanceScore`만 한 번에 받아 기준 목록으로
보관한다. 후속 상세 필터와 페이지 이동에서는 Search API를 다시 호출하지 않는다. matches
응답은 OA 인덱스와 OA ID로 결합해 필터 구조와 카드·PDF 경로를 유지한다.

검색바의 첫 키워드 조건은 포함 조건으로 바로 추가한다. 조건이 하나 이상 있으면 `조건 추가`
버튼 아래 Dropdown에서 새 조건의 `AND`, `OR`, `EXCLUDE` 관계를 선택한다. 미확정 검색어가 있는
상태에서는 연산자를 선택하기 전까지 `검색` 버튼을 비활성화해 묵시적인 연산자로 검색되지 않게
한다. OR로 이어진 INCLUDE 조건은 괄호로 묶고, 그룹 사이는 AND, EXCLUDE는 전역 제외로
화면에 표시한다. 한 condition에 공백으로 구분된 단어가 여러 개면 기본적으로 모두 포함해야 한다.

법조문과 IPC의 첫 조건은 바로 추가한다. 같은 그룹에 조건이 이미 있으면 `추가` 버튼 아래
Dropdown에서 앞 조건과의 `AND` 또는 `OR`를 선택한 뒤 새 조건을 추가한다. 혼합식은 일반적인
Boolean 규칙대로 AND를 먼저 묶고 OR를 계산한다. `AND`는 하나의 관계 행이 두 조건을 동시에
만족한다는 뜻이 아니라, OA/특허 전체에 각 조건과 일치하는 관계 행이 모두 존재한다는 뜻이다.
두 그룹 사이는 다른 상세 필터와 마찬가지로 AND로 결합한다. 조건 연산자는 프런트 필터 전용이며
Search API payload에는 포함하지 않는다.

### 전체 경량 키워드 매칭

`POST /api/patent-search/matches`는 브라우저의 Office Actions 목록 전용 endpoint다.

```jsonc
// request
{
  "keywords": [
    { "query": "EGFR", "target": "officeAction", "operator": "AND" },
    { "query": "HER2", "target": "officeAction", "operator": "OR" },
    { "query": "kinase inhibitor", "target": "opinion", "operator": "AND" },
    { "query": "antibody", "target": "opinion", "operator": "NOT" }
  ]
}

// response
{
  "total": 1343,
  "items": [
    { "officeActionId": 11933, "relevanceScore": 3.0359515666390378 }
  ]
}
```

- OA PostgreSQL의 `idx_office_action_content`, `idx_response_content` ParadeDB BM25 인덱스를
  직접 사용한다.
- `office_action.content`, `response.content`, 카드 관계 데이터는 응답으로 전송하지 않는다. NOT이
  있으면 포함 조건으로 먼저 좁힌 OA의 해당 target 본문만 내부 제외 판정에 사용한다.
- 각 INCLUDE condition 내부는 `paradedb.match(..., conjunction_mode => true)`를 사용해 모든
  token이 있어야 후보가 된다. 기본 raw BM25의 token OR semantics는 후보 결정에 사용하지 않는다.
- OR로 이어진 INCLUDE는 한 그룹으로 합집합하고, 다음 AND 조건은 새 그룹을 시작한다. 그룹
  사이는 교집합이므로 위 예시는 `(officeAction:EGFR OR officeAction:HER2) AND
  opinion:(kinase AND inhibitor) AND NOT opinion:antibody`다. 첫 INCLUDE의 OR는 AND로 정규화한다.
- 같은 OR 그룹·target의 대안은 `paradedb.disjunction_max` 한 번으로 검색한다. 서로 다른
  target의 대안만 target별 CTE를 `UNION ALL`하고 OA별 최고 점수를 취한다.
- NOT 조건은 BM25 analyzer의 token 판정이 아니라
  해당 target 본문에 입력 문자열이 실제로 포함되어 있는지 대소문자를 무시하고 확인한 뒤 OA ID를
  제외한다. 따라서 의견서 NOT은 같은 OA의 의견서 중 하나라도 문자열을 포함하면 결과에서 빠진다.
- OR 그룹에서는 대안 condition의 최고 BM25 score를 쓰고, AND 그룹들의 score 평균을 최종
  relevance로 사용한다. opinion/amendment가 같은 OA에 여러
  건 있어도 문서 수만으로 점수가 커지지 않도록 target별 최고 response score를 사용한다.
- 공백으로 구분된 여러 단어 검색은 모든 token을 가진 후보 안에서, target 원문에 전체 검색문이
  정확한 순서로 연속 등장하는 OA에 `해당 조건의 최고 BM25 점수 + 1`만큼 phrase bonus를 준다.
  따라서 exact phrase가 먼저 나오고, phrase가 없는 문서는 기존 BM25 순서로 이어진다.
- 최종 결과는 관련도, 발행일자, OA ID 순으로 정렬한다.
- page/size가 없으며 매칭된 전체 ID를 한 응답으로 반환한다.
- 외부 FastAPI의 100건 page 제한이나 60초 HTTP timeout에 의존하지 않는다.
- 2026-08-27 OA DB에서 `진보성` 1,343건 전체 정렬을 실행한 결과 약 53ms였다.
- 의견서 `EGFR` 포함 + 의견서 `진보성` literal 제외 조합은 약 0.72초였다.
- 의견서 `epidermal squamous cell carcinoma`는 모든 token을 가진 5개 response(4개 OA)를
  후보로 제한하고 exact phrase 2개 OA를 상단으로 승격한다. 5초 statement timeout을 건 최종
  SQL 실행시간은 약 1.64초였다.

사용자가 결과 카드를 선택하면 `GET /api/patent-search/:officeActionId/content`로 해당 OA 한
건의 통지서·의견서·보정서 본문만 지연 조회한다. PDF 경로는 인덱스 응답으로 즉시 열고, 본문
응답이 도착하면 같은 레일 항목을 보강한다. 이미 읽은 본문은 화면 메모리에 캐시한다. 프런트는
이 선택 문서 본문에서 INCLUDE 조건별 실제 일치 token과 target을 확인하고, 첫 매칭 문서를
자동으로 연 뒤 기존 PDF 검색 기능으로 token을 하이라이트한다. 전체 결과 본문이나 snippet을
추가로 요청하지 않는다.

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
- `keywords` 항목이 여러 개면 **서로 AND**로 묶인다. 아래 '키워드 항목의 순서와 operator'
  참고 — 배열 순서가 의미를 갖는다.
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
`operator`는 `AND` / `OR` / `NOT`(생략 시 `AND`)이다. 단 `OR`은 외부가 500을 낸다(아래 참고).

### 키워드 항목의 순서와 operator

2026-08-26에 상류(`http://172.16.1.210:10000/patents/search`)로 직접 측정한 결과다.
검색어는 `진보성`, 숫자는 `total`이다.

| 조건 | total |
| --- | --- |
| `officeAction` 하나 | 1,343 |
| `opinion` 하나 | 5,727 |
| `officeAction` + `opinion`(AND) | 447 |
| `officeAction` + `opinion`(NOT) | 896 |
| `opinion` + `officeAction`(NOT) | 5,280 |
| `officeAction` 하나에 `operator: NOT` | 1,343 |
| `officeAction` + `opinion`(OR) | **500** |

읽어야 할 것 세 가지다.

1. 외부는 항목을 **앞에서부터 누적 적용**한다. `AND`는 교집합(1,343 → 447), `NOT`은
   지금까지의 집합에서 차집합(1,343 − 447 = 896, 5,727 − 447 = 5,280)이다.
2. **첫 항목의 operator는 무시되고 포함으로 취급된다.** `NOT` 하나만 보내면 '없는 것'이
   아니라 '있는 것'이 나온다(1,343). 그래서 `NOT` 조건은 앞에 포함 조건이 최소 하나 있어야
   뜻이 성립한다. 화면에서는 `toPatentSearchKeywords`
   (`frontend/src/components/office-action/officeActionKeywords.ts`)가 포함 조건을
   배열 앞으로 모으고, 포함 조건이 하나도 없으면 keywords 자체를 보내지 않는다.
3. 순서를 바꿔도 결과 집합은 같다((A ∩ B) \ C = (A \ C) ∩ B). 그래서 2번의 재배치는
   의미를 바꾸지 않는다.

관련도 점수는 항목이 여러 개여도 그대로 붙고, 조건이 많아질수록 점수도 올라간다
(위 447건의 상위 점수 ≈ 2.56 > 단일 조건 1,343건의 상위 점수 ≈ 2.24).

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
`의견제출통지서 발행일자순`을 자동 표시한다. Search API에서 받은 전체 기준 목록의 순서를
유지한 채 상세 필터를 적용하고 현재 UI 페이지 범위만 잘라 표시한다.

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

아래 세 가지는 기존 page 기반 `POST /api/patent-search`가 사용하는 외부 API의 제한이다.
matches API가 OA DB에서 직접 구현한 기능과는 구분해서 읽는다.

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

### 2. keyword의 `operator: OR` → 외부 500

`AND`·`NOT`은 정상 동작하지만 `OR`은 target 2개 이상과 **같은 오류**로 실패한다.

```
데이터베이스 에러: index should have a `WITH (key_field='...')` option
```

이 제약은 기존 page 기반 `POST /api/patent-search`가 호출하는 외부 API에만 해당한다.
Office Actions 화면의 `POST /api/patent-search/matches`는 OA DB에서 OR 그룹을 직접 구성하므로
`AND`·`OR`·`EXCLUDE`를 모두 노출하고 정상 처리한다.

- 같은 DTO를 기존 page endpoint에 직접 보내면 OR가 상류 500을 내 502로 변환되는 제한은 남아 있다.
- 외부 API가 수정되면 `PatentSearchService`의 별도 OR 방어·문서만 재검토하면 된다. matches API는
  외부 변경과 무관하다.

### 3. `registrationDate` 기간 조건 → 외부 500

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
| `PATENT_SEARCH_UPSTREAM_TIMEOUT` | 504 | 기존 page 검색에서 `PATENT_SEARCH_API_TIMEOUT_MS` 초과 |
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
