# My Board Data Column Vertical

## Request
- My Board 그룹 상세 목록 테이블의 `데이터` 컬럼 버튼을 좌/우 배치에서 세로 가운데 정렬로 변경.
- 버튼 순서는 위에서 아래로 `KP`, `PDB`, `Docking`, `MD` 순서로 표시.

## Implementation
- 데이터 asset 정렬 기준을 `kp`, `pdb`, `docking`, `md` 단일 순서 배열로 통일했다.
- 기존 KP 좌측, PDB/Docking/MD 우측 그룹 분리 렌더링을 제거하고 단일 리스트로 렌더링하도록 변경했다.
- 세로 배치에 맞게 `데이터` 컬럼 폭을 조정했다.
- 좌/우 그룹 CSS를 제거하고 `.my-board-data-tags`를 중앙 정렬 flex column으로 단순화했다.

## Verification
- 빌드/실행은 프로젝트 지침에 따라 수행하지 않았다.
- `git diff --check`로 패치 공백 오류를 확인했다.
