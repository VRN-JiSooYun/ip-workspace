import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { QuantumCalculationController } from "./quantum-calculation.controller";
import { QuantumCalculationService } from "./quantum-calculation.service";
import { ThreeDPsaClient } from "./three-d-psa.client";
import { VpropClient } from "./vprop.client";
import { VpropController } from "./vprop.controller";
import { VpropService } from "./vprop.service";

@Module({
  imports: [HttpModule],
  controllers: [QuantumCalculationController, VpropController],
  providers: [
    QuantumCalculationService,
    ThreeDPsaClient,
    VpropClient,
    VpropService,
  ],
})
export class CalculationsModule {}
