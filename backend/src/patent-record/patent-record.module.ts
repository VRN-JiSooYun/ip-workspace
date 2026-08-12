import { Module } from "@nestjs/common";
import { PatentCodeController } from "./patent-code.controller";
import { PatentCodeService } from "./patent-code.service";
import { PatentRecordImportService } from "./patent-record-import.service";
import { PatentRecordController } from "./patent-record.controller";
import { PatentRecordService } from "./patent-record.service";

@Module({
  controllers: [PatentRecordController, PatentCodeController],
  providers: [
    PatentRecordService,
    PatentCodeService,
    PatentRecordImportService,
  ],
})
export class PatentRecordModule {}
