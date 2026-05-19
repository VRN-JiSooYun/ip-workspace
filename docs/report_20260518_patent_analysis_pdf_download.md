# Patent Analysis Detail PDF Download

## 변경 내용
- 특허 분석 상세 페이지의 PDF 툴바에 PDF 다운로드 버튼을 추가했다.
- 다운로드 버튼은 현재 상세 페이지에서 로드 중인 PDF 문서 경로를 사용한다.
- 파일명은 특허 번호를 기반으로 생성하고, 안전하지 않은 문자는 `_`로 치환한다.

## 관련 파일
- `frontend/src/pages/PatentAnalysisDetail.tsx`
- `frontend/src/components/patent-analysis/pdf/PatentPdfToolbar.tsx`
