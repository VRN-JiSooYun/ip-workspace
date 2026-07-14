# SAR Table VNA Code Fallback Weight

## 변경 내용
- `frontend/src/pages/SarTable.tsx`
  - `VNA Code` 컬럼 표시값이 실제 VNA code가 아니라 아이디어 번호 fallback일 때 font weight를 400으로 낮췄다.
  - 실제 VNA code가 있는 경우는 primary 색상과 font weight 600을 유지한다.
  - 우측 compound card name도 동일한 표시 판단을 사용해 VNA code와 아이디어 번호의 굵기 차이를 맞췄다.

## 확인 필요
- 로컬 실행은 사용자가 진행한다.
- SAR Table 우측 테이블 `VNA Code` 컬럼에서 아이디어 번호 fallback이 기존 회색을 유지하면서 더 얇게 보이는지 확인 필요.
