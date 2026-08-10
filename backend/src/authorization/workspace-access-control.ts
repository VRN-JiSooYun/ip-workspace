import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

const workspaceStatements = {
  ...defaultStatements,
  userAccess: ["manage"],
  conference: ["read", "manage", "comment-moderate"],
  patentAnalysis: ["read", "manage"],
  sarTable: ["read", "write", "manage"],
  design: ["read", "write", "manage"],
  synthesis: ["read", "write", "manage"],
} as const;

export const workspaceAccessControl = createAccessControl(workspaceStatements);

const baseUserStatements = {
  user: [],
  session: [],
  conference: [],
  patentAnalysis: [],
  sarTable: [],
  design: [],
  synthesis: [],
} as const;

const superAdminStatements = {
  ...adminAc.statements,
  userAccess: ["manage"],
  conference: ["read", "manage", "comment-moderate"],
  patentAnalysis: ["read", "manage"],
  sarTable: ["read", "write", "manage"],
  design: ["read", "write", "manage"],
  synthesis: ["read", "write", "manage"],
} as const;

export const betterAuthWorkspaceRoles = {
  USER: workspaceAccessControl.newRole(baseUserStatements),
  ADMIN: workspaceAccessControl.newRole(superAdminStatements),
  SUPER_ADMIN: workspaceAccessControl.newRole(superAdminStatements),
  CONFERENCE_ADMIN: workspaceAccessControl.newRole({
    ...baseUserStatements,
    conference: ["read", "manage", "comment-moderate"],
  }),
  PATENT_ANALYSIS_ADMIN: workspaceAccessControl.newRole({
    ...baseUserStatements,
    patentAnalysis: ["read", "manage"],
  }),
};
