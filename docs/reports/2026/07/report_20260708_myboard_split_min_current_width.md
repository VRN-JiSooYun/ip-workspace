# MyBoard 좌측 패널 최초 로딩 폭 최소값 고정

## 작업 범위
- `frontend/src/pages/MyBoard.tsx`의 MyBoard 좌우 패널 너비 조절 로직을 조정했다.

## 구현 내용
- 페이지 최초 로딩 시 `applyDefaultGroupListSplit({ fallbackToPercent: false, lockAsInitialMin: true })`로 자동 계산된 좌측 그룹 패널 폭을 `initialSplitLeftMinWidth`에 저장한다.
- `clampSplitLeftWidth`에서 기본 20% 최소값과 최초 자동 계산 폭 중 더 큰 값을 최소 폭으로 사용한다.
- 더블클릭 자동 맞춤 및 이후 사용자 조작은 `initialSplitLeftMinWidth`를 새로 덮어쓰지 않는다.
- splitter의 `aria-valuemin`은 최초 자동 계산 최소 폭을 현재 container 기준 percent로 환산해 반영한다.

## 확인 사항
- 로컬 빌드 및 실행은 프로젝트 지침에 따라 수행하지 않았다.
