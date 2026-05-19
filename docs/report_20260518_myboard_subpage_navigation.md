# My Board Subpage Navigation

## 변경 내용
- SAR Table과 Synthesis Board를 My board 하위 경로로 정리했다.
  - `/myboard/sar-table`
  - `/myboard/synthesis-board`
- 기존 경로는 새 경로로 redirect 처리했다.
  - `/sar-table` → `/myboard/sar-table`
  - `/synthesis-board` → `/myboard/synthesis-board`
- My Board의 SAR Table, 합성 보드 진입 버튼 경로를 새 하위 경로로 변경했다.
- Synthesis Board 상단 breadcrumb를 `Compounds > My board > 합성 보드`로 변경했다.
- SAR Table과 Synthesis Board는 좌측 메뉴에는 노출하지 않고, 해당 하위 페이지 진입 시 My board 메뉴가 선택 상태로 보이도록 연결했다.

## 관련 파일
- `frontend/src/App.tsx`
- `frontend/src/pages/MyBoard.tsx`
- `frontend/src/pages/SynthesisBoard.tsx`
- `frontend/src/components/layout/MainLayout.tsx`
