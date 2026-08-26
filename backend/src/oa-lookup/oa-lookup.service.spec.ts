import { BadGatewayException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { OaDatabaseService } from "../oa-database/oa-database.service";
import { OaLookupService } from "./oa-lookup.service";

const config = {
  get: (_key: string, fallback: unknown) => fallback,
} as unknown as ConfigService;

describe("OaLookupService", () => {
  it("reads the three OA code tables and caches the result", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("public.country")) {
        return [{ id: 1, country: "대한민국" }];
      }
      if (sql.includes("public.exam_status")) {
        return [{ id: 4, status: "등록결정(일반)" }];
      }
      return [{ id: 4, status: "등록" }];
    });
    const service = new OaLookupService(
      { query } as unknown as OaDatabaseService,
      config,
    );

    const first = await service.list();
    const second = await service.list();

    expect(first).toEqual({
      countries: [{ id: 1, country: "대한민국" }],
      examStatuses: [{ id: 4, status: "등록결정(일반)" }],
      legalStatuses: [{ id: 4, status: "등록" }],
    });
    expect(second).toBe(first);
    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[1][0]).toContain("status IS NOT NULL");
    expect(query.mock.calls[1][0]).toContain("btrim(status) <> ''");
  });

  it("maps a database failure to a stable gateway error", async () => {
    const service = new OaLookupService(
      {
        query: jest.fn().mockRejectedValue(new Error("connection refused")),
      } as unknown as OaDatabaseService,
      config,
    );

    await expect(service.list()).rejects.toBeInstanceOf(BadGatewayException);
  });
});
