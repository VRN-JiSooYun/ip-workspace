import { Button, Result } from 'antd';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccessContext } from '../../contexts/AccessContext';
import { useNavigationAccess } from '../../hooks/useMenuAccess';
import type { WorkspacePermission } from '../../services/accessContextApi';

type RequirePermissionProps = React.PropsWithChildren<{
  permission: WorkspacePermission;
}>;

const RequirePermission: React.FC<RequirePermissionProps> = ({
  permission,
  children,
}) => {
  const navigate = useNavigate();
  const { hasPermission } = useAccessContext();
  const { homePath } = useNavigationAccess();
  if (hasPermission(permission)) return children;
  return (
    <Result
      status="403"
      title="접근 권한이 없습니다"
      subTitle="이 페이지를 사용하려면 담당 권한이 필요합니다."
      extra={homePath
        ? <Button type="primary" onClick={() => navigate(homePath)}>처음 화면으로 이동</Button>
        : undefined}
    />
  );
};

export default RequirePermission;
