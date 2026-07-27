import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { ConferenceInteractionService } from './conference-interaction.service';
import { CreateConferenceCommentDto } from './dto/create-conference-comment.dto';
import { RecipientSearchQueryDto } from './dto/recipient-search-query.dto';

@Controller('api')
export class ConferenceInteractionController {
  constructor(private readonly interactions: ConferenceInteractionService) {}

  @Put('conference-abstracts/:abstractId/bookmark')
  bookmarkAbstract(
    @Session() session: UserSession,
    @Param('abstractId', new ParseUUIDPipe({ version: '4' })) abstractId: string,
  ) {
    return this.interactions.setAbstractBookmark(session.user.id, abstractId, true);
  }

  @Delete('conference-abstracts/:abstractId/bookmark')
  unbookmarkAbstract(
    @Session() session: UserSession,
    @Param('abstractId', new ParseUUIDPipe({ version: '4' })) abstractId: string,
  ) {
    return this.interactions.setAbstractBookmark(session.user.id, abstractId, false);
  }

  @Get('notification-recipients/search')
  searchRecipients(
    @Session() session: UserSession,
    @Query() query: RecipientSearchQueryDto,
  ) {
    return this.interactions.searchRecipients(session.user.id, query);
  }

  @Post('conference-abstracts/:abstractId/comments')
  createComment(
    @Session() session: UserSession,
    @Param('abstractId', new ParseUUIDPipe({ version: '4' })) abstractId: string,
    @Body() body: CreateConferenceCommentDto,
  ) {
    return this.interactions.createComment(session.user.id, abstractId, body);
  }

  @Delete('conference-abstract-comments/:commentId')
  deleteComment(
    @Session() session: UserSession,
    @Param('commentId', new ParseUUIDPipe({ version: '4' })) commentId: string,
  ) {
    return this.interactions.deleteComment(
      session.user.id,
      String(session.user.role ?? 'USER'),
      commentId,
    );
  }
}
