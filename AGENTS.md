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
- `docker compose up --build`: 프론트엔드 로컬 개발 스택 실행 (포트 5174:5173).
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

## Frontend Display Formatting Rules
- 숫자 표시: 프론트엔드 화면에 표시되는 정수/소수는 기본적으로 셋 자리 comma를 적용합니다.
  - 권장 정규식: `String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',')`
  - 예: `1000` → `1,000`, `1234567.89` → `1,234,567.89`
  - 예외: 특허 번호, compound ID, model ID처럼 숫자처럼 보여도 식별자인 값은 comma를 적용하지 않습니다.
- 날짜 표시: 프론트엔드 화면에 표시되는 날짜는 기본적으로 `YYYY.mm.dd`, 날짜+시간은 `YYYY.mm.dd HH:MM` 형식을 사용합니다.
  - 권장 변환: 공통 유틸 `formatDisplayDate`를 사용해 날짜 구분자를 `.`로 통일하고, 시간이 포함된 값은 분 단위까지만 표시합니다.
  - 예: `2026-06-02` → `2026.06.02`, `26.06.02 10:30` → `2026.06.02 10:30`, `2026-06-02T10:30:45Z` → `2026.06.02 10:30`
  - API 요청/응답 payload의 날짜 형식은 서버 계약을 우선하고, 화면 표시 직전에만 `YYYY.mm.dd` 또는 `YYYY.mm.dd HH:MM`으로 변환합니다.
- Pagination UX: Ant Design Table pagination은 MyBoard 그룹 상세 목록 UX를 기본값으로 맞춥니다.
  - 기본 위치는 하단 우측이며, `ant-pagination-total-text`는 표시하지 않습니다.
  - 기본 page size 옵션은 `[10, 30, 50, 100]`을 사용하고, 필요한 경우 `showSizeChanger: true`를 사용합니다.
  - page number는 숫자 표시 규칙과 동일하게 셋 자리 comma를 적용합니다.
  - 선택된 page item은 primary 색상(`#F87C63`)을 사용합니다.
  - page item은 24px 높이와 32px 최소 폭을 기본으로 사용하고, page size select는 24px 높이를 기본으로 사용합니다.
  - page item, 선택된 page item, prev/next control은 pill radius(`990px`)를 사용합니다.
  - comma가 포함된 page number가 잘리지 않도록 page item은 auto width와 충분한 좌우 여백을 유지합니다.

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
- **외부 API 소유권**: `rdkit/`, `compound_search/` API는 별도 담당자가 관리하므로 에이전트가 해당 디렉토리의 파일을 생성, 수정, 삭제하거나 포맷팅하지 않습니다. 연동 작업 시 API 코드는 읽기 전용으로 확인하고 프론트엔드만 수정합니다.
- **의존성 관리**: 로컬에는 npm, Bun 등이 설치되어 있지 않음. 모든 install, build 등의 작업은 Docker 컨테이너 내에서 수행.
  - 컨테이너 내에서 `bun add <package>`, `bun run build` 등 실행 가능.
  - 로컬에서는 `docker-compose.yml`을 통해 컨테이너 실행.
- **문서화**: 모든 작업내용을 문서화합니다. 작업 보고서는 `docs/reports/YYYY/MM/report_YYYYMMDD_<topic>.md`, 날짜 기반 작업 계획은 `docs/plans/YYYY/MM/plan_YYYYMMDD_<topic>.md`에 저장하고, 장기 기준 문서는 `docs/` 루트에 유지합니다. 상세 탐색 및 명명 규칙은 `docs/README.md`를 따릅니다.
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
