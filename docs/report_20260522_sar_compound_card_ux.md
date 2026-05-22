# SAR Table Compound Card UX Update

## 요청
- SAR Table 화합물 영역의 구조 카드 UX 수정.
- 기본 상태 outline 제거.
- 선택 또는 hover 상태에서만 기존 outline 적용.
- SVG 이미지 크기 확대.
- 좌우 여백 제거.
- 돋보기 버튼 제거, 더블 클릭 시 구조 modal popup 호출.
- 기본/2줄 보기 모두 동일 적용.

## 구현 내용
- `frontend/src/pages/SarTable.tsx`의 화합물 카드 기본 padding을 제거하고 카드 리스트 좌우 padding을 0으로 조정.
- 화합물 카드 기본 border를 transparent로 처리해 기본 상태 outline이 보이지 않도록 변경.
- 기존 hover/selected 상태의 primary outline과 shadow는 유지.
- 구조 SVG wrapper를 카드 이미지 영역 전체 크기로 확장하고 내부 SVG가 카드 영역에 맞게 채워지도록 조정.
- 구조 확대 돋보기 버튼을 제거하고, 카드 더블 클릭 시 구조 modal popup이 열리도록 변경.
- 2줄 보기 grid column 폭을 기본 카드 폭과 동일한 200px로 맞춰 동일 UX가 적용되도록 조정.
- 카드 크기 기준을 상수화하고, 기본 1줄 모드는 SVG 확대 크기에 맞춰 400px 폭/296px 구조 영역으로 확대.
- 2줄 모드는 기존 1줄 카드 크기와 동일한 200px 폭/148px 구조 영역을 사용하도록 조정.
- 선택된 화합물이 카드 또는 테이블 row에서 변경될 때, 상단 카드와 하단 테이블 row가 모두 보이는 위치로 자동 스크롤되도록 동기화.

## 검증
- 프로젝트 지침상 빌드/실행은 수행하지 않음.
