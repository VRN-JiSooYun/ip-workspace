# 사용자 권한·메뉴 노출 설정 가이드

누가 어떤 화면을 보고 무엇을 고칠 수 있는지는 세 층으로 정해진다. 아래 층일수록 좁히기만 한다.

| 층 | 무엇을 정하나 | 어디서 바꾸나 | 반영 시점 |
| --- | --- | --- | --- |
| 1. 역할 (role) | 사용자가 관리자인지 | 사용자 접근 관리 화면 · 환경변수 · DB | 해당 사용자 재로그인 |
| 2. permission | 특허 조회·관리, 사용자 관리 가능 여부 | 역할 + 팀별 접근 설정 | 해당 사용자 재로그인 / 다음 화면 이동 |
| 3. 메뉴 노출 수준 | 메뉴를 숨길지, 보기만 할지 | `frontend/src/config/menuAccess.json` | frontend 재빌드 |

**permission이 없으면 메뉴 설정이 `edit`이어도 열 수 없다.** 메뉴 설정은 permission 위에 덧씌우는 제한이다.

## 1. 사용자 역할

### 역할 종류

| 역할 | 의미 | 받는 permission |
| --- | --- | --- |
| `USER` | 관리 역할이 없는 일반 사용자. 따로 부여하는 값이 아니라 관리 역할이 없는 상태다. | 없음(팀 설정으로만 받음) |
| `PATENT_ANALYSIS_ADMIN` | 특허 분석 관리자 | `patentAnalysis.read`, `patentAnalysis.manage` |
| `SUPER_ADMIN` | 전체 관리자 | 위 두 개 + `userAccess.manage` |

- 저장 위치: DB `user.role` 컬럼. 여러 역할은 `SUPER_ADMIN,PATENT_ANALYSIS_ADMIN`처럼 쉼표로 잇는다.
- 예전 값 `ADMIN`은 `SUPER_ADMIN`으로 해석한다.
- 매핑 코드: `backend/src/authorization/workspace-permissions.ts`
- 프론트는 `GET /access-context` 응답의 `globalRoles`(관리 역할만 담긴 배열)로 역할을 안다.

### 역할 바꾸기 — 사용자 접근 관리 화면 (기본 방법)

1. `SUPER_ADMIN` 계정으로 좌측 하단 **사용자 접근 관리**(`/workspace/access-registry`)를 연다.
2. 사용자 행의 **권한 변경**을 누른다.
3. **관리 역할**에서 `Super Admin` / `특허 분석 관리자`를 고른다. 아무것도 고르지 않으면 `USER`다.
4. **변경**을 누른다. 그 사용자의 기존 로그인 세션이 끊기고, 다시 로그인할 때 새 역할이 적용된다.

이 화면은 `userAccess.manage`가 필요해서 `SUPER_ADMIN`만 쓸 수 있다.

### 최초 관리자 — `AUTH_BOOTSTRAP_ADMIN_EMAILS`

처음에는 `SUPER_ADMIN`이 없어 위 화면을 열 사람이 없다. 이때는 backend 환경변수에 이메일을 넣는다.

```bash
AUTH_BOOTSTRAP_ADMIN_EMAILS=admin1@voronoi.io,admin2@voronoi.io
```

- 이 목록의 이메일이 그룹웨어 SSO로 **처음** 로그인해 계정이 생길 때 `SUPER_ADMIN`이 된다. 나머지는 `USER`로 생긴다.
- 이미 계정이 있는 사용자는 목록에 넣어도 바뀌지 않는다. 화면이나 DB로 바꾼다.
- 읽는 곳: `backend/src/auth/auth-config.ts`, 전달: `docker-compose.yml`의 backend `environment`.

### 비상시 — DB 직접 수정

화면을 쓸 수 없을 때만 `user.role`을 직접 고친다. 고친 뒤 그 사용자는 다시 로그인해야 한다.

## 2. 팀별 permission

역할 없이도 팀 단위로 permission을 줄 수 있다. 사용자 접근 관리 화면의 **팀별 접근 설정**에서 팀을 고르고 모듈별로 체크한다.

| 체크 | 받는 permission (특허 분석 모듈) |
| --- | --- |
| 조회, 작성/수정, 관리 중 하나라도 | `patentAnalysis.read` |
| 관리 | `patentAnalysis.manage` |

- 특허 분석 외 모듈(SAR Table, Design, 합성 관리)은 현재 permission으로 이어지지 않는다.
- **팀 permission은 역할을 바꾸지 않는다.** 팀 설정으로 특허 조회를 받아도 메뉴 설정에서는 여전히 `USER`다.
- 팀 목록이 그룹웨어와 다르면 **팀 동기화**를 먼저 누른다.

## 3. 메뉴별 노출 수준

### 설정 파일

`frontend/src/config/menuAccess.json`

```json
{
  "menus": {
    "dashboard":         { "USER": "hide", "PATENT_ANALYSIS_ADMIN": "edit", "SUPER_ADMIN": "edit" },
    "patent-management": { "USER": "hide", "PATENT_ANALYSIS_ADMIN": "edit", "SUPER_ADMIN": "edit" },
    "office-actions":    { "USER": "edit", "PATENT_ANALYSIS_ADMIN": "edit", "SUPER_ADMIN": "edit" },
    "access-registry":   { "USER": "hide", "PATENT_ANALYSIS_ADMIN": "edit", "SUPER_ADMIN": "edit" },
    "patent-code-admin": { "USER": "hide", "PATENT_ANALYSIS_ADMIN": "edit", "SUPER_ADMIN": "edit" },
    "contact":           { "USER": "hide", "PATENT_ANALYSIS_ADMIN": "edit", "SUPER_ADMIN": "edit" }
  },
  "rightRail": {
    "documents": { "USER": "edit", "PATENT_ANALYSIS_ADMIN": "edit", "SUPER_ADMIN": "edit" },
    "schedule":  { "USER": "hide", "PATENT_ANALYSIS_ADMIN": "edit", "SUPER_ADMIN": "edit" },
    "todo":      { "USER": "hide", "PATENT_ANALYSIS_ADMIN": "edit", "SUPER_ADMIN": "edit" }
  }
}
```

