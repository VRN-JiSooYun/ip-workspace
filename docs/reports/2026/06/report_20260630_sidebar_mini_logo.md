# 2026.06.30 Sidebar Mini Logo 적용 보고서

## 작업 내용
- `frontend/public/favicon.ico`를 기반으로 사이드바 표시용 PNG 자산 `frontend/public/sidebar-mini-logo.png`를 생성했습니다.
- `app-sidebar-mini-logo` 영역에서 기존 `FlaskConical` 아이콘 대신 생성한 PNG 이미지를 렌더링하도록 변경했습니다.
- favicon 원본이 투명 배경의 주황색 심볼이므로, 기존 주황색 배경 박스는 투명 처리해 아이콘이 묻히지 않도록 했습니다.
- 이미지 크기는 40px 로고 영역 안에서 34px로 고정하고 `object-fit: contain`을 적용해 찌그러짐 없이 표시되도록 했습니다.
- `app-sidebar-mini-logo`에 테두리를 추가하고, 내부 배경색을 라이트 모드 `#ffffff`, 다크 모드 `#24272b`로 분기했습니다.
- 로고 우측 워드마크의 `Medichem`/`Workspace` 폰트 크기를 각각 2px 키우고, 두 줄 사이 간격을 3px에서 0.6px로 줄였습니다.
- 제공된 VORONOI SVG에서 텍스트 영역을 제거하고 왼쪽 심볼만 분리한 `frontend/public/sidebar-mini-logo.svg`를 추가했습니다.
- 사이드바 미니 로고 이미지 참조를 `/sidebar-mini-logo.png`에서 `/sidebar-mini-logo.svg`로 변경했습니다.

## 변경 파일
- `frontend/public/sidebar-mini-logo.png`
- `frontend/public/sidebar-mini-logo.svg`
- `frontend/src/components/layout/MainLayout.tsx`
