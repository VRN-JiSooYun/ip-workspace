# 메뉴별 노출 수준(edit / view / hide) 설정

## 작업 목적

개발이 잠정 중단되어, 완성된 `특허 거절 대응 전략`(`/analysis/office-actions`)을 뺀
나머지 기능은 일반 사용자 화면에서 보이지 않게 한다. 대상은 Dashboard, 특허 관리,
사용자 접근 관리, 특허 코드 관리, 문의하기, 우측 레일의 일정·To-do다.

노출 여부를 코드가 아니라 JSON 설정 파일로 메뉴·역할별로 관리한다.

## 설정 파일

`frontend/src/config/menuAccess.json`

```json
{
  "menus": {
    "dashboard":      { "USER": "hide", "PATENT_ANALYSIS_ADMIN": "edit", "SUPER_ADMIN": "edit" },
    "office-actions": { "USER": "edit", "PATENT_ANALYSIS_ADMIN": "edit", "SUPER_ADMIN": "edit" }
  },
  "rightRail": {
    "schedule": { "USER": "hide", "PATENT_ANALYSIS_ADMIN": "edit", "SUPER_ADMIN": "edit" }
  }
}
```

- 키
  - `menus`: `dashboard`, `patent-management`, `office-actions`, `access-registry`, `patent-code-admin`, `contact`
  - `rightRail`: `documents`, `schedule`, `todo`
- 값
  - `edit`: 보이고, 그 화면의 편집 기능도 쓴다.
  - `view`: 보이지만 편집 기능(추가·수정·삭제·설정)은 가린다.
  - `hide`: 메뉴·레일에서 빠지고, 주소로 열어도 첫 화면으로 돌려보낸다.
- 역할
  - 모든 로그인 사용자는 `USER`다.
  - `access-context`의 `globalRoles`(`SUPER_ADMIN`·`PATENT_ANALYSIS_ADMIN`)가 있으면 그 값도 보고,
    그중 가장 넓은 수준을 쓴다.
  - 파일에 없는 역할·메뉴, 알 수 없는 값은 `hide`로 본다.
- **permission을 좁히기만 한다.** `edit`이어도 화면이 요구하는 permission(`userAccess.manage`,
  `patentAnalysis.manage` 등)이 없으면 열거나 고칠 수 없다. 예: `PATENT_ANALYSIS_ADMIN`은
  `access-registry`가 `edit`이어도 `userAccess.manage`가 없어 메뉴가 보이지 않는다.
- 번들에 포함되는 파일이라 값을 바꾸면 frontend를 다시 빌드해야 반영된다.
- YAML은 Vite 기본 지원이 아니어서 의존성을 더하지 않으려고 JSON을 택했다. JSON은 주석을
  쓸 수 없어 설명은 `$comment` 키와 `config/menuAccess.ts` 주석에 두었다.

## 변경 내용

- `config/menuAccess.json`·`config/menuAccess.ts`: 설정과 수준 해석(`getMenuAccessLevel`, `getRailAccessLevel`).
- `hooks/useMenuAccess.ts`
  - `useMenuAccessLevel(key)`, `useRailAccessLevel(id)`: 화면에서 수준을 읽는다.
  - `useNavigationAccess()`: permission과 수준을 모두 통과한 좌측 메뉴, 첫 화면(`homePath`)을 준다.
- `routes.tsx`: `AppRoute.menu`로 각 화면이 어느 설정 키를 따르는지 적는다. 좌측 메뉴는 permission처럼
  라우트의 `menu`를 그대로 따라가므로 메뉴와 라우트가 어긋나지 않는다.
- `App.tsx`: 라우트 렌더링을 `AppRoutes`로 옮겼다.
  - `hide`인 화면을 주소로 열면 `homePath`(보이는 메뉴 중 첫 번째)로 보낸다.
  - `/`(→ `/dashboard`), 없는 주소(→ `/patent-management`)도 대상이 숨었거나 permission이 없으면 `homePath`로 보낸다.
  - 볼 수 있는 메뉴가 하나도 없으면 redirect하지 않고 "볼 수 있는 화면이 없습니다"를 보여 준다(무한 redirect 방지).
- `navigation.tsx`: `filterNavByPermission` → `filterNavByAccess`로 바꾸고 수준이 `hide`인 메뉴를 뺐다.
  첫 경로를 찾는 `getFirstNavPath`를 더했다.
- `MainLayout.tsx`: 로고는 `homePath`로 이동한다.
- `RequirePermission.tsx`: 403 버튼은 `처음 화면으로 이동`(`homePath`)이다. 갈 곳이 없으면 버튼을 숨긴다.
- `RightSidebar.tsx`: `rightRail`에서 `hide`인 항목을 레일에서 뺐다.
  - 저장된 열린 항목이 숨은 항목이면 접힌 것으로 다룬다(store 값은 유지).
  - 상단 화살표는 마지막 항목이 숨었으면 보이는 첫 항목을 연다.
- `view` 연결
  - 기존 편집 판정에 `=== 'edit'`을 AND로 묶었다.

| 화면 | `view`일 때 |
| --- | --- |
| Dashboard (`useDashboardState.canManage`) | 데이터 품질 카드의 관리 동작 숨김 |
| 특허 관리 (`usePatentWorkspaceState.canManage`) | 추가·수정·삭제 등 편집 기능 숨김 |
| 특허 코드 관리 (`PatentCodeAdmin.canManage`) | 코드 추가·변경·삭제 숨김 |
| 사용자 접근 관리 | `팀 동기화`·`팀별 접근 설정` 버튼, `관리` 열 숨김 |
| 문의하기 | `신규 작성`·`수정`·`삭제` 버튼, `답글` 열 숨김 |
| 레일 To-do | 완료 체크 비활성화 |
| 특허 거절 대응 전략, 레일 문서·일정 | 원래 편집 기능이 없어 `edit`과 같다 |

## 범위 밖 / 주의

- **화면 노출만 막는다.** 백엔드 API 권한은 바꾸지 않았으므로 API를 직접 호출하면 기존 permission 범위에서 응답한다.
- 메뉴에 없는 `/patents/*`, `/papers/manage`, `/workspace/patent-analysis-admin`은 설정 키가 없어
  기존처럼 permission만 따른다(주소를 알면 열 수 있다). 막으려면 `MenuKey`·JSON에 키를 더하고 라우트에 `menu`를 단다.
- 이전 초안의 `canSeeUnreleased`·`released`는 모두 제거했다.

## 확인

- `tsc -p tsconfig.app.json --noEmit` 통과.
- 설정 해석을 bun으로 직접 돌려 확인했다.
  - 역할 없음(USER): `office-actions`, 레일 `documents`만 `edit`이고 나머지는 `hide`.
  - `PATENT_ANALYSIS_ADMIN`·`SUPER_ADMIN`: 모두 `edit`.
  - 설정에 없는 키는 `hide`.
- 저장소 지침에 따라 개발 서버 실행·브라우저 검증은 하지 않았다. 관리자 역할이 없는 계정으로 아래를 확인해야 한다.
  - 좌측 메뉴에 `분석 > 특허 거절 대응 전략`만 보이고 하단 메뉴가 없다.
  - `/`, `/dashboard`, `/patent-management`, `/contact`, 없는 주소가 모두 `/analysis/office-actions`로 간다.
  - 우측 레일에 `문서`만 보인다.
