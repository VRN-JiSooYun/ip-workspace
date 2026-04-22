# 다크 테마(Dark Theme) 구현 계획

> 작성일: 2026-04-22

## 1. 개요

애플리케이션 전반에 걸쳐 사용자가 Light/Dark 테마를 전환할 수 있는 '다크 모드(Dark Mode)'를 도입합니다. Ant Design의 `ConfigProvider`와 `theme.darkAlgorithm`을 활용하여 전체 UI 컴포넌트에 자동 적용되도록 하고, 기존에 하드코딩된 인라인 색상 값들은 동적 토큰으로 치환합니다.

## 2. 아키텍처

### 2.1 ThemeContext (전역 상태 관리)
- **파일**: `frontend/src/contexts/ThemeContext.tsx`
- `isDarkMode` 상태와 `toggleTheme` 메서드를 제공하는 React Context
- `localStorage`에 사용자 설정을 저장하여 새로고침 시에도 유지
- `document.body`에 `data-theme='dark'` 속성을 설정하여 CSS 변수 전환에도 활용

### 2.2 ConfigProvider 동적 전환
- **파일**: `frontend/src/App.tsx`
- `useTheme()` 훅으로 `isDarkMode` 상태를 구독
- `theme.algorithm`을 `isDarkMode`에 따라 `theme.defaultAlgorithm` / `theme.darkAlgorithm`으로 분기
- Layout, Menu, Card, Button 등 컴포넌트별 토큰도 모드별로 분기 설정

### 2.3 CSS 변수 시스템
- **파일**: `frontend/src/index.css`
- `:root` (Light)와 `[data-theme='dark']` (Dark) 선택자로 색상 팔레트 분리
- 주요 변수: `--bg-color`, `--card-bg`, `--card-border`, `--text-primary`, `--text-secondary`, `--border-color`

## 3. 수정 대상 파일

| 파일 | 수정 내용 |
|---|---|
| `contexts/ThemeContext.tsx` | [신규] 전역 테마 상태 관리 Context |
| `main.tsx` | ConfigProvider 제거, ThemeProvider로 감싸기 |
| `App.tsx` | ConfigProvider 이동 및 isDarkMode 기반 동적 테마 설정 |
| `components/layout/MainLayout.tsx` | Sider/Header/Content 배경색 토큰화, 테마 토글 버튼(Sun/Moon) 추가 |
| `index.css` | CSS 변수 시스템 도입 (`--bg-color`, `--card-bg` 등) |
| `pages/MyBoard.tsx` | 인라인 스타일 → `theme.useToken()` 토큰 |
| `pages/SarTable.tsx` | 인라인 스타일 → 토큰, 히트맵 색상 다크 모드 대응 |
| `pages/SynthesisBoard.tsx` | 인라인 스타일 → 토큰, ManagerComparisonPopup 자체 토큰 호출 |

## 4. 다크 모드 색상 팔레트

| 용도 | Light | Dark |
|---|---|---|
| 배경 (Body) | `#f8f9fa` | `#141414` |
| 카드 배경 | `#fff` | `#1f1f1f` |
| Sider 배경 | `#f2f4f6` | `#1a1a1a` |
| Header 배경 | `#f7f9fb` | `#1f1f1f` |
| 카드 Border | `#c4c4c4` | `#434343` |
| 일반 Border | `#f0f0f0` | `#303030` |
| 기본 텍스트 | `#4f5d73` | `rgba(255,255,255,0.85)` |
| 보조 텍스트 | `#868e96` | `rgba(255,255,255,0.45)` |
| 선택 행 배경 | `#fff7f6` | `#2a1f1d` |
| 메뉴 선택 배경 | `#ffffff` | `#2b2b2b` |
