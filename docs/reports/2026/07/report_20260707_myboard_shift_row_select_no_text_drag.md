# My Board Shift Row Select No Text Drag

## Request
- My Board에서 `Shift + mouse click`으로 table row 범위 선택을 할 때 텍스트 내용도 같이 드래그 선택되는 현상 수정.
- 해당 경우에만 텍스트 드래그를 막고 싶음.

## Implementation
- My Board 그룹 상세 Table row에 `onMouseDown` 핸들러를 추가했다.
- My Board 그룹 리스트 Table row에도 동일한 `onMouseDown` 핸들러를 추가했다.
- `Shift` 키가 눌린 row mousedown에서만 `event.preventDefault()`를 실행해 브라우저 텍스트 selection 시작을 막았다.
- button, link, input, textarea, checkbox, select, dropdown 같은 인터랙티브 요소에서는 기존 동작을 유지하도록 제외했다.
- 일반 클릭, 일반 드래그, Ctrl/Meta 선택은 기존 동작을 유지한다.

## Verification
- 빌드/실행은 프로젝트 지침에 따라 수행하지 않았다.
- `git diff --check`로 패치 공백 오류를 확인했다.
