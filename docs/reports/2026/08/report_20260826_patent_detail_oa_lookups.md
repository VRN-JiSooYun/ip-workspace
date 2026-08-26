# 특허 상세 검색 OA lookup 반영 작업 보고서

## 작업 목적

`office-actions` 고급 검색에서 사용 중인 OA DB 기반 국가·법적상태·심사상태 목록을
`patent-management` 상세 검색에도 동일하게 반영한다.

## 변경 내용

- 특허 관리 workspace가 `GET /api/oa-lookups`를 별도로 조회하도록 추가했다.
- 상세 검색의 국가·법적상태·심사상태 select를 OA lookup 목록으로 교체했다.
- OA DB와 로컬 Prisma DB의 정수 ID를 혼용하지 않도록 목록 조건에
  `countryText`, `legalStatusText`, `examStatusText`를 추가했다.
- 서버는 외부 명칭을 로컬 관계 테이블의 명칭과 대소문자 구분 없이 정확히 비교한다.
- 기존 대시보드 딥링크와 진행 단계가 사용하는 로컬 ID 조건은 유지했다. ID 조건으로
  진입한 경우 상세 검색 select에는 로컬 lookup에서 찾은 사람이 읽을 수 있는 명칭을 표시한다.
- OA lookup과 로컬 CRUD lookup을 분리해 등록·수정 modal의 FK 저장 계약은 변경하지 않았다.
- 상세 검색 URL 직렬화·역직렬화에도 명칭 조건을 반영했다.

## 검증 결과

- OA 명칭 3종이 각각 로컬 관계 조건으로 변환되는 서비스 단위 테스트를 추가했다.
- 기존 로컬 ID 조건과 OA 명칭 조건이 함께 있어도 조건을 덮어쓰지 않는 테스트를 보완했다.
- 상세 검색 query의 OA 명칭 조건 직렬화·역직렬화 harness 검증을 보완했다.
- 변경 파일의 타입·prop 전달 경로와 사용자 작업 중인 동일 파일의 기존 변경을 정적으로 확인했다.
- Prisma schema와 migration은 변경하지 않아 DB Schema·ERD 동기화 대상이 아니다.

## 미실행 항목

- 저장소 지침에 따라 빌드·테스트·Docker 실행은 수행하지 않았다.
