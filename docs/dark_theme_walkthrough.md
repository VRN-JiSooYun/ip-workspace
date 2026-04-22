# 다크 테마 구현 Walkthrough

> 작성일: 2026-04-22

## 1. 요약

MyWorkspace 프론트엔드에 **Light/Dark 테마 전환 기능**을 구현했습니다. 헤더의 Sun/Moon 아이콘을 클릭하면 전체 UI가 부드럽게 다크 모드로 전환되며, 사용자의 선택은 `localStorage`에 저장되어 새로고침 후에도 유지됩니다.

## 2. 변경된 파일 목록

### 신규 생성
| 파일 | 역할 |
|---|---|
| `frontend/src/contexts/ThemeContext.tsx` | 전역 테마 상태 관리 (isDarkMode, toggleTheme, localStorage 연동) |

### 수정
| 파일 | 주요 변경 |
|---|---|
| `frontend/src/main.tsx` | ConfigProvider 제거, ThemeProvider로 App 감싸기 |
| `frontend/src/App.tsx` | ConfigProvider를 App 내부로 이동, isDarkMode 기반 동적 algorithm 전환 |
| `frontend/src/index.css` | `:root` / `[data-theme='dark']` CSS 변수 시스템 도입 |
| `frontend/src/components/layout/MainLayout.tsx` | Sider 다크 배경, Header 토큰화, Sun/Moon 토글 버튼, 메뉴 스타일 다크 대응 |
| `frontend/src/pages/MyBoard.tsx` | 인라인 하드코딩 색상 → `theme.useToken()` 토큰 치환 |
| `frontend/src/pages/SarTable.tsx` | 인라인 스타일 토큰화, `<style>` 태그 다크 대응, 히트맵(C 토글) 다크 모드 색상 |
| `frontend/src/pages/SynthesisBoard.tsx` | 인라인 스타일 토큰화, `<style>` 태그 다크 대응, ManagerComparisonPopup 자체 토큰 호출 |

## 3. 기술적 결정 사항

### 3.1 테마 전환 방식
- **Ant Design ConfigProvider**: `theme.darkAlgorithm` / `theme.defaultAlgorithm` 동적 전환
- **CSS 변수**: Ant Design이 커버하지 못하는 커스텀 클래스(`.c-card`, `.dashboard-card` 등)는 CSS 변수로 처리
- **body[data-theme]**: ThemeContext에서 body 속성을 동적으로 설정하여 CSS 변수 전환 트리거

### 3.2 인라인 스타일 토큰 치환 전략
Python 스크립트를 사용하여 3개 페이지(MyBoard, SarTable, SynthesisBoard)의 하드코딩된 색상을 일괄 치환한 뒤, 구문 오류를 수동으로 보정하는 방식으로 진행했습니다.

주요 매핑:
- `'#fff'` → `token.colorBgContainer`
- `'#f8f9fa'` → `token.colorBgLayout`
- `'#f0f0f0'` → `token.colorBorderSecondary`
- `'#868e96'` → `token.colorTextSecondary`
- `'#F87C63'` → `token.colorPrimary`

### 3.3 독립 컴포넌트 처리
`ManagerComparisonPopup`처럼 메인 컴포넌트 외부에 정의된 컴포넌트는 자체적으로 `theme.useToken()`을 호출해야 합니다. 외부 스코프의 `token` 변수에 의존하면 `ReferenceError`가 발생합니다.

### 3.4 히트맵 색상 (SAR Table C 토글)
다크 모드에서 히트맵은 배경을 짙게, 텍스트를 밝게 처리하여 가독성을 확보했습니다:

| 값 범위 | Light 배경 → Dark 배경 | Dark 텍스트 |
|---|---|---|
| < 0.1 | `#10b981` → `#065f46` | `#6ee7b7` |
| < 0.5 | `#d1fae5` → `#064e3b` | `#a7f3d0` |
| < 1.0 | `#fef3c7` → `#78350f` | `#fde68a` |
| < 10 | `#fffbeb` → `#713f12` | `#fcd34d` |
| ≥ 10 | `#fee2e2` → `#7f1d1d` | `#fca5a5` |

## 4. 검증 방법

1. `http://localhost:5174` 접속
2. 헤더 우측의 Moon(🌙) 아이콘 클릭 → 전체 UI가 다크 모드로 전환
3. Sun(☀️) 아이콘 클릭 → 라이트 모드로 복원
4. 브라우저 새로고침 → 마지막 선택한 테마가 유지되는지 확인
5. SAR Table에서 C 버튼 토글 → 히트맵 색상이 다크 모드에서 적절히 표시되는지 확인

## 5. 향후 과제

- Dashboard 페이지 다크 모드 세부 조정
- 추가 페이지(특허, 논문 등) 생성 시 다크 모드 토큰 기반으로 개발
- 테마 전환 시 부드러운 CSS transition 애니메이션 추가 검토
