# MyBoard 합성 의뢰 번호 자동 채번

## 작업 범위
- `frontend/src/pages/MyBoard.tsx`의 아이디어 화합물 등록 팝업에 합성 의뢰 번호 자동 채번을 추가했다.
- 포맷은 `LYH-YY-0001` 형태로 적용했다.

## 구현 내용
- `my-board:synthesis-request-counter` localStorage 기반의 별도 카운터를 추가했다.
- 신규 아이디어 화합물 등록 팝업을 열 때 다음 합성 의뢰 번호를 `synthesisRequestNo` 필드에 자동 바인딩한다.
- 입력 필드는 disabled 처리하지 않아 사용자가 직접 수정할 수 있다.
- 등록 성공 시 카운터를 1 증가시키고, 사용자가 값을 비워둔 경우 예약된 자동 번호를 저장한다.
- 기존 저장 위치는 현재 화면 구조에 맞춰 `progressMemo`를 유지했다.

## 확인 사항
- 로컬 빌드 및 실행은 프로젝트 지침에 따라 수행하지 않았다.
