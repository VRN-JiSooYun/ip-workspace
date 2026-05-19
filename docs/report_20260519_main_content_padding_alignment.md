# Main Content Padding Alignment

## 요청 요약

페이지가 렌더링되는 `main` 태그 아래 Content 영역의 좌우 padding을 12px로 조정해 header와 좌우 여백 기준을 맞춘다.

## 구현 내용

파일: `frontend/src/components/layout/MainLayout.tsx`

- Ant Design `Content` 영역의 padding을 변경했다.
- 기존: `0 32px 24px 32px`
- 변경: `0 12px 24px 12px`

## 효과

- 레이아웃 Content 자체의 좌우 padding을 12px로 유지한다.
- 좌우 여백을 과하게 키우지 않으면서 header와 페이지 컨테이너 기준을 맞춘다.
- 페이지별 반응형 컨테이너와 header 정렬을 조정하기 쉬운 구조가 된다.
