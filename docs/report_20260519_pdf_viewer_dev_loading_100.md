# Dev 서버 PDF Viewer Loading 100% 이슈 검토

## 현상
- dev 서버에서 특허 분석 상세 페이지의 PDF Viewer가 `Loading 100%` 텍스트만 표시되고 PDF 본문이 렌더링되지 않는다.

## 원인 추정
- `Loading 100%`는 PDF 파일 다운로드 자체는 완료됐다는 의미다.
- 이후 PDF.js가 문서를 파싱하고 페이지를 렌더링해야 하는데, 기존 설정은 PDF.js wasm 리소스를 외부 CDN(`cdn.jsdelivr.net`)에서 가져오도록 되어 있었다.
- dev 서버 또는 사용자 네트워크에서 외부 CDN 접근이 차단되거나 지연되면 PDF 파일은 100%까지 로드되지만 렌더링 단계가 완료되지 않을 수 있다.

## 변경 내용
- `frontend/src/components/patent-analysis/pdf/PatentPdfViewer.tsx`
  - production/dev 배포 빌드에서는 PDF.js wasm 경로를 `/pdfjs/wasm/` 로 사용하도록 변경했다.
  - Vite 개발 서버에서는 기존 CDN 경로를 유지한다.
- `frontend/Dockerfile.dev`
  - 빌드 이미지의 `node_modules/pdfjs-dist/wasm` 디렉토리를 nginx 정적 경로 `/usr/share/nginx/html/pdfjs/wasm` 로 복사하도록 추가했다.

## 확인 포인트
- dev 서버 재빌드 후 브라우저 Network 탭에서 `/pdfjs/wasm/` 하위 `.wasm` 파일이 200으로 내려오는지 확인한다.
- `/WO2026090333A1.pdf`, `/WO2026087635A1.pdf` 는 기존처럼 nginx 정적 파일로 제공된다.
