# Compounds Clustering Menu Report

## 요청
- Compounds 메뉴 하위에 `Clustering` 메뉴 추가.

## 구현 내용
- `frontend/src/components/layout/MainLayout.tsx`
  - 미니 메뉴 dropdown의 Compounds 하위 항목에 `Clustering` 추가.
  - 일반 inline sidebar의 Compounds 하위 항목에 `Clustering` 추가.
  - `/clustering` 경로 선택 시 sidebar selected key가 `clustering`으로 잡히도록 처리.
- `frontend/src/App.tsx`
  - `/clustering` route 추가.
  - 기존 빈 페이지 패턴을 사용해 breadcrumb를 `Compounds > Clustering`으로 표시.

## 검증
- 프로젝트 지침상 빌드/실행은 수행하지 않음.
