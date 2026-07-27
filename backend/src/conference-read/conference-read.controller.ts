import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { ConferenceReadService } from './conference-read.service';
import { ConferenceAbstractListQueryDto } from './dto/conference-abstract-list-query.dto';
import { ConferenceListQueryDto } from './dto/conference-list-query.dto';

@Controller('api')
export class ConferenceReadController {
  constructor(private readonly conferences: ConferenceReadService) {}

  @Get('conferences')
  listConferences(
    @Session() session: UserSession,
    @Query() query: ConferenceListQueryDto,
  ) {
    return this.conferences.listConferences(session.user.id, query);
  }

  @Get('conferences/:conferenceId')
  getConference(
    @Session() session: UserSession,
    @Param('conferenceId', new ParseUUIDPipe({ version: '4' })) conferenceId: string,
  ) {
    return this.conferences.getConference(session.user.id, conferenceId);
  }

  @Get('conferences/:conferenceId/abstracts')
  listAbstracts(
    @Session() session: UserSession,
    @Param('conferenceId', new ParseUUIDPipe({ version: '4' })) conferenceId: string,
    @Query() query: ConferenceAbstractListQueryDto,
  ) {
    return this.conferences.listAbstracts(session.user.id, conferenceId, query);
  }

  @Get('conference-abstracts/:abstractId')
  getAbstract(
    @Session() session: UserSession,
    @Param('abstractId', new ParseUUIDPipe({ version: '4' })) abstractId: string,
  ) {
    return this.conferences.getAbstract(session.user.id, abstractId);
  }
}
