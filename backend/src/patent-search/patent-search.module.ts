import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { PatentSearchClient } from "./patent-search.client";
import { PatentSearchController } from "./patent-search.controller";
import { PatentSearchIndexService } from "./patent-search-index.service";
import { PatentSearchMatchesService } from "./patent-search-matches.service";
import { PatentSearchService } from "./patent-search.service";

@Module({
  imports: [HttpModule],
  controllers: [PatentSearchController],
  providers: [
    PatentSearchClient,
    PatentSearchService,
    PatentSearchIndexService,
    PatentSearchMatchesService,
  ],
  exports: [PatentSearchService],
})
export class PatentSearchModule {}
