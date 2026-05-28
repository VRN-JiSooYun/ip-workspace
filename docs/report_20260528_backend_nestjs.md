# NestJS Backend Initial Implementation Report

## Date
- 2026-05-28

## Scope
- `docs/backend_nestjs_plan.md` 기준으로 초기 NestJS backend 프로젝트를 생성했다.
- 초기 단계 정책에 따라 DB, Prisma, JWT, BullMQ는 추가하지 않았다.
- 외부 `patent_analysis_helper_api`를 감싸는 frontend-facing REST API를 추가했다.

## Backend Changes
- `backend/` 신규 프로젝트 구성
  - NestJS 11
  - TypeScript
  - Jest
  - ESLint/Prettier
  - Bun 기반 Docker 실행
- `GET /health` 추가
- 특허 분석 API 추가
  - `GET /api/patents/my`
  - `GET /api/patents/:publicationNumber`
  - `GET /api/patents/:publicationNumber/embodiments`
- 외부 helper API adapter 추가
  - `POST {PATENT_ANALYSIS_HELPER_API_URL}/api`
  - `multipart/form-data`
  - `result_code !== "0000"` 에러 변환
  - timeout/network error를 `BadGatewayException`으로 변환
- 환경변수 설정 추가
  - `PORT`
  - `CORS_ORIGINS`
  - `PATENT_ANALYSIS_HELPER_API_URL`
  - `PATENT_ANALYSIS_UPLOAD_API_URL`
  - `PATENT_ANALYSIS_OWNER_ID`
  - `HTTP_TIMEOUT_MS`

## Docker/Compose Changes
- `backend/Dockerfile.dev`
  - `bun run start:dev`
- `backend/Dockerfile`
  - build/runtime stage 분리
  - `bun run start:prod`
- `docker-compose.yml`
  - `local-myworkspace-backend` 추가
  - frontend `VITE_API_URL=/api`
  - Vite proxy `/api -> local-myworkspace-backend:3000`
- `docker-compose.dev.yml`
  - `dev-myworkspace-backend` 추가
  - frontend nginx proxy `/api -> dev-myworkspace-backend:3000`

## Frontend Changes
- `frontend/src/services/patentAnalysisApi.ts` 추가
  - runtime `window._env_.VITE_API_URL` 또는 `import.meta.env.VITE_API_URL` 사용
  - 특허 목록/상세/실시예 API client 제공
- `PatentAnalysisList`
  - backend API로 My 특허 목록 조회
  - 실패 시 기존 mock 데이터 fallback
- `PatentAnalysisDetail`
  - route id가 특허 번호인 경우도 표시 가능하도록 보정
  - backend 상세/실시예 API 응답을 우선 사용
  - 실패 시 기존 mock 데이터 fallback

## Verification
- 프로젝트 지침에 따라 install/build/run/test는 수행하지 않았다.
- Docker 실행 시 기대 확인 URL:
  - local: `http://localhost:3000/health`
  - dev compose: `http://localhost:18082/health`
  - frontend proxy: `/api/patents/my`

## Notes
- 외부 API 서버 `172.16.1.210` 접근 가능 여부는 Docker 실행 환경에서 확인해야 한다.
- 초기 응답 정규화는 최소 수준으로 유지했다. frontend에서 필요한 필드가 확정되면 backend DTO/response shape를 더 엄격하게 고정하는 것이 좋다.
