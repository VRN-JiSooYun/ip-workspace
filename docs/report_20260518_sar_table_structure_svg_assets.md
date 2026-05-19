# SAR Table Structure SVG Asset Rendering

## 변경 내용
- SAR Table의 Compound 카드 영역이 `mockCompounds.structureSvg`를 사용해 첨부 SVG 구조 이미지를 렌더링하도록 수정했다.
- Compound 카드 영역의 SVG 구조 이미지에 돋보기 버튼을 추가하고, 클릭 시 크게 볼 수 있는 모달을 연결했다.
- SAR Table의 고정 Compound 컬럼은 텍스트만 표시하도록 유지했다.
- SVG가 없는 데이터는 기존 화학 구조 아이콘 대체 표시를 유지했다.

## 관련 파일
- `frontend/src/pages/SarTable.tsx`
- `frontend/src/mocks/compounds.ts`
- `frontend/src/assets/mol_svg/*.svg`

## 비고
- `mockCompounds`는 My Board와 SAR Table이 공유하므로, SVG 첨부파일 변경은 두 페이지에 동일하게 반영된다.
- 로컬 빌드는 사용자 환경에서 Docker/Bun으로 실행한다.
