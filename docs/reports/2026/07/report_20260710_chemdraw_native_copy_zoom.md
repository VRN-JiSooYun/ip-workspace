# ChemDraw Copy 선명도 개선 롤백

## 변경 내용
- `frontend/src/components/common/ChemDrawCanvasCore.tsx`
  - PowerPoint 붙여넣기 선명도 개선을 위해 추가했던 별도 copy 버튼을 제거했다.
  - copy 직전 CDXML을 `10`배 확대해 임시 로드하고 원본으로 복구하던 로직을 제거했다.
  - ChemDraw `Copy Document`/`copyDocumentToClipboard` fallback 로직을 제거했다.
  - ChemDraw toolbar의 기존 clipboard target을 클릭하는 원래 흐름으로 되돌렸다.

## 확인 필요
- ChemDraw editor toolbar의 기존 clipboard 버튼이 이전처럼 동작하는지 확인한다.
