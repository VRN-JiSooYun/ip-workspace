# SAR Table Single API Row No Expand

## Request
- compound SAR data API row가 1줄뿐이면 확장하지 않아도 되지 않는지 확인 및 UX 개선.

## Implementation
- SAR Table row 생성 로직을 변경했다.
- API row가 0개면 기존 mock/fallback 값을 사용한다.
- API row가 1개면 부모 row에 `sarApiRow`를 직접 붙여 확장 버튼 없이 값을 표시한다.
- API row가 2개 이상일 때만 children row를 생성해 확장 UX를 유지한다.

## Verification
- 빌드/실행은 프로젝트 지침에 따라 수행하지 않았다.
- `git diff --check`로 패치 공백 오류를 확인했다.
