import { Controller, Get, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ConferenceMediaService } from './conference-media.service';

@Controller('api/conference-assets')
export class ConferenceMediaController {
  constructor(private readonly conferenceMedia: ConferenceMediaService) {}

  @Get(':assetId/content')
  async getContent(
    @Param('assetId', new ParseUUIDPipe({ version: '4' })) assetId: string,
    @Res() response: Response,
  ): Promise<void> {
    const target = await this.conferenceMedia.getContentTarget(assetId);
    response.redirect(302, target.url);
  }

  @Get(':assetId/download')
  async download(
    @Param('assetId', new ParseUUIDPipe({ version: '4' })) assetId: string,
    @Res() response: Response,
  ): Promise<void> {
    await this.conferenceMedia.pipeDownload(assetId, response);
  }
}
