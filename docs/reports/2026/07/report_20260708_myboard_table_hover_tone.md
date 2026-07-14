# MyBoard 테이블 Hover 톤 조정

## 작업 범위
- `frontend/src/pages/MyBoard.tsx`의 MyBoard 페이지 테이블 row hover 하이라이트 톤을 조정했다.
- 전역 테이블 스타일은 변경하지 않고 `.my-board-page` 범위에서만 CSS 변수를 덮어썼다.

## 구현 내용
- 일반 row hover 색상: `rgba(248, 124, 99, 0.12)` 수준에서 MyBoard 전용 `0.06`으로 완화했다.
- 선택된 row hover 색상: `rgba(248, 124, 99, 0.22)` 수준에서 MyBoard 전용 `0.16`으로 완화했다.
- 다크 모드에서도 MyBoard 전용 hover alpha를 낮춰 기존보다 연하게 보이도록 조정했다.

## 확인 사항
- 로컬 빌드 및 실행은 프로젝트 지침에 따라 수행하지 않았다.
