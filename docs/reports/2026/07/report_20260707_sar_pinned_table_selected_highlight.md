# SAR Table Pinned Selected Row Highlight

## Request
- 핀 고정된 화합물 row가 선택되었을 때 테이블 선택 하이라이트도 기본 primary 색상이 아니라 초록 계열로 표시할지 결정.
- 결정된 UX에 맞춰 패치.

## Implementation
- SAR Table의 핀 고정 row CSS를 테이블의 일반 hover/selected 규칙보다 뒤쪽에 추가해 우선순위를 보강했다.
- 핀 고정 row는 기본 상태, hover 상태, selected 상태 모두 초록 계열 배경을 사용하도록 했다.
- selected 상태에서 남아 있던 primary 계열 border가 섞이지 않도록 초록 계열 border로 덮었다.
- fixed-left 셀도 같은 초록 계열 배경과 좌측 inset 라인을 유지하도록 별도 규칙을 추가했다.

## Verification
- 빌드/실행은 프로젝트 지침에 따라 수행하지 않았다.
- `git diff --check`로 패치 공백 오류를 확인했다.
