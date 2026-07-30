import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { FilesInterceptor } from '@nestjs/platform-express';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import { SkipTimeout } from '../common/decorators/skip-timeout.decorator';
import { ConferenceImportService } from './conference-import.service';
import {
  CONFERENCE_IMPORT_UPLOAD_MAX_FILE_BYTES,
  CONFERENCE_IMPORT_UPLOAD_MAX_FILES,
  CONFERENCE_IMPORT_UPLOAD_TEMP_DIRECTORY,
} from './conference-import-upload.constants';
import {
  ConferenceImportUploadService,
  type ConferenceImportUploadFile,
} from './conference-import-upload.service';
import { CreateConferenceImportDto } from './dto/create-conference-import.dto';
import { ConferenceImportListQueryDto } from './dto/conference-import-list-query.dto';

@RequirePermissions('conference.manage')
@Controller('api/admin/conference-imports')
export class ConferenceImportController {
  constructor(
    private readonly imports: ConferenceImportService,
    private readonly uploads: ConferenceImportUploadService,
  ) {}

  @Post('batches')
  @SkipTimeout()
  @UseInterceptors(FilesInterceptor('files', CONFERENCE_IMPORT_UPLOAD_MAX_FILES, {
    dest: CONFERENCE_IMPORT_UPLOAD_TEMP_DIRECTORY,
    limits: {
      files: CONFERENCE_IMPORT_UPLOAD_MAX_FILES,
      fileSize: CONFERENCE_IMPORT_UPLOAD_MAX_FILE_BYTES,
    },
  }))
  uploadBatch(
    @Session() session: UserSession,
    @Body() body: Record<string, unknown>,
    @UploadedFiles() files: ConferenceImportUploadFile[] = [],
  ) {
    return this.uploads.upload(session.user.id, body, files);
  }

  @Post('dry-run')
  createDryRun(
    @Session() session: UserSession,
    @Body() body: CreateConferenceImportDto,
  ) {
    return this.imports.createDryRun(session.user.id, body);
  }

  @Post()
  createApply(
    @Session() session: UserSession,
    @Body() body: CreateConferenceImportDto,
  ) {
    return this.imports.createApply(session.user.id, body);
  }

  @Get()
  listRuns(@Query() query: ConferenceImportListQueryDto) {
    return this.imports.listRuns(query.limit);
  }

  @Get('batches')
  listBatches() {
    return this.imports.listBatches();
  }

  @Get(':runId')
  getRun(
    @Param('runId', new ParseUUIDPipe({ version: '4' })) runId: string,
  ) {
    return this.imports.getRun(runId);
  }
}
