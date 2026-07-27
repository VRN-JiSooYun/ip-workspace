import { Module } from '@nestjs/common';
import { ConferenceExcelReaderService } from './conference-excel-reader.service';
import { ConferenceImportController } from './conference-import.controller';
import { ConferenceImportService } from './conference-import.service';
import { ConferenceImportApplyService } from './conference-import-apply.service';
import { ConferenceMediaModule } from '../conference-media/conference-media.module';
import { LegacyCommentImportService } from './legacy-comment-import.service';
import { ConferenceImportUploadService } from './conference-import-upload.service';

@Module({
  imports: [ConferenceMediaModule],
  controllers: [ConferenceImportController],
  providers: [
    ConferenceExcelReaderService,
    ConferenceImportApplyService,
    LegacyCommentImportService,
    ConferenceImportUploadService,
    ConferenceImportService,
  ],
})
export class ConferenceImportModule {}
