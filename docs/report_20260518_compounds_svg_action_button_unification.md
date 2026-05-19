# Compounds SVG Action Button Unification

## 변경 내용
- Compounds 계열 화면의 구조 SVG 돋보기 버튼 UX를 특허 분석 상세 페이지의 SVG 액션 버튼과 맞췄다.
- My Board, SAR Table, Synthesis Board의 구조 이미지 확대 버튼에 공통 `svg-action-btn` 클래스를 적용했다.
- 버튼 타입을 `type="text"`로 통일하고, 아이콘 크기와 반투명 배경 스타일을 특허 분석 상세 페이지와 맞췄다.
- 기존 원형 버튼/개별 shadow 스타일은 제거하고 위치 지정만 페이지별 클래스에 남겼다.

## 관련 파일
- `frontend/src/pages/MyBoard.tsx`
- `frontend/src/pages/SarTable.tsx`
- `frontend/src/pages/SynthesisBoard.tsx`
