# 다크 테마 구현 작업 체크리스트

> 작성일: 2026-04-22

## 완료된 작업

- [x] 1. `ThemeContext.tsx` 생성 — 전역 isDarkMode 상태 및 toggleTheme 메서드
- [x] 2. `main.tsx` 수정 — ConfigProvider 제거, ThemeProvider로 App 감싸기
- [x] 3. `App.tsx` 수정 — ConfigProvider를 App 내부로 이동, isDarkMode에 따라 algorithm 동적 전환
- [x] 4. `MainLayout.tsx` 수정 — Sider/Header/Content 배경색 토큰화, Sun/Moon 토글 버튼 추가
- [x] 5. `index.css` 수정 — `:root` / `[data-theme='dark']` CSS 변수 시스템 도입
- [x] 6. `MyBoard.tsx` 리팩토링 — 인라인 하드코딩 색상을 `theme.useToken()` 토큰으로 교체
- [x] 7. `SarTable.tsx` 리팩토링 — 인라인 스타일 토큰화, `<style>` 태그 다크 모드 대응
- [x] 8. `SynthesisBoard.tsx` 리팩토링 — 인라인 스타일 토큰화, `<style>` 태그 다크 모드 대응
- [x] 9. Sider 다크 모드 — `theme='dark'` prop 전환, 배경/텍스트/border 어두운 계열로
- [x] 10. SAR Table 히트맵(C 토글) 다크 모드 — 배경은 짙게, 텍스트는 밝게 처리
- [x] 11. `ManagerComparisonPopup` 버그 수정 — 외부 컴포넌트에서 token 미정의 에러 해결

## 버그 수정 이력

| 증상 | 원인 | 해결 |
|---|---|---|
| Vite 빌드 에러 (Babel parser) | Python 스크립트로 `theme` import 시 `} , theme }` 문법 오류 발생 | SarTable, SynthesisBoard의 import 구문 수동 수정 |
| `token is not defined` (SynthesisBoard) | `ManagerComparisonPopup`이 별도 컴포넌트여서 `token` 스코프 밖 | 컴포넌트 내부에서 `theme.useToken()` 자체 호출하도록 수정 |
