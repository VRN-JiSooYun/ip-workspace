# Sidebar Bottom Menu Alignment

## 요청 요약

좌측 메뉴에서 다음 항목을 하단 정렬로 배치한다.

- 수리응용2팀 서비스 개발 진행 현황
- 문의하기

## 구현 내용

파일: `frontend/src/components/layout/MainLayout.tsx`

- `Sider`를 flex column 레이아웃으로 변경했다.
- `Sider` 높이를 `100vh`로 명시해 화면 높이 기준으로 메뉴 영역을 계산하도록 했다.
- Ant Design `Sider` 내부의 `.ant-layout-sider-children` 래퍼에도 flex column을 적용했다.
- 주요 메뉴는 스크롤 가능한 상단 영역에 유지했다.
- `수리응용2팀 서비스 개발 진행 현황`, `문의하기`는 별도 `Menu`로 분리해 하단 영역에 배치했다.
- 하단 메뉴 영역에 `marginTop: auto`와 `flexShrink: 0`을 적용해 화면 bottom에 붙도록 조정했다.
- 선택 상태는 기존 `getSelectedKey()`를 그대로 사용해 상단/하단 메뉴 모두 현재 경로 하이라이트가 동작한다.

## UX 효과

- 업무 주요 메뉴는 위에서부터 탐색한다.
- 도움말/문의성 메뉴는 화면 하단에 고정되어 보조 액션처럼 인식된다.
- 사이드바가 mini/hidden 상태일 때도 기존 표시 정책을 유지한다.
- Ant Design 내부 래퍼 때문에 `Sider` 자체에만 flex를 적용하면 하단 정렬이 동작하지 않으므로, `app-sidebar` class 하위 래퍼를 함께 제어한다.
