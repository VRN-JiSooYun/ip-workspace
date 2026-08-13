# IP Workspace CI/CD 아키텍처 다이어그램

이 문서는 현재 IP Workspace 프로젝트의 GitHub Actions 기반 개발 서버 배포 흐름과 Docker Compose 서비스 구성을 설명합니다.

현재 확정된 자동 배포는 `dev` 브랜치 대상 개발 서버 배포입니다. 운영 서버 배포 워크플로우와 별도 운영 Compose 파일은 아직 이 저장소에 정의되어 있지 않습니다.

실제 배포 준비, 검증, 장애 대응과 rollback 절차는
[`dev_deployment_runbook.md`](dev_deployment_runbook.md)를 따른다.

## CI/CD 프로세스 다이어그램

```mermaid
graph TD
    subgraph GitHubRepo ["GitHub Repository (ip-workspace)"]
        DevBranch[/"branch: dev"/]
    end

    subgraph GitHubActions ["GitHub Actions"]
        DevDeploy["Dev Server Deploy<br/>(.github/workflows/dev-deploy.yml)"]
    end

    subgraph DevServer ["Development Server<br/>(self-hosted runner: myworkspace)"]
        Compose["docker compose -f docker-compose.yml<br/>up --build -d --force-recreate"]

        subgraph Containers ["Dev Docker Containers"]
            Frontend["dev-ipworkspace-frontend<br/>React + Vite build<br/>Nginx (평문 HTTP)<br/>host:25443 -> container:80"]
            Backend["dev-ipworkspace-backend<br/>NestJS API<br/>host:25444 -> container:3000"]
            Migrate["dev-ipworkspace-migrate<br/>Prisma migrate deploy<br/>one-shot"]
            Postgres["dev-ipworkspace-postgres<br/>PostgreSQL 17<br/>persistent volume"]
        end
    end

    subgraph External ["External APIs"]
        PatentHelper["Patent Analysis Helper API<br/>172.16.1.210:10130"]
        PatentUpload["Patent Upload / Insight API<br/>172.16.1.210:8000"]
        Conformer["Conformer API<br/>172.16.1.203:8000"]
    end

    DevBranch -->|push| DevDeploy
    DevDeploy -->|checkout + submodules| Compose
    Compose --> Containers

    Frontend -->|/api/* proxy| Backend
    Backend --> Postgres
    Migrate --> Postgres

    Backend --> PatentHelper
    Backend --> PatentUpload
    Backend --> Conformer
```

## 현재 배포 흐름

1. `dev` 브랜치에 push되면 `.github/workflows/dev-deploy.yml`이 실행됩니다.
2. 워크플로우는 `self-hosted`, `myworkspace` 라벨이 붙은 GitHub Actions runner에서 실행됩니다.
3. `actions/checkout@v4`가 저장소와 submodule을 checkout합니다. submodule 접근에는 `RDKIT_SUBMODULE_TOKEN` secret을 사용합니다.
4. dev 서버의
   `/home/thmoon/devops/myworkspace/secrets/gmail/token.json`을 runner checkout의
   `secrets/gmail/token.json`으로, 같은 위치의 `getMembers.json`을
   `sample/groupware_mail_system/getMembers.json`으로 `600` 권한으로
   복사합니다.
5. runner의 checkout 디렉토리에서 `docker compose -f docker-compose.yml up --build -d --force-recreate`를 실행합니다.
6. 배포 후 `docker image prune -f`로 사용하지 않는 Docker 이미지를 정리합니다.

## 개발 서버 컨테이너 구성

| 서비스 | 컨테이너 | 역할 | 포트 |
| --- | --- | --- | --- |
| Frontend | `dev-ipworkspace-frontend` | React/Vite 빌드 결과를 Nginx로 서빙하고 내부 API 경로를 proxy | `25443:80` |
| Backend | `dev-ipworkspace-backend` | NestJS API 서버 | `25444:3000` |
| Migration | `dev-ipworkspace-migrate` | Backend 시작 전 Prisma migration 적용 | 내부 전용, one-shot |
| PostgreSQL | `dev-ipworkspace-postgres` | Better Auth 사용자·Account·Session·감사 로그 영속 저장 | 내부 전용 |

