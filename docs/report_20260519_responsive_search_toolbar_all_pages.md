# 전체 페이지 검색 영역 반응형 UX 개선

## 요청 요약

My Board 검색 영역 개선과 같은 방식으로, 다른 페이지의 검색 영역도 화면 폭이 줄어들 때 버튼이나 입력창이 잘리지 않도록 UX를 수정한다.

## 적용 범위

- `frontend/src/pages/MyBoard.tsx`
- `frontend/src/pages/SynthesisBoard.tsx`
- `frontend/src/pages/SarTable.tsx`
- `frontend/src/pages/PatentAnalysisList.tsx`
- `frontend/src/pages/ChemSpace.tsx`
- `frontend/src/pages/ChemSpace3D.tsx`
- `frontend/src/components/layout/MainLayout.tsx`
- `frontend/src/components/patent-analysis/pdf/PatentPdfToolbar.tsx`

## 구현 내용

- 검색 input의 고정폭 배치를 `flex: 1 1 ...` 기반 반응형 폭으로 변경했다.
- 검색 input은 최소 폭을 유지하면서 남는 공간을 사용하고, 좁은 화면에서는 버튼과 함께 줄바꿈된다.
- 기존 `Space` nowrap 배치로 인해 버튼 텍스트가 잘리는 영역은 wrap 가능한 `div` flex toolbar로 교체했다.
- `1100px` 이하에서 주요 액션 버튼은 한 줄 전체 폭 또는 동일 비율 flex 폭을 사용하도록 조정했다.
- Chemical Space 2D/3D 상단 헤더도 제목 영역과 검색/액션 영역이 줄바꿈되도록 수정했다.
- 기본 Header 검색창은 flex 영역 안에서 줄어들 수 있도록 고정 `256px` 폭을 제거했다.
- 특허 PDF 툴바의 문서 검색 input도 고정폭 대신 flex 폭으로 바꿔 툴바 버튼들과 함께 자연스럽게 줄바꿈되도록 했다.

## UX 효과

- 작은 화면에서 검색창, 상세 필터, 구조 검색, Export, 돌아가기 등의 버튼이 영역 밖으로 잘리지 않는다.
- 버튼이 억지로 압축되지 않고 다음 줄로 내려가므로 터치/클릭 영역을 유지한다.
- 페이지별 검색 UX가 My Board와 같은 반응형 동작으로 통일된다.
