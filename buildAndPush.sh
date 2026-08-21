#!/usr/bin/env bash

set -Eeuo pipefail

readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<EOF
사용법:
  ${SCRIPT_NAME} <서비스> <태그 버전>

예시:
  ${SCRIPT_NAME} dev-ipworkspace-frontend 20260821
  ${SCRIPT_NAME} dev-ipworkspace-backend 20260821
  ${SCRIPT_NAME} dev-ipworkspace-migrate 20260821
  ${SCRIPT_NAME} all 20260821

환경 변수:
  COMPOSE_FILE  사용할 Compose 파일 (기본값: ${SCRIPT_DIR}/docker-compose.yml)

Harbor 인증이 필요한 경우 실행 전에 docker login을 완료해야 합니다.
EOF
}

die() {
  echo "오류: $*" >&2
  echo >&2
  usage >&2
  exit 1
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

[[ $# -eq 2 ]] || die "서비스(또는 all)와 태그 버전을 모두 입력해야 합니다."

readonly SERVICE_SELECTOR="$1"
readonly TAG_VERSION="$2"
readonly COMPOSE_FILE_PATH="${COMPOSE_FILE:-${SCRIPT_DIR}/docker-compose.yml}"

readonly APP_SERVICES=(
  dev-ipworkspace-migrate
  dev-ipworkspace-backend
  dev-ipworkspace-frontend
)

[[ "$TAG_VERSION" =~ ^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,127}$ ]] || die "올바르지 않은 태그 버전입니다: ${TAG_VERSION}"
[[ -f "$COMPOSE_FILE_PATH" ]] || die "Compose 파일을 찾을 수 없습니다: ${COMPOSE_FILE_PATH}"

command -v docker >/dev/null 2>&1 || die "docker 명령어를 찾을 수 없습니다."
docker compose version >/dev/null 2>&1 || die "Docker Compose를 사용할 수 없습니다."

export TAG_VERSION

if [[ "$SERVICE_SELECTOR" == "all" ]]; then
  readonly SERVICES=("${APP_SERVICES[@]}")
else
  [[ "$SERVICE_SELECTOR" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ ]] || die "올바르지 않은 서비스명입니다: ${SERVICE_SELECTOR}"
  readonly SERVICES=("$SERVICE_SELECTOR")
fi

for service in "${SERVICES[@]}"; do
  if ! docker compose -f "$COMPOSE_FILE_PATH" config --services | grep -Fqx "$service"; then
    die "Compose 파일에 서비스가 없습니다: ${service}"
  fi
done

if [[ "${#SERVICES[@]}" -eq 1 ]]; then
  readonly TARGET_LABEL="${SERVICES[0]}"
else
  readonly TARGET_LABEL="전체 애플리케이션 서비스"
fi

compose() {
  docker compose -f "$COMPOSE_FILE_PATH" "$@"
}

echo "[1/2] ${TARGET_LABEL} 이미지 빌드 (TAG_VERSION=${TAG_VERSION})"
compose build "${SERVICES[@]}"

echo "[2/2] Harbor에 이미지 푸시 (TAG_VERSION=${TAG_VERSION})"
compose push "${SERVICES[@]}"

echo "완료: ${TARGET_LABEL}의 TAG_VERSION=${TAG_VERSION} 이미지가 빌드되고 Harbor에 푸시되었습니다."
