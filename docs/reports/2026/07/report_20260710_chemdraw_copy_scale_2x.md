# ChemDraw Copy 2x Scale 롤백

## 변경 내용
- `frontend/src/components/common/ChemDrawCanvasCore.tsx`
  - ChemDraw 공통 clipboard 버튼 클릭 시 CDXML을 `2`배 scale하던 로직을 제거했다.
  - CDXML scale helper, 임시 CDXML load, 원본 복구 timer를 제거했다.
  - 기존 ChemDraw clipboard target을 그대로 클릭하는 동작으로 되돌렸다.

## 롤백 사유
- CDXML 좌표/크기를 2배로 키우면 일부 화합물 구조가 이상하게 변형된다.

## 확인 필요
- ChemDraw clipboard 버튼이 기존처럼 동작하는지 확인한다.
- 복사 후 화합물 구조가 변형되지 않는지 확인한다.
