import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { PatentSearchClient } from "./patent-search.client";
import { PatentSearchController } from "./patent-search.controller";
import { PatentSearchService } from "./patent-search.service";

@Module({
  imports: [HttpModule],
  controllers: [PatentSearchController],
  providers: [PatentSearchClient, PatentSearchService],
  exports: [PatentSearchService],
})
export class PatentSearchModule {}
