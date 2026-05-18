# Patent Table Scroll UX

## 작업 범위
- 특허 분석 상세 페이지의 Raw Data, Clean Data 테이블에서 데이터 높이가 짧을 때 세로 스크롤 영역이 보이지 않도록 수정했습니다.
- 특허 분석 목록 페이지의 리스트 테이블도 검색 결과 데이터가 표시 높이를 넘을 때만 세로 스크롤 영역이 생기도록 수정했습니다.

## 수정 파일
- `frontend/src/pages/PatentAnalysisDetail.tsx`
- `frontend/src/pages/PatentAnalysisList.tsx`

## 구현 메모
- 기존에는 `Table`의 `scroll.y`가 항상 지정되어 데이터가 적어도 Ant Design 테이블 body가 세로 스크롤 영역으로 렌더링되었습니다.
- 행 수와 예상 행 높이를 기준으로 실제 데이터 높이가 테이블 최대 높이를 넘을 때만 `scroll.y`를 적용하도록 공통 헬퍼를 추가했습니다.
- 가로 스크롤(`scroll.x`)은 컬럼 수가 많은 테이블 레이아웃 유지를 위해 계속 적용됩니다.
- 목록 페이지는 검색 결과를 `filteredPatents`로 분리하고, viewport 높이와 예상 행 높이를 기준으로 `scroll.y` 적용 여부를 계산합니다.
