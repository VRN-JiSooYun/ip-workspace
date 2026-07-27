import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '@thallesp/nestjs-better-auth';
import { ConferenceMailAdminService } from './conference-mail-admin.service';
import { ConferenceMailOutboxListQueryDto } from './dto/conference-mail-outbox-list-query.dto';

@Roles(['ADMIN'])
@Controller('api/admin/conference-mail-outbox')
export class ConferenceMailAdminController {
  constructor(private readonly mail: ConferenceMailAdminService) {}

  @Get('health')
  health() {
    return this.mail.health();
  }

  @Get()
  list(@Query() query: ConferenceMailOutboxListQueryDto) {
    return this.mail.list(query);
  }

  @Post(':outboxId/retry')
  retry(
    @Param('outboxId', new ParseUUIDPipe({ version: '4' })) outboxId: string,
  ) {
    return this.mail.retry(outboxId);
  }
}
