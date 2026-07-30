import type { WorkspacePermission } from './workspace-permissions';

export type WorkspaceDataScope =
  | { type: 'GLOBAL' }
  | { type: 'ORG'; organizationId: string }
  | { type: 'TEAM'; organizationId: string; teamIds: string[] }
  | { type: 'OWN'; userId: string };

export type WorkspaceScopedRequest = {
  workspaceAccessContext?: {
    userId: string;
    globalRoles: string[];
    organization: { id: string; name: string } | null;
    teams: Array<{ id: string; name: string }>;
    permissions: WorkspacePermission[];
  };
};

export const organizationIdForScope = (
  scope: WorkspaceDataScope,
): string | undefined => (
  scope.type === 'ORG' || scope.type === 'TEAM'
    ? scope.organizationId
    : undefined
);
