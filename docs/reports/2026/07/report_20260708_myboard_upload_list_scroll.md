# MyBoard 첨부파일 리스트 스크롤 조정

## 작업 범위
- `frontend/src/pages/MyBoard.tsx`의 아이디어 화합물 등록/수정 팝업 첨부파일 리스트 스크롤 동작을 조정했다.

## 구현 내용
- 첨부파일 리스트가 1줄일 때는 `overflow-y: hidden`으로 세로 스크롤이 보이지 않도록 했다.
- 첨부파일 항목이 2개 이상일 때만 `:has(.ant-upload-list-item + .ant-upload-list-item)` 조건으로 세로 스크롤을 켠다.
- 1줄 파일명 표시 높이에 맞춰 list item margin과 name line-height를 보정했다.

## 확인 사항
- 로컬 빌드 및 실행은 프로젝트 지침에 따라 수행하지 않았다.
