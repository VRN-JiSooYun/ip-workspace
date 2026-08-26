# 특허 설명 이미지 업로드 작업 보고서

## 작업 목적

`PatentRecordDetailModal`의 설명 편집기를 JIRA 작업 수정 모달과 유사하게 개선하여 이미지
드래그 앤 드롭, 클립보드 붙여넣기, 파일 선택 업로드를 지원한다. 이미지 원본은 SeaweedFS에
저장하고 `patent.note`에는 URL만 보관한다.

## 변경 내용

### Backend

- SeaweedFS Filer·public URL과 저장 경로 환경설정을 추가했다.
- 설정의 `SEAWEEDFS_ENV_DIR=ip_ws_dev`는 유지하되 `/buckets`의 S3 이름 규칙에 맞춰 실제
  파일은 `/buckets/ip-ws-dev/{BASE_PATH}/patent-records/{id}/note-images/` 아래 UUID
  파일명으로 저장한다.
- 업로드·인증 프록시 조회·삭제 API를 추가했다.
- PNG/JPEG/GIF/WebP MIME type, magic signature, 10MB 상한을 검사한다.
- 조회 파일명은 서버가 생성하는 UUID 패턴만 허용하여 임의 경로 접근을 막았다.

### Frontend

- Quill 툴바에 이미지 버튼을 추가했다.
- 드래그 앤 드롭과 클립보드 이미지 붙여넣기를 지원한다.
- 업로드 즉시 로컬 미리보기를 표시하고 완료되면 SeaweedFS URL로 교체한다.
- 본문에는 앱 base path를 포함한 same-origin 상대 URL을 저장하고, Vite 개발 서버에는
  Backend API proxy를 추가하여 개발 주소가 HTML에 고정되지 않게 했다.
- 업로드 개수와 진행 상태를 표시하고 완료 전 저장·취소를 막는다.
- 편집 취소 또는 저장 시 제거된 신규 이미지를 best-effort로 정리한다.
- 읽기 및 편집 상태의 이미지는 본문 폭을 넘지 않도록 반응형으로 표시한다.

## 설정

- `SEAWEEDFS_FILER_URL=http://172.16.1.183:8888`
- `SEAWEEDFS_PUBLIC_URL=http://172.16.1.183:8888`
- `SEAWEEDFS_BASE_PATH=`
- `SEAWEEDFS_ROOT_DIR=buckets`
- `SEAWEEDFS_ENV_DIR=ip_ws_dev`

## 검증 결과

- `http://172.16.1.183:8888/`에 읽기 요청하여 SeaweedFS Filer `4.29`의 정상 응답을 확인했다.
- 변경 파일의 whitespace 오류를 `git diff --check`로 확인했다.
- Backend 빌드에서 Node `Buffer<ArrayBufferLike>`가 DOM `BodyInit`과 호환되지 않던 타입
  오류를 확인하여, 업로드 body를 `ArrayBuffer` 기반 `Uint8Array`로 복사해 전달하도록
  수정했다. 전송되는 byte 내용은 동일하다.
- 실제 Filer에 raw body로 요청했을 때 `request Content-Type isn't multipart/form-data`가
  반환되는 것을 확인해 Backend→SeaweedFS 요청을 `FormData`로 변경했다.
- `/buckets/ip_ws_dev`는 underscore 때문에 bucket 이름 검증에 실패했다. 실제 경로를
  `/buckets/ip-ws-dev`로 정규화한 multipart 업로드가 `201 Created`로 성공하는 것을
  확인했고, 진단 이미지는 즉시 삭제하여 `204 No Content`를 확인했다.
- 앱에서 반환한 UUID URL과 SeaweedFS의 실제 원본 파일명이 달라 깨진 이미지가 표시되는
  사례를 확인했다. multipart 요청을 개별 파일 URL이 아닌 trailing slash 디렉터리 URL로
  보내고 multipart filename에 UUID를 지정하도록 수정했다. 응답의 `name`·`size`도 검증한다.
- SeaweedFS에 보이던 특허 `13`의 원본 파일은 사용자가 수동 업로드한 파일임을 정정했다.
  Backend 런타임별 FormData 직렬화 차이를 제거하기 위해 UUID filename이 명시된 multipart
  body를 직접 구성하고, 실패 상태·응답 본문과 성공 파일명을 Backend 로그에 남기도록 했다.
- Quill 1.3이 blob URL을 `//:0`으로 바꿔 업로드 실패 시에도 깨진 미리보기가 남던 문제를
  확인했다. 임시 미리보기는 data URL을 사용하되 저장을 막고, 업로드 성공 직후 Backend
  URL로 교체하도록 변경했다.
- SeaweedFS에 UUID 파일이 실제 생성된 뒤에도 미리보기가 깨지는 문제를 확인했다. 이미지
  표시 URL이 API 설정 대신 Vite base path를 강제로 사용하여 nginx가 PNG가 아닌 SPA
  `text/html`을 반환한 것이 원인이었다. 업로드와 조회 모두 같은 `VITE_API_URL`을 사용하고,
  DB에는 canonical `/api/patent-records/...` 경로만 저장하도록 분리했다.
- Quill 본문 이미지가 원본 크기로 과도하게 커지지 않도록 편집·읽기 상태 모두 최대
  `640×420px`로 제한했다. 작은 컨테이너에서는 `100%`까지 더 축소하고 원본 비율을 유지한다.
- DB schema 변경은 없어 Prisma migration 및 ERD 갱신 대상이 아니다.

## 미실행 항목

- 저장소 지침에 따라 Backend/Frontend 빌드와 실행, 실제 파일 업로드는 수행하지 않았다.
- 브라우저별 드래그 앤 드롭·클립보드 동작은 사용자의 실행 환경에서 확인이 필요하다.
