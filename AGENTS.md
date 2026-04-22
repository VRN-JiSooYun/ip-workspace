# Repository Guidelines

## Project Structure & Module Organization
- `frontend/`: Vite + React 앱. 소스는 `frontend/src/`, 정적 자산은 `frontend/public/`에 작업.
- `docs/`: 프로젝트 문서와 노트.
- `docker-compose.yml`: Postgres, backend, frontend 로컬 개발 스택.
- `backend/`: NestJS API 서버(타입스크립트). 핵심 코드는 `backend/src/`, Prisma 스키마는 `backend/prisma/schema.prisma`, 테스트는 `backend/test/` 및 `backend/src/**/*.spec.ts`에 위치합니다.

## Build, Test, and Development Commands
- 모든 빌드 및 실행은 사용자가 할게
- `docker-compose up --build`: Postgres + backend + frontend 통합 로컬 실행.

## Coding Style & Naming Conventions
- 들여쓰기: JS/TS는 2칸 공백(ESLint로 강제, backend는 Prettier도 사용).
- 프론트엔드, 백엔드 모두 TypeScript를 기본으로 사용.
- 모듈/컴포넌트는 `PascalCase`, 변수/함수는 `camelCase`.
- 백엔드 테스트 파일은 `*.spec.ts` 규칙 사용.

## Testing Guidelines
- 프론트엔드 테스트 러너는 현재 구성되어 있지 않음.
- 프론트엔드 자체 mockup 데이터 생성
- 백엔드는 Jest(`backend/package.json` 설정) 사용.
- 유닛 테스트는 `backend/src/`에 `*.spec.ts`로 작성.
- e2e 테스트는 `backend/test/`에 위치.

## Commit & Pull Request Guidelines
- 이 작업공간에는 Git 기록이 없어 커밋 메시지 규칙을 확인할 수 없습니다.
- 권장: 짧고 명령형 커밋 제목(예: "Add auth guard").
- PR에는 요약, 테스트 내용, UI 변경 시 스크린샷을 포함하세요.

## Configuration & Environment
- 프론트엔드는 API 기본 URL로 `VITE_API_URL`을 사용합니다.
- 기본 개발 값은 `docker-compose.yml`에 정의되어 있습니다.
- 백엔드는 `DATABASE_URL`(Postgres)과 `backend/prisma/schema.prisma`를 기대합니다.
- 
## Agent Instructions
- 라이브러리/프레임워크 관련 질의는 답변 전에 Context7 MCP 문서를 먼저 조회합니다.
- sequential thinking MCP를 사용해서 답변을 구성합니다.
- 로컬에서는 npm, burn등 설치되어 있지 않습니다. install, build등 기능들은 docker container 안에서 사용합니다.
- 로컬에서는 docker-compose.yml을 통해 container 실행합니다.
- 모든 작업내용은 docs/에 문서화해서 저장합니다.