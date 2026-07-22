# 개발 도메인 TLS 인증서 볼륨 배포 설정

## 목적

- 외부 `https://voronoi.app:28000` 요청을 방화벽에서 개발 서버 `18080`으로 전달받는다.
- TLS 인증서를 Docker 이미지나 Git 저장소에 포함하지 않고 개발 서버의 영구 경로에서 읽는다.
- 배포할 때마다 인증서 파일을 다시 설치하지 않는다.

## 연결 구조

```text
https://voronoi.app:28000
  -> 방화벽 TCP 포트 포워딩
개발 서버 TCP 18080
  -> Docker 18080:443
frontend Nginx TCP 443 (TLS 종료)
```

## 구현 내용

- `docker-compose.dev.yml`의 frontend 포트를 `18080:443`으로 변경했다.
- `TLS_CERT_PATH`, `TLS_KEY_PATH`가 가리키는 호스트 파일을 Nginx 컨테이너에 읽기 전용으로 마운트한다.
- 두 인증서 경로가 없거나 비어 있으면 Compose 단계에서 오류가 발생하도록 필수 환경변수로 지정했다.
- Nginx가 `voronoi.app`, `www.voronoi.app`에 대해 TLS 1.2/1.3으로 서비스하도록 설정했다.
- backend CORS에 외부 브라우저 origin인 `https://voronoi.app:28000`을 추가했다.
- GitHub Actions가 GitHub Environment variables의 인증서 경로와 공개 origin을 Compose에 전달하도록 설정했다.
- ChemDraw Clipboard Bridge 확장 프로그램에서 신규 HTTPS 도메인을 허용했다.

## 개발 서버 인증서 배치

권장 영구 경로 예시는 다음과 같다.

```text
/opt/voronoi/tls/fullchain.pem
/opt/voronoi/tls/private.key
```

`fullchain.pem`에는 서버 인증서 다음에 중간 인증서 체인이 들어 있어야 한다.

```bash
cat 110d9e0d63ac0356.crt sf_bundle-g2.crt > /opt/voronoi/tls/fullchain.pem
chmod 644 /opt/voronoi/tls/fullchain.pem
chmod 600 /opt/voronoi/tls/private.key
```

GitHub `dev_myworkspace` Environment에 다음 variables를 등록한다.

```text
TLS_CERT_PATH=/opt/voronoi/tls/fullchain.pem
TLS_KEY_PATH=/opt/voronoi/tls/private.key
PUBLIC_ORIGIN=https://voronoi.app:28000
```

경로는 인증서 내용이 아니므로 GitHub Environment secret이 아닌 variable로 관리한다. 개인키 파일 자체는 Git에 커밋하지 않고 개발 서버에만 보관한다.

## 운영 참고

- self-hosted runner와 Docker daemon이 인증서 파일을 읽을 수 있어야 한다.
- 인증서 갱신 시 호스트의 `fullchain.pem`, `private.key`를 교체하고 frontend 컨테이너를 재생성하거나 Nginx를 reload한다.
- 외부 방화벽은 TCP `28000`을 개발 서버 TCP `18080`으로 포워딩해야 한다.
- 확장 프로그램 허용 도메인 변경은 기존 설치본에 바로 반영되지 않으므로 새 패키지를 배포하거나 unpacked 확장을 다시 로드해야 한다.

## 검증

- Compose 환경변수 치환과 YAML 구성을 정적으로 확인했다.
- Nginx 인증서 경로와 Compose 컨테이너 마운트 경로가 일치하는지 확인했다.
- Chrome 확장 manifest JSON 문법을 확인했다.
- `git diff --check`를 수행했다.
- 프로젝트 지침에 따라 Docker 빌드와 실행은 수행하지 않았다.
