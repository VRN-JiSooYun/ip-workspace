import rawConfig from './menuAccess.json';
import type { RightRailItemId } from '../store/useRightSidebarStore';

/**
 * 메뉴별 노출 수준. 값은 `menuAccess.json`에서 관리한다.
 *
 *  - `edit`: 보이고, 그 화면의 편집 기능도 쓴다.
 *  - `view`: 보이지만 편집 기능(추가·수정·삭제·설정)은 가린다.
 *  - `hide`: 메뉴에서 빠지고, 주소로 열어도 첫 화면으로 돌려보낸다.
 *
 * **permission을 좁히기만 한다.** `edit`이어도 그 화면이 요구하는 permission이 없으면
 * 여전히 못 열고 못 고친다. 서버 API 권한과도 무관하다 — 화면 노출만 정한다.
 *
 * 역할 해석: 모든 로그인 사용자는 `USER`이고, `access-context`의 `globalRoles`
 * (SUPER_ADMIN·PATENT_ANALYSIS_ADMIN)가 있으면 그 값들도 본다. 그중 가장 넓은 수준을 쓴다.
 * 파일에 없는 역할·메뉴, 알 수 없는 값은 `hide`로 본다 — 실수로 빠뜨린 메뉴가 열리는
 * 쪽보다 안 보이는 쪽이 알아채기 쉽다.
 */
export type MenuAccessLevel = 'edit' | 'view' | 'hide';

/** `menuAccess.json`의 `menus` 키. 좌측 메뉴의 key이자 routes의 `menu`다. */
export type MenuKey =
  | 'dashboard'
  | 'patent-management'
  | 'office-actions'
  | 'access-registry'
  | 'patent-code-admin'
  | 'contact';

const BASE_ROLE = 'USER';

const LEVEL_RANK: Record<MenuAccessLevel, number> = { hide: 0, view: 1, edit: 2 };

const isLevel = (value: unknown): value is MenuAccessLevel => (
  typeof value === 'string' && value in LEVEL_RANK
);

type RoleLevels = Record<string, unknown>;
type MenuAccessConfig = {
  menus?: Record<string, RoleLevels>;
  rightRail?: Record<string, RoleLevels>;
};

const config = rawConfig as MenuAccessConfig;

const resolveLevel = (
  entry: RoleLevels | undefined,
  globalRoles: readonly string[],
): MenuAccessLevel => {
  if (!entry) return 'hide';
  let level: MenuAccessLevel = 'hide';
  for (const role of [BASE_ROLE, ...globalRoles]) {
    const value = entry[role];
    if (isLevel(value) && LEVEL_RANK[value] > LEVEL_RANK[level]) level = value;
  }
  return level;
};

export const getMenuAccessLevel = (
  key: MenuKey,
  globalRoles: readonly string[],
): MenuAccessLevel => resolveLevel(config.menus?.[key], globalRoles);

export const getRailAccessLevel = (
  id: RightRailItemId,
  globalRoles: readonly string[],
): MenuAccessLevel => resolveLevel(config.rightRail?.[id], globalRoles);
