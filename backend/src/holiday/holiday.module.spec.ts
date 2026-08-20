import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { HolidayController } from "./holiday.controller";
import { HolidayModule } from "./holiday.module";
import { HolidayService } from "./holiday.service";

/**
 * HolidayModule의 DI 배선(HttpService·ConfigService 주입)이 실제로 성립하는지 본다.
 * ConfigModule은 app.module과 같이 isGlobal로 올린다.
 */
describe("HolidayModule", () => {
  it("자격증명이 없어도 부팅되고 configured=false를 준다", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), HolidayModule],
    }).compile();

    const controller = moduleRef.get(HolidayController);
    expect(moduleRef.get(HolidayService)).toBeDefined();

    await expect(controller.findByYear({ year: 2026 })).resolves.toEqual({
      year: 2026,
      configured: false,
      holidays: [],
    });

    await moduleRef.close();
  });
});
