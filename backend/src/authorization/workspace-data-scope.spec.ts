import { WorkspaceAuthorizationService } from "./workspace-authorization.service";
import type { WorkspaceAccessContext } from "./workspace-authorization.service";

const context = (
  overrides: Partial<WorkspaceAccessContext> = {},
): WorkspaceAccessContext => ({
  userId: "user-1",
  globalRoles: [],
  organization: { id: "org-1", name: "Workspace" },
  teams: [{ id: "team-1", name: "Research" }],
  permissions: ["patentAnalysis.read"],
  modules: {
    patentAnalysis: { read: true, write: false, manage: false },
  },
  ...overrides,
});

describe("workspace data scope", () => {
  const service = new WorkspaceAuthorizationService(
    null as never,
    null as never,
  );

  it("grants global scope only to a super admin", () => {
    expect(
      service.resolveDataScope(context({ globalRoles: ["SUPER_ADMIN"] })),
    ).toEqual({ type: "GLOBAL" });
  });

  it("keeps regular patent helper access owned by the signed-in user", () => {
    expect(service.resolveDataScope(context())).toEqual({
      type: "OWN",
      userId: "user-1",
    });
  });

  it("widens a patent analysis admin to the current organization", () => {
    expect(
      service.resolveDataScope(
        context({ globalRoles: ["PATENT_ANALYSIS_ADMIN"] }),
      ),
    ).toEqual({ type: "ORG", organizationId: "org-1" });
  });

  it("requires an organization before widening an admin", () => {
    expect(() =>
      service.resolveDataScope(
        context({
          globalRoles: ["PATENT_ANALYSIS_ADMIN"],
          organization: null,
        }),
      ),
    ).toThrow("WORKSPACE_ORGANIZATION_REQUIRED");
  });
});
