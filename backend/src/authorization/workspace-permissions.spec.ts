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

  it("combines permissions for multiple stored roles", () => {
    const permissions = getWorkspacePermissions(
      "CONFERENCE_ADMIN,PATENT_ANALYSIS_ADMIN",
    );
    expect(permissions).toEqual(
      expect.arrayContaining([
        "conference.manage",
        "conference.comment.moderate",
        "patentAnalysis.manage",
      ]),
    );
    expect(permissions).not.toContain("userAccess.manage");
  });

  it("normalizes and deduplicates comma-separated roles", () => {
    expect(parseStoredRoles(" conference_admin,CONFERENCE_ADMIN ")).toEqual([
      "CONFERENCE_ADMIN",
    ]);
  });

  it("serializes selected admin roles in a stable order", () => {
    expect(
      serializeWorkspaceAdminRoles([
        "PATENT_ANALYSIS_ADMIN",
        "CONFERENCE_ADMIN",
      ]),
    ).toBe("CONFERENCE_ADMIN,PATENT_ANALYSIS_ADMIN");
    expect(serializeWorkspaceAdminRoles([])).toBe("USER");
  });

  it("adds team-scoped permissions without granting global administration", () => {
    const permissions = getWorkspacePermissions("USER", [
      "design.read",
      "design.write",
    ]);
    expect(permissions).toEqual(["design.read", "design.write"]);
    expect(permissions).not.toContain("userAccess.manage");
  });
});
