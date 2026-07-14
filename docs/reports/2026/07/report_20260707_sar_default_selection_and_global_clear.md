# SAR Table Default Selection And Global Clear

## Request
- SAR Table 최초 로드시 우측 SAR table 첫 번째 row가 default로 선택되는 동작 제거.
- table 외 다른 영역 클릭 시 선택 해제되던 동작이 좌측 메뉴나 헤더에서는 동작하지 않는 문제 확인 및 수정.

## Implementation
- SAR compound 목록 로드시 첫 번째 row를 자동 선택하던 effect를 제거했다.
- 선택된 row가 현재 SAR compound 목록에서 사라진 경우에만 선택 상태를 정리하도록 변경했다.
- SAR 페이지 내부 `onMouseDown` 선택 해제 규칙을 유지하면서, `document` mousedown listener를 추가했다.
- 헤더/좌측 메뉴처럼 SAR page DOM 바깥 영역 클릭도 row 선택 해제 대상으로 포함했다.
- SAR table, 우측 compound card list, quick viewer panel 내부 클릭은 기존처럼 선택 해제 대상에서 제외했다.

## Verification
- 빌드/실행은 프로젝트 지침에 따라 수행하지 않았다.
- `git diff --check`로 패치 공백 오류를 확인했다.
