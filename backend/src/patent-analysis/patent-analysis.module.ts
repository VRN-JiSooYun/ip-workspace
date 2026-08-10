import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { PatentAnalysisController } from "./patent-analysis.controller";
import { PatentAnalysisHelperClient } from "./patent-analysis-helper.client";
import { PatentAnalysisService } from "./patent-analysis.service";
import { PatentMemberService } from "./patent-member.service";

@Module({
  imports: [HttpModule],
  controllers: [PatentAnalysisController],
  providers: [
    PatentAnalysisHelperClient,
    PatentAnalysisService,
    PatentMemberService,
  ],
  exports: [PatentAnalysisHelperClient, PatentMemberService],
})
export class PatentAnalysisModule {}
