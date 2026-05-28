# Backend NestJS Implementation Plan

## Date
- 2026-05-28

## Goal
- `backend/`에 NestJS API 서버를 신규 구성한다.
- 초기 단계에서는 DB를 연결하지 않는다.
- 외부 `patent_analysis_helper_api`와 연동해 frontend의 `Documents > Patents > My 특허 분석` 메뉴에서 사용할 API를 제공한다.
  - [patent_analysis_api_docs.md](patent_analysis_api_docs.md)
  - [patent_analysis_external_api_guide.md](patent_analysis_external_api_guide.md)
- 빌드와 실행은 Docker 안에서 수행한다.
- `docker-compose.yml`과 `docker-compose.dev.yml` 모두 frontend, backend, rdkit-api를 함께 다루도록 구성한다.

## Scope

### Included
- NestJS 11 기반 `backend/` 프로젝트 스캐폴딩
- Docker 실행 환경
- 개발용 Dockerfile과 운영용 Dockerfile
- `/health` API
- 특허 분석 BFF API 모듈
- 외부 특허 분석 API 호출용 adapter/service
- 환경변수 기반 설정
- 기본 validation, exception handling, timeout 처리
- frontend가 호출할 안정적인 REST API 표면 정의

### Excluded Initially
- Prisma, PostgreSQL 연결
- BullMQ/Redis job queue
- JWT 인증
- 사용자/권한 모델
- 파일 영구 저장소
- 외부 API 응답의 전체 정규화 저장

초기 단계에서는 이전 프로젝트의 `package.json` 중 NestJS 서버 운영에 필요한 최소 라이브러리만 가져오고, DB/Auth/Queue 관련 패키지는 실제 요구가 생길 때 추가한다.

## Proposed Backend Dependencies

### Runtime
- `@nestjs/common`
- `@nestjs/core`
- `@nestjs/platform-express`
- `@nestjs/config`
- `@nestjs/axios`
- `class-validator`
- `class-transformer`
- `reflect-metadata`
- `rxjs`

### Dev
- `@nestjs/cli`
- `@nestjs/schematics`
- `@nestjs/testing`
- `typescript`
- `ts-node`
- `tsconfig-paths`
- `jest`
- `ts-jest`
- `supertest`
- `eslint`
- `prettier`

### Hold For Later
- `@prisma/client`, `prisma`, `@prisma/adapter-pg`, `pg`
- `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`
- `bullmq`

## Directory Structure

```text
backend/
  Dockerfile
  Dockerfile.dev
  .dockerignore
  package.json
  bun.lockb
  nest-cli.json
  tsconfig.json
  tsconfig.build.json
  eslint.config.mjs
  src/
    main.ts
    app.module.ts
    config/
      env.validation.ts
      configuration.ts
    common/
      filters/http-exception.filter.ts
      interceptors/timeout.interceptor.ts
    health/
      health.module.ts
      health.controller.ts
    patent-analysis/
      patent-analysis.module.ts
      patent-analysis.controller.ts
      patent-analysis.service.ts
      patent-analysis-helper.client.ts
      dto/
        patent-list-query.dto.ts
        patent-detail-query.dto.ts
        embodiment-list-query.dto.ts
      types/
        patent-analysis-helper.types.ts
  test/
    app.e2e-spec.ts
    jest-e2e.json
```

## API Design

Backend는 frontend에 REST 형태를 제공하고, 내부에서 `patent_analysis_helper_api`의 RPC 스타일 `/api` 호출로 변환한다.

### Health
- `GET /health`
- 응답 예시:

```json
{
  "status": "ok"
}
```

### Patent Analysis

#### List My Patents
- `GET /api/patents/my`
- Query:
  - `ownerId`
  - `page`
  - `pageSize`
  - `folderId`
  - `filter`
  - `order`
