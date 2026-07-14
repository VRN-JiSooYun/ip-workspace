# Compound API Backend 연동 계획

## 목표
- 외부 `compound_api`를 프론트에서 직접 호출하지 않고 NestJS backend를 통해 호출한다.
- MyBoard Quick add에서 compound code 자동 조회, 권한 확인, 임시 row 추가까지 연결한다.
- MyBoard에서 SAR Table 이동 시 선택 그룹의 실제 compound code를 `get_compound_sar_data`로 조회해 SAR Table에 표시할 수 있는 임시 데이터 흐름을 만든다.
- DB 구축 전까지는 Zustand/localStorage 또는 route state 기반의 임시 UX로 동작시키고, DB 전환 시 초기화해야 할 임시 저장소를 문서화한다.

## 참조 샘플
- `sample/compound_api/search_compounds.ts`
  - `POST http://172.16.1.32:10050/search_compounds`
  - body: `login_token`, `project`, `keyword`, `smiles`, `mol_block`, `search_type`, `similarity_range_start`, `similarity_range_end`
  - response: `{ compound_code }[]`
- `sample/compound_api/get_compounds.ts`
  - `POST http://172.16.1.32:10050/get_compounds`
  - body: `login_token`, `compounds`, `type`
  - response: `{ compounds: [{ compound_code, smiles }] }`
  - 권한 없음은 `smiles: "No permission"`으로 판단한다.
- `sample/compound_api/get_compound_sar_data.ts`
  - `POST http://172.16.1.32:10050/get_compound_sar_data`
  - body: `login_token`, `compounds`
  - response: SAR row 배열. key에 `#_#` 구분자가 포함된다.

## Backend 설계
- 신규 모듈: `backend/src/compound-api/`
  - `compound-api.module.ts`
  - `compound-api.controller.ts`
  - `compound-api.service.ts`
  - `dto/search-compounds.dto.ts`
  - `dto/get-compounds.dto.ts`
  - `dto/get-compound-sar-data.dto.ts`
  - `types/compound-api.types.ts`
- backend route는 `/api/compound-api/*`로 둔다.
  - `POST /api/compound-api/search-compounds`
  - `POST /api/compound-api/get-compounds`
  - `POST /api/compound-api/get-compound-sar-data`
- backend env 추가:
  - `COMPOUND_API_URL=http://172.16.1.32:10050`
  - `COMPOUND_API_AUTH_TOKEN=...`
  - `COMPOUND_API_TIMEOUT_MS=30000`
- `Authorization` 헤더는 backend에서만 구성한다.
  - 외부 API 요청 헤더: `Authorization: Bearer ${COMPOUND_API_AUTH_TOKEN}`
  - frontend는 bearer token을 알지 않게 한다.
- `configuration.ts`, `env.validation.ts`, `docker-compose.yml`에 compound API env를 추가한다.
- backend service는 외부 API 오류를 그대로 노출하지 않고 `{ message, statusCode, upstreamStatus }` 형태로 정리한다.
- 모든 compound API 요청에는 bearer `Authorization` 헤더를 붙인다.
- `search_compounds`는 외부 API에 compound input을 `keyword`로 전달하지 않는다.
  - 외부 API에는 `keyword: ""`로 전체 조회 요청을 보낸다.
  - backend에서 frontend input과 유사한 `compound_code`만 필터링/정렬해 반환한다.
  - 첫 구현은 대소문자 무시 `includes`, prefix match 우선 정렬로 처리하고 필요 시 fuzzy score를 추가한다.

## Login Token UX
- 추후 landing page에서 받을 값이므로 지금은 임시 UI로 처리한다.
- `MainLayout` 헤더의 RDKit Draw 버튼 우측에 `Login token` 버튼을 추가한다.
- 클릭 시 Modal/Input.Password로 token 입력/수정.
- 저장 위치는 임시로 Zustand + localStorage:
  - 예: `useAuthStore` 또는 기존 store에 `compoundLoginToken`
  - storage key 예: `compound-api:login-token`
- DB/Auth 전환 시 이 localStorage key는 삭제 또는 migration 대상임을 문서에 남긴다.
- 보안상 표시 상태는 masked로 두고, 버튼에는 입력 여부만 `Token 설정됨` 같은 상태로 표시한다.

## Frontend API Client
- 신규 service: `frontend/src/services/compoundApi.ts`
- `VITE_API_URL` 기반으로 backend endpoint 호출.
- 타입:
  - `CompoundSearchResult = { compound_code: string }`
  - `CompoundPermissionResult = { compound_code: string; smiles: string }`
  - `CompoundSarDataRow = Record<string, string | number | null>`
- 모든 요청 body에는 frontend가 가진 `login_token`만 전달한다.
- bearer token 관련 값은 frontend에 두지 않는다.

## MyBoard Quick Add 흐름
- Quick add Modal input 변경 시 debounce 250~400ms 적용.
- 입력값이 비어 있으면 조회하지 않는다.
- `search_compounds` 요청:
  - body의 `login_token`은 저장된 token 사용.
  - frontend input은 backend proxy 요청 body에 `query` 같은 별도 필드로 전달한다.
  - backend는 외부 API 요청 시 `keyword: ""`로 전체 조회하고, 응답받은 `compound_code`를 `query` 기준으로 유사 필터링해 반환한다.
