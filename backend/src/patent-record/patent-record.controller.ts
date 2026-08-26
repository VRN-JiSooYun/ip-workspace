import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { randomUUID } from "node:crypto";
import { RequirePermissions } from "../authorization/require-permissions.decorator";
import { SkipTimeout } from "../common/decorators/skip-timeout.decorator";
import { CreatePatentRecordDto } from "./dto/create-patent-record.dto";
import { ImportPatentRecordsDto } from "./dto/import-patent-records.dto";
import { PatentDeadlineQueryDto } from "./dto/patent-deadline-query.dto";
import { PatentRecordListQueryDto } from "./dto/patent-record-list-query.dto";
import { PatentScheduleQueryDto } from "./dto/patent-schedule-query.dto";
import { PatentAuditLogQueryDto } from "./dto/patent-audit-log-query.dto";
import { PatentStageQueryDto } from "./dto/patent-stage-query.dto";
import { UpdatePatentRecordDto } from "./dto/update-patent-record.dto";
import { buildTemplateCsv } from "./patent-csv";
import { PatentRecordImportService } from "./patent-record-import.service";
import { PatentAuditService } from "./patent-audit.service";
import { PatentRecordService } from "./patent-record.service";
import {
  PATENT_NOTE_IMAGE_MAX_BYTES,
  PatentNoteImageService,
} from "./patent-note-image.service";

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
    private readonly audit: PatentAuditService,
    private readonly imports: PatentRecordImportService,
    private readonly noteImages: PatentNoteImageService,
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

  /** 진행 현황 파이프라인용 단계별 건수. 목록과 같은 필터를 받는다. */
  @Get("stages")
  stages(@Query() query: PatentStageQueryDto) {
    return this.patents.stages(query);
  }

  /**
   * 대시보드 기한 보드용 마감 목록. 월 단위인 `schedule`과 달리 임의 구간을 받는다.
   * `:id` 라우팅에 먹히지 않도록 그 위에 둔다.
   */
  @Get("deadlines")
  deadlines(@Query() query: PatentDeadlineQueryDto) {
    return this.patents.deadlines(query);
  }

  /** 대시보드 KPI + 데이터 품질 집계. 목록·진행 현황과 같은 필터를 받는다. */
  @Get("summary")
  summary(@Query() query: PatentStageQueryDto) {
    return this.patents.summary(query);
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

  /**
   * 이 특허의 활동 피드(변경 이력).
   *
   * `@Get(":id")`보다 먼저 선언해야 한다 — Nest는 선언 순서대로 맞춰 보므로 뒤에 두면
   * `:id`가 'audit-logs'를 id로 삼켜 400이 난다.
   */
  @Get(":id/audit-logs")
  auditLogs(
    @Param("id", ParseIntPipe) id: number,
    @Query() query: PatentAuditLogQueryDto,
  ) {
    return this.audit.list(id, { limit: query.limit, cursor: query.cursor });
  }

  @Get(":id")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.patents.get(id);
  }

  /** 관리 특허에 딸린 문서(통지서·제출 서류) 목록. 우측 문서 뷰어가 쓴다. */
  @Get(":id/documents")
  listDocuments(@Param("id", ParseIntPipe) id: number) {
    return this.patents.listDocuments(id);
  }

  /** 설명 편집기에 붙여 넣은 이미지를 SeaweedFS에 저장한다. */
  @RequirePermissions("patentAnalysis.manage")
  @Post(":id/note-images")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { files: 1, fileSize: PATENT_NOTE_IMAGE_MAX_BYTES },
    }),
  )
  async uploadNoteImage(
    @Param("id", ParseIntPipe) id: number,
    @UploadedFile() file?: {
      buffer?: Buffer;
      mimetype?: string;
      size?: number;
    },
  ) {
    await this.patents.get(id);
    if (!file?.buffer) {
      throw new BadRequestException("PATENT_NOTE_IMAGE_FILE_REQUIRED");
    }
    return this.noteImages.upload(id, {
      buffer: file.buffer,
      mimetype: file.mimetype,
      size: file.size,
    });
  }

  /** SeaweedFS를 직접 노출하지 않고 기존 세션·권한을 거쳐 이미지를 전달한다. */
  @Get(":id/note-images/:fileName")
  @Header("Cache-Control", "private, max-age=31536000, immutable")
  async readNoteImage(
    @Param("id", ParseIntPipe) id: number,
    @Param("fileName") fileName: string,
  ) {
    await this.patents.get(id);
    const image = await this.noteImages.read(id, fileName);
    return new StreamableFile(image.buffer, {
      type: image.contentType,
      length: image.buffer.length,
      disposition: `inline; filename="${fileName}"`,
    });
  }

  /** 편집을 취소했거나 본문에서 제거한 신규 이미지의 정리용 API. */
  @RequirePermissions("patentAnalysis.manage")
  @Delete(":id/note-images/:fileName")
  async removeNoteImage(
    @Param("id", ParseIntPipe) id: number,
    @Param("fileName") fileName: string,
  ) {
    await this.patents.get(id);
    await this.noteImages.remove(id, fileName);
    return { fileName };
  }

  @RequirePermissions("patentAnalysis.manage")
  @Post()
  create(
    @Session() session: UserSession,
    @Body() body: CreatePatentRecordDto,
    @Headers("x-request-id") requestId?: string,
  ) {
    return this.patents.create(body, session.user.id, requestId ?? randomUUID());
  }

  @RequirePermissions("patentAnalysis.manage")
  @Patch(":id")
  update(
    @Session() session: UserSession,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: UpdatePatentRecordDto,
    @Headers("x-request-id") requestId?: string,
  ) {
    return this.patents.update(id, body, session.user.id, requestId ?? randomUUID());
  }

  @RequirePermissions("patentAnalysis.manage")
  @Delete(":id")
  remove(
    @Session() session: UserSession,
    @Param("id", ParseIntPipe) id: number,
    @Headers("x-request-id") requestId?: string,
  ) {
    return this.patents.remove(id, session.user.id, requestId ?? randomUUID());
  }
}
