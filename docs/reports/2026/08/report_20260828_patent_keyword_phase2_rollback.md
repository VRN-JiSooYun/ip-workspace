# 특허 키워드 상세 검색 Phase 2 원복

## 작업 목적

재귀 검색 그룹과 condition별 ALL/PHRASE/ANY 선택이 화면과 검색 동작을 지나치게 복잡하게
만들어, Phase 2 변경만 제거하고 Phase 1 검색 경험으로 복원했다.

## 원복 내용

- 검색바의 match mode 선택, 추가 대상 group 선택, 재귀 AND/OR group 편집 UI를 제거했다.
- 검색 조건 state와 payload를 Phase 1의 평면 `keywords` 배열로 복원했다.
- matches DTO의 `queryGroup`과 재귀 node, match mode 관련 type을 제거했다.
- 백엔드의 재귀 Boolean tree, PHRASE/ANY candidate mode, proximity boost를 제거했다.
- Phase 2 API 예시와 구현 완료 표기를 문서에서 제거했다.

## 유지한 Phase 1 기능

- 검색어 내부 모든 token 포함(ALL) 후보 검색
- 선형 `(A OR B) AND (C OR D)` 조건 조합
- 전역 literal EXCLUDE
- BM25 정렬과 exact phrase `+1` 가산점
- 같은 target OR의 `paradedb.disjunction_max` 최적화
- Search API는 `검색` 버튼을 클릭할 때만 호출
- 상세 필터와 페이지네이션의 프런트엔드 처리
- 기존 전체 OA 인덱스와 선택 문서 본문 지연 조회

## 확인

- Phase 2 전용 `queryGroup`, `matchMode`, proximity query 및 재귀 group UI 참조가 코드에서
  제거되었음을 정적으로 확인했다.
- `git diff --check`에서 whitespace 오류가 없음을 확인했다.
- DB schema, migration, Prisma model 및 ERD 변경은 없다.
- 저장소 지침에 따라 build와 test runner는 실행하지 않았다.
