# Office Actions 하이브리드 필터 작업 보고서

## 작업 목적

상세 필터를 적용하거나 페이지를 이동할 때마다 느린 전문 Search API를 다시 호출하는 비용을
줄인다. 본문 전문 검색은 서버에 유지하고, 키워드가 없는 구조화 필터는 content 없는 전체 OA
인덱스를 이용해 프런트에서 처리한다.

## 변경 내용

- 상세 필터 영역의 Enter 자동 적용을 제거했다. 필터 값 변경과 Select의 Enter 확정은 상태만
  바꾸며, `조건 적용` 버튼을 눌렀을 때만 결과에 반영된다.
- `GET /api/patent-search/index`를 추가했다.
  - 읽기 전용 OA DB에서 OA, 특허, 제출 문서, 심사관, 법조문, IPC, 대리인 정보를 구조화한다.
  - `office_action.content`와 `response.content`는 조회 결과에 포함하지 않는다.
  - 카드와 PDF 뷰어에 필요한 문서 경로와 특허 메타데이터는 유지한다.
- 프런트에 OA 인덱스 필터 함수를 추가해 의견서·보정서 유무, 심사청구, 심사관, 대리인,
  법적상태, 심사진행상태, 법조문, IPC, 기간 조건을 브라우저에서 처리한다.
- 키워드가 없는 경우 최초 한 번 받은 인덱스를 메모리에 보관하고 상세 필터 재적용과
  페이지네이션에 재사용한다.
- 브라우저 세션 동안 인덱스 요청 Promise를 서비스 계층에서도 캐시해 페이지 재진입 시 중복
  다운로드를 막았다. 실패한 Promise는 제거해 재시도할 수 있다.
- 전문 키워드가 있으면 기존 `POST /api/patent-search`를 사용한다. 이 경우에도
  `includeContent: false`로 본문 전송을 제외한다.
- 결과 카드를 선택하면 `GET /api/patent-search/:officeActionId/content`로 해당 OA 한 건의
  본문만 지연 조회하고 메모리에 캐시한다. PDF 경로는 먼저 열어 선택 반응을 지연시키지 않는다.
- 개발 harness를 새 초기 로딩 계약에 맞춰 인덱스 1회, 전문 Search API 0회를 검증하도록
  갱신했다.

## Timeout 보완

최초 구현의 단일 SQL은 전체 OA와 제출 문서·심사관·법조문·IPC 집계를 한 번에 처리해 OA DB의
5초 `query_timeout`에서 `Query read timeout`이 발생했다. 전역 timeout을 느슨하게 바꾸지 않고
다음과 같이 보완했다.

- 각 테이블을 PK keyset pagination으로 최대 2,000행씩 조회한다.
- 개별 쿼리는 content column을 읽지 않는다.
- 조회한 관계 행은 Nest 서비스 메모리에서 OA ID 또는 patent ID 기준으로 그룹화한다.
- 조립 후 발행일자·OA ID 기준으로 정렬해 기존 기본 정렬을 유지한다.

## 검증 결과

- 키워드 유무에 따라 로컬 인덱스와 전문 Search API 중 하나를 선택하도록 호출 경로를
  확인했다.
- 로컬 페이지네이션은 필터링한 전체 건수를 기준으로 현재 page size만큼 slice한다.
- 인덱스 응답의 OA·제출 문서 `content`는 항상 `null`이며 원문 column은 SQL 결과에 포함하지
  않는다.
- DB schema나 migration 변경은 없다.
- 변경 diff의 공백 오류와 제거된 Enter 적용 코드의 잔여 참조를 확인했다.

## 미실행 항목

- 저장소 지침에 따라 빌드, 테스트 및 실제 OA DB 연결 실행은 수행하지 않았다.
