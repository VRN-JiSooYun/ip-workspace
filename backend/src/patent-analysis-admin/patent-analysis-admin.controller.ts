import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles, Session, type UserSession } from '@thallesp/nestjs-better-auth';
import {
  AdminPatentListQueryDto,
  CreateBioactivityRequestDto,
  CreatePatentTargetRequestDto,
  ModifyAdminPatentDto,
  PatentTargetDecisionDto,
  PatentTargetListQueryDto,
} from './dto/patent-analysis-admin.dto';
import { PatentAnalysisAdminService } from './patent-analysis-admin.service';

type UploadFile = { buffer: Buffer; originalname: string; mimetype: string };

@Controller('api/patents')
export class PatentAnalysisRequestController {
  constructor(private readonly service: PatentAnalysisAdminService) {}

  @Post(':publicationNumber/bioactivity-requests')
  createBioactivityRequest(
    @Session() session: UserSession,
    @Param('publicationNumber') publicationNumber: string,
    @Body() body: CreateBioactivityRequestDto,
  ) {
    return this.service.createBioactivityRequest(session.user.id, publicationNumber, body);
  }

  @Post('target-requests')
  createTargetRequest(
    @Session() session: UserSession,
    @Body() body: CreatePatentTargetRequestDto,
  ) {
    return this.service.createTargetRequest(session.user.id, body);
  }
}

@Roles(['ADMIN'])
@Controller('api/admin/patent-analysis')
export class PatentAnalysisAdminController {
  constructor(private readonly service: PatentAnalysisAdminService) {}

  @Get('patents')
  listPatents(
    @Session() session: UserSession,
    @Query() query: AdminPatentListQueryDto,
  ) {
    return this.service.listPatents(session.user.id, query);
  }

  @Patch('patents/:publicationNumber')
  modifyPatent(
    @Session() session: UserSession,
    @Param('publicationNumber') publicationNumber: string,
    @Body() body: ModifyAdminPatentDto,
  ) {
    return this.service.modifyPatent(session.user.id, publicationNumber, body);
  }

  @Post('patents/:publicationNumber/bioactivity')
  @UseInterceptors(FileInterceptor('file'))
  uploadBioactivity(
    @Session() session: UserSession,
    @Param('publicationNumber') publicationNumber: string,
    @UploadedFile() file?: UploadFile,
  ) {
    return this.service.uploadBioactivity(session.user.id, publicationNumber, file);
  }

  @Get('targets')
  listTargets(
    @Session() session: UserSession,
    @Query() query: PatentTargetListQueryDto,
  ) {
    return this.service.listTargets(session.user.id, query);
  }

  @Post('targets/:targetId/approve')
  approveTarget(
    @Session() session: UserSession,
    @Param('targetId') targetId: string,
    @Body() body: PatentTargetDecisionDto,
  ) {
    return this.service.decideTarget(session.user.id, targetId, true, body);
  }

  @Post('targets/:targetId/reject')
  rejectTarget(
    @Session() session: UserSession,
    @Param('targetId') targetId: string,
    @Body() body: PatentTargetDecisionDto,
  ) {
    return this.service.decideTarget(session.user.id, targetId, false, body);
  }

  @Patch('targets/active/:targetName')
  modifyActiveTarget(
    @Session() session: UserSession,
    @Param('targetName') targetName: string,
    @Body() body: PatentTargetDecisionDto,
  ) {
    return this.service.modifyTarget(session.user.id, targetName, body);
  }

  @Post('targets/active/:targetName/delete')
  deleteActiveTarget(
    @Session() session: UserSession,
    @Param('targetName') targetName: string,
  ) {
    return this.service.deleteTarget(session.user.id, targetName);
  }
}
