# My Board 컬럼 설정 Modal 스크롤 UX

## 요청 요약

My Board 테이블 컬럼 설정 modal popup의 높이가 길어지면 화면 밖으로 벗어나는 문제가 있어, 적정 범위 안에서 보이고 길어지면 스크롤되도록 수정한다.

## 구현 내용

파일: `frontend/src/pages/MyBoard.tsx`

- 컬럼 설정 `Modal`의 body에 `maxHeight`를 적용했다.
- 최대 높이: `min(70vh, 720px)`
- 내용이 길어지면 `overflowY: auto`로 내부 스크롤이 표시된다.
- 스크롤바와 내용이 붙지 않도록 body 오른쪽 padding을 보정했다.

## UX 효과

- 컬럼 항목이 많아져도 modal이 화면 밖으로 밀리지 않는다.
- footer 버튼은 화면 안에 유지되고, 컬럼 목록만 내부에서 스크롤된다.
- 작은 화면에서도 설정 작업을 마무리하기 쉽다.