- response의 `compound_code` 중 backend가 유사하다고 판단한 값을 모두 보여준다.
- 사용자가 후보를 선택하거나 Enter 시 추가 요청:
  - `get_compounds`로 `type: "smiles"` 조회.
  - `smiles === "No permission"`이면 추가하지 않고 권한 없음 안내.
  - smiles가 있으면 MyBoard 그룹 상세 목록에 임시 row를 추가하고, 응답받은 `smiles`를 row 데이터에 함께 저장한다.
- 임시 row 필드:
  - `compoundId/name`: `compound_code`
  - `smiles`: `get_compounds` 응답 smiles. SAR Table row별 화합물 카드 구조 렌더링에 사용할 원본 구조 값으로 유지한다.
  - `source/designSource`: `Quick add`
  - `project`: 대상 그룹 target 또는 `Unassigned`
  - `quickViewerAssets`: 빈 배열
  - `externalSource: "compound_api"` 같은 식별 필드를 추가하는 것을 권장한다.

## SAR Table 이동 흐름
- MyBoard의 SAR Table 버튼 클릭 시 선택된 그룹의 상세 row 중 compound code가 있는 row만 모은다.
- mock 샘플로 만든 물질 번호는 조회하지 않는다.
  - 권장 기준: Quick add로 추가된 row 또는 `externalSource === "compound_api"`인 row만 대상으로 한다.
  - DB 전까지는 `id` prefix `quick-`만으로도 필터링 가능하지만, 명시 필드를 추가하는 편이 안전하다.
- `get_compound_sar_data` 요청:
  - body: `{ login_token, compounds: compoundCodes }`
  - API 응답을 SAR Table 전용 임시 store에 저장하거나 route state로 전달한다.
- SAR Table은 응답 row 배열을 우선 렌더링하고, 없으면 기존 mock 데이터를 표시한다.
- API row의 `compound_code`를 기존 `Compound.compoundId` 대응 key로 사용한다.
- compound당 여러 SAR row가 반환될 수 있으므로 `compound_code` 단위 그룹핑을 적용한다.
  - 화합물 카드/좌측 구조 영역은 compound code당 1개만 표시한다.
  - SAR Table 본문은 그룹핑된 compound row 아래에 project/reference/assay row를 확장 행 또는 nested table로 보여주는 방식을 우선 검토한다.
  - 첫 구현에서 nested UI까지 부담이 크면 table row는 유지하되 compound card와 선택 상태는 `compound_code` 기준으로 dedupe한다.
- SAR Table row별 화합물 카드 구조는 MyBoard Quick add 시 저장한 `smiles`를 우선 사용한다.
  - `get_compound_sar_data` 응답에는 구조 값이 없으므로, SAR row와 Quick add compound row를 `compound_code` 기준으로 join한다.
  - join된 smiles가 없거나 권한 없음 상태면 구조 영역에는 권한 없음/구조 없음 상태를 표시하고 렌더링 요청을 보내지 않는다.
- `#_#`가 포함된 SAR property key는 첫 구현에서는 원문 컬럼명 그대로 표시하고, 이후 컬럼 그룹핑/라벨링을 별도 UX 작업으로 분리한다.

## DB 이전 임시 표시 추천
- 추천안: Quick add로 추가한 compound row를 전역 store에 저장하고 SAR API 응답도 store에 캐시한다.
- 이유:
  - MyBoard에서 추가한 row가 페이지 전환 후에도 SAR Table에서 보인다.
  - route state만 쓰면 새로고침, 직접 URL 진입, 뒤로가기에서 데이터가 사라진다.
  - DB 전환 시 store action을 API mutation으로 바꾸기 쉽다.
- storage는 두 단계로 나눈다.
  - 1차: Zustand memory store만 사용해 새로고침 시 사라지게 한다.
  - 2차가 필요할 때만 localStorage를 붙인다.
- 현재 요구에는 memory store가 더 적합하다. DB 구축 전 임시 데이터가 오래 남아 실제 DB 데이터처럼 보이는 리스크를 줄일 수 있다.

## 구현 순서
1. backend compound-api 모듈과 env 추가.
2. frontend login token 임시 store와 헤더 버튼/Modal 추가.
3. frontend compound API service 추가.
4. MyBoard Quick add 자동 검색 UI와 권한 확인 후 임시 row 추가.
5. MyBoard -> SAR Table 이동 시 Quick add compound codes 수집 및 SAR 데이터 조회.
6. SAR Table에서 API SAR rows 우선 표시, 없으면 mock fallback.
7. localStorage 사용 key와 DB 전환 시 제거할 항목을 docs에 명시.

## 확인 필요 사항
- 정리 완료:
  - `search_compounds`는 compound input을 `keyword`로 보내지 않고 전체 조회 후 backend에서 유사 compound를 반환한다.
  - 모든 compound API에는 bearer `Authorization`이 필요하다.
  - compound당 여러 SAR row 반환 시 compound code 단위 그룹핑이 필요하다.
