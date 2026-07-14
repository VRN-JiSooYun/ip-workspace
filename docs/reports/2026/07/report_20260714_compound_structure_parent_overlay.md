# 화합물 구조 액션 버튼 parent 기준 배치

## 작업 내용

- 공통 `CompoundStructureView`의 `actionOverlayAnchor`에 `parent` 옵션을 추가했다.
- 기존 옵션은 그대로 유지한다.
  - `frame`: SVG frame 기준
  - `container`: `CompoundStructureView` 최상위 container 기준
  - `parent`: 컴포넌트 외부의 가장 가까운 positioned parent 기준
- MyBoard 그룹 상세 목록의 화합물 구조 셀에 `parent` anchor를 적용했다.
- 테이블 구조 셀을 `position: relative`로 지정해 액션 버튼을 셀 우측 하단 기준으로 배치했다.
- 구조 컴포넌트를 셀 전체 폭으로 확장해 SVG에서 우측 하단 버튼으로 포인터를 이동할 때 hover가 안정적으로 유지되도록 했다.
- 구조 셀의 `hover`, `focus-within` 상태에서도 버튼을 활성화해 SVG 영역에서 버튼까지 이동할 때 버튼이 사라지지 않도록 했다.
- 버튼의 실제 위치는 셀 우측 및 하단에서 각각 `4px`이다.
- 다른 화면의 기존 `frame`, `container` 동작은 변경하지 않았다.

## 실행 여부

- 프로젝트 지침에 따라 빌드 및 실행은 수행하지 않았다.
