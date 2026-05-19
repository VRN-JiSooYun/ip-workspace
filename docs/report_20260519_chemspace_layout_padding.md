# Chem Space 좌우 여백 정렬 작업 보고서

## 요청
- Chem Space 페이지의 좌/우 여백을 My Board 페이지와 같은 수치로 맞춘다.

## 변경 내용
- `frontend/src/pages/ChemSpace.tsx`
  - My Board와 동일한 `getPatentAnalysisLayoutPreset` 기준을 적용했다.
  - 화면 폭에 따라 `maxWidth`, `margin: 0 auto`, 좌우 `sidePadding`이 동일하게 계산되도록 수정했다.
- `frontend/src/pages/ChemSpace3D.tsx`
  - Chem Space에서 이어지는 3D 화면도 같은 여백 기준을 적용했다.

## 적용 기준
- 1920px 미만: `maxWidth: 1600`, `sidePadding: 16`
- 1920px 이상: `maxWidth: 9999`, `sidePadding: 16`
- 2560px 이상: `maxWidth: 9999`, `sidePadding: 20`
- 3200px 이상: `maxWidth: 9999`, `sidePadding: 24`

## 비고
- 상위 Content 영역 padding은 기존 사용자가 수정한 `0 12px 24px 12px` 값을 유지했다.
- My Board와 동일한 내부 페이지 래퍼 기준만 Chem Space에 추가했다.
