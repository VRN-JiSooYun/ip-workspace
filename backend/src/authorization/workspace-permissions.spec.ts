import {
  getWorkspaceAdminRoles,
  getWorkspacePermissions,
  parseStoredRoles,
  serializeWorkspaceAdminRoles,
} from "./workspace-permissions";

describe("workspace permissions", () => {
  it("keeps legacy ADMIN users as super admins", () => {
    expect(getWorkspaceAdminRoles("ADMIN")).toEqual(["SUPER_ADMIN"]);
    expect(getWorkspacePermissions("ADMIN")).toContain("userAccess.manage");
  });

  it("grants a domain admin its own permissions only", () => {
    const permissions = getWorkspacePermissions("PATENT_ANALYSIS_ADMIN");
    expect(permissions).toEqual(
      expect.arrayContaining(["patentAnalysis.read", "patentAnalysis.manage"]),
    );
    expect(permissions).not.toContain("userAccess.manage");
  });

  it("normalizes and deduplicates comma-separated roles", () => {
    expect(
      parseStoredRoles(" patent_analysis_admin,PATENT_ANALYSIS_ADMIN "),
    ).toEqual(["PATENT_ANALYSIS_ADMIN"]);
  });

  it("serializes selected admin roles in a stable order", () => {
    expect(
      serializeWorkspaceAdminRoles(["PATENT_ANALYSIS_ADMIN", "SUPER_ADMIN"]),
    ).toBe("SUPER_ADMIN,PATENT_ANALYSIS_ADMIN");
    expect(serializeWorkspaceAdminRoles([])).toBe("USER");
  });

  it("adds team-scoped permissions without granting global administration", () => {
    const permissions = getWorkspacePermissions("USER", [
      "patentAnalysis.read",
    ]);
    expect(permissions).toEqual(["patentAnalysis.read"]);
    expect(permissions).not.toContain("userAccess.manage");
  });
});
