# ChemDraw Clipboard Fixer 다운로드 경로 변경

## 작업 목적

- 변경된 ChemDraw Clipboard Fixer ZIP 디렉토리와 파일명을 프론트엔드 다운로드 버튼에 반영한다.

## 변경 내용

- 다운로드 URL을 `frontend/public/voronoi_chemdraw_clipboard_fixer/voronoi-chemdraw-clipboard-fixer.zip` 기준으로 변경했다.
- 브라우저에 전달하는 다운로드 파일명을 `voronoi-chemdraw-clipboard-fixer.zip`으로 변경했다.
- Vite의 `BASE_URL`을 사용하는 기존 하위 경로 배포 대응 방식은 유지했다.

## 검증 결과

- 변경된 정적 ZIP 파일이 새 경로에 존재하는 것을 확인했다.
- 코드와 문서에서 이전 다운로드 URL 및 파일명 참조가 남아 있는지 검색했다.

## 미실행 항목

- 프로젝트 지침에 따라 빌드와 실행은 수행하지 않았다.
- 브라우저에서 ChemDraw 모달의 다운로드 버튼을 클릭해 실제 다운로드를 확인해야 한다.