RDKit API와 Compound Search API 컨테이너는 dev 배포 구성에서 제거되었습니다. 두 서비스는 로컬 개발용 `docker-compose.yml_local`에만 남아 있습니다.

Frontend Nginx는 TLS를 직접 종단하지 않고 평문 HTTP만 서빙합니다. HTTPS가 필요한 경우 앞단 reverse proxy에서 종단합니다.

## Frontend Proxy 경로

`frontend/nginx.conf` 기준으로 프론트엔드 컨테이너는 다음 경로를 내부 서비스로 전달합니다.

| 외부 경로 | 내부 대상 |
| --- | --- |
| `/api/*` | `http://dev-ipworkspace-backend:3000/api/*` |
| `/api/servers`, `/api/status/*`, `/api/notices/*`, `/monitoring/*` 등 | `${MONITORING_PROXY_TARGET}` (기본 `http://172.16.1.200:2026`) |

`/rdkit-api/*`와 `/compound-search-api/*` proxy는 해당 서비스 제거와 함께 삭제되었습니다. 프론트엔드 코드는 여전히 두 경로를 호출하므로, dev 환경에서 구조 렌더링·화합물 검색 기능은 동작하지 않습니다.

## 외부 연동

Backend 컨테이너는 `docker-compose.yml`의 환경변수로 외부 API 주소를 주입받습니다.

| 환경변수 | 기본 개발 서버 값 | 용도 |
| --- | --- | --- |
| `PATENT_ANALYSIS_HELPER_API_URL` | `http://172.16.1.210:10130` | 특허 분석 helper API |
| `PATENT_ANALYSIS_UPLOAD_API_URL` | `http://172.16.1.210:8000` | 특허 분석 업로드 API |
| `PATENT_INSIGHT_API_URL` | `http://172.16.1.210:8000` | Patent Insight API |
| `CONFORMER_API_URL` | `http://172.16.1.203:8000` | conformer 생성 API |
| `VPROP_API_URL` | `http://172.16.1.207:8100` | Vprop 물성 예측 API |
| `VPROP_API_TIMEOUT_MS` | `25000` | Vprop 동기 계산 timeout |
| `VPROP_MAX_RESPONSE_BYTES` | `5242880` | Vprop 응답 최대 크기 |
| `GROUPWARE_LOGIN_CHECK_URL` | `http://172.16.1.32:10050/login_check` | Groupware Token 검증 |
| `GROUPWARE_REVALIDATE_INTERVAL_SECONDS` | `600` | Groupware Token 10분 재검증 |

개발 배포에는 GitHub Environment secret `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRETS`가 필수다. `BETTER_AUTH_SECRETS`는 `version:32자 이상 secret` 형식을 사용하며 기존 배포 후에는 같은 값을 유지해야 기존 암호화 Token과 session을 계속 사용할 수 있다.

Gmail OAuth token은 GitHub Secret이나 image에 넣지 않는다. self-hosted runner가
dev 서버의 `/home/thmoon/devops/myworkspace/secrets/gmail/token.json`을 checkout
내부로 복사하고, Compose가 Backend의 `/run/secrets/gmail/token.json`에
read-only bind mount한다. source 파일이 없으면 배포는 container build 전에
실패한다.

그룹웨어 구성원 원본도 Git에 넣지 않는다. 같은 host 디렉터리의
`getMembers.json`을 checkout의
`sample/groupware_mail_system/getMembers.json`으로 복사하고 Backend의
`/app/imports/groupware-members/getMembers.json`에 read-only mount한다.

## 아직 미정인 영역

- 운영 배포용 GitHub Actions workflow는 현재 없습니다.
- 운영 배포용 `docker-compose.prod.yml`은 현재 없습니다.
- Redis와 Worker 컨테이너는 현재 `docker-compose.yml`에 포함되어 있지 않습니다.
- 로컬 개발용 `docker-compose.yml_local`은 개발 서버 배포 파일과 별도로 존재하며, 서비스 prefix(`local-ipworkspace-*`), 포트, 일부 환경변수가 다릅니다.
