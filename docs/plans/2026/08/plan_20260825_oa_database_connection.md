# OA 외부 DB 연결 및 필터 코드 조회 계획

## 목적

기존 IP Workspace PostgreSQL 연결과 분리된 OA PostgreSQL 읽기 전용 연결을 추가하고,
`country`, `exam_status`, `legal_status`를 공용 select 목록으로 제공한다.

## 작업 범위

1. OA DB 연결 환경변수와 유효성 검사를 추가한다.
2. 별도 `pg` connection pool을 수명주기와 함께 관리하는 NestJS 모듈을 추가한다.
3. 세 코드 테이블을 읽는 캐시형 lookup 서비스와 인증된 조회 API를 추가한다.
4. 의견제출통지서 고급 검색의 법적상태·심사진행상태 select를 조회 API에 연결한다.
5. Docker Compose에 OA DB 환경변수를 전달하고 운영 기준을 문서화한다.
6. 정적 검증과 실제 DB 읽기 확인 결과를 작업 보고서에 기록한다.

## 안전 기준

- OA 연결은 세션 기본값을 read-only로 강제한다.
- 비밀번호를 API 응답이나 로그에 노출하지 않는다.
- 기존 Prisma 연결과 로컬 특허 코드 테이블은 변경하지 않는다.
- 외부 OA 코드 ID를 로컬 특허 레코드 ID로 직접 사용하지 않는다.
