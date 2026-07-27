import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConferenceMediaController } from './conference-media.controller';
import { ConferenceMediaService } from './conference-media.service';

@Module({
  imports: [HttpModule],
  controllers: [ConferenceMediaController],
  providers: [ConferenceMediaService],
  exports: [ConferenceMediaService],
})
export class ConferenceMediaModule {}
