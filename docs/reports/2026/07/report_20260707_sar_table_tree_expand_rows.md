# SAR Table Tree Expand Rows

## 요청
- 확장 영역에 table을 다시 넣으면서 UI가 겹쳐 보이는 문제를 수정한다.
- `+` 버튼 클릭 시 새 table이 아니라 원래 SAR Table에 row만 추가된 것처럼 보이게 한다.

## 구현
- `frontend/src/pages/SarTable.tsx`
  - `expandedRowRender` 안의 nested Ant Table 렌더링을 제거했다.
  - SAR Table dataSource를 Ant Table tree data 형태로 변경했다.
  - compound 대표 row는 `children`에 API response row들을 갖는다.
  - `+` 버튼을 누르면 같은 table body 안에 response row가 child row로 펼쳐진다.
  - row key는 그대로 `sarTableRowKey`를 사용한다.
  - child response row에는 `sar-row-response` class를 부여해 같은 table row처럼 보이되 배경만 살짝 구분했다.

## 확인
- `git diff --check` 통과.
- 프로젝트 지침상 build/test 실행은 하지 않았다.
