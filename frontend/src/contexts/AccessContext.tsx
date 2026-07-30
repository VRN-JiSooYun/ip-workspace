import { Button, Result, Spin } from 'antd';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  accessContextApi,
  type WorkspaceAccessContext,
  type WorkspacePermission,
} from '../services/accessContextApi';

type AccessContextValue = {
  access: WorkspaceAccessContext;
  hasPermission: (permission: WorkspacePermission) => boolean;
  refresh: () => Promise<void>;
};

const AccessContext = createContext<AccessContextValue | null>(null);

export const AccessContextProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [access, setAccess] = useState<WorkspaceAccessContext | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setAccess(await accessContextApi.get());
    } catch (loadError) {
      setAccess(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : '접근 권한 정보를 확인하지 못했습니다.',
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo<AccessContextValue | null>(() => {
    if (!access) return null;
    const permissionSet = new Set(access.permissions);
    return {
      access,
      hasPermission: (permission) => permissionSet.has(permission),
      refresh: load,
    };
  }, [access, load]);

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Result
          status="warning"
          title="접근 권한 확인 실패"
          subTitle={error}
          extra={<Button type="primary" onClick={() => void load()}>다시 시도</Button>}
        />
      </div>
    );
  }
  if (!value) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
};

export const useAccessContext = (): AccessContextValue => {
  const context = useContext(AccessContext);
  if (!context) {
    throw new Error('useAccessContext must be used within AccessContextProvider');
  }
  return context;
};
