import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { RequirePermissions } from "../authorization/require-permissions.decorator";
import { SkipTimeout } from "../common/decorators/skip-timeout.decorator";
import { CreatePatentRecordDto } from "./dto/create-patent-record.dto";
import { ImportPatentRecordsDto } from "./dto/import-patent-records.dto";
import { PatentRecordListQueryDto } from "./dto/patent-record-list-query.dto";
import { PatentScheduleQueryDto } from "./dto/patent-schedule-query.dto";
import { UpdatePatentRecordDto } from "./dto/update-patent-record.dto";
import { buildTemplateCsv } from "./patent-csv";
import { PatentRecordImportService } from "./patent-record-import.service";
import { PatentRecordService } from "./patent-record.service";

const CSV_MAX_BYTES = 5 * 1024 * 1024;

/**
 * 로컬 `patent` table CRUD.
 *
 * 외부 특허 API를 중계하는 PatentAnalysisController(`api/patents`)와는 별개다.
 * `:id` 라우팅이 그쪽의 `/my`, `/favorites`와 섞이지 않도록 prefix를 분리했다.
 */
@RequirePermissions("patentAnalysis.read")
@Controller("api/patent-records")
export class PatentRecordController {
  constructor(
    private readonly patents: PatentRecordService,
    private readonly imports: PatentRecordImportService,
  ) {}

  @Get("lookups")
  listLookups() {
    return this.patents.listLookups();
  }

  @Get("targets")
  listTargets() {
    return this.patents.listTargets();
  }

  @Get("schedule")
  schedule(@Query() query: PatentScheduleQueryDto) {
    return this.patents.schedule(query);
  }

  /** Google Sheets에 붙여넣고 컬럼명을 맞출 수 있는 빈 CSV. */
  @Get("import/template")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header(
    "Content-Disposition",
    'attachment; filename="patent-import-template.csv"',
  )
  downloadTemplate() {
    return buildTemplateCsv();
  }

  /**
   * CSV 일괄 등록. DRY_RUN으로 결과를 먼저 확인하고 APPLY로 반영한다.
   * APPLY는 전부 하나의 transaction이라 중간에 실패하면 아무것도 남지 않는다.
   */
  @RequirePermissions("patentAnalysis.manage")
  @Post("import")
  @SkipTimeout()
  @UseInterceptors(
    FileInterceptor("file", { limits: { files: 1, fileSize: CSV_MAX_BYTES } }),
  )
  import(
    @Body() body: ImportPatentRecordsDto,
    @UploadedFile() file?: { buffer?: Buffer; size?: number },
  ) {
    if (!file?.buffer)
      throw new BadRequestException("PATENT_CSV_FILE_REQUIRED");
    return this.imports.execute(
      file.buffer.toString("utf8"),
      body.mode,
      body.duplicateMode,
    );
  }

  @Get()
  list(@Query() query: PatentRecordListQueryDto) {
    return this.patents.list(query);
  }

  @Get(":id")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.patents.get(id);
  }

  @RequirePermissions("patentAnalysis.manage")
  @Post()
  create(@Body() body: CreatePatentRecordDto) {
    return this.patents.create(body);
  }

  @RequirePermissions("patentAnalysis.manage")
  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: UpdatePatentRecordDto,
  ) {
    return this.patents.update(id, body);
  }

  @RequirePermissions("patentAnalysis.manage")
  @Delete(":id")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.patents.remove(id);
  }
}
