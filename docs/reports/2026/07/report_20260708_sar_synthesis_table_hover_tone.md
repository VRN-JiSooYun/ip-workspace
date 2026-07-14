# SAR Table 및 Synthesis 테이블 Hover 톤 조정

## 작업 범위
- `frontend/src/pages/SarTable.tsx`의 SAR 페이지 테이블 hover 톤을 MyBoard와 동일하게 조정했다.
- `frontend/src/pages/SynthesisBoard.tsx`의 Synthesis 페이지 테이블 hover 톤을 MyBoard와 동일하게 조정했다.

## 구현 내용
- SAR 페이지는 기존 `.sar-page` 범위에서 hover 관련 CSS 변수를 덮어썼다.
- Synthesis 페이지는 루트에 `.synthesis-page` class를 추가하고 해당 범위에서 hover 관련 CSS 변수를 덮어썼다.
- 일반 row hover는 `rgba(248, 124, 99, 0.06)`, 선택 row hover는 `rgba(248, 124, 99, 0.16)`로 맞췄다.
- 다크 모드는 각각 `0.10`, `0.24` alpha로 MyBoard와 동일하게 적용했다.

## 확인 사항
- 로컬 빌드 및 실행은 프로젝트 지침에 따라 수행하지 않았다.
