# ChemDraw Editor Scrollbar Theme

## 변경 내용
- `frontend/src/components/common/ChemDrawCanvasCore.tsx`
  - ChemDraw editor 컨테이너와 내부 DOM에 공통 scrollbar 스타일을 추가했다.
  - 기존 전역 CSS 변수 `--patent-scrollbar-thumb`, `--patent-scrollbar-thumb-hover`, `--patent-scrollbar-track`, `--card-bg`를 사용해 라이트/다크 모드 색상을 따라가도록 했다.
  - ChemDraw CSS가 나중에 로드될 수 있어 scrollbar 규칙에 `!important`를 적용했다.

## 한계
- ChemDraw가 같은 document DOM에 생성하는 스크롤바에는 적용된다.
- ChemDraw 내부가 iframe 또는 Shadow DOM 안에서 별도 document로 렌더링하는 영역이면 부모 CSS가 직접 적용되지 않을 수 있다.

## 확인 필요
- 라이트/다크 모드에서 ChemDraw 팝업 editor 내부 스크롤바 thumb/track 색상이 페이지 테마와 맞는지 확인한다.
- ChemDraw canvas 조작과 toolbar 동작에 영향이 없는지 확인한다.
