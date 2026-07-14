# SAR Table Expand Icon Alignment

## Request
- SAR Table에서 Compound 컬럼을 off하면 `+|-` 확장 버튼이 세로 중앙정렬되지 않는 UX 현상 수정.

## Implementation
- Ant Design Table의 expand icon이 첫 번째 표시 컬럼 셀 내부에 append되는 구조를 유지했다.
- `.ant-table-cell-with-append`에 상대 위치와 좌측 여백을 지정했다.
- `.ant-table-row-expand-icon`을 셀 내부에서 absolute 배치하고 `top: 50%`, `translateY(-50%)`로 세로 중앙에 고정했다.
- Compound 컬럼 표시 여부와 관계없이 아이콘이 row 높이 기준 중앙에 놓이도록 보정했다.

## Verification
- 빌드/실행은 프로젝트 지침에 따라 수행하지 않았다.
- `git diff --check`로 패치 공백 오류를 확인했다.
