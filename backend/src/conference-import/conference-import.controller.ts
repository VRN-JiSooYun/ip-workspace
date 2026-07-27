import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Roles, Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { ConferenceImportService } from './conference-import.service';
import { CreateConferenceImportDto } from './dto/create-conference-import.dto';
import { ConferenceImportListQueryDto } from './dto/conference-import-list-query.dto';

@Roles(['ADMIN'])
@Controller('api/admin/conference-imports')
export class ConferenceImportController {
  constructor(private readonly imports: ConferenceImportService) {}

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
