# SAR Table Shift Row Select No Text Drag

## Request
- SAR Table 페이지에도 `Shift + mouse click`으로 table row 범위 선택 시 텍스트가 같이 드래그 선택되지 않도록 적용.

## Implementation
- SAR Table의 그룹 구조 테이블 row에 `onMouseDown` 핸들러를 추가했다.
- SAR 데이터 테이블 row에도 동일한 `onMouseDown` 핸들러를 추가했다.
- 우측 화합물 카드 영역에도 동일한 `onMouseDown` 핸들러를 추가했다.
- `Shift` 키가 눌린 row mousedown에서만 `event.preventDefault()`를 실행해 브라우저 텍스트 selection 시작을 막았다.
- button, link, input, textarea, checkbox, select, dropdown 같은 인터랙티브 요소에서는 기존 동작을 유지하도록 제외했다.

## Verification
- 빌드/실행은 프로젝트 지침에 따라 수행하지 않았다.
- `git diff --check`로 패치 공백 오류를 확인했다.
