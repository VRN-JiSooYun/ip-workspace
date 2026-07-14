# GitHub Actions Compound API Auth Token

## Request
- GitHub Actions에서 `COMPOUND_API_AUTH_TOKEN`을 넣을 수 있게 추가.

## Implementation
- `.github/workflows/dev-deploy.yml`의 Docker Compose 실행 step에 env를 추가했다.
- `COMPOUND_API_AUTH_TOKEN`은 GitHub Actions secret `secrets.COMPOUND_API_AUTH_TOKEN`에서 읽는다.
- `docker-compose.dev.yml`은 이미 `COMPOUND_API_AUTH_TOKEN=${COMPOUND_API_AUTH_TOKEN:-}`를 사용하고 있어 workflow env가 backend container로 전달된다.

## Required Repository Setting
- GitHub repository 또는 `dev_myworkspace` environment secret에 `COMPOUND_API_AUTH_TOKEN` 값을 등록해야 한다.

## Verification
- 빌드/실행은 프로젝트 지침에 따라 수행하지 않았다.
- `git diff --check`로 패치 공백 오류를 확인했다.
