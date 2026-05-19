# My Board 그룹 리스트 선택 Row 강조

## 요청 요약

My Board 페이지의 그룹 리스트에서 row 선택 시 선택 색상을 더 진하게 조정한다.

## 구현 내용

파일: `frontend/src/pages/MyBoard.tsx`

- 그룹 리스트 테이블의 선택 row에 `my-board-group-row-selected` class를 추가했다.
- My Board 그룹 리스트에만 적용되도록 범위를 제한했다.
- light/dark 테마별 선택 배경색을 기존보다 진하게 조정했다.
- hover 상태에서도 선택 상태가 더 명확하게 보이도록 별도 배경색을 적용했다.

## 효과

- 그룹 리스트에서 현재 선택된 그룹을 더 쉽게 구분할 수 있다.
- 공통 `.row-selected` 스타일은 유지하고, My Board 그룹 리스트에만 추가 강조가 적용된다.
