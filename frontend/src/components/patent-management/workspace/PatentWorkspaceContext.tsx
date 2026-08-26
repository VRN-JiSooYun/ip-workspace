import React, { createContext, useContext } from 'react';
import type { PatentWorkspaceState } from '../../../hooks/usePatentWorkspaceState';

const PatentWorkspaceContext = createContext<PatentWorkspaceState | null>(null);

/**
 * 패널들이 공유하는 상태. 배치가 트리로 바뀌면서 각 패널이 화면의 서로 다른 자리에
 * 독립적으로 마운트되므로, props로 내려보낼 공통 부모가 없다.
 */
export const PatentWorkspaceProvider: React.FC<
  React.PropsWithChildren<{ value: PatentWorkspaceState }>
> = ({ value, children }) => (
  <PatentWorkspaceContext.Provider value={value}>
    {children}
  </PatentWorkspaceContext.Provider>
);

export const usePatentWorkspace = (): PatentWorkspaceState => {
  const value = useContext(PatentWorkspaceContext);
  if (!value) throw new Error('usePatentWorkspace must be used within PatentWorkspaceProvider');
  return value;
};
