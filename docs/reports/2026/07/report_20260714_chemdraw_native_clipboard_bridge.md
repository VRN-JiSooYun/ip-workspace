# 공통 구조 컴포넌트 ChemDraw Native Clipboard Bridge 구현

## 목적

- 공통 구조 컴포넌트의 PPT 링크 복사 기능을 비활성화한다.
- 원격 개발 서버에서 `localhost` HTTP 호출이 Private Network Access 정책에 막히는 문제를 제거한다.
- 구조 컴포넌트가 가진 CDXML, Molfile, SMILES, SVG를 Chrome 확장 프로그램과 Windows EXE를 통해 로컬 Clipboard에 기록한다.

## 프론트엔드

- `CompoundStructureView`에서 `PPT 링크 복사` 액션 생성을 제거했다.
- 기존 prop 타입은 호출부 호환을 위해 deprecated 상태로 유지하지만 런타임 액션에는 포함하지 않는다.
- Windows에서 구조 데이터가 있을 때 `ChemDraw Clipboard 복사` 액션을 표시한다.
- 신규 `chemdrawClipboardBridge.ts`가 요청 ID를 생성하고 `window.postMessage`로 확장 content script에 구조 payload를 전달한다.
- payload에는 가능한 경우 `cdxml`, `molBlock`, `smiles`, `svg`, `title`을 모두 포함한다.
- 확장 프로그램 미설치 또는 무응답 시 5초 후 연결 오류를 표시한다.
- 기존 ChemDraw 열기, 일반 구조 데이터 복사, 이미지 복사 기능은 유지한다.

## Chrome 확장 프로그램

- `sample/chemdraw-clipboard-fixer/chrome-extension/`에 Manifest V3 확장 프로그램을 추가했다.
- 고정 공개키를 사용해 unpacked 설치에서도 확장 ID `pjfcamljbnhlpagmcckhjjedphagiadb`를 유지한다.
- 허용 페이지는 localhost, 127.0.0.1, 개발 서버 `110.15.60.66`로 제한한다.
- content script가 페이지 메시지를 크기 및 action 기준으로 검증한다.
- service worker가 sender와 hostname을 다시 검증한 뒤 `chrome.runtime.sendNativeMessage`를 호출한다.
- Native Host 이름은 `com.voronoi.chemdraw_clipboard_fixer`다.
- 확장 팝업에서 Native Host 연결 확인과 현재 Clipboard format 조회를 수행할 수 있다.

## Windows Native Host

- 기존 `sample/chemdraw-clipboard-fixer/` 원본 .NET 프로젝트에 Native Messaging 실행 모드를 통합했다.
- Chrome origin 인자가 있으면 상주 HTTP/Clipboard listener를 시작하지 않고 길이-prefix JSON 요청 하나만 처리한다.
- 일반 실행은 기존 ChemDraw OLE EMF 미리보기 보정 동작을 유지한다.
- Native Messaging stdout에는 프로토콜 응답만 기록해 Chrome 메시지 framing이 로그로 오염되지 않도록 했다.
- 허용된 고정 확장 origin을 EXE에서도 재검증한다.
- `ping`, `diagnose`, `copy` action을 구현했다.
- `copy`는 다음 Windows Clipboard format을 가능한 범위에서 함께 기록한다.
  - CDXML: `CDXML`, `chemical/x-cdxml`, `application/vnd.chemdraw+xml`
  - Molfile: `MDLCT`, `MDL Molfile`, `chemical/x-mdl-molfile`
  - SMILES: `SMILES`, `chemical/x-daylight-smiles`
  - SVG: `image/svg+xml`
  - fallback: `CF_UNICODETEXT`
  - vector preview: `CF_ENHMETAFILE`
- 숨김 owner window를 생성한 후 `EmptyClipboard`와 `SetClipboardData`를 호출해 Windows Clipboard ownership 규약을 지킨다.
- Clipboard가 일시적으로 사용 중이면 짧게 재시도하고, 실제 기록된 format 목록을 응답한다.

## 설치 및 배포

- 설치 스크립트가 EXE와 확장 소스를 `%LOCALAPPDATA%\ChemDrawClipboardFixer`로 복사한다.
- Chrome과 Edge 사용자 레지스트리에 Native Messaging Host manifest를 등록한다.
- Native Host manifest는 고정 확장 ID만 `allowed_origins`로 허용한다.
- 제거 스크립트는 Chrome/Edge Native Host 등록을 함께 제거한다.
- SCCM 감지 스크립트에 EXE, 예약 작업, 확장 manifest, Native Host 등록 확인을 추가했다.
- `package.ps1`은 self-contained EXE 빌드, 설치 파일 패키징, 확장 포함 ZIP 생성, 프론트엔드 공개 다운로드 ZIP 교체를 자동화한다.
- 기존에는 `sample/` 전체가 ignore 상태였으므로 `.gitignore`에서 `sample/chemdraw-clipboard-fixer/`만 추적 예외로 지정했다.

## 보안

- 페이지, content script, service worker, Native Host의 각 경계에서 request type, action, sender, origin을 검증한다.
- 페이지에서 확장으로 전달 가능한 메시지를 2MB로 제한한다.
- Native Host는 임의 명령 실행, 파일 경로, URL 요청을 받지 않고 구조 데이터와 정해진 action만 처리한다.
- localhost HTTP를 거치지 않으므로 CORS 및 Private Network Access 허용 설정이 필요하지 않다.

## 제한 및 Windows 실기 검증

- 이 환경에는 Windows, Chrome Native Messaging, 설치형 ChemDraw가 없어 빌드와 실제 Clipboard 붙여넣기 검증은 수행하지 않았다.
- 확장 팝업의 `Clipboard 포맷 조회`로 공식 ChemDraw Web Clipboard 복사 직후 format 목록을 수집해야 한다.
- `MDLCT` 또는 SMILES로 데스크톱 ChemDraw에 편집 가능한 구조가 붙여넣어지는지 확인해야 한다.
- 직접 복사는 공식 확장의 `Embed Source` OLE binary를 생성하지 않는다. PowerPoint에서 더블클릭 편집까지 필요하면 실기 진단 후 ChemDraw SDK/COM 기반 OLE adapter가 추가로 필요하다.
- 운영 도메인이 변경되면 extension manifest와 service worker의 허용 host 목록을 함께 수정해야 한다.

## 검증

- Chrome extension manifest와 Native Host manifest template의 JSON 문법을 확인했다.
- 프론트와 content script의 request/response message type이 일치하는지 확인했다.
- 확장 ID와 Native Host 이름이 manifest, service worker, EXE, 설치 스크립트에서 일치하는지 확인했다.
- 프론트 소스에서 `PPT 링크 복사` 런타임 액션이 남아 있지 않은지 검색했다.
- `git diff --check`를 통과했다.
- 프로젝트 지침에 따라 프론트엔드와 .NET 빌드는 실행하지 않았다.
