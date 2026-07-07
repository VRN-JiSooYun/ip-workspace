import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { CompoundApiController } from './compound-api.controller';
import { CompoundApiService } from './compound-api.service';

@Module({
  imports: [HttpModule],
  controllers: [CompoundApiController],
  providers: [CompoundApiService],
})
export class CompoundApiModule {}
