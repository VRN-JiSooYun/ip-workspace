# My Board Structure SVG Field

## 작업 범위
- My Board 페이지의 `Structure` 컬럼이 mock 데이터의 SVG 필드를 렌더링하도록 연결했습니다.

## 수정 파일
- `frontend/src/mocks/compounds.ts`
- `frontend/src/pages/MyBoard.tsx`

## 구현 메모
- `Compound` interface에 `structureSvg?: string` 필드를 추가했습니다.
- Docker/Vite 실행 환경에서 resolve 가능하도록 SVG 파일을 `frontend/src/assets/mol_svg/`에 복사했습니다.
- `frontend/src/assets/mol_svg/example_compound1.svg` ~ `example_compound4.svg`를 `?raw` import로 연결해 `structureSvg`에 넣었습니다.
- 4개 SVG를 모두 확인할 수 있도록 네 번째 mock compound를 추가했습니다.
- `Structure` 컬럼은 `structureSvg` 값이 있으면 해당 SVG를 렌더링하고, 값이 없으면 기존 `BenzeneIcon` placeholder를 표시합니다.
- 구조 검색 결과 SVG가 있는 경우에는 기존처럼 검색 결과 SVG가 우선 표시됩니다.
- SVG가 표시된 Structure 셀에는 돋보기 버튼을 추가했고, 클릭 시 큰 preview modal에서 구조를 확인할 수 있습니다.
