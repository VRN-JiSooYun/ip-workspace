# My Board Quick Add Scrollbar Theme

## Request
- My Board 페이지의 Quick add compound list 스크롤바가 라이트/다크 모드를 반영하지 않는 문제 수정.

## Implementation
- Quick add 결과 `List`에 `my-board-quick-add-list` class를 추가했다.
- 기존 My Board 공통 스크롤바 테마 규칙에 Quick add list class를 포함했다.
- `scrollbar-color`, webkit track/thumb/hover 색상을 Ant Design theme token 기반으로 적용해 라이트/다크 모드에 같이 반응하도록 했다.

## Verification
- 빌드/실행은 프로젝트 지침에 따라 수행하지 않았다.
- `git diff --check`로 패치 공백 오류를 확인했다.
