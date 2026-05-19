# My Board Create Design Modal Layout

## 변경 내용
- Create Design 팝업의 기본 입력 필드를 1행 `Group / Source / Name`, 2행 `SMILES` 전체 폭 구조로 재배치했다.
- `SMILES` 입력 영역은 한 줄 전체를 쓰도록 `Col span={24}`로 변경하고, 높이는 2줄 입력으로 조정했다.
- Calculations 옵션 목록을 `calculationOptions` 상수로 분리했다.
- Calculations 라벨 영역에 `All` 토글을 추가해 전체 선택과 전체 해제를 지원하도록 했다.

## 관련 파일
- `frontend/src/pages/MyBoard.tsx`
