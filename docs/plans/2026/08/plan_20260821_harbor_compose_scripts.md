# Harbor Compose 스크립트 연동 계획

## 작업 목적

`buildAndPush.sh`와 `pullAndStart.sh`가 `docker-compose.yml`의 애플리케이션 서비스를 대상으로 버전 태그 기반 Harbor 빌드·푸시·배포를 수행할 수 있게 한다.

## 작업 계획

1. 두 스크립트가 기대하는 서비스명, `TAG_VERSION`, Compose 동작을 확인한다.
2. frontend, backend, migration 서비스에 Harbor 이미지명과 `TAG_VERSION` 기반 태그를 연결한다.
3. 서비스 단위 재기동에 맞지 않는 `docker compose down <service>` 호출을 교정한다.
4. 스크립트 구문과 Compose 렌더링을 검증하고 사용법을 문서화한다.

## 범위 및 전제

- PostgreSQL은 공식 이미지를 계속 사용하므로 프로젝트 이미지 빌드·푸시 대상에서 제외한다.
- 기존 태그 고정 배포와 GitHub Actions의 `up --build` 흐름을 유지하기 위해 `TAG_VERSION` 미지정 시 기본 태그는 `1.0.0`으로 둔다.
- 프로젝트 지침에 따라 실제 이미지 빌드, push, pull 및 컨테이너 실행은 수행하지 않는다.
