# SAR Left Structure Rotation Sync

## 요청
- SAR Table 우측 화합물 카드 영역에서 rotate 값을 변경할 때 좌측 화합물 구조 영역도 같이 회전되게 한다.
- 우측 카드 영역의 나머지 SAR 전용 설정은 기존처럼 별도로 유지한다.

## 구현
- `frontend/src/pages/SarTable.tsx`
  - 좌측 그룹 대표 구조 렌더링에서 `getGroupStructureSettings(record.id)`를 읽도록 했다.
  - 좌측 `CompoundStructureView`의 `rdkitAngleDeg`를 해당 group의 `sarRotationDeg`로 연결했다.
  - `rdkitScalePercent`, header 전역 RDKit draw option 적용, 우측 카드의 `rdkitUseGlobalDrawOptions={false}` 정책은 그대로 유지했다.

## 확인
- `git diff --check` 통과.
- 프로젝트 지침상 build/test 실행은 하지 않았다.
