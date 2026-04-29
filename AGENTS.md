# Repository Guidelines

## Project Structure & Module Organization
- `frontend/`: Vite + React 앱. 소스는 `frontend/src/`, 정적 자산은 `frontend/public/`에 위치. Bun 기반 빌드.
  - `src/components/`: UI 컴포넌트 (`layout/MainLayout.tsx`, `charts/RadarChart.tsx` 등)
  - `src/contexts/`: React Context (`ThemeContext.tsx` — 다크/라이트 테마 관리)
  - `src/pages/`: 페이지 컴포넌트 (`Dashboard.tsx`, `MyBoard.tsx`, `SarTable.tsx`, `SynthesisBoard.tsx`)
  - `src/store/`: Zustand 상태관리 (`useBoardStore.ts` — 그룹 선택 및 필터 상태)
  - `src/mocks/`: Mock 데이터 (`compounds.ts`)
  - `src/styles/`: 테마 및 스타일 변수
- `docs/`: 프로젝트 문서, 프로토타입 디자인, 구현 계획 및 작업 보고서.
- `docker-compose.yml`: 프론트엔드 로컬 개발 스택 (Postgres, backend는 추후 추가 예정).
- `backend/`: 향후 NestJS API 서버 (현재 미구현).

## Build, Test, and Development Commands
- 모든 빌드 및 실행은 사용자가 할게
- `docker-compose up --build`: 프론트엔드 로컬 개발 스택 실행 (포트 5174:5173).
- 프론트엔드 개발 서버는 Docker 내 Bun으로 Vite 개발 서버 실행 (`bun run dev --host`).
- 빌드: `bun build ./src/main.tsx --outdir ./dist` (현재 Vite 설정 미적용, Bun 직접 빌드).

## Coding Style & Naming Conventions
- 들여쓰기: JS/TS는 2칸 공백(ESLint로 강제).
- 프론트엔드는 TypeScript를 기본으로 사용.
- 모듈/컴포넌트는 `PascalCase`, 변수/함수는 `camelCase`.
- Zustand store는 `useBoardStore` 형식 (Hook-like naming).
- 페이지 컴포넌트: `pages/*.tsx` (예: `Dashboard.tsx`, `MyBoard.tsx`).
- UI 컴포넌트: `components/*/*.tsx` (예: `layout/MainLayout.tsx`, `charts/RadarChart.tsx`).
- React Context: `contexts/*.tsx` (예: `ThemeContext.tsx`).
- Mock 데이터: `mocks/*.ts` (예: `compounds.ts`).

## Testing Guidelines
- 프론트엔드 테스트 러너는 현재 구성되어 있지 않음.
- 프론트엔드는 Mock 데이터(`src/mocks/compounds.ts`)를 사용한 UI 기반 테스트.
- 컴포넌트는 Ant Design, Zustand, React Context와 함께 상태 변화 및 렌더링 검증.

## Commit & Pull Request Guidelines
- 이 작업공간에는 Git 기록이 없어 커밋 메시지 규칙을 확인할 수 없습니다.
- 권장: 짧고 명령형 커밋 제목(예: "Add auth guard").
- PR에는 요약, 테스트 내용, UI 변경 시 스크린샷을 포함하세요.

## Configuration & Environment
- 프론트엔드는 API 기본 URL로 `VITE_API_URL`을 사용합니다 (향후 backend 연동 시 필요).
- 기본 개발 값은 `docker-compose.yml`의 환경변수(`VITE_API_URL=http://localhost:3000`)에서 정의.
- 현재는 Mock 데이터(`src/mocks/compounds.ts`)로 UI 기반 개발 진행 중.

## Agent Instructions
- **현재 프로젝트 상태**: 프론트엔드만 구현됨 (Mock 데이터 기반). 백엔드 미구현.
- **의존성 관리**: 로컬에는 npm, Bun 등이 설치되어 있지 않음. 모든 install, build 등의 작업은 Docker 컨테이너 내에서 수행.
  - 컨테이너 내에서 `bun add <package>`, `bun run build` 등 실행 가능.
  - 로컬에서는 `docker-compose.yml`을 통해 컨테이너 실행.
- **문서화**: 모든 작업내용은 `docs/` 디렉토리에 문서화하여 저장 (작업 계획, 구현 내용, 보고서 등).
- **라이브러리/프레임워크 질의**: Context7 MCP 문서를 먼저 조회하고, sequential thinking을 사용하여 답변 구성.
- **현재 인프라 구성**:
  - Frontend: Vite + React + TypeScript + Ant Design + Zustand + React Context (ThemeContext)
  - Build Tool: Bun (package.json scripts 참고)
  - Theme Management: CSS Variables + React Context (`src/contexts/ThemeContext.tsx`) — 다크/라이트 모드 지원
  - State Management: Zustand (`src/store/useBoardStore.ts`)
  - Mock Data: `src/mocks/compounds.ts`
- **주의사항**: 
  - Backend (`backend/` 디렉토리)는 아직 미구현 상태. NestJS + Prisma는 향후 구현 예정.
  - Docker-compose.yml는 현재 프론트엔드만 포함. Postgres, Backend 추가는 향후 진행.
