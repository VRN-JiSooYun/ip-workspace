# Compound Structure ChemDraw 취소 버튼 숨김

## 변경 내용
- `frontend/src/components/common/ChemDrawModal.tsx`
  - `showCancelButton` prop을 추가했다.
  - 기본값은 `true`로 유지해 기존 검색/편집용 ChemDraw 팝업의 취소 버튼은 그대로 표시한다.
- `frontend/src/components/common/CompoundStructureView.tsx`
  - 화합물 구조 컴포넌트에서 여는 ChemDraw 팝업에 `showCancelButton={false}`를 전달했다.
  - 해당 팝업은 `닫기` 버튼만 표시된다.

## 확인 필요
- Design, 합성 관리, SAR table의 화합물 구조 ChemDraw 팝업에서 취소 버튼이 보이지 않는지 확인한다.
- 구조 검색 등 다른 ChemDraw 팝업의 취소 버튼은 기존처럼 보이는지 확인한다.
