import React from 'react';
import {
  BOTTOM_NAV,
  MAIN_NAV,
  filterNavByAccess,
  getFirstNavPath,
} from '../components/layout/navigation';
import {
  getMenuAccessLevel,
  getRailAccessLevel,
  type MenuAccessLevel,
  type MenuKey,
} from '../config/menuAccess';
import { useAccessContext } from '../contexts/AccessContext';
import type { RightRailItemId } from '../store/useRightSidebarStore';

/** 이 사용자에게 `key` 메뉴가 어느 수준으로 보이는지(`config/menuAccess.json`). */
export const useMenuAccessLevel = (key: MenuKey): MenuAccessLevel => {
  const { access } = useAccessContext();
  return getMenuAccessLevel(key, access.globalRoles);
};

/** 우측 레일 항목의 수준. 메뉴와 같은 규칙이다. */
export const useRailAccessLevel = (id: RightRailItemId): MenuAccessLevel => {
  const { access } = useAccessContext();
  return getRailAccessLevel(id, access.globalRoles);
};

/**
 * 좌측 메뉴와 첫 화면. permission과 메뉴 노출 수준을 모두 통과한 것만 남는다.
 *
 * `homePath`는 보이는 메뉴 중 맨 앞(대개 Dashboard)이다. 볼 수 있는 메뉴가 하나도
 * 없으면 null — 돌려보낼 곳이 없으므로 redirect하지 말고 안내를 보여야 한다.
 */
export const useNavigationAccess = () => {
  const { access, hasPermission } = useAccessContext();
  return React.useMemo(() => {
    const menuLevel = (key: MenuKey) => getMenuAccessLevel(key, access.globalRoles);
    const mainNav = filterNavByAccess(MAIN_NAV, hasPermission, menuLevel);
    const bottomNav = filterNavByAccess(BOTTOM_NAV, hasPermission, menuLevel);
    return {
      menuLevel,
      mainNav,
      bottomNav,
      homePath: getFirstNavPath([...mainNav, ...bottomNav]),
    };
  }, [access.globalRoles, hasPermission]);
};
