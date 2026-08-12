import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

const workspaceStatements = {
  ...defaultStatements,
  userAccess: ["manage"],
  patentAnalysis: ["read", "manage"],
} as const;

export const workspaceAccessControl = createAccessControl(workspaceStatements);

const baseUserStatements = {
  user: [],
  session: [],
  patentAnalysis: [],
} as const;

const superAdminStatements = {
  ...adminAc.statements,
  userAccess: ["manage"],
  patentAnalysis: ["read", "manage"],
} as const;

export const betterAuthWorkspaceRoles = {
  USER: workspaceAccessControl.newRole(baseUserStatements),
  ADMIN: workspaceAccessControl.newRole(superAdminStatements),
  SUPER_ADMIN: workspaceAccessControl.newRole(superAdminStatements),
  PATENT_ANALYSIS_ADMIN: workspaceAccessControl.newRole({
    ...baseUserStatements,
    patentAnalysis: ["read", "manage"],
  }),
};
