# RDKit API Docker Compose Service

## 요청 요약

`docker-compose.yml`에 `rdkit` submodule의 FastAPI 서비스를 추가한다.

## 구현 내용

### Dockerfile 추가

파일: `docker/rdkit-api.Dockerfile`

- `python:3.12-slim` 기반 이미지 사용
- RDKit drawing 모듈이 참조하는 OS 런타임 라이브러리 설치
  - `libxrender1`
  - `libxext6`
  - `libsm6`
  - `libexpat1`
- `rdkit==2026.3.2`, `fastapi`, `uvicorn`, `requests` 설치
- `rdkit/` submodule 내용을 `/app`으로 복사
- `uvicorn main:app --host 0.0.0.0 --port 8000`으로 실행

### Compose 서비스 추가

파일: `docker-compose.yml`

- 서비스명: `local-myworkspace-rdkit-api`
- container name: `local-myworkspace-rdkit-api`
- 포트: `8000:8000`
- build context: repository root
- dockerfile: `docker/rdkit-api.Dockerfile`
- 개발 편의를 위해 `./rdkit:/app` volume mount 적용
- 기존 frontend 서비스에 `VITE_RDKIT_API_URL=http://localhost:8000` 추가
- frontend 서비스가 rdkit API 서비스에 의존하도록 `depends_on` 추가

파일: `docker-compose.dev.yml`

- 서비스명: `dev-myworkspace-rdkit-api`
- container name: `dev-myworkspace-rdkit-api`
- 포트: `18081:8000`
- build context: repository root
- dockerfile: `docker/rdkit-api.Dockerfile`
- 개발 편의를 위해 `./rdkit:/app` volume mount 적용
- dev frontend 서비스에 `VITE_RDKIT_API_URL=/rdkit-api` 추가
- dev frontend 서비스가 rdkit API 서비스에 의존하도록 `depends_on` 추가

파일: `frontend/nginx.conf`

- dev 정적 배포 환경에서 `/rdkit-api/` 요청을 `dev-myworkspace-rdkit-api:8000`으로 proxy하도록 설정했다.
- 브라우저에서는 `http://localhost:18080/rdkit-api/...` 같은 same-origin 요청으로 호출된다.

파일: `frontend/env.template.js`, `frontend/public/env.js`

- runtime env 템플릿에 `VITE_RDKIT_API_URL`을 추가했다.

## API 확인 경로

- Health check: `http://localhost:8000/health`
- Draw endpoint: `POST http://localhost:8000/draw`

## 참고

빌드와 실행은 프로젝트 지침에 따라 수행하지 않았다. 사용자가 `docker compose up --build`로 확인하면 된다.

## 2026-05-19 추가 수정

컨테이너 실행 시 `ImportError: libXrender.so.1`가 발생해 `python:3.12-slim` 이미지에 누락된 OS shared library를 추가했다. `rdkit/README.md`의 Python 패키지 설치 내용은 반영되어 있었지만, Docker slim 이미지에서는 RDKit drawing에 필요한 시스템 라이브러리를 별도로 설치해야 한다.

이후 `ImportError: libexpat.so.1`가 추가로 발생해 `libexpat1`도 설치 목록에 추가했다.

`test_api.py` 실행 시 `ModuleNotFoundError: No module named 'requests'`가 발생해 테스트 스크립트 실행용 `requests`도 Python 패키지 설치 목록에 추가했다.

dev nginx 정적 배포에서는 Vite dev server proxy가 동작하지 않기 때문에 `frontend/nginx.conf`에 `/rdkit-api/` proxy 설정을 추가했다.
