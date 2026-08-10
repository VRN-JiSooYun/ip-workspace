import { Module } from "@nestjs/common";
import { PatentAnalysisModule } from "../patent-analysis/patent-analysis.module";
import {
  PatentAnalysisAdminController,
  PatentAnalysisRequestController,
} from "./patent-analysis-admin.controller";
import { PatentAnalysisAdminService } from "./patent-analysis-admin.service";

@Module({
  imports: [PatentAnalysisModule],
  controllers: [PatentAnalysisAdminController, PatentAnalysisRequestController],
  providers: [PatentAnalysisAdminService],
})
export class PatentAnalysisAdminModule {}
