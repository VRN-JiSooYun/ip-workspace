# Synthesis Board Structure SVG

## 변경 내용
- Synthesis Board 내부 mock 상세 데이터에 `structureSvg` 필드를 추가했다.
- 기존 `frontend/src/assets/mol_svg/example_compound*.svg` 첨부 SVG를 Synthesis Board mock 데이터에 연결했다.
- 합성 상세 목록의 `Structure` 컬럼이 placeholder 아이콘 대신 SVG 구조 이미지를 표시하도록 수정했다.
- Canvas 보기 카드의 구조 영역도 같은 SVG 이미지를 사용하도록 연결했다.
- `Structure` 컬럼과 Canvas 보기 카드에 돋보기 버튼을 추가하고, 클릭 시 구조 이미지를 크게 볼 수 있는 모달을 연결했다.

## 관련 파일
- `frontend/src/pages/SynthesisBoard.tsx`
- `frontend/src/assets/mol_svg/*.svg`

## 비고
- SVG가 없는 항목은 기존 아이콘 fallback을 유지한다.
