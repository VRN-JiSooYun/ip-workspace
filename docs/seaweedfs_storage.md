# SeaweedFS 이미지 저장소

## 목적

`PatentRecordDetailModal`의 설명(`patent.note`)에 삽입하는 이미지를 HTML의 base64로
저장하지 않고 SeaweedFS에 보관한다. `note`에는 인증된 Backend 이미지 URL만 들어가므로
이미지 크기가 특허 목록 응답 크기에 영향을 주지 않는다.

SeaweedFS Filer는 `http://172.16.1.183:8888`이며 확인 시 버전은 `4.29`였다.

## 환경변수

| 환경변수 | 기본값 | 설명 |
| --- | --- | --- |
| `SEAWEEDFS_FILER_URL` | `http://172.16.1.183:8888` | 업로드와 삭제에 사용하는 내부 Filer URL |
| `SEAWEEDFS_PUBLIC_URL` | `SEAWEEDFS_FILER_URL` | Backend가 이미지를 읽을 URL. 빈 값이면 Filer URL로 폴백 |
| `SEAWEEDFS_BASE_PATH` | 빈 값 | 환경 디렉터리 아래에 추가할 선택 경로 |
| `SEAWEEDFS_ROOT_DIR` | `buckets` | 최상위 디렉터리 |
| `SEAWEEDFS_ENV_DIR` | `ip_ws_dev` | 환경별 디렉터리 |

`/buckets` 바로 아래 경로는 SeaweedFS가 S3 bucket 이름으로 검증한다. S3 bucket에는
underscore를 쓸 수 없으므로 환경변수의 논리 값 `ip_ws_dev`는 유지하되 실제 저장 경로의
segment는 `ip-ws-dev`로 정규화한다.

기본 실제 저장 경로는 다음과 같다.

```text
/buckets/ip-ws-dev/{SEAWEEDFS_BASE_PATH}/patent-records/{patentId}/note-images/{uuid}.{ext}
```

`SEAWEEDFS_BASE_PATH`가 비어 있으면 해당 경로 조각은 생략된다. 모든 경로 조각은 코드에서
앞뒤 slash를 제거한 뒤 결합한다.

## Backend API

모든 API는 기존 로그인 세션과 `patentAnalysis` 권한을 적용한다. 브라우저가 SeaweedFS에
직접 접근하지 않으므로 저장소 주소와 접근 정책을 Frontend에 노출하지 않는다.

### 이미지 업로드

```http
POST /api/patent-records/{patentId}/note-images
Content-Type: multipart/form-data
```

- 권한: `patentAnalysis.manage`
- multipart 필드: `file`
- Backend도 SeaweedFS Filer의 `.../note-images/` 디렉터리 URL에
  `multipart/form-data`로 전달한다. Filer `4.29`는 raw image body 요청을 허용하지 않으며,
  multipart filename을 실제 저장 파일명으로 사용한다.
- SeaweedFS 응답의 `name`과 `size`가 요청한 UUID·byte 크기와 일치해야 업로드 성공으로
  처리한다. 본문에 반환한 URL과 실제 파일명이 어긋나는 것을 방지한다.
- 허용 형식: PNG, JPEG, GIF, WebP
- 최대 크기: 파일당 10MB
- 확장자만 믿지 않고 magic signature를 함께 검사한다.

응답 예시:

```json
{
  "fileName": "ea74eb9d-92cc-4bd3-921a-eccdb8ef0973.png",
  "mimeType": "image/png",
  "byteSize": 184220,
  "url": "/patent-records/42/note-images/ea74eb9d-92cc-4bd3-921a-eccdb8ef0973.png"
}
```

Frontend는 업로드 요청에 성공한 것과 동일한 `VITE_API_URL`을 이미지 표시 URL에도
사용한다. `note` HTML에는 배포 주소 대신 canonical `/api/patent-records/...` 경로를
저장하고, 읽을 때 현재 API base URL로 변환한다. 따라서 개발·운영 origin이나 base path가
본문에 고정되지 않는다.

### 이미지 조회

```http
GET /api/patent-records/{patentId}/note-images/{fileName}
```

- 권한: `patentAnalysis.read`
- Backend가 `SEAWEEDFS_PUBLIC_URL`에서 파일을 읽어 stream으로 전달한다.
- UUID 파일명은 불변이므로 private immutable cache header를 사용한다.

### 이미지 삭제

```http
DELETE /api/patent-records/{patentId}/note-images/{fileName}
```

- 권한: `patentAnalysis.manage`
- 설명 편집을 취소하거나 저장 시 본문에서 빠진 이미지를 정리할 때 사용한다.
- 삭제 요청 실패가 설명 저장 자체를 되돌리지는 않는다. 저장된 본문의 일관성을 우선하고
  정리는 best-effort로 수행한다.

## Frontend UX

- OS 파일을 편집기로 드래그 앤 드롭할 수 있다.
- 스크린샷 또는 클립보드 이미지를 붙여넣을 수 있다.
- Quill 툴바의 이미지 버튼으로 여러 파일을 선택할 수 있다.
- 업로드 시작 즉시 data URL 미리보기를 삽입하고 완료 후 영구 URL로 교체한다.
- Quill 1.3이 `blob:` URL을 허용하지 않으므로 실제 임시 미리보기는 data URL을 사용한다.
  이 값은 업로드 중에만 존재하고 `note`에는 저장되지 않는다.
- 업로드 중인 이미지 수를 표시하며, 완료 전에는 설명 저장과 편집 취소를 비활성화한다.
- 업로드가 실패하면 임시 미리보기를 제거하고 오류 메시지를 표시한다.
- 편집 취소 시 해당 편집 세션에서 새로 업로드한 이미지를 삭제한다.

## 운영 주의사항

- SeaweedFS를 브라우저에 직접 공개할 필요는 없지만 Backend 컨테이너에서 Filer URL에
  접근할 수 있어야 한다.
- 현재 파일 메타데이터를 로컬 PostgreSQL에 별도로 저장하지 않는다. UUID 파일 경로가
  식별자이며, `note` HTML이 참조 관계의 원본이다.
- Backend가 비정상 종료되거나 브라우저가 업로드 직후 강제 종료되면 참조되지 않는 파일이
  남을 수 있다. 장기 운영 시 `note` 참조를 기준으로 orphan 정리 작업을 추가할 수 있다.
