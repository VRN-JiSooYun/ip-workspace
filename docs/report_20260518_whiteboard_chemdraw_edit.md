# Whiteboard ChemDraw Edit Flow

## 작업 범위
- My Board canvas 탭에서 ChemDraw로 추가한 구조 이미지를 더블 클릭해 ChemDraw 팝업으로 다시 열고 수정할 수 있도록 구현했습니다.

## 수정 파일
- `frontend/src/components/board/WhiteboardEditor.tsx`

## 구현 메모
- ChemDraw로 추가한 Fabric 객체의 `structureData`를 더블 클릭 시 다시 ChemDraw modal 초기값으로 전달합니다.
- 수정 적용 시 기존 Fabric 객체를 제거하고 새 SVG 객체를 같은 위치, 크기, 회전값 기준으로 교체합니다.
- 신규 구조 추가와 기존 구조 수정 상태를 구분해 modal 제목과 confirm 버튼 문구를 다르게 표시합니다.