- External mapping:
  - `POST {PATENT_ANALYSIS_HELPER_API_URL}/api`
  - `operation=GET-PATENT-LIST`
  - `whose=my`
  - `owner_id={ownerId}`
  - `num-rows-per-page={pageSize}`
  - `page-no={page}`
  - `filter_dict`, `order_dict`, `filter_group_conjunction_list`는 JSON string form-data로 전달

#### Patent Detail
- `GET /api/patents/:publicationNumber`
- Query:
  - `ownerId`
- External mapping:
  - `operation=GET-PATENT-DATA`
  - `publication_number={publicationNumber}`
  - `owner_id={ownerId}`

#### Embodiment List
- `GET /api/patents/:publicationNumber/embodiments`
- Query:
  - `ownerId`
  - `page`
  - `pageSize`
  - `filter`
  - `ligandFilter`
  - `order`
- External mapping:
  - `operation=GET-EMBODIMENT-LIST`
  - `publication_number={publicationNumber}`
  - `owner_id={ownerId}`
  - `whose=my`

## Environment Variables

### Backend
- `NODE_ENV=development`
- `PORT=3000`
- `PATENT_ANALYSIS_HELPER_API_URL=http://172.16.1.210:10130`
- `PATENT_ANALYSIS_UPLOAD_API_URL=http://172.16.1.210:8000`
- `PATENT_ANALYSIS_OWNER_ID=171`
- `HTTP_TIMEOUT_MS=30000`

### Frontend
- 로컬 compose:
  - `VITE_API_URL=http://localhost:3000`
- dev compose:
  - reverse proxy를 쓰면 `/api`
  - 직접 접근이면 배포 호스트 기준 backend port

## Docker Plan

### `backend/Dockerfile.dev`
- Bun 기반 이미지 사용
- `/app` workdir
- `package.json`, lockfile 복사 후 install
- 개발 시 `./backend:/app` volume mount
- command: `bun run start:dev`
- port: `3000`

### `backend/Dockerfile`
- build stage:
  - dependencies install
  - `bun run build`
- runtime stage:
  - production dependencies만 사용
  - command: `bun run start:prod`
- port: `3000`

## Compose Plan

### `docker-compose.yml`
로컬 개발용으로 유지한다.

- `local-myworkspace-frontend`
  - port `5174:5173`
  - `VITE_API_URL=http://localhost:3000`
  - depends_on:
    - `local-myworkspace-backend`
    - `local-myworkspace-rdkit-api`
- `local-myworkspace-backend`
  - build context `./backend`
  - dockerfile `Dockerfile.dev`
  - port `3000:3000`
  - volume `./backend:/app`, `/app/node_modules`
  - environment:
    - `NODE_ENV=development`
    - `PORT=3000`
    - `PATENT_ANALYSIS_HELPER_API_URL=http://172.16.1.210:10130`
    - `PATENT_ANALYSIS_UPLOAD_API_URL=http://172.16.1.210:8000`
    - `PATENT_ANALYSIS_OWNER_ID=171`
    - `HTTP_TIMEOUT_MS=30000`
- `local-myworkspace-rdkit-api`
  - 기존 유지

### `docker-compose.dev.yml`
서버형 개발/검수 환경으로 유지한다.

- `dev-myworkspace-frontend`
  - 기존 nginx 기반 port `18080:80`
  - frontend가 `/api`로 backend를 호출하도록 nginx proxy 또는 `VITE_API_URL` 조정
  - depends_on:
    - `dev-myworkspace-backend`
    - `dev-myworkspace-rdkit-api`
- `dev-myworkspace-backend`
  - build context `./backend`
  - dockerfile `Dockerfile`
  - restart `always`
  - port `18082:3000`
  - environment는 dev 환경 값 사용
- `dev-myworkspace-rdkit-api`
  - 기존 유지

## Implementation Phases

### Phase 1. Backend Skeleton
- `backend/` NestJS 프로젝트 생성
- Bun 기반 scripts 정리
- `/health` 추가
- global prefix `/api` 적용 여부 결정
  - 권장: business API는 `/api/*`, health는 `/health`
