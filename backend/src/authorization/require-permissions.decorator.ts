import { SetMetadata } from '@nestjs/common';
import type { WorkspacePermission } from './workspace-permissions';

export const WORKSPACE_PERMISSIONS_METADATA = 'WORKSPACE_PERMISSIONS';

export type RequiredPermissions = {
  mode: 'all' | 'any';
  permissions: WorkspacePermission[];
};

export const RequirePermissions = (
  ...permissions: WorkspacePermission[]
) => SetMetadata(WORKSPACE_PERMISSIONS_METADATA, {
  mode: 'all',
  permissions,
} satisfies RequiredPermissions);

export const RequireAnyPermission = (
  ...permissions: WorkspacePermission[]
) => SetMetadata(WORKSPACE_PERMISSIONS_METADATA, {
  mode: 'any',
  permissions,
} satisfies RequiredPermissions);
