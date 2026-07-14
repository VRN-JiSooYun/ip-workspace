# SAR Table Expand Response Rows

## 요청
- compound별 SAR API response row가 여러 개면 VNA Code가 중복되어도 response row를 모두 출력한다.
- 처음부터 모든 response row를 펼치지 않고, `+` 버튼을 눌렀을 때 아래에 response row들을 보여준다.
- row key는 VNA Code가 아니라 임의의 안정적인 key를 사용한다.
- response row가 여러 개여도 화합물 카드 영역은 compound당 1개만 유지한다.
- 긴 수치 때문에 컬럼 폭을 고정하지 않고 table 내부 가로 스크롤로 처리한다.
- 소수값에는 comma를 붙이지 않는다.

## 구현
- `frontend/src/pages/SarTable.tsx`
  - table dataSource를 compound 대표 row(`sarTableRows`)로 분리해 화합물 카드 영역과 table 대표 row 모두 compound당 1개만 생성되도록 유지했다.
  - Ant Table `rowKey`를 `sarTableRowKey`로 변경했다.
  - compound 대표 row key는 `compound-${compound.id}`, 확장 response row key는 `compound-${compound.id}-sar-${index}` 형식으로 생성한다.
  - `expandedRowRender`에서 compound의 `sarApiRows` 전체를 nested table로 렌더링한다.
  - nested table row에는 개별 `sarApiRow`를 주입해 같은 VNA Code라도 response row별 값을 각각 표시한다.
  - table과 nested table 모두 `tableLayout="auto"`와 `scroll.x='max-content'`를 사용해 긴 수치가 가로 스크롤로 빠지도록 했다.
  - SAR cell은 정수에만 `formatNumberWithComma`를 적용하고, 소수는 원문 문자열로 표시한다.

## 확인
- `git diff --check` 통과.
- 프로젝트 지침상 build/test 실행은 하지 않았다.
