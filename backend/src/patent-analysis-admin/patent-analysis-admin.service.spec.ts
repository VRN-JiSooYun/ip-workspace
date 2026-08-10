import { PatentAnalysisAdminService } from "./patent-analysis-admin.service";

describe("PatentAnalysisAdminService notification preferences", () => {
  const member = {
    memberId: 256,
    email: "user@example.com",
    name: "User",
    status: "ACTIVE",
  };

  const createService = (helperResponses: unknown[]) => {
    const helperCall = jest.fn();
    helperResponses.forEach((response) =>
      helperCall.mockResolvedValueOnce(response),
    );
    const service = new PatentAnalysisAdminService(
      {} as never,
      { call: helperCall } as never,
      { resolve: jest.fn().mockResolvedValue(member) } as never,
    );
    return { service, helperCall };
  };

  it("normalizes the helper alarm and target rows without exposing raw user data", async () => {
    const { service } = createService([
      {
        user_to_alarm: [{ mail: "1", owner_id: 256, email: member.email }],
        rows: [
          { target_name: "EGFR", keyword: "ErbB1, HER1" },
          { target_name: "egfr", keyword: ["HER1", "ErbB"] },
          { target_name: "" },
        ],
        selected_rows: [
          {
            target_name: "KRAS",
            keyword: "G12C",
            pending: "true",
            email: member.email,
          },
        ],
      },
    ]);

    await expect(
      service.getNotificationPreferences("user-id"),
    ).resolves.toEqual({
      enabled: true,
      availableTargets: [
        {
          targetName: "EGFR",
          keywords: ["ErbB1", "HER1", "ErbB"],
          pending: false,
        },
      ],
      selectedTargets: [
        {
          targetName: "KRAS",
          keywords: ["G12C"],
          pending: true,
        },
      ],
    });
  });

  it("adds only an active target and returns the refreshed canonical state", async () => {
    const initial = {
      user_to_alarm: [],
      rows: [{ target_name: "EGFR", keyword: "HER1" }],
      selected_rows: [],
    };
    const refreshed = {
      user_to_alarm: [{ mail: true }],
      rows: initial.rows,
      selected_rows: [{ target_name: "EGFR", keyword: "HER1", pending: false }],
    };
    const { service, helperCall } = createService([initial, {}, refreshed]);

    await expect(
      service.addNotificationTarget("user-id", "egfr"),
    ).resolves.toMatchObject({
      enabled: true,
      selectedTargets: [{ targetName: "EGFR", pending: false }],
    });
    expect(helperCall).toHaveBeenNthCalledWith(2, {
      operation: "ADD-TARGET-USER",
      actionType: "ADD-TARGET-USER",
      owner_id: 256,
      target_name: "EGFR",
      email: member.email,
    });
  });

  it("rejects a target that is not in the active target list", async () => {
    const { service, helperCall } = createService([
      {
        user_to_alarm: [],
        rows: [{ target_name: "EGFR" }],
        selected_rows: [],
      },
    ]);

    await expect(
      service.addNotificationTarget("user-id", "KRAS"),
    ).rejects.toThrow("PATENT_NOTIFICATION_TARGET_NOT_ACTIVE");
    expect(helperCall).toHaveBeenCalledTimes(1);
  });

  it("disables the global alarm without sending the member email", async () => {
    const refreshed = {
      user_to_alarm: [{ mail: false }],
      rows: [],
      selected_rows: [{ target_name: "EGFR", pending: false }],
    };
    const { service, helperCall } = createService([{}, refreshed]);

    await service.updateNotificationPreference("user-id", false);

    expect(helperCall).toHaveBeenNthCalledWith(1, {
      operation: "DISABLE-EMAIL-ALARM",
      actionType: "DISABLE-EMAIL-ALARM",
      owner_id: 256,
      email: undefined,
    });
  });
});
