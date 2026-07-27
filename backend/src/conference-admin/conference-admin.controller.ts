import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Roles } from '@thallesp/nestjs-better-auth';
import { ConferenceAdminService } from './conference-admin.service';
import { CreateAdminConferenceDto } from './dto/create-admin-conference.dto';
import { UpdateAdminConferenceDto } from './dto/update-admin-conference.dto';
import { CreateAdminConferenceAbstractDto } from './dto/create-admin-conference-abstract.dto';
import { UpdateAdminConferenceAbstractDto } from './dto/update-admin-conference-abstract.dto';

@Roles(['ADMIN'])
@Controller('api/admin')
export class ConferenceAdminController {
  constructor(private readonly conferences: ConferenceAdminService) {}

  @Get('conferences/options')
  listConferenceOptions() {
    return this.conferences.listConferenceOptions();
  }

  @Post('conferences')
  createConference(@Body() body: CreateAdminConferenceDto) {
    return this.conferences.createConference(body);
  }

  @Patch('conferences/:conferenceId')
  updateConference(
    @Param('conferenceId', new ParseUUIDPipe({ version: '4' })) conferenceId: string,
    @Body() body: UpdateAdminConferenceDto,
  ) {
    return this.conferences.updateConference(conferenceId, body);
  }

  @Post('conferences/:conferenceId/abstracts')
  createAbstract(
    @Param('conferenceId', new ParseUUIDPipe({ version: '4' })) conferenceId: string,
    @Body() body: CreateAdminConferenceAbstractDto,
  ) {
    return this.conferences.createAbstract(conferenceId, body);
  }

  @Patch('conference-abstracts/:abstractId')
  updateAbstract(
    @Param('abstractId', new ParseUUIDPipe({ version: '4' })) abstractId: string,
    @Body() body: UpdateAdminConferenceAbstractDto,
  ) {
    return this.conferences.updateAbstract(abstractId, body);
  }
}
