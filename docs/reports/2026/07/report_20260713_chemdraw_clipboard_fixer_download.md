# ChemDraw Clipboard Fixer 다운로드 버튼 추가

## 작업 내용

- ChemDraw 공통 컴포넌트의 좌측 세로 버튼 영역에 다운로드 아이콘 버튼을 추가했다.
- 버튼 클릭 시 `frontend/public/chemdrawClipboardFixer/chemdraw-clipboard-fixer.zip`을 설치 파일명 그대로 다운로드한다.
- Vite의 `BASE_URL`을 기준으로 링크를 생성해 하위 경로에 배포된 환경에서도 정적 파일을 찾을 수 있도록 했다.
- 툴팁과 접근성 레이블에 Windows용 ChemDraw Office 붙여넣기 보정 설치 파일임을 표시했다.
- ChemDraw 컨테이너에서 구조 복사 이벤트가 발생하면 현재 구조의 SVG를 추출해 사용자 PC의 `http://localhost:47823/svg`로 POST한다.
- 요청 본문은 SVG 원문이며 `Content-Type: image/svg+xml`을 사용한다.
- 로컬 helper가 설치되지 않았거나 실행 중이 아닌 경우를 포함한 모든 전송 오류는 무시하며, 1.5초 후 요청을 중단해 기존 복사 동작에 영향을 주지 않는다.
- 좌측 컨트롤이 활성화되면 `GET http://localhost:47823/health`를 즉시 호출하고 이후 5초마다 연결 상태를 갱신한다.
- helper가 `200 ok`로 응답하면 다운로드 버튼을 Extend clipboard 버튼과 같은 primary 상태로 표시하고, 연결되지 않으면 기본 상태와 설치 안내 툴팁을 표시한다.
- 연결되지 않은 상태에서도 helper 설치를 위해 다운로드 버튼은 계속 사용할 수 있다.
- Clipboard Fixer는 Windows 전용으로 판별하며, macOS를 포함한 비 Windows 환경에서는 다운로드 버튼을 렌더링하지 않는다.
- 비 Windows 환경에서는 `/health` polling과 구조 복사 시 `/svg` 전송을 모두 실행하지 않는다.
- Clipboard Fixer API BASE URL은 `VITE_CHEMDRAW_CLIPBOARD_FIXER_URL` 환경변수에서 읽고 `/svg`, `/health` 경로를 조합한다.
- `docker-compose.yml`과 `docker-compose.dev.yml`의 프론트 서비스에는 BASE URL을 `http://localhost:47823`으로 명시했으며, Nginx 런타임 env 템플릿에서도 같은 변수를 주입할 수 있도록 연결했다.
- 커스텀 `ImportMetaEnv` 타입에 Vite 기본 변수 `BASE_URL`을 선언해 다운로드 URL 구성 시 발생하던 TypeScript 빌드 오류를 수정했다.

## 확인 사항

- 프로젝트 지침에 따라 빌드와 실행은 수행하지 않았다.
- 브라우저에서 ChemDraw 모달을 연 뒤 좌측 다운로드 버튼 클릭 시 ZIP 파일이 내려받아지는지 확인이 필요하다.
