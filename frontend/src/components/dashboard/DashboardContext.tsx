import React, { createContext, useContext } from 'react';
import type { DashboardState } from '../../hooks/useDashboardState';

const DashboardContext = createContext<DashboardState | null>(null);

/**
 * 위젯들이 공유하는 상태. 배치가 트리라서 각 위젯이 화면의 서로 다른 자리에 독립적으로
 * 마운트되므로, props로 내려보낼 공통 부모가 없다(PatentWorkspaceContext와 같은 이유).
 */
export const DashboardProvider: React.FC<
  React.PropsWithChildren<{ value: DashboardState }>
> = ({ value, children }) => (
  <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
);

export const useDashboard = (): DashboardState => {
  const value = useContext(DashboardContext);
  if (!value) throw new Error('useDashboard must be used within DashboardProvider');
  return value;
};
