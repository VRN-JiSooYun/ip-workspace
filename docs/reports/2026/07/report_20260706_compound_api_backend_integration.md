# Compound API Backend 연동 구현 보고

## 변경 요약
- backend에 `compound-api` NestJS 모듈을 추가했다.
  - `POST /api/compound-api/search-compounds`
  - `POST /api/compound-api/get-compounds`
  - `POST /api/compound-api/get-compound-sar-data`
- 외부 compound API 호출은 backend에서만 수행하고, bearer `Authorization`은 backend env `COMPOUND_API_AUTH_TOKEN`으로 구성한다.
- `search_compounds`는 외부 API에 `keyword: ""`로 전체 조회 후 backend에서 `query` 기준 유사 compound code를 필터링/정렬한다.
- MyBoard 헤더 RDKit Draw 버튼 우측에 compound login token 임시 입력 버튼을 추가했다.
- MyBoard Quick add는 자동 검색, `get_compounds` 권한 확인, smiles 저장 후 임시 row 추가 흐름으로 변경했다.
- MyBoard에서 SAR Table 이동 시 Quick add compound code만 `get_compound_sar_data`로 조회하고, 응답을 임시 store에 저장한다.
- SAR Table은 Quick add row와 mock row를 함께 표시하고, SAR API 응답은 `compound_code` 기준으로 join한다.
- compound당 여러 SAR row가 있으면 table 확장 영역에서 grouped row 내용을 확인할 수 있게 했다.

## 임시 저장소
- `compound-api:login-token`
  - 헤더의 login token Modal에서 입력한 compound API login_token을 localStorage에 저장한다.
  - 추후 landing/login 및 DB/Auth 연동 시 제거 또는 migration해야 한다.
- Quick add compound row와 SAR API 응답은 Zustand memory store에만 저장한다.
  - DB 구축 전 임시 UX 확인용이며 새로고침 시 사라지는 동작이 의도된 상태다.

## 참고
- `get_compounds` 응답의 `smiles`가 `"No permission"`이면 row를 추가하지 않는다.
- 권한이 있는 compound는 `smiles`를 row에 저장하고, SAR Table row별 화합물 카드 구조 렌더링에 사용한다.
- mock 샘플 compound는 SAR API 조회 대상에서 제외하고, `externalSource: "compound_api"`가 있는 Quick add row만 조회한다.
- `login_token`은 request body 값이고, bearer `Authorization`은 backend env `COMPOUND_API_AUTH_TOKEN` 값이다.
- Docker compose에서 bearer token은 `.env`에 `COMPOUND_API_AUTH_TOKEN=...` 형태로 저장한다. `${토큰문자열:-}`처럼 쓰면 Docker가 토큰 문자열을 환경변수 이름으로 해석해 빈 값이 들어갈 수 있다.

## 검증
- `git diff --check` 통과.
- 프로젝트 지침에 따라 build/test는 실행하지 않았다.
