# 특허 분석 리스트 검색 영역 UX 정렬 작업 보고서

## 요청
- 특허 분석 리스트 페이지 검색 영역의 outline을 My Board와 같은 UX로 통일한다.

## 변경 내용
- `frontend/src/pages/PatentAnalysisList.tsx`
  - 검색 영역 `Card`에 My Board와 동일한 `c-card` 클래스를 적용했다.
  - 검색 영역 하단 간격도 My Board와 동일하게 `24px`로 맞췄다.

## 적용 결과
- 검색 영역 카드가 공통 `--c-card-border` 기반의 outline, `12px` radius, shadow 없음 스타일을 사용한다.
- 라이트/다크 테마 모두 My Board 검색 영역과 같은 border 기준을 공유한다.
