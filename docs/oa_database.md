# OA 외부 PostgreSQL 연결

## 역할

IP Workspace는 두 PostgreSQL 연결을 사용한다.

- `DATABASE_URL`: Prisma가 관리하는 IP Workspace 기본 DB
- `OA_DATABASE_*`: 의견제출통지서 원천 데이터가 있는 외부 OA DB의 조회 전용 pool

두 DB의 코드 ID는 같은 값이라고 보장할 수 없으므로 서로 바꿔 쓰지 않는다. 외부 OA 코드는
`GET /api/oa-lookups`로 제공하고, 로컬 특허 레코드 CRUD는 기존 Prisma 코드 테이블을 유지한다.

## 기본 연결값

| 환경변수 | 기본값 | 설명 |
| --- | --- | --- |
| `OA_DATABASE_HOST` | `172.16.1.210` | OA PostgreSQL host |
| `OA_DATABASE_PORT` | `15432` | OA PostgreSQL port |
| `OA_DATABASE_USER` | `postgres` | 접속 사용자 |
| `OA_DATABASE_PASSWORD` | `1234` | 접속 비밀번호 |
| `OA_DATABASE_NAME` | `OA` | database 이름 |
| `OA_DATABASE_CONNECTION_TIMEOUT_MS` | `5000` | 연결 제한 시간 |
| `OA_DATABASE_STATEMENT_TIMEOUT_MS` | `5000` | SQL 실행 제한 시간 |
| `OA_DATABASE_LOOKUP_CACHE_TTL_MS` | `300000` | 코드 목록 캐시 시간 |

운영 환경에서는 Compose 기본 비밀번호 대신 secret 환경변수를 지정하고, 가능하면
`country`, `exam_status`, `legal_status`에 `SELECT`만 허용된 전용 DB 계정을 사용한다.

## 조회 API

`GET /api/oa-lookups`는 `patentAnalysis.read` 권한이 필요하며 다음 형태로 응답한다.

```json
{
  "countries": [{ "id": 1, "country": "대한민국" }],
  "examStatuses": [{ "id": 4, "status": "등록결정(일반)" }],
  "legalStatuses": [{ "id": 4, "status": "등록" }]
}
```

빈 문자열 또는 `NULL` 상태는 select option에서 제외한다. 조회 실패는
`502 OA_DATABASE_LOOKUP_FAILED`로 응답하며 기존 Prisma 연결에는 영향을 주지 않는다.

## 스키마 근거

외부 테이블 및 FK 관계는 [`OA_DB.erd`](./OA_DB.erd)를 따른다. 2026-08-25 읽기 전용
확인 결과 대상 컬럼은 다음과 같다.

| 테이블 | 컬럼 |
| --- | --- |
| `country` | `id integer NOT NULL`, `country text NOT NULL` |
| `exam_status` | `id integer NOT NULL`, `status text NULL` |
| `legal_status` | `id integer NOT NULL`, `status text NOT NULL` |
