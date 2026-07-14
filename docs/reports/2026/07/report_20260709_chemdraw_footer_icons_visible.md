# ChemDraw 공통 Core 분리 및 Clipboard 버튼 이동

## 변경 내용
- `frontend/src/components/common/ChemDrawCanvasCore.tsx`
  - ChemDraw JS 로드, attach, ready 처리, 초기 구조 로드, 한글 키보드 bridge, canvas/readback patch, SMILES polling, pending input flush를 공통 core로 분리했다.
  - 좌측/상단 공통 컨트롤 영역에 ChemDraw clipboard 버튼을 추가했다.
  - 추가한 clipboard 버튼은 숨겨진 ChemDraw 내부 `.cdd-clipboard-icon` control에 pointer/mouse/click 이벤트를 위임해 기존 하단 버튼과 같은 가이드 팝업 동작을 수행하도록 했다.
  - ChemDraw 내부 clipboard icon이 enabled 상태(`.cdd-clipboard-icon-image-enabled`)이면 외부 버튼도 primary 상태로 강조한다.
  - `.cdd-clipboard-icon-row-container`는 다시 숨김 처리했다.
- `frontend/src/components/common/ChemDrawModal.tsx`
  - Ant Design Modal, footer, confirm 데이터 추출만 담당하도록 축소했다.
  - 내부 editor 렌더링은 `ChemDrawCanvasCore`를 사용한다.
- `frontend/src/components/common/ChemDrawEditor.tsx`
  - embed용 wrapper만 담당하도록 축소했다.
  - 내부 editor 렌더링은 `ChemDrawCanvasCore`를 사용한다.

## 목적
- `ChemDrawModal`과 `ChemDrawEditor`의 중복 구현을 줄이고, ChemDraw 공통 동작을 한 곳에서 관리한다.
- 테스트 후 하단 ChemDraw clipboard row는 다시 숨기되, 같은 기능을 좌측 컨트롤 영역에서 사용할 수 있게 한다.

## 확인 필요
- 로컬 실행은 사용자가 진행한다.
- ChemDraw modal/editor에서 좌측 clipboard 버튼이 내부 하단 clipboard 버튼과 같은 동작을 하는지 브라우저에서 확인 필요.
- 하단 `.cdd-clipboard-icon-row-container`가 다시 보이지 않는지 확인 필요.
