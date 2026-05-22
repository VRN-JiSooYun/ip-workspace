# My Board Group Bookmark Column Report

## 요청
- My Board 그룹 리스트의 `Date` 컬럼 앞에 북마크 컬럼 추가.
- `frontend/src/assets/svg/bookmark.svg` 아이콘 사용.
- 클릭 시 활성화 효과를 주고 해당 row를 최상단으로 이동.
- 추후 Table 순서 지정 API 연동 예정이므로 현재는 버튼 색상 변경과 최상단 이동만 구현.

## 구현 내용
- `frontend/src/pages/MyBoard.tsx`
  - `bookmark.svg`를 raw import 후 CSS mask 아이콘으로 사용.
  - `bookmarkedGroupIds` 로컬 상태 추가.
  - 그룹 리스트 정렬 시 북마크된 그룹을 최상단으로 배치.
  - `Date` 컬럼 앞에 40px 고정 폭 북마크 컬럼 추가.
  - 북마크 버튼 클릭은 row 선택 이벤트로 전파되지 않도록 처리.
  - 활성 상태는 primary color와 primary background로 표시.

## 검증
- 프로젝트 지침상 빌드/실행은 수행하지 않음.
