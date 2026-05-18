# Patent PDF StrictMode Warning Fix

## 작업 범위
- 특허 분석 상세 페이지 PDF 뷰어에서 발생하던 `Cannot use an aborted signal` 콘솔 에러를 줄이기 위해 React 루트의 `StrictMode` 래퍼를 제거했습니다.
- 해당 에러는 개발 모드 StrictMode가 effect를 두 번 실행하면서 `react-pdf-highlighter-plus` / PDF.js 내부 abort signal 정리 흐름과 충돌하는 형태입니다.
- PDF.js JBig2 이미지가 포함된 특허 PDF에서 `wasmUrl`이 전달되지 않아 워커가 `jbig2_nowasm_fallback.js`를 `null...` 경로로 해석하던 문제를 수정했습니다.
- `PdfLoader`에 문자열 URL 대신 PDF.js document params 객체를 넘기고, `wasmUrl`을 `pdfjs-dist@5.7.284`의 WASM CDN 경로로 지정했습니다.

## 수정 파일
- `frontend/src/main.tsx`
- `frontend/src/suppressWarnings.ts`
- `frontend/src/components/patent-analysis/pdf/PatentPdfViewer.tsx`
- `frontend/src/types/external-modules.d.ts`

## 메모
- `JBig2 failed to initialize`, `wasmUrl API parameter`, `Dependent image isn't ready yet` 메시지는 PDF.js 워커 내부 이미지 디코더 경고입니다.
- 워커에서 발생하는 경고는 앱의 `console.warn` 래핑만으로 안정적으로 숨길 수 없으므로, 실제 원인인 `wasmUrl` 설정을 추가했습니다.
- 완전 오프라인 배포에서는 `pdfjs-dist/wasm` 자산을 `public` 또는 정적 파일 서버로 복사하고 `PDFJS_WASM_URL`을 로컬 경로로 바꿔야 합니다.
