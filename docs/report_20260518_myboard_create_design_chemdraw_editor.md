# My Board Create Design ChemDraw Editor

## 변경 내용
- Create Design 팝업의 `Draw (Structure)` 영역에 ChemDraw JS editor를 직접 렌더링하도록 수정했다.
- ChemDraw editor를 재사용할 수 있도록 공통 embed 컴포넌트 `ChemDrawEditor`를 추가했다.
- ChemDraw editor가 준비되기 전에는 `등록` 버튼을 비활성화하도록 연결했다.
- ChemDraw editor가 잘리지 않도록 팝업 폭을 `1200px`로 조정하고 Draw 영역을 full-width 섹션으로 분리했다.
- ChemDraw 구조가 변경되면 SMILES 입력값이 자동 반영되도록 editor SMILES polling을 추가했다.
- SMILES 입력값이 변경되면 ChemDraw editor에 debounce 방식으로 구조를 다시 로드하도록 양방향 동기화를 추가했다.

## 관련 파일
- `frontend/src/pages/MyBoard.tsx`
- `frontend/src/components/common/ChemDrawEditor.tsx`

## 비고
- 기존 구조 검색용 `ChemDrawModal`은 유지했다.
- ChemDraw의 Canvas2D readback warning을 줄이기 위해 embed 컴포넌트에서도 `willReadFrequently` 패치를 적용했다.