- CORS 설정
  - local frontend origin: `http://localhost:5174`
  - 필요 시 dev origin 추가

### Phase 2. Docker Integration
- `backend/Dockerfile.dev` 추가
- `backend/Dockerfile` 추가
- `.dockerignore` 추가
- `docker-compose.yml`에 backend service 추가
- `docker-compose.dev.yml`에 backend service 추가
- frontend `depends_on`, `VITE_API_URL` 정리

### Phase 3. Patent Analysis Adapter
- `PatentAnalysisHelperClient` 구현
- form-data 생성 공통 함수 작성
- 외부 API 공통 응답 `{ result_code, result }` 검증
- `result_code !== "0000"`일 때 NestJS exception으로 변환
- timeout, network error, invalid response 처리

### Phase 4. Frontend-Facing Patent APIs
- `GET /api/patents/my`
- `GET /api/patents/:publicationNumber`
- `GET /api/patents/:publicationNumber/embodiments`
- query DTO validation
- frontend에서 쓰기 쉬운 응답 shape로 최소 정규화

### Phase 5. Frontend Wiring
- frontend mock 데이터 의존 지점을 API service로 분리
- `VITE_API_URL` 기반 fetch/axios client 추가
- `Documents > Patents > My 특허 분석` 메뉴의 list/detail 데이터를 backend API로 전환
- 실패 시 빈 상태, 로딩, 에러 표시 처리

### Phase 6. Verification
- Docker compose up은 사용자가 수행
- 구현자는 실행하지 않고 다음 항목을 문서화:
  - 기대 실행 명령
  - health check URL
  - 주요 API curl 예시
  - 외부 API 연결 실패 시 확인할 환경변수

## API Response Normalization Policy

초기에는 외부 API 응답을 과하게 변환하지 않는다.

- list API:
  - `items`
  - `totalCount`
  - `raw`
- detail API:
  - `publicationNumber`
  - `metadata`
  - `compounds`
  - `modifiedCompounds`
  - `tables`
  - `raw`
- embodiment API:
  - `items`
  - `totalCount`
  - `modifiedItems`
  - `modifiedTotalCount`
  - `raw`

이 방식은 frontend가 필요한 필드만 안정적으로 쓰게 하면서, 외부 API의 세부 필드 누락에도 대응하기 쉽다.

## Risks
- 외부 API가 `multipart/form-data`와 stringified JSON 필드를 강하게 요구한다.
- `172.16.1.210` 접근은 Docker 네트워크/호스트 네트워크 환경에 따라 실패할 수 있다.
- 외부 API 응답 shape가 operation별로 일관적이지 않을 수 있다.
- 대용량 특허 상세 응답은 frontend 렌더링과 backend timeout에 영향을 줄 수 있다.
- 파일 다운로드/업로드 API는 JSON API와 별도 흐름이므로 2차 단계로 분리하는 편이 안전하다.

## Open Decisions
- `ownerId`를 frontend query로 받을지, backend env 기본값으로 고정할지 결정 필요
  - 초기 권장: env 기본값을 두고 query override 허용
- `docker-compose.dev.yml`에서 frontend nginx가 `/api`를 backend로 proxy할지 결정 필요
  - 초기 권장: nginx proxy를 사용해 browser CORS와 host port 의존성을 줄인다.
- 특허 업로드 기능을 1차 범위에 포함할지 결정 필요
  - 초기 권장: 목록/상세/실시예 조회 안정화 후 추가한다.

## Recommended First Implementation Order
1. `backend/` NestJS skeleton 생성
2. `/health` 구현
3. Dockerfile 2종 작성
4. compose 2종에 backend 연결
5. `PatentAnalysisHelperClient` 구현
6. `GET /api/patents/my` 구현
7. `GET /api/patents/:publicationNumber` 구현
8. `GET /api/patents/:publicationNumber/embodiments` 구현
9. frontend API client 연결
10. 작업 보고서 작성