(2026-11 기준 값. 개발 잠정 중단으로 일반 사용자에게는 특허 거절 대응 전략과 레일 문서만 연다.)

### 값

| 값 | 동작 |
| --- | --- |
| `edit` | 보이고, 편집 기능도 쓴다. |
| `view` | 보이지만 추가·수정·삭제·설정 기능을 가린다. |
| `hide` | 메뉴·레일에서 빠진다. 주소로 열면 보이는 메뉴 중 첫 화면으로 보낸다. |

### 키

| 구역 | 키 | 화면 | `view`일 때 가려지는 것 |
| --- | --- | --- | --- |
| `menus` | `dashboard` | Dashboard | 데이터 품질 카드의 관리 동작 |
| `menus` | `patent-management` | 특허 관리 | 추가·수정·삭제 등 편집 기능 |
| `menus` | `office-actions` | 분석 > 특허 거절 대응 전략 | (편집 기능 없음) |
| `menus` | `access-registry` | 사용자 접근 관리 | 팀 동기화·팀별 접근 설정 버튼, 관리 열 |
| `menus` | `patent-code-admin` | 특허 코드 관리 | 코드 추가·변경·삭제 |
| `menus` | `contact` | 문의하기 | 신규 작성·수정·삭제 버튼, 답글 열 |
| `rightRail` | `documents` | 우측 레일 문서 | (편집 기능 없음) |
| `rightRail` | `schedule` | 우측 레일 일정 | (편집 기능 없음) |
| `rightRail` | `todo` | 우측 레일 To-do | 완료 체크 |

### 해석 규칙

- 모든 로그인 사용자는 `USER` 값을 받는다. 관리 역할이 있으면 그 역할 값도 보고 **가장 넓은 값**(`edit` > `view` > `hide`)을 쓴다.
  - 예: `USER: "view"`, `SUPER_ADMIN: "edit"` → SUPER_ADMIN은 `edit`, 일반 사용자는 `view`.
- 파일에 없는 역할·키, 오타 난 값은 `hide`로 본다.
- permission 검사는 그대로 먼저 한다. 예: `PATENT_ANALYSIS_ADMIN`은 `access-registry`가 `edit`이어도 `userAccess.manage`가 없어 메뉴가 안 보인다.
- 첫 화면(`/`, 로고, 403 화면의 이동 버튼)은 보이는 메뉴 중 맨 앞이다. 볼 수 있는 메뉴가 하나도 없으면 "볼 수 있는 화면이 없습니다"를 보여 준다.
- 숨긴 레일 항목이 열린 채 저장돼 있었다면 접힌 상태로 시작한다.

### 바꾸고 반영하기

1. `menuAccess.json`의 값을 고친다.
2. frontend를 다시 빌드·배포한다. JSON이 번들에 포함되므로 파일만 바꿔서는 운영에 반영되지 않는다. 개발 서버에서는 저장 즉시 반영된다.
3. 대상 역할 계정으로 메뉴·레일과 주소 직접 접근을 확인한다.

### 새 메뉴를 추가할 때

1. `frontend/src/config/menuAccess.ts`의 `MenuKey`에 키를 더한다.
2. `menuAccess.json`의 `menus`에 역할별 값을 적는다. 빠뜨리면 모두에게 숨는다.
3. `frontend/src/routes.tsx`의 해당 라우트에 `menu: '<키>'`를 단다. 좌측 메뉴는 라우트를 따라가므로 따로 적지 않는다.
4. `view`를 지원하려면 그 화면의 편집 판정에 `useMenuAccessLevel('<키>') === 'edit'`을 AND로 묶는다.

레일 항목은 `rightRail`에 키를 더하면 되고(`RightRailItemId`와 같은 이름), `view` 지원은 `useRailAccessLevel`을 쓴다.

## 주의

- **메뉴 설정은 화면 노출만 정한다.** 서버 API는 permission만 본다. 메뉴를 `hide`해도 permission이 있는 사용자가 API를 직접 호출하면 응답한다. 실제 접근을 막으려면 역할·팀 permission을 조정한다.
- 메뉴에 없는 `/patents/*`, `/papers/manage`, `/workspace/patent-analysis-admin`은 메뉴 설정 키가 없어 permission만 따른다.

## 관련 코드

- 역할·permission: `backend/src/authorization/workspace-permissions.ts`, `workspace-authorization.service.ts`
- 역할 변경 API: `backend/src/admin/admin-users.service.ts`
- 최초 관리자: `backend/src/auth/groupware-sso.plugin.ts`, `backend/src/auth/auth-config.ts`
- 메뉴 설정: `frontend/src/config/menuAccess.json`, `menuAccess.ts`, `frontend/src/hooks/useMenuAccess.ts`
- 라우트·메뉴: `frontend/src/routes.tsx`, `frontend/src/components/layout/navigation.tsx`, `frontend/src/App.tsx`
- 구현 기록: [report_20261102_unreleased_feature_gate.md](reports/2026/11/report_20261102_unreleased_feature_gate.md)
