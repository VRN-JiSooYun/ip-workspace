# 모니터링 iframe reverse proxy 연동 작업 보고서

## 작업일
- 2026.07.01

## 요청
- 내부망 모니터링 화면 `http://172.16.1.200:2026`을 My Workspace 프론트 화면에서 iframe으로 표시한다.
- 외부 네트워크 사용자는 내부 IP에 직접 접근할 수 없으므로, 우리 도메인 하위 경로를 reverse proxy로 연결한다.
- 좌측 메뉴의 `수리응용2팀 서비스 개발 진행 현황` 위에 `모니터링` 메뉴를 추가한다.

## 구현 내용
- `frontend/src/pages/Monitoring.tsx`
  - `/monitoring/` reverse proxy 경로를 iframe으로 표시하는 페이지를 추가했다.
  - 헤더 breadcrumb는 `모니터링`으로 설정했다.
  - iframe이 차단되거나 별도 확인이 필요할 때 사용할 수 있도록 `새 창으로 열기` 링크를 추가했다.
  - iframe URL은 런타임 env `VITE_MONITORING_URL`을 우선 사용하고, 기본값은 `/monitoring/`으로 설정했다.

- `frontend/src/App.tsx`
  - `/monitoring` 라우트를 추가했다.

- `frontend/src/components/layout/MainLayout.tsx`
  - 좌측 하단 메뉴에 `모니터링` 메뉴를 추가했다.
  - 요청대로 `수리응용2팀 서비스 개발 진행 현황` 메뉴 위에 배치했다.
  - mini sidebar에서도 동일하게 표시되도록 `bottomMiniMenuItems`에 추가했다.

- `frontend/vite.config.ts`
  - 로컬 Vite dev server에서 `/monitoring` 요청을 `http://172.16.1.200:2026`으로 proxy하도록 추가했다.

- `frontend/nginx.conf`
  - 정적 nginx 배포에서 `/monitoring/` 요청을 `${MONITORING_PROXY_TARGET}`으로 proxy하도록 추가했다.
  - websocket upgrade 헤더도 전달하도록 설정했다.

- `docker-compose.yml`, `docker-compose.dev.yml`, `frontend/env.template.js`, `frontend/src/types/external-modules.d.ts`
  - `VITE_MONITORING_URL=/monitoring/`을 추가했다.
  - dev nginx 배포용 `MONITORING_PROXY_TARGET=http://172.16.1.200:2026`을 추가했다.

## Python 모니터링 화면에서 확인할 사항
- iframe 차단 헤더가 없어야 한다.
  - `X-Frame-Options: DENY` 또는 `SAMEORIGIN`이 있으면 제거하거나 조정해야 한다.
  - CSP를 사용한다면 `frame-ancestors`에 My Workspace 도메인을 허용해야 한다.
- CSS/JS/이미지 경로는 reverse proxy 하위 경로에서도 깨지지 않게 맞춘다.
  - 권장: 상대경로 사용
  - 또는 `/monitoring/` base path 기준으로 정적 리소스를 제공
- 모니터링 서버가 redirect를 반환하는 경우 `/monitoring/` 하위 경로를 유지하는지 확인이 필요하다.

## 검증
- 프로젝트 지침에 따라 로컬 Bun install/build는 실행하지 않았다.
- 코드 레벨 diff와 경로 연결 여부를 확인했다.

## 2026.07.01 추가 수정
- iframe에 `/monitoring/`을 직접 연결하면 모니터링 HTML 내부의 절대 API 경로가 `/api/...`로 요청되어 My Workspace backend 또는 SPA fallback으로 빠질 수 있다.
- 브라우저 콘솔에서 `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` 에러가 발생하는 원인은 API 응답 대신 HTML 문서가 반환된 것이다.
- `sample/gpu-monitor` 소스를 확인한 결과 `templates/index.html`에서 `fetch('/api/...')`를 직접 사용하고 있었다.
- 모니터링 소스는 수정하지 않고, My Workspace proxy 환경에서 모니터링 API endpoint만 `MONITORING_PROXY_TARGET`으로 보내도록 수정했다.
- nginx 정적 배포 proxy 대상:
  - `/api/servers`
  - `/api/status`, `/api/status/{server_name}`
  - `/api/notices`, `/api/notices/{notice_id}`
  - `/api/monitor-errors`
  - `/api/register`
  - `/api/reservations/{reservation_id}`
  - `/api/cancel/{reservation_id}`
- Vite dev proxy에도 동일한 모니터링 API prefix를 추가했다.
