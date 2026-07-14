# SAR Pinned Card Selected Outline

## 요청
- SAR Table 우측 화합물 카드 영역에서 pin 고정된 카드가 선택되면 기본 선택 색상 대신 pin 고정 색상인 초록 계열 outline을 사용한다.

## 구현
- `frontend/src/pages/SarTable.tsx`
  - 기존 카드 selected/hover outline은 `token.colorPrimary`를 사용한다.
  - `.sar-compound-card.pinned.selected::after`, `.sar-compound-card.pinned.hovered::after` 등 pinned 상태 전용 selector를 추가해 `sarPinnedRowColor`를 우선 적용했다.
  - pinned selected/hover 배경은 기존 초록 계열 로직을 유지했다.

## 확인
- `git diff --check` 통과.
- 프로젝트 지침상 build/test 실행은 하지 않았다.
