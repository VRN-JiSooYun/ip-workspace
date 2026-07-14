# ChemDraw 회전 버튼 command API 적용 보고서

## 배경
- ChemDraw JS 키보드 단축키 `Cmd/Ctrl + Shift + H/V`와 공통 팝업의 수평/수직 180도 회전 버튼 결과가 달라지는 현상을 확인했다.
- 특히 버튼 실행 시 chiral SMILES의 `@` / `@@` 유지 결과가 키보드 실행 결과와 달랐다.

## 확인 내용
- 로컬 ChemDraw JS 번들 `frontend/public/chemdrawweb/chemdraw-ui.6720d9652d8d7a6d41e0.js`에서 command API를 확인했다.
- public editor API로 `getCommandWithName`, `getAvailableCommandNames`가 노출되어 있다.
- 번들 내부 shortcut registration은 다음과 같다.
  - `mod+shift+h` -> `rotateObjects180Horizontal`
  - `mod+shift+v` -> `rotateObjects180Vertical`

## 변경 내용
- `frontend/src/utils/chemdrawTransform.ts`
  - 180도 회전 command 후보에 실제 ChemDraw command 명인 `rotateObjects180Horizontal`, `rotateObjects180Vertical`을 추가했다.
- `frontend/src/components/common/ChemDrawModal.tsx`
- `frontend/src/components/common/ChemDrawEditor.tsx`
  - 버튼 클릭 시 synthetic keyboard event를 먼저 보내지 않고, ChemDraw command API 실행을 우선하도록 변경했다.
  - command API 실행이 실패하는 경우에만 keyboard event fallback을 사용한다.

## 기대 효과
- 버튼과 키보드 단축키가 같은 ChemDraw 내부 command를 타게 되어 회전 시 stereochemistry 갱신 규칙이 일치한다.
