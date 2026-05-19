# Header Stack Responsive Layout

## 요청 요약

이전 breadcrumb 축약/ellipsis 방식은 rollback하고, 화면 폭이 짧아질 때 Header의 좌측 breadcrumb 영역과 우측 사용자/아이콘 영역을 좌우 배치에서 위/아래 배치로 전환한다.

## 구현 내용

### Breadcrumb Rollback

파일: `frontend/src/components/common/PageHeaderBreadcrumb.tsx`

- breadcrumb 축약 로직을 제거했다.
- 3단계 이상에서 `...`으로 줄이는 동작을 제거했다.
- 기존처럼 전달된 breadcrumb item을 그대로 표시하도록 복원했다.

### Header 반응형 배치

파일: `frontend/src/components/layout/MainLayout.tsx`

- `viewportWidth` 상태를 추가했다.
- `900px` 이하에서 Header를 column 방향으로 전환한다.
- 좁은 화면에서는 상단 줄에 메뉴 버튼 + breadcrumb를 표시한다.
- 좁은 화면에서는 하단 줄에 알림/테마/팔레트/사용자 선택/avatar를 우측 정렬로 표시한다.
- 좁은 화면 Header 높이를 `128px`로 늘리고, Content 높이는 `calc(100vh - headerHeight)`로 함께 조정한다.
- breadcrumb 자체는 원본 표시를 유지하되, 좁은 화면에서 필요한 경우 가로 스크롤할 수 있게 wrapper에 overflow 처리를 적용했다.

## UX 효과

- breadcrumb 텍스트를 임의로 축약하지 않는다.
- 우측 사용자/아이콘 영역이 breadcrumb와 충돌하지 않고 아래 줄로 내려간다.
- Header 높이 변화에 맞춰 Content 영역 높이도 같이 조정되어 화면 하단이 밀리지 않는다.
