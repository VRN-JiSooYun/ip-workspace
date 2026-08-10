import {
  normalizeTeamAlias,
  TeamMembershipSyncService,
} from "./team-membership-sync.service";

describe("normalizeTeamAlias", () => {
  it("normalizes unicode, whitespace, and case for stable alias lookup", () => {
    expect(normalizeTeamAlias("  AI 연구소   수리응용2팀  ")).toBe(
      "ai 연구소 수리응용2팀",
    );
    expect(normalizeTeamAlias("ＡＩ 연구소")).toBe("ai 연구소");
  });
});

describe("TeamMembershipSyncService", () => {
  it("repairs active session context when the canonical assignment already exists", async () => {
    const findUnique = jest.fn().mockResolvedValue({
      team: {
        id: "team-1",
        name: "Research",
        organization: {
          id: "organization-1",
          name: "Medichem Workspace",
          slug: "medichem-workspace",
        },
        aliases: [{ id: "alias-1" }],
        moduleAccess: [
          { module: "CONFERENCE" },
          { module: "PATENT_ANALYSIS" },
        ],
      },
      user: {
        organizationMembers: [{ organizationId: "organization-1" }],
      },
    });
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const transaction = jest.fn();
    const service = new TeamMembershipSyncService({
      client: {
        groupwareTeamAssignment: { findUnique },
        session: { updateMany },
        $transaction: transaction,
      },
    } as never);

    await expect(service.ensureForUser("user-1", "Research")).resolves.toEqual({
      organization: {
        id: "organization-1",
        name: "Medichem Workspace",
      },
      team: { id: "team-1", name: "Research" },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        OR: [
          { activeOrganizationId: null },
          { activeOrganizationId: { not: "organization-1" } },
          { activeTeamId: null },
          { activeTeamId: { not: "team-1" } },
        ],
      },
      data: {
        activeOrganizationId: "organization-1",
        activeTeamId: "team-1",
      },
    });
    expect(transaction).not.toHaveBeenCalled();
  });
});
