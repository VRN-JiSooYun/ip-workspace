import { Module } from '@nestjs/common';
import { PatentAnalysisModule } from '../patent-analysis/patent-analysis.module';
import {
  PatentAnalysisAdminController,
  PatentAnalysisRequestController,
} from './patent-analysis-admin.controller';
import { PatentAnalysisAdminService } from './patent-analysis-admin.service';
import { PatentMemberService } from './patent-member.service';

@Module({
  imports: [PatentAnalysisModule],
  controllers: [PatentAnalysisAdminController, PatentAnalysisRequestController],
  providers: [PatentAnalysisAdminService, PatentMemberService],
})
export class PatentAnalysisAdminModule {}
