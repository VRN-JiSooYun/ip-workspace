# PatentAnalysisDetail PDF 컨트롤바 분리 및 조회 기능 추가

## 작업 배경
- 기존 `shrink/expand` 버튼이 PDF 카드 내부 float 영역에 있어, 컨트롤 가시성과 확장성(검색/페이지/회전)이 낮았습니다.
- 문서 기준(`patent_analysis_ui_ux_plan.md`)의 PDF 뷰어 검색/인터랙션 요구를 반영하기 위해 별도 제어영역을 구성했습니다.

## 적용 파일
- `frontend/src/pages/PatentAnalysisDetail.tsx`

## 구현 내용
1. **컨트롤바 분리**
   - PDF 카드 내부 absolute 툴바를 제거하고, PDF 카드 상단 별도 컨트롤바 영역으로 이동.
   - 기존 `Expand/Shrink` 기능은 동일 동작 유지.

2. **PDF 텍스트 조회(검색) 추가**
   - 검색 입력창(`Input`) 추가.
   - PDF textLayer의 span을 대상으로 검색 매치 수집.
   - 결과 개수/현재 선택 인덱스 표시(`1/10` 형태).
   - `Prev/Next` 버튼으로 매치 이동 및 스크롤 포커싱.

3. **페이지 표시 추가**
   - `Page {current}/{total}` 표시.
   - `handleGoToPdf` 호출 시 현재 페이지 상태 동기화.
   - 뷰어 스크롤/DOM 변화를 감지해 현재 페이지 자동 업데이트.

4. **좌/우 회전 버튼 추가**
   - `RotateCcw`, `RotateCw` 버튼 추가.
   - 90도 단위 회전 상태(`0/90/180/270`) 관리.

5. **검색 하이라이트 스타일 추가**
   - 검색 결과 기본/활성 하이라이트 클래스(`pdf-search-match`, `pdf-search-match-active`) 추가.

## 검증
- 타입 체크: `get_errors` 기준 에러 없음.
- 컨테이너 빌드 검증:
  - `docker compose run --rm local-myworkspace-frontend sh -lc "bun install && bun run build"`
  - `tsc -b && vite build` 통과.

## 참고/제약
- 현재 텍스트 조회는 렌더된 `textLayer` 기준입니다.
- 미렌더 페이지 텍스트까지 전수 검색이 필요하면 `pdfjs-dist` 기반 페이지 텍스트 인덱싱 로직을 추가하는 2차 확장이 필요합니다.

