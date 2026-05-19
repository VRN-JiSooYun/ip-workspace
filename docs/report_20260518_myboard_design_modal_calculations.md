# My Board Design Modal Calculations UX

## 작업 범위
- My Board 페이지의 디자인 등록 팝업에서 `Calculations` 선택 영역이 모달 폭보다 커져 보이는 UX를 수정했습니다.

## 수정 파일
- `frontend/src/pages/MyBoard.tsx`

## 구현 메모
- `Row gutter` 기반 배치를 CSS grid로 변경해 모달 내부 폭 안에서 항목이 자동 줄바꿈되도록 했습니다.
- 계산 선택 영역 박스에 `boxSizing: 'border-box'`와 `overflow: 'hidden'`을 적용했습니다.
- 각 계산 토글은 grid 셀 폭을 채우고 긴 텍스트는 줄바꿈되도록 정렬했습니다.
