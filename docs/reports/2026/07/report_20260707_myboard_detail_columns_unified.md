# My Board Detail Columns Unified

## Request
- My Board 페이지에서 설계팀/합성팀에 따라 그룹 상세 목록 테이블 컬럼이 다르게 보이던 동작을 설계팀 기준으로 통일.

## Implementation
- 상세 목록 기본 컬럼 구성을 `currentUser.role` 분기에서 분리했다.
- 합성팀 계정에서도 설계팀 기준 컬럼(`디자인 번호`, `필요량 (mg)`, `목적`, `기대 개선 효과`, `의뢰일자`, `합성 확장 필요 정도`, `의뢰 비고`)이 기본 활성 컬럼으로 보이도록 변경했다.
- 사용자 role 변경 시 컬럼 preset이 역할별 컬럼으로 재초기화되지 않도록 effect dependency에서 role 의존성을 제거했다.

## Verification
- 빌드/실행은 프로젝트 지침에 따라 수행하지 않았다.
- `git diff --check`로 패치 공백 오류를 확인했다.
