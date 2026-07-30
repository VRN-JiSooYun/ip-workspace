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
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import { ConferenceInteractionService } from './conference-interaction.service';
import { CreateConferenceCommentDto } from './dto/create-conference-comment.dto';
import { RecipientSearchQueryDto } from './dto/recipient-search-query.dto';
import { WorkspaceAccess } from '../authorization/workspace-access.decorator';
import type { WorkspaceAccessContext } from '../authorization/workspace-authorization.service';
import { WorkspaceAuthorizationService } from '../authorization/workspace-authorization.service';
import { organizationIdForScope } from '../authorization/workspace-data-scope';

@RequirePermissions('conference.read')
@Controller('api')
export class ConferenceInteractionController {
  constructor(
    private readonly interactions: ConferenceInteractionService,
    private readonly authorization: WorkspaceAuthorizationService,
  ) {}

  @Put('conference-abstracts/:abstractId/bookmark')
  bookmarkAbstract(
    @Session() session: UserSession,
    @WorkspaceAccess() access: WorkspaceAccessContext,
    @Param('abstractId', new ParseUUIDPipe({ version: '4' })) abstractId: string,
  ) {
    return this.interactions.setAbstractBookmark(
      session.user.id,
      abstractId,
      true,
      this.organizationId(access),
    );
  }

  @Delete('conference-abstracts/:abstractId/bookmark')
  unbookmarkAbstract(
    @Session() session: UserSession,
    @WorkspaceAccess() access: WorkspaceAccessContext,
    @Param('abstractId', new ParseUUIDPipe({ version: '4' })) abstractId: string,
  ) {
    return this.interactions.setAbstractBookmark(
      session.user.id,
      abstractId,
      false,
      this.organizationId(access),
    );
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
    @WorkspaceAccess() access: WorkspaceAccessContext,
    @Param('abstractId', new ParseUUIDPipe({ version: '4' })) abstractId: string,
    @Body() body: CreateConferenceCommentDto,
  ) {
    return this.interactions.createComment(
      session.user.id,
      abstractId,
      body,
      this.organizationId(access),
    );
  }

  @Delete('conference-abstract-comments/:commentId')
  deleteComment(
    @Session() session: UserSession,
    @WorkspaceAccess() access: WorkspaceAccessContext,
    @Param('commentId', new ParseUUIDPipe({ version: '4' })) commentId: string,
  ) {
    return this.interactions.deleteComment(
      session.user.id,
      commentId,
      this.organizationId(access),
    );
  }

  private organizationId(access: WorkspaceAccessContext): string | undefined {
    return organizationIdForScope(
      this.authorization.resolveDataScope(access, 'conference'),
    );
  }
}
