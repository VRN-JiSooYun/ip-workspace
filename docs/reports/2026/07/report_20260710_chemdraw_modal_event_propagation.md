# ChemDraw Modal 이벤트 전파 차단

## 원인
- ChemDraw 팝업은 Ant Design `Modal`로 렌더링되지만, React portal 이벤트는 DOM 위치가 아니라 React 컴포넌트 트리를 따라 bubble될 수 있다.
- 구조 셀 또는 SAR 카드 내부에서 `ChemDrawModal`이 렌더링되면 팝업 내부 클릭 이벤트가 row/card selection handler까지 전달될 수 있다.

## 변경 내용
- `frontend/src/components/common/ChemDrawModal.tsx`
  - ChemDraw 내부 toolbar/copy/mouse 처리를 방해하지 않도록 이벤트 전파 차단 wrapper를 제거했다.
  - 모달에 `.chemdraw-modal` class를 추가해 selection handler에서 팝업 내부 이벤트를 식별할 수 있게 했다.
- `frontend/src/pages/MyBoard.tsx`
  - 그룹/상세 row selection handler에서 `.chemdraw-modal` 내부 이벤트면 selection을 무시하도록 했다.
- `frontend/src/pages/MyBoardSynthesisBoard.tsx`
  - 그룹/상세 row selection handler에서 `.chemdraw-modal` 내부 이벤트면 selection을 무시하도록 했다.
- `frontend/src/pages/SarTable.tsx`
  - SAR compound card/table/group structure selection handler에서 `.chemdraw-modal` 내부 이벤트면 selection을 무시하도록 했다.

## 확인 필요
- Design, 합성 관리, SAR table 페이지에서 화합물 구조 ChemDraw 팝업 내부를 클릭해도 바깥 row/card selection이 변경되지 않는지 확인한다.
- ChemDraw toolbar 버튼 선택, canvas 드래그, 선택 구조 복사, 텍스트 입력, 확인/취소 버튼이 정상 동작하는지 확인한다.
