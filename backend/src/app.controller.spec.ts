import { Test, TestingModule } from "@nestjs/testing";
import { AppModule } from "./app.module";
import { HealthController } from "./health/health.controller";

describe("HealthController", () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it("returns ok status", () => {
    expect(controller.getHealth()).toEqual({ status: "ok" });
  });
});
