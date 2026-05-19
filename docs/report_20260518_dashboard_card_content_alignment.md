# Dashboard Card Content Alignment

## 작업 범위
- Dashboard 페이지 카드의 상세 내용 영역이 카드 상단부터 정렬되도록 수정했습니다.

## 수정 파일
- `frontend/src/index.css`
- `frontend/src/pages/Dashboard.tsx`

## 구현 메모
- `.dashboard-card-content` 공통 스타일에 column flex 상단 정렬을 명시했습니다.
- 연구소 소식 카드에 있던 중앙 정렬 inline 스타일을 상단 정렬로 변경했습니다.
- 연구소 소식 카드의 `[웹 화보]` 버튼을 소식 텍스트 바로 뒤에 붙는 inline UX로 변경했습니다.
- 카드 상세 영역의 첫 번째 `dashboard-list-title`은 공통 CSS로 `margin-top: 0`이 적용되도록 정리했습니다.
