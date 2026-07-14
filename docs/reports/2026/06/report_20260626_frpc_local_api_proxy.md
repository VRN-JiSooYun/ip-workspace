# 2026-06-26 FRPC 및 로컬 API 프록시 설정

## 작업 내용
- 로컬 Vite 개발 환경에서 일반 backend API도 `/api` 상대경로로 호출하도록 `VITE_API_URL`을 `/api`로 변경했다.
- `frontend/vite.config.ts`에 `/api -> local-myworkspace-backend:3000` 프록시를 추가했다.
- `frpc.100moon.i234.me` 도메인을 Vite `allowedHosts`에 유지했다.
- backend CORS 허용 목록에 `https://frpc.100moon.i234.me`, `http://frpc.100moon.i234.me`를 추가했다.
- 특허 분석 상세 페이지의 PDF 로드는 API 응답의 파일 경로를 브라우저가 직접 열지 않고 backend의 `/api/patents/:publicationNumber/pdf` 스트리밍 엔드포인트를 우선 사용하도록 변경했다.
- 특허 분석 상세 조회, embodiment 조회, PDF 스트리밍 URL에 동일한 `ownerId=256`을 전달하도록 맞췄다.

## 기대 동작
- `localhost:5174` 접속 시 frontend 요청은 `/api`, `/rdkit-api`, `/compound-search-api` 상대경로를 사용하고 Vite proxy가 Docker 내부 서비스로 전달한다.
- `frpc.100moon.i234.me`를 `localhost:5174`에 연결한 경우에도 브라우저가 사용자의 로컬 `localhost:3000`을 직접 호출하지 않는다.
- `docker-compose.dev.yml` 배포 환경은 기존처럼 frontend Nginx가 `/api`, `/rdkit-api`, `/compound-search-api`를 내부 서비스로 프록시한다.
- 특허 분석 상세 PDF는 `localhost:5174/api/patents/{publicationNumber}/pdf?ownerId=256` 또는 `frpc.100moon.i234.me/api/patents/{publicationNumber}/pdf?ownerId=256` 형태로 요청된다.

## 참고
- API를 같은 origin 상대경로로 통일했기 때문에 일반 사용 흐름에서는 CORS 의존도가 낮다.
- backend 포트를 직접 외부에 노출해 호출하는 경우를 대비해 frpc 도메인을 CORS 목록에도 추가했다.
