# 의견제출통지서 검색 — Keyword Search Target UI

## 작업 목적

`office-actions` 화면의 본문 키워드 검색은 대상 문서가 의견제출통지서
(`keywords[].target = 'officeAction'`)로 **코드에 고정**되어 있었다. 외부 검색 API는
의견제출통지서·의견서·보정서 세 문서의 본문을 모두 지원하므로
(`search_client.ipynb`의 `KeywordTarget`), 사용자가 대상 문서를 고를 수 있게 한다.

UI 형태는 외부 API의 제약이 결정했다. 조건 하나에 문서는 하나뿐이고, 조건을 여러 개 보내면
서로 AND(교집합)로 묶인다. 그래서 "여러 문서 동시 선택(합집합)"은 제공할 수 없고, 아래 두
가지로 나눠 제공했다.

1. **검색 바 = 문서 하나 선택.** 평소의 검색이다.
2. **고급 검색 = 문서별 키워드 조건 여러 줄(AND/NOT).** "통지서에 A가 있고 의견서에 B가
   없는 건"처럼 문서를 조합하는 검색이다.

## 외부 API 실측 (2026-08-26)

UI 설계의 근거다. 상세 표와 해석은 [patent_search_api.md](../../../patent_search_api.md)의
'키워드 항목의 순서와 operator'에 기록했다.

- 항목은 앞에서부터 누적 적용된다. `AND`는 교집합, `NOT`은 차집합.
- **첫 항목의 operator는 무시되고 포함으로 취급된다.** `NOT`만 보내면 결과가 정확히
  뒤집힌다("없는 것"이 아니라 "있는 것"). → 화면이 순서를 보정하고, 포함 조건이 없으면
  keywords를 아예 보내지 않는다.
- `operator: 'OR'`은 target 2개 이상과 **같은 오류**로 500이다. → 합집합 검색은 불가능하고,
  화면은 `OR`을 노출하지 않는다.

## 변경 내용

### `frontend/src/services/patentSearchApi.ts`
- `PATENT_SEARCH_KEYWORD_OPERATORS`(`AND`·`NOT`)와 라벨(`포함`·`제외`) 추가. 계약 타입
  `PatentSearchKeywordOperator`에는 `OR`을 남겨 두고, 화면이 쓰는 집합만 좁혔다.
- `PatentSearchKeyword`에 **배열 순서가 의미를 갖는다**는 사실을 주석으로 기록.

### `frontend/src/components/office-action/OfficeActionSearchBar.tsx`
- 검색어 왼쪽에 검색 대상 select(borderless) 추가. placeholder도 고른 문서를 따라간다.
- 이 select가 고급 검색이 아니라 검색 바에 있는 이유(target은 `filters`가 아니라 `keywords`의
  일부이고, 고급 검색의 '조건 적용'·'n개 적용' 셈과 섞이면 안 된다)를 주석에 남겼다.
- 대상을 하나만 고르는 이유(합집합 불가)도 함께 기록. 기존의 "그 UI는 아직 없다" 주석 제거.

### `frontend/src/components/office-action/OfficeActionAdvancedFilters.tsx`
- `KeywordCondition`(문서·검색어·포함/제외)과 `OfficeActionFilterState.keywords` 추가.
- 법조문·IPC와 같은 sub-panel 패턴으로 `[문서][본문 키워드][조건] + 추가` 한 줄을 만들고,
  확정한 조건은 `의견서에 "진보성" 포함` 태그로 쌓는다. 제외 조건 태그는 채운 pill이 아니라
  테두리형으로 구분한다. sub-panel 안의 Enter도 '추가 → 조건 적용'으로 이어진다.
- `toPatentSearchKeywords(state, primary?)` 추가: 검색 바 조건을 앞에 놓고, 포함 조건을
  배열 앞으로 모으고, 중복을 제거하고, **포함 조건이 없으면 빈 배열**을 돌려준다.
- 포함 조건이 하나도 없을 때 경고를 띄운다(제외 조건은 검색에 실리지 않는다는 안내).
- `countActiveFilters`에 키워드 조건 포함(접힌 헤더의 'n개 적용'에 반영).

### `frontend/src/pages/OfficeActionAnalysis.tsx`
- `keywordTarget` state 추가, 하드코딩된 `target: 'officeAction'` 제거.
- 요청의 `keywords`를 `toPatentSearchKeywords`로 구성. 관련도 정렬 판단을 '검색어 유무'에서
  '최종 keywords 유무'로 바꿨다(검색 바가 비어도 고급 검색 조건만으로 검색될 수 있다).
