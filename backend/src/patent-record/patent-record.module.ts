import { Module } from "@nestjs/common";
import { PatentCodeController } from "./patent-code.controller";
import { PatentAuditService } from "./patent-audit.service";
import { PatentCodeService } from "./patent-code.service";
import { PatentRecordImportService } from "./patent-record-import.service";
import { PatentRecordController } from "./patent-record.controller";
import { PatentRecordService } from "./patent-record.service";
import { PatentTodoController } from "./patent-todo.controller";
import { PatentTodoService } from "./patent-todo.service";
import { PatentNoteImageService } from "./patent-note-image.service";
import { PatentDocumentLinkService } from "./patent-document-link.service";

@Module({
  controllers: [
    PatentRecordController,
    PatentCodeController,
    PatentTodoController,
  ],
  providers: [
    PatentRecordService,
    PatentAuditService,
    PatentCodeService,
    PatentRecordImportService,
    PatentTodoService,
    PatentNoteImageService,
    PatentDocumentLinkService,
  ],
})
export class PatentRecordModule {}
