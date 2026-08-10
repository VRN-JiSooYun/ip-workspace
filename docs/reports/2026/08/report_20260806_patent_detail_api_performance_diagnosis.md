# 특허 상세 API 성능 진단

## 작업 목적

- `GET /api/patents/:publicationNumber` 요청 처리 위치와 호출 경로를 확인한다.
- 상세 조회가 느려질 수 있는 코드상의 병목 후보를 식별한다.

## 확인 내용

### 호출 경로

1. `PatentAnalysisController.getPatentDetail`
2. `PatentMemberService.resolve`에서 로그인 사용자의 특허 시스템 `memberId` 조회
3. `PatentAnalysisService.getPatentDetail`
4. `PatentAnalysisHelperClient.call`이 `PATENT_ANALYSIS_HELPER_API_URL/api`에 multipart POST 요청
5. helper 요청 payload의 `operation`은 `GET-PATENT-DATA`

### 병목 후보

- 실제 특허 상세 데이터 조회는 workspace backend나 Prisma가 아니라 기본값 `http://172.16.1.210:10130/api`인 외부 helper API에서 수행한다. 따라서 항상 느리다면 `GET-PATENT-DATA` 처리 또는 해당 서버와의 네트워크가 가장 우선적인 측정 대상이다.
- helper 응답 전체를 `raw`로 포함하면서 `metadata`, `compounds`, `modifiedCompounds`, `tables`를 최상위 응답에도 중복 포함한다. 큰 특허 응답은 backend JSON 직렬화, 네트워크 전송, frontend JSON 파싱 비용이 거의 두 배가 될 수 있다.
- 상세 페이지는 현재 `detail.raw`만 상태에 저장한다. 따라서 상세 페이지 기준으로 최상위 중복 필드는 사용되지 않는다. 목록 Quick Viewer는 `metadata`를 사용하므로 응답 계약을 줄이려면 호출 목적별 endpoint 또는 선택 필드가 필요하다.
- 모든 인증 요청 앞에서 `GroupwareSessionInterceptor`가 User 및 관련 Account/NotificationRecipient를 조회한다. 이어 controller가 `PatentMemberService.resolve`로 NotificationRecipient를 다시 조회하므로 요청마다 인증 관련 DB 조회가 중복된다.
- 그룹웨어 토큰 검증 시각이 기본 10분을 넘었거나 사용자 프로필이 비어 있으면 외부 `login_check` 요청이 추가된다. 이 경우 최대 10초 설정 때문에 일부 요청만 평소보다 느려질 수 있다.
- backend 전역 timeout과 helper HTTP timeout은 모두 기본 30초다. 현재 단계별 소요 시간과 응답 크기를 남기는 관측 로그는 없다.
- application 레벨 응답 압축 설정은 확인되지 않았다. 큰 JSON 응답이라면 전송 시간에 영향을 줄 수 있다.

## 검증 결과

- 라우트와 controller/service/helper client의 정적 호출 경로를 확인했다.
- `notificationRecipient.linkedUserId`는 unique index가 있어 member ID 조회 자체는 정상적인 DB 상태에서 큰 병목일 가능성이 낮다.
- frontend 상세 페이지와 Quick Viewer의 응답 필드 사용처를 확인했다.
- 로컬 포트 3000과 5174에 실행 중인 서버가 없어 실제 요청 시간과 응답 크기는 측정하지 못했다.
- Docker daemon 접근 권한이 없어 컨테이너 상태 및 로그를 확인하지 못했다.

## 권장 측정 순서

1. controller 진입부터 member resolve 종료까지 시간을 기록한다.
2. helper `GET-PATENT-DATA` 요청의 TTFB/전체 시간과 응답 byte 크기를 기록한다.
3. backend 최종 JSON 응답 byte 크기와 전체 요청 시간을 기록한다.
4. 동일 특허를 helper에 직접 요청한 시간과 workspace backend 경유 시간을 비교한다.
5. 빠른 특허와 느린 특허의 compound/modified compound/table 개수 및 응답 크기를 비교한다.

## 미실행 항목

- 코드 변경 및 성능 계측 추가
- 실행 중인 환경에서의 실제 API 호출
- 외부 helper API 구현 및 데이터베이스 쿼리 분석
