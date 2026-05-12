# PDF Worker 로딩 에러 대응 (2026-05-12)

## 증상
- 배포(dev) 환경에서 PDF 로더 진입 시 아래 에러 발생
- `Setting up fake worker failed: "Failed to fetch dynamically imported module: http://<host>/assets/pdf.worker.min-<hash>.mjs"`

## 원인 후보
1. `react-pdf-highlighter-plus`가 사용하는 pdfjs 인스턴스와 앱에서 설정한 `GlobalWorkerOptions.workerSrc` 인스턴스가 다를 수 있음
2. Nginx에서 `.mjs` MIME 타입 매핑이 불완전하면 module import 실패 가능

## 적용 조치
1. `PatentPdfViewer.tsx`
- worker를 `pdf.worker.min.mjs?url`로 명시
- `pdfjs.GlobalWorkerOptions.workerSrc` 설정
- `window.pdfjsLib.GlobalWorkerOptions.workerSrc`도 동일값으로 동기화 (라이브러리 fallback 경로 방지)

2. `nginx.conf`
- `types { application/javascript js mjs; }` 추가
- `.mjs` 파일을 모듈 스크립트로 확실히 응답하도록 강화

3. `pdf-worker-url.d.ts`
- `pdf.worker.min.mjs?url` 타입 선언 추가

## 확인 포인트
- 브라우저 Network에서 `/assets/pdf.worker.min-*.mjs` 요청이 200인지 확인
- 응답 `Content-Type`이 JavaScript MIME(`application/javascript` 또는 동등)인지 확인
- 새 이미지로 `docker-compose.dev.yml` 재빌드 후 검증

## 추후 수정 예정
- 백엔드 개발 후 PDF파일은 외부 서버에서 받아올 예정