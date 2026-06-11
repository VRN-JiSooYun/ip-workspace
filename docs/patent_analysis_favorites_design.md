# Patent Analysis List Favorites Design

작성일: 2026.06.11

## 목적

`sample/patent_analysis_helper_html/patent_files.html`의 폴더 기반 즐겨찾기 기능을 특허 분석 리스트 페이지에 맞게 이식한다.

테스트 계정:
- `owner_id`: `256`
- `email`: `thmoon@voronoi.io`

## 샘플 소스 동작 방식

샘플은 단순 star toggle이 아니라, 사용자 폴더에 특허를 담고 폴더를 선택해 해당 특허 리스트를 다시 조회하는 방식이다.

1. 폴더 생성
   - `addFolder(folder_name, parent_id)` 호출
   - helper API:
     - `actionType=ADD-FOLDER`
     - `operation=ADD-FOLDER`
     - `folder_name`
     - `parent_id`
   - 성공 응답의 `data[2].folders`로 좌측 폴더 트리를 다시 렌더링한다.

2. 즐겨찾기에 추가할 특허 선택
   - 리스트 checkbox로 `selected_patent_list`를 구성한다.
   - 특허 추가 시 `selected_patent_list`를 JSON 문자열로 전송한다.

3. 폴더 메뉴에서 특허 추가
   - 각 폴더의 `folder-menu-btn` 클릭 시 context menu를 연다.
   - `특허 추가` 선택 시 `addPatentToFolder(folder_id)`를 호출한다.
   - helper API:
     - `actionType=ADD-PATENTS-TO-FOLDER`
     - `operation=ADD-PATENTS-TO-FOLDER`
     - `folder_id`
     - `selected_patent_list`

4. 즐겨찾기 폴더 선택
   - 폴더명 클릭 시 `partialSearch(1, 'NEW-SEARCH', {}, {}, folder_id)`를 호출한다.
   - helper API는 기존 특허 리스트 조회와 동일한 `GET-PATENT-LIST`를 사용하되 `folder_id`를 함께 전달한다.
   - 응답의 `partial_rows`를 기존 리스트와 같은 table에 출력한다.

샘플의 폴더 공유 `cc` 값은 즐겨찾기 추가와 별개다. `cc`는 공유 모달의 조직 트리 선택값이며 `SHARE-FOLDER` 요청에서만 사용한다.

## 변경 UX 시나리오 검토

요청한 변경안은 구현 가능하다. 핵심은 샘플의 폴더 트리 UX를 그대로 노출하지 않고, backend에서 사용자별 기본 폴더를 자동으로 관리하는 방식이다.

변경 시나리오:
- 특허 리스트에 별표 컬럼을 추가한다.
- 별표 선택 시 해당 특허를 즐겨찾기에 추가한다.
- 기본 폴더는 논리 경로 `/myworkspace/{owner_id}/`로 정의한다.
- 사용자는 폴더를 직접 설정하지 않는다.
- 즐겨찾기 조회/등록은 본인의 `owner_id` 기준 기본 폴더만 사용한다.
- 검색 영역에 `즐겨찾기` 검색 조건을 추가한다.
- 공유는 특허별 선택 공유가 아니라 기본 폴더(`/myworkspace/{owner_id}/`)를 다른 사용자에게 공유하는 방식으로 제한한다.
- 공유 대상/공유 현황은 Modal popup 또는 Drawer UX로 설계한다.

구현 시 주의점:
- helper API는 folder path를 직접 받지 않고 `folder_id`를 받는다.
- 따라서 `/myworkspace/{owner_id}/`는 frontend에서 사용하는 문자열 path가 아니라 backend adapter의 규칙으로 처리한다.
- backend는 `owner_id`로 기본 폴더를 resolve해야 한다.
  - root 폴더 `myworkspace` 확인 또는 생성
  - 하위 폴더 `{owner_id}` 확인 또는 생성
  - 최종 folder id를 cache하거나 매 요청마다 folder tree에서 resolve
- 기본 폴더 생성은 사용자가 첫 별표를 누르거나 즐겨찾기 검색을 처음 실행할 때 lazy create로 처리하는 것이 좋다.

## Backend 설계

기본 원칙:
- 특허 리스트 조회는 현재 backend의 `/api/patents/my` 흐름을 그대로 사용한다.
- 즐겨찾기 검색 시 `/api/patents/my?favoriteOnly=true&ownerId=256` 형태로 호출하고, backend가 기본 폴더 id를 resolve해 기존 `folder_id` 조회로 변환한다.
- helper operation은 샘플과 동일하게 사용한다.

현재 구현되어 있는 목록 조회:
- `GET /api/patents/my`
- service에서 helper `GET-PATENT-LIST` 호출
- 이미 `folder_id: query.folderId ?? ''`를 helper payload로 전달한다.

추가할 backend endpoint:

| 목적 | Method / Path | helper operation |
| --- | --- | --- |
| 기본 즐겨찾기 상태 조회 | `GET /api/patents/favorites?ownerId=256` | 기본 folder id resolve 후 `GET-PATENT-LIST` |
| 별표 추가 | `POST /api/patents/favorites` | 기본 folder id resolve 후 `ADD-PATENTS-TO-FOLDER` |
| 별표 제거 | `POST /api/patents/favorites/remove` | 기본 folder id resolve 후 `DELETE-PATENTS-FROM-FOLDER` |
| 기본 폴더 공유 대상 조회 | `GET /api/patents/favorites/share?ownerId=256` | folder tree의 `shared_tree` 또는 별도 helper 확인 |
| 기본 폴더 공유 저장 | `POST /api/patents/favorites/share` | 기본 folder id resolve 후 `SHARE-FOLDER` |

권장 DTO:

```ts
type PatentFavoriteRequest = {
  ownerId?: string;
};

type PatentFavoriteMutationRequest = PatentFavoriteRequest & {
  publicationNumber: string;
};

type PatentFavoriteBulkMutationRequest = PatentFavoriteRequest & {
  publicationNumbers: string[];
};

type PatentFavoriteShareRequest = PatentFavoriteRequest & {
  cc: string;
};
```

helper payload 매핑:

```ts
{
  owner_id: ownerId,
  actionType: 'ADD-PATENTS-TO-FOLDER',
  operation: 'ADD-PATENTS-TO-FOLDER',
  folder_id: resolvedDefaultFolderId,
  selected_patent_list: JSON.stringify([publicationNumber]),
}
```

기본 폴더 resolve 로직:

```ts
async function resolveDefaultFavoriteFolder(ownerId: string) {
  // logical path: /myworkspace/{ownerId}/
  // 1. folder tree 조회
  // 2. root "myworkspace"가 없으면 ADD-FOLDER parent_id=-1
  // 3. root 하위 "{ownerId}"가 없으면 ADD-FOLDER parent_id={myworkspaceFolderId}
  // 4. "{ownerId}" folder id 반환
}
```

주의 사항:
- 테스트/개발 기본값은 `ownerId=256`으로 둔다. 운영에서는 로그인 사용자 정보에서 owner id를 주입하는 구조로 바꾼다.
- `selected_patent_list`는 샘플 기준 publication number 문자열 배열이다.
- frontend는 folder id를 직접 다루지 않고 `ownerId`와 `publicationNumber`만 넘긴다.
- helper 응답의 `folders.my_list`, `folders.shared_list` 구조는 backend 내부 resolve/share 처리에만 사용한다.
- 공유 기능은 기본 폴더 단위로만 허용한다.

## Frontend 설계

### UX 배치

특허 분석 리스트 화면에서는 폴더 트리를 노출하지 않는다. 사용자는 별표와 검색 조건만 사용한다.

권장안:
- 일반 특허 리스트 table의 첫 영역에 별표 컬럼을 추가한다.
- 별표 컬럼은 `No.` 컬럼보다 앞에 두거나 `No.` 바로 뒤에 둔다. 추천은 가장 좌측 고정 컬럼이다.
- 별표 클릭은 row 상세 열기와 충돌하지 않도록 `event.stopPropagation()` 처리한다.
- 즐겨찾기 상태는 optimistic update를 적용하되, 실패 시 원복하고 warning을 표시한다.
- 검색 영역에 `즐겨찾기` 조건을 추가한다.
  - 형태 1: 검색 타입 segmented에 `즐겨찾기` 추가
  - 형태 2: 상세 필터 또는 검색 버튼 근처에 `즐겨찾기만` toggle 추가
  - 추천: `즐겨찾기만` toggle. 제목/출원인/번호 검색과 조합하기 쉽다.

### 별표 상태

상태 예시:

```ts
const [favoriteOnly, setFavoriteOnly] = useState(false);
const [favoritePatentNumbers, setFavoritePatentNumbers] = useState<Set<string>>(new Set());
const [savingFavoritePatentNumbers, setSavingFavoritePatentNumbers] = useState<Set<string>>(new Set());
const [isShareModalOpen, setIsShareModalOpen] = useState(false);
```

별표 클릭 시:
- 현재 row의 `publicationNumber`를 읽는다.
- 이미 즐겨찾기이면 `POST /api/patents/favorites/remove` 호출
- 아니면 `POST /api/patents/favorites` 호출
- 성공 후 현재 row의 별표 상태를 갱신한다.

즐겨찾기 상태 조회:
- 리스트 조회 결과 row에 backend가 `isFavorite`을 붙여주는 방식이 가장 단순하다.
- 대안으로 현재 page의 publication number 목록을 `/api/patents/favorites/status`에 보내 즐겨찾기 여부를 받는다.
- 추천은 backend가 `/api/patents/my` 응답 items에 `isFavorite`을 annotate하는 방식이다.

### Frontend service

`frontend/src/services/patentAnalysisApi.ts`에 즐겨찾기 API를 추가한다.

```ts
addPatentFavorite(body: { ownerId?: string; publicationNumber: string })
removePatentFavorite(body: { ownerId?: string; publicationNumber: string })
getFavoriteShare(params?: { ownerId?: string })
saveFavoriteShare(body: { ownerId?: string; cc: string })
```

목록 조회는 기존 함수를 확장 사용한다.

```ts
patentAnalysisApi.getMyPatents({
  ownerId: '256',
  favoriteOnly,
  page: currentPage,
  pageSize,
  order: DEFAULT_PATENT_ORDER,
});
```

### Component 분리

권장 컴포넌트:
- `PatentFavoriteStar`
  - 별표 표시/저장 중 상태/클릭 처리
- `PatentFavoriteShareModal`
  - 기본 폴더 공유 대상 선택
  - 현재 공유 대상 표시
  - 저장/취소

`PatentAnalysisList.tsx`는 다음 책임만 갖는다.
- `favoriteOnly` 검색 조건 관리
- row별 `isFavorite` 렌더링
- 별표 mutation 후 현재 리스트 상태 갱신
- 공유 modal open/close 관리

### 공유 Modal UX

공유는 기본 폴더(`/myworkspace/{owner_id}/`) 단위로만 제공한다.

진입점:
- 검색 영역 우측 또는 table header 우측에 `즐겨찾기 공유` 버튼을 둔다.
- 버튼 클릭 시 modal을 연다.

Modal 구성:
- 제목: `즐겨찾기 공유`
- 설명: `내 즐겨찾기 기본 폴더를 선택한 사용자에게 공유합니다.`
- 현재 기본 폴더 path 표시: `/myworkspace/256/`
- 공유 대상 선택 UI:
  - 1차 구현: 사용자 email 또는 owner id를 입력해 tag로 추가
  - helper `cc`가 조직 tree id를 요구하면, backend에서 email/owner id를 tree id로 변환하는 adapter가 필요하다.
  - 변환 API가 없다면 샘플처럼 조직 tree 데이터를 받아 tree selector modal로 구현한다.
- 현재 공유 대상 목록:
  - 이미 공유된 사용자 표시
  - 제거 기능은 helper의 `SHARE-FOLDER`가 덮어쓰기인지 병합인지 확인 후 구현한다.
- footer:
  - `취소`
  - `공유 저장`

공유 저장:
- backend가 기본 folder id를 resolve한다.
- `cc` 문자열을 생성한다.
- helper `SHARE-FOLDER` 호출:
  - `actionType=SHARE-FOLDER`
  - `operation=SHARE-FOLDER`
  - `folder_id={resolvedDefaultFolderId}`
  - `cc={selectedTreeIds}`

### Empty / Loading UX

- 별표 저장 중: 해당 row 별표 버튼만 loading 또는 disabled 처리
- 즐겨찾기 검색 결과가 없을 때: `즐겨찾기한 특허가 없습니다`
- 기본 폴더 resolve/create 실패 시: `즐겨찾기 폴더를 준비하지 못했습니다`
- 공유 대상 저장 실패 시: modal 안에 error alert 표시

## 구현 순서

1. Backend default favorite folder resolver 추가
   - `/myworkspace/{ownerId}/` 논리 path resolve
   - 없으면 `ADD-FOLDER`로 lazy create
   - `ownerId=256`으로 수동 API 확인

2. Backend favorite endpoint 추가
   - `POST /api/patents/favorites`
   - `POST /api/patents/favorites/remove`
   - `GET /api/patents/my?favoriteOnly=true`
   - 공유 endpoint는 별도 단계로 추가

3. Frontend API service 추가
   - 즐겨찾기 add/delete 함수 추가
   - `getMyPatents`에 `favoriteOnly` parameter 추가

4. PatentAnalysisList 별표 컬럼 추가
   - row별 `isFavorite` 표시
   - 별표 클릭 add/delete
   - 클릭 이벤트 전파 방지

5. UX 보강
   - 검색 영역 `즐겨찾기만` toggle 추가
   - 적용된 filter tag 표시
   - loading/empty/warning 처리

6. 공유 Modal 추가
   - 공유 대상 조회/선택/저장
   - helper `cc` tree id 계약 확인 후 email/owner id mapping 방안 확정

## 검증 시나리오

테스트 계정:
- `owner_id=256`
- `email=thmoon@voronoi.io`

1. 기본 폴더 생성/resolve
   - `/myworkspace/256/` 기본 폴더가 없을 때 첫 별표 클릭으로 생성되는지 확인한다.
   - 이미 있으면 중복 생성 없이 기존 folder id를 사용하는지 확인한다.

2. 별표 추가
   - 일반 특허 리스트에서 별표 클릭
   - helper `ADD-PATENTS-TO-FOLDER`에 기본 folder id와 publication number가 전달되는지 확인한다.
   - 새로고침 후에도 별표 상태가 유지되는지 확인한다.

3. 별표 제거
   - 이미 즐겨찾기된 특허의 별표 클릭
   - helper `DELETE-PATENTS-FROM-FOLDER`에 기본 folder id와 publication number가 전달되는지 확인한다.

4. 즐겨찾기 검색
   - 검색 영역에서 `즐겨찾기만` 활성화
   - `/api/patents/my?favoriteOnly=true&ownerId=256`로 목록이 조회되는지 확인한다.
   - backend helper payload는 기본 folder id를 `folder_id`로 전달해야 한다.

5. 공유
   - `즐겨찾기 공유` modal을 연다.
   - 공유 대상 선택 후 저장한다.
   - helper `SHARE-FOLDER`에 기본 folder id와 `cc`가 전달되는지 확인한다.
   - 공유받은 사용자가 shared folder로 같은 즐겨찾기 목록을 볼 수 있는지 확인한다.

## 1차 범위 제외

- 임의 폴더 생성/이름 변경/삭제 UI
- 다중 폴더 즐겨찾기
- 특허별 선택 공유
- shared folder 권한별 세부 메뉴 제어
- 구조 검색 compound 결과에서 바로 즐겨찾기 추가
- drag and drop 폴더 이동
