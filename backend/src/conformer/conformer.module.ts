import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConformerController } from './conformer.controller';
import { ConformerService } from './conformer.service';

@Module({
  imports: [HttpModule],
  controllers: [ConformerController],
  providers: [ConformerService],
})
export class ConformerModule {}
