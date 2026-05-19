# VORA 외부 이동 버튼 추가

## 요청 요약

좌측 영역에 VORA 외부 사이트 이동 버튼을 추가한다. VORA는 Mol* 라이브러리 기반의 3차원 화합물 viewer 엔진이며, 현재 앱 내부 라우트가 아니라 다른 사이트로 이동한다.

## 구현 내용

### 메뉴 위치

파일: `frontend/src/components/layout/MainLayout.tsx`

- `VORA`를 일반 `Menu` 항목에서 제거했다.
- Dashboard 메뉴 위에 별도 외부 이동 button으로 배치했다.
- 선택/활성 메뉴처럼 보이지 않도록 primary 채움 색상 대신 neutral outline 스타일을 적용했다.
- 클릭 시 새 탭으로 외부 사이트를 연다.
- 배치 순서:
  - VORA button
  - Dashboard
  - Compounds
  - Documents

### 라우트

파일: `frontend/src/App.tsx`

- `/vora` 내부 라우트를 제거했다.
- VORA는 앱 내부 페이지가 아니라 외부 사이트로 이동한다.

## 아이콘 추천

사용한 아이콘: `Box`

이유:

- VORA가 3차원 viewer 엔진이므로 3D 공간/볼륨을 암시하는 아이콘이 적합하다.
- lucide-react에 포함된 안정적인 아이콘이며, 현재 프로젝트의 아이콘 스타일과 일관된다.
- `Chemical space`와 구분되면서도 3D 도구라는 의미를 전달한다.

대안:

- `Rotate3d`: 3D 회전/인터랙션을 더 직접적으로 표현할 때 적합하다.
- `Cuboid`: 3D 박스 의미가 더 명확하지만 lucide-react 버전 호환성을 확인해야 한다.
- `Atom`: 분자/원자 의미는 강하지만 viewer 엔진보다는 화학 일반 기능처럼 보일 수 있다.
