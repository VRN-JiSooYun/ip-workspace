# 특허 키워드 상세 검색 Phase 1 구현

## 기준 문서

- `docs/특허 키워드 상세 검색 개선 기획.md`

## 기존 구조 분석

- matches API는 INCLUDE condition마다 score CTE를 만들고 전부 JOIN해 condition 간 AND만
  지원했다.
- 한 condition의 raw `content @@@ query`는 pg_search query parser의 기본 token OR로
  동작해, `EGFR 저해제`에서 한 token만 가진 문서도 후보가 됐다.
- OR는 `PATENT_SEARCH_MATCHES_UNSUPPORTED_OR`로 거부했고 검색바에서도 숨겼다.
- NOT은 사용자가 보는 문자열과 맞추기 위해 literal substring으로 제외했다.
- 다중 단어 exact phrase bonus는 있었지만 broad OR 후보 집합 자체는 줄이지 않았다.

## 변경 설계

- 기존 `keywords[].operator` payload는 page 기반 외부 API 호환을 위해 유지한다.
- matches API에서 AND/OR는 INCLUDE 관계, NOT은 EXCLUDE로 해석한다.
- OR로 이어진 INCLUDE를 한 그룹으로 묶고 그룹 사이는 AND로 고정한다.
- 따라서 선형 입력 `A OR B AND C OR D NOT F`는 `(A OR B) AND (C OR D) AND NOT F`다.
- condition 내부는 `paradedb.match('content', query, conjunction_mode => true)`로 모든 token을
  요구한다.
- OR 그룹 score는 대안 중 최고값, 최종 score는 AND 그룹 score 평균으로 계산한다.
- 같은 target의 OR 대안은 `paradedb.disjunction_max`로 합쳐 index scan 한 번에 후보 합집합과
  최고 대안 score를 계산한다. 서로 다른 target만 별도 CTE를 합친다.
- EXCLUDE는 모든 INCLUDE 그룹으로 후보를 만든 뒤 기존 literal NOT EXISTS로 적용한다.

## 구현 내용

- `PatentSearchMatchesService`의 OR 거부를 제거하고 condition CTE를 AND-of-OR 그룹 CTE로
  조립하도록 변경했다.
- officeAction/opinion/amendment target 모두 conjunction mode를 사용한다.
- 기존 exact phrase bonus와 response OA별 최고 score, literal EXCLUDE를 유지했다.
- DTO 주석에 matches API의 그룹 semantics와 기존 operator 호환 목적을 명시했다.
- 검색바 추가 메뉴를 AND/OR/EXCLUDE로 확장했다.
- 조건 tag를 `(A OR B) AND (C OR D) EXCLUDE F` 형태로 렌더링하고 기본 ALL 의미 안내를
  추가했다.
- 첫 INCLUDE가 OR로 남는 삭제/재배치 상황은 request 변환 시 AND로 정규화한다.

## 검증

- OA DB의 `pg_search 0.23.4`에서 `paradedb.match(..., conjunction_mode => true)` 함수와
  BM25 score가 함께 동작함을 확인했다.
- `epidermal squamous cell carcinoma`는 5개 response, 4개 OA만 모든 token 조건을
  만족했고 원문 token 검사 결과도 4/4로 일치했다.
- exact phrase 2개 OA가 후보 상단에 놓였으며, 5초 statement timeout을 적용한 최종 SQL은
  약 1.64초에 완료됐다.
- `(opinion:EGFR OR opinion:HER2) AND opinion:inhibitor` 그룹 SQL은 15개 OA를 반환했다.
- `(officeAction:EGFR OR opinion:HER2)`의 서로 다른 target 합집합도 5초 제한 안에서 375개
  OA를 반환했다.
- 같은 target OR를 개별 BM25 scan으로 실행한 초기 SQL은 EXCLUDE 조합에서 5초 timeout이
  재현됐다. `disjunction_max` 단일 scan으로 바꾼 실제 OR+EXCLUDE 서비스 SQL은 약 1.22초에
  완료됐고 54개 OA를 반환했다.
- OR 그룹, multi-token ALL, phrase bonus, literal EXCLUDE SQL을 확인하는 서비스 테스트를
  보강했다.
- DB schema, migration 및 ERD 변경은 없다.
- 저장소 지침에 따라 빌드와 테스트 러너는 실행하지 않았다.

## Phase 2로 남긴 범위

- 중첩 depth가 임의인 recursive query group DTO/UI
- condition별 ALL/PHRASE/ANY 선택 UI와 DTO
- token distance 기반 proximity bonus
- PDF ingestion의 line-wrap artifact normalization
