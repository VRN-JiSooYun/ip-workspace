# MyBoard 그룹 리스트 Title 컬럼 폭 안정화

## 변경 내용
- `frontend/src/pages/MyBoard.tsx`
  - 그룹 리스트 `Title` 컬럼 최소 width를 `120px`에서 `200px`로 변경했다.
  - `Title` 컬럼 width 계산에서 마운트 후 측정되는 `groupListTableWidth` 의존성을 제거했다.
  - 초기 로드 시 컨테이너 실측값 반영으로 `Title` 컬럼이 다시 계산되어 그룹 리스트가 resize처럼 보이는 현상을 줄였다.
  - 그룹 리스트 패널을 넓히거나 좁힐 때는 기존처럼 split width 기준으로 `Title` 컬럼이 가변 동작한다.
  - 그룹 리스트 초기 패널 폭을 `Title` 최소 width와 고정 컬럼 합계 기준의 최소 테이블 폭으로 시작하도록 변경했다.
  - stacked 레이아웃에서는 `Title` 컬럼이 전체 여유 폭을 모두 차지하지 않고 가로 스크롤이 생기지 않는 최소 폭 기준으로 제한되도록 변경했다.
  - 그룹 리스트 width 측정 전에는 horizontal scroll을 켜지 않고, border/floor 오차를 고려한 4px 허용치를 적용했다.
  - `Title` 컬럼 width 계산에 buffer를 반영해 전체 컬럼 합계가 패널 폭을 꽉 채우지 않도록 조정했다.
  - horizontal scroll이 필요 없는 상태에서는 Ant Table 내부 table width도 100% 기준으로 고정해 잔여 가로 스크롤을 숨기도록 보강했다.
- `frontend/src/index.css`
  - 그룹 리스트 `Title` 컬럼 전용 clamp를 추가해 4줄부터 말줄임이 표시되도록 변경했다.

## 확인 필요
- Design 페이지 최초 진입 시 그룹 리스트가 한 번 움찔하지 않는지 확인한다.
- Design 페이지 최초 진입 시 그룹 리스트에 순간적으로 가로 스크롤이 나타나지 않는지 확인한다.
- 그룹 리스트/상세 목록 사이 resizer를 드래그할 때 `Title` 컬럼이 남는 공간을 따라 늘어나는지 확인한다.
- 화면 폭이 줄어 stacked 레이아웃으로 전환되었을 때 `Title` 컬럼이 과도하게 길어지지 않는지 확인한다.
- 그룹 리스트 `Title` 값이 긴 경우 4줄까지 표시되고 이후 말줄임 처리되는지 확인한다.
