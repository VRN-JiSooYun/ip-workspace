import { Module } from "@nestjs/common";
import { PatentCodeController } from "./patent-code.controller";
import { PatentCodeService } from "./patent-code.service";
import { PatentRecordImportService } from "./patent-record-import.service";
import { PatentRecordController } from "./patent-record.controller";
import { PatentRecordService } from "./patent-record.service";
import { PatentTodoController } from "./patent-todo.controller";
import { PatentTodoService } from "./patent-todo.service";

@Module({
  controllers: [
    PatentRecordController,
    PatentCodeController,
    PatentTodoController,
  ],
  providers: [
    PatentRecordService,
    PatentCodeService,
    PatentRecordImportService,
    PatentTodoService,
  ],
})
export class PatentRecordModule {}
