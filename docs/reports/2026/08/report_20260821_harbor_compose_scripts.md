# Harbor Compose 스크립트 연동 작업 보고서

## 작업 목적

루트에 추가된 `buildAndPush.sh`, `pullAndStart.sh`의 버전 태그 기반 배포 의도를 확인하고, `docker-compose.yml`이 실제 빌드·push·pull 대상 이미지 정보를 제공하도록 연동한다.

## 파악한 스크립트 의도

- `buildAndPush.sh`: Compose 서비스명과 태그를 받아 `TAG_VERSION`을 내보낸 뒤 해당 서비스만 빌드하고 Harbor에 push한다.
- `pullAndStart.sh`: 같은 서비스명과 태그로 Harbor 이미지를 pull한 뒤 해당 서비스만 새 이미지로 재기동한다.
- 두 스크립트 모두 서비스명과 Docker 태그를 검증하고, `COMPOSE_FILE`로 Compose 파일을 교체할 수 있게 설계되어 있다.

## 변경 내용

### Compose 이미지 연결

- `dev-ipworkspace-frontend`
  - `harbor.dev.voronoi/math2/ip-workspace/web:${TAG_VERSION:-1.0.0}`
- `dev-ipworkspace-backend`
  - `harbor.dev.voronoi/math2/ip-workspace/backend:${TAG_VERSION:-1.0.0}`
- `dev-ipworkspace-migrate`
  - `harbor.dev.voronoi/math2/ip-workspace/migrate:${TAG_VERSION:-1.0.0}`

기존 Compose 및 GitHub Actions 실행에서 `TAG_VERSION`을 넣지 않아도 종전 태그인 `1.0.0`을 사용한다. PostgreSQL은 프로젝트에서 빌드하는 이미지가 아니므로 `postgres:17`을 유지했다.

### 스크립트 보정

- 예시 서비스명을 실제 Compose 서비스명으로 교체했다.
- `docker compose down <service>`는 `down`이 서비스 인자를 받지 않고 프로젝트 전체를 대상으로 하므로 `docker compose stop <service>`로 교체했다.
- pull한 이미지가 같은 태그를 재사용하는 경우에도 컨테이너가 반드시 교체되도록 `up`에 `--force-recreate`를 추가했다.
- `--no-deps`, `--no-build`를 유지해 선택하지 않은 서비스의 재기동이나 배포 서버의 로컬 빌드를 막았다.

### 일괄 실행 지원

- 서비스 인자로 `all`을 추가했다.
- `./buildAndPush.sh all <tag>`는 migration, backend, frontend 세 이미지를 한 번에 빌드·push한다.
- `./pullAndStart.sh all <tag>`는 세 이미지를 pull한 뒤 migration → backend → frontend 순서로 기동한다.
- migration은 foreground와 `--exit-code-from`으로 완료 및 실패를 확인한 뒤 다음 서비스로 넘어간다.

### 운영 문서

- `docs/cicd_diagram.md`에 서비스별 Harbor 이미지와 빌드·배포 명령, 권장 배포 순서를 추가했다.

## 검증 결과

- `bash -n buildAndPush.sh pullAndStart.sh`: 통과
- `docker compose version`: Docker Compose v5.3.0 확인
- 검증용 필수 환경변수와 `TAG_VERSION=20260821`을 넣은 `docker compose config --images`: 통과
  - frontend: `harbor.dev.voronoi/math2/ip-workspace/web:20260821`
  - backend: `harbor.dev.voronoi/math2/ip-workspace/backend:20260821`
  - migration: `harbor.dev.voronoi/math2/ip-workspace/migrate:20260821`
  - database: `postgres:17`
- `docker compose config --services`: 네 서비스가 정상 렌더링됨
- 두 스크립트의 `--help`: 정상 출력
- `git diff --check`: 통과

## 미실행 항목

프로젝트 지침에 따라 실제 Docker 이미지 build/push/pull 및 컨테이너 재기동은 수행하지 않았다. Harbor에 `backend`, `migrate` 저장소가 생성되어 있고 실행 계정에 push 권한이 있는지는 최초 실행 전에 확인해야 한다.