- 고급 검색 dirty 판정(`filterKeyOf`)에 키워드 조건 행을 포함. 검색 바의 검색어·대상은
  일부러 제외했다(그쪽은 '검색' 버튼이 따로 있다).
- 마지막 검색의 포함 대상(`matchedTargets`)을 결과 목록에 넘긴다.

### `frontend/src/components/office-action/OfficeActionResultList.tsx`
- 결과 헤더에 `본문 일치: 의견제출통지서 · 의견서` 태그 추가. 의견서 본문으로 찾아도 결과는
  통지서 카드로 나오기 때문에, 이 표시가 없으면 카드가 나온 이유를 알 수 없다.
- 카드마다 반복하지 않고 헤더에 한 번만 둔다(검색 단위 정보다).

### `frontend/src/pages/OfficeActionAnalysis.css`
- 검색 바: `container-type: inline-size`, 대상 select 구분선, 좁은 폭(≤420px)에서 select가
  위 줄을 온전히 쓰는 규칙.
- 검색어 입력에 `flex: 1 1 0`. antd Input의 `width: 100%`가 기본 basis(auto)로 잡히면
  줄바꿈이 켜진 순간 '검색' 버튼이 늘 아래 줄로 밀린다.
- 키워드 sub-panel grid와 기존 두 컨테이너 쿼리(≤720px·≤320px)에 편입.
- 제외 조건 태그·경고 문구·결과 헤더 일치 태그 스타일.

## 검증 결과

`frontend/office-action-harness.html`(dev 전용 harness, fetch만 스텁)로 확인했다.

- **harness 자동 점검 12개 전부 PASS**(진입 시 1회 검색·레일 펼침·스크롤 주인 등).
  단 viewport 높이가 820px 이하면 `.oa-page`가 스크롤을 갖는 항목 2개가 실패하는데, 이는
  `@media (max-height: 820px)`의 의도된 전환이고 이 작업과 무관하다(변경 전에도 동일).
- 실제 요청 본문 확인:
  - 검색 바 `EGFR`(통지서) + 고급 검색 `의견서: 진보성` 포함 → `keywords`가
    `[{EGFR, officeAction, AND}, {진보성, opinion, AND}]`.
  - 여기에 `의견서: 기재불비` 제외를 더하면 포함 2건이 앞, `NOT`이 뒤로 정렬되어 나간다.
  - 포함 조건을 모두 지우고 제외만 남기면 경고가 뜨고 요청에 `keywords`가 실리지 않는다.
- 결과 헤더의 `본문 일치: 의견제출통지서 · 의견서` 표시, 관련도순 자동 전환, 조건 적용 후
  dirty 문구 해제 확인.
- 폭 검증: 컨테이너 ≤420px에서 대상 select가 윗줄로 빠지고 입력+버튼이 아랫줄을 나눠 갖는다.
  넓은 폭(1440px)에서는 세 요소가 한 줄, 검색 바 높이 62px로 변경 전과 같다.
- 다크 모드(`data-theme="dark"`)에서 sub-panel·태그·경고 문구 대비 확인.
- `tsc -b` 통과(타입 검사만 수행).

## 미실행 항목

- **합집합(OR) 검색**: 외부 API가 500을 내 제공하지 않았다. 요청을 target별로 쪼개
  클라이언트에서 합치는 방법은 `total`·페이지네이션·관련도 정렬이 모두 깨져 채택하지 않았다.
- **backend DTO의 `OR` 차단**: `PatentSearchKeywordOperator`에 `OR`을 남겨 두었다. 화면은
  만들지 않지만 계약상으로는 통과하고, 보내면 502가 된다. 계약을 좁히는 것은 별건이다.
- **레일 뷰어의 기본 문서 선택**: 의견서 본문으로 검색해도 뷰어는 통지서부터 연다.
  `PatentDocumentViewer`가 "대응 서류만 먼저 열리면 무엇에 대한 대응인지 모른다"는 이유로
  의도적으로 그렇게 정한 규칙이라, 이 작업에서 바꾸지 않았다.
- 프론트엔드 테스트 러너가 없어 자동화 테스트는 추가하지 않았다(harness로 검증).
