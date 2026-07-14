# SAR Table 하단 여백 UX 패치

## 요청
- SAR Table도 MyBoard 페이지처럼 화면 하단 16px 여백 기준으로 맞춘다.

## 변경
- `frontend/src/pages/SarTable.tsx`
  - SAR 페이지 내부 하단 padding `24px`을 제거하고, 공통 `MainLayout` Content 하단 padding `16px` 기준을 사용하도록 했다.
  - SAR Table은 화합물 카드 영역이 커질 수 있으므로 페이지 자체 세로 스크롤은 유지했다.
  - 테이블 body 높이 계산은 유지해 일반 높이에서는 테이블 내부 스크롤을 사용하고, 카드 영역 확장으로 공간이 부족하면 페이지 스크롤이 함께 생기도록 했다.

## 검증
- 로컬에는 Bun/npm이 없고 빌드는 사용자가 수행한다는 프로젝트 지침에 따라 빌드는 실행하지 않았다.
