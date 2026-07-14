# ChemDraw 회전 버튼 포커스 보정

## 문제
- ChemDraw 공통 팝업에서 `180° 회전 - 수직` 버튼을 클릭했을 때와 `Ctrl+Shift+V` 단축키를 눌렀을 때 결과가 다르게 보일 수 있었다.
- 버튼은 ChemDraw 캔버스 밖의 Ant Design Button이라 mouse down 시점에 ChemDraw focus/selection 상태를 바꿀 수 있고, 단축키는 기존 ChemDraw 선택 상태를 유지한 채 실행된다.
- `Ctrl+Shift+V`는 브라우저/에디터 native handler와 충돌할 수 있어, ChemDraw native 단축키가 같이 실행되면 chiral center의 `@`/`@@` 처리 결과가 달라질 수 있다.

## 변경
- `frontend/src/components/common/ChemDrawModal.tsx`
- `frontend/src/components/common/ChemDrawEditor.tsx`
- `frontend/src/utils/chemdrawTransform.ts`
  - 회전 버튼의 `onMouseDown`에서 `event.preventDefault()`를 호출해 버튼 클릭이 ChemDraw editor focus/selection을 빼앗지 않도록 했다.
  - custom `Ctrl+Shift+H/V` keydown interception을 제거하고, 실제 단축키는 ChemDraw native handler에 맡긴다.
  - 버튼 클릭도 같은 native shortcut keydown/keyup을 ChemDraw editor 안으로 dispatch하도록 변경했다.
  - native shortcut dispatch는 OS별로 분기한다. macOS/iOS 계열은 `Cmd+Shift+H/V`, 그 외 환경은 `Ctrl+Shift+H/V`를 사용한다.
  - ChemDraw가 synthetic shortcut 이벤트를 처리하지 않는 환경에서는 `applyChemDrawRotate180` 유틸로 fallback한다.
  - fallback도 direct flip method보다 ChemDraw command dispatcher를 먼저 사용하도록 바꿔 keyboard shortcut의 stereochemistry 처리와 최대한 맞춘다.

## 검증
- 로컬에는 Bun/npm이 없고 빌드는 사용자가 수행한다는 프로젝트 지침에 따라 빌드는 실행하지 않았다.
