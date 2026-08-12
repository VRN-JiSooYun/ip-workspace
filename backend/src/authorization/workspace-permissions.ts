export const WORKSPACE_PERMISSIONS = [
  "userAccess.manage",
  "patentAnalysis.read",
  "patentAnalysis.manage",
] as const;

export type WorkspacePermission = (typeof WORKSPACE_PERMISSIONS)[number];

export const WORKSPACE_ADMIN_ROLES = [
  "SUPER_ADMIN",
  "PATENT_ANALYSIS_ADMIN",
] as const;

export type WorkspaceAdminRole = (typeof WORKSPACE_ADMIN_ROLES)[number];

export const LEGACY_ADMIN_ROLE = "ADMIN";
export const DEFAULT_USER_ROLE = "USER";

const ROLE_PERMISSION_GRANTS: Readonly<
  Record<WorkspaceAdminRole, readonly WorkspacePermission[]>
> = {
  SUPER_ADMIN: WORKSPACE_PERMISSIONS,
  PATENT_ANALYSIS_ADMIN: ["patentAnalysis.read", "patentAnalysis.manage"],
};

const normalizeRole = (role: string): string => role.trim().toUpperCase();

export const parseStoredRoles = (storedRole?: string | null): string[] => {
  if (!storedRole) return [DEFAULT_USER_ROLE];
  const roles = storedRole.split(",").map(normalizeRole).filter(Boolean);
  return roles.length > 0 ? [...new Set(roles)] : [DEFAULT_USER_ROLE];
};

export const getWorkspaceAdminRoles = (
  storedRole?: string | null,
): WorkspaceAdminRole[] => {
  const roles = parseStoredRoles(storedRole);
  const normalizedRoles = roles.includes(LEGACY_ADMIN_ROLE)
    ? [...roles, "SUPER_ADMIN"]
    : roles;
  return WORKSPACE_ADMIN_ROLES.filter((role) => normalizedRoles.includes(role));
};

export const serializeWorkspaceAdminRoles = (
  roles: readonly WorkspaceAdminRole[],
): string => {
  const normalizedRoles = WORKSPACE_ADMIN_ROLES.filter((role) =>
    roles.includes(role),
  );
  return normalizedRoles.length > 0
    ? normalizedRoles.join(",")
    : DEFAULT_USER_ROLE;
};

export const getWorkspacePermissions = (
  storedRole?: string | null,
  scopedPermissions: readonly WorkspacePermission[] = [],
): WorkspacePermission[] => {
  const permissions = new Set<WorkspacePermission>(scopedPermissions);
  for (const role of getWorkspaceAdminRoles(storedRole)) {
    for (const permission of ROLE_PERMISSION_GRANTS[role]) {
      permissions.add(permission);
    }
  }
  return WORKSPACE_PERMISSIONS.filter((permission) =>
    permissions.has(permission),
  );
};

export const hasWorkspacePermission = (
  storedRole: string | null | undefined,
  permission: WorkspacePermission,
): boolean => getWorkspacePermissions(storedRole).includes(permission);

export const isSuperAdminRole = (storedRole?: string | null): boolean =>
  getWorkspaceAdminRoles(storedRole).includes("SUPER_ADMIN");
