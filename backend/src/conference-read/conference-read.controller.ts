import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { ConferenceReadService } from './conference-read.service';
import { ConferenceAbstractSearchQueryDto } from './dto/conference-abstract-search-query.dto';

@Controller('api')
export class ConferenceReadController {
  constructor(private readonly conferences: ConferenceReadService) {}

  @Get('conference-abstracts')
  searchAbstracts(
    @Session() session: UserSession,
    @Query() query: ConferenceAbstractSearchQueryDto,
  ) {
    return this.conferences.searchAbstracts(session.user.id, query);
  }

  @Get('conferences/:conferenceId')
  getConference(
    @Param('conferenceId', new ParseUUIDPipe({ version: '4' })) conferenceId: string,
  ) {
    return this.conferences.getConference(conferenceId);
  }

  @Get('conference-abstracts/:abstractId')
  getAbstract(
    @Session() session: UserSession,
    @Param('abstractId', new ParseUUIDPipe({ version: '4' })) abstractId: string,
  ) {
    return this.conferences.getAbstract(session.user.id, abstractId);
  }
}
