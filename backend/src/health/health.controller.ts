import { Controller, Get } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";

@AllowAnonymous()
@Controller("health")
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: "ok",
    };
  }
}
