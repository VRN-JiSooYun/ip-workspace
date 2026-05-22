# My Board Detail Pagination Report

## 요청
- My Board 페이지의 그룹 상세 목록 하단 페이지네이션에 page size 선택 기능 추가.
- 선택 옵션은 10, 30, 50, 100.

## 구현 내용
- `frontend/src/pages/MyBoard.tsx` 그룹 상세 목록 table의 pagination 설정을 확장.
- 기본 page size는 10으로 유지.
- `showSizeChanger`를 활성화하고 `pageSizeOptions`를 `[10, 30, 50, 100]`으로 설정.
- pagination 하단 영역에 우측 padding을 추가해 오른쪽 끝에 붙지 않도록 조정.

## 검증
- 프로젝트 지침상 빌드/실행은 수행하지 않음.
