# MyBoard Tree View UI 설계

작성일: 2026.06.23

## 목적

MyBoard의 `Tree` 탭에서 그룹별 화합물 디자인 흐름을 hierarchy 형태로 탐색할 수 있는 화면을 설계한다. 우선 실제 API 데이터가 없으므로 기존 mock compound와 공통 화합물 구조 컴포넌트를 재사용해 `sample/tree/img.png`와 유사한 검증용 화면을 구현했다.

## 화면 구성

- 상단 툴바: 전체 선택, 관리 필터, Bookmark, 3D View, Tutorial, 확대/축소/화면 맞춤 버튼
- Tree canvas: 가로/세로 스크롤이 가능한 넓은 작업영역
- Depth ruler: 1depth부터 5depth까지 열 기준 표시
- Node card: 변경 유형 태그, 화합물 ID, bookmark/menu 버튼, 화합물 구조, 주요 metric
- Connector: parent-child 관계를 SVG path로 연결
- Mock depth: 3depth 샘플뿐 아니라 4depth, 5depth branch까지 포함

## 구현 기준

- 화합물 구조는 `CompoundStructureView`를 그대로 사용한다.
- Tree mock 데이터는 선택된 그룹의 필터 결과를 우선 사용한다.
- 선택된 그룹/필터 결과가 없을 때도 UX 검토가 가능하도록 전체 mock compound 일부를 fallback으로 사용한다.
- 숫자 metric은 `formatNumberWithComma`를 사용해 화면 표시 규칙을 따른다.
- 실제 그래프 편집 기능이 붙기 전까지는 별도 그래프 라이브러리 없이 CSS absolute layout + SVG connector로 구현한다.

## React Flow 검토

React Flow는 사용 가능하다. MyBoard Tree의 요구가 다음 단계로 확장되면 적합하다.

- 노드 drag/drop 위치 조정
- pan/zoom/minimap/fit view
- 노드 선택, edge selection, keyboard interaction
- custom node 내부에 `CompoundStructureView` 삽입
- 추후 tree layout 엔진(dagre/elk 등) 연동

단점은 새 의존성 추가가 필요하고, 현재 mock 기반 화면 설계 단계에서는 과하다. 지금 단계에서는 정적 tree 목업으로 UX를 먼저 검증한 뒤, interactive canvas 요구가 확정되면 React Flow를 추가하는 흐름이 적절하다.

## AntV X6 검토

Ant Design을 기본으로 사용해도 AntV X6 사용은 가능하다. AntV는 Ant Design과 같은 생태계라 시각적 충돌은 크지 않다. 다만 X6는 일반적인 workflow/diagram editor에 가까워 다음 요구가 강할 때 유리하다.

- 복잡한 edge routing
- 포트 기반 연결
- diagram editing
- stencil/palette
- history, clipboard, selection box 등 편집기 기능

MyBoard Tree가 “분자 디자인 lineage 탐색” 중심이면 React Flow가 더 가볍고 React component node 구성이 쉽다. X6는 “사용자가 직접 관계를 그리고 편집하는 diagram tool”에 가까운 요구가 생겼을 때 검토하는 편이 낫다.

## 다음 단계

1. 실제 그룹별 lineage API schema 정의
2. parent-child 관계와 변경 유형(`Core`, `Replace`, `Expand`, `Optimize`) 확정
3. Tree node 클릭 시 상세 목록 row selection 또는 Quick Viewer 연동
4. interactive 요구 확정 후 React Flow 또는 AntV X6 도입 결정
