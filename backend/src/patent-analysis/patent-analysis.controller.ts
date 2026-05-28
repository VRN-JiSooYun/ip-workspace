import { Controller, Get, Param, Query } from '@nestjs/common';
import { EmbodimentListQueryDto } from './dto/embodiment-list-query.dto';
import { PatentDetailQueryDto } from './dto/patent-detail-query.dto';
import { PatentListQueryDto } from './dto/patent-list-query.dto';
import { PatentAnalysisService } from './patent-analysis.service';

@Controller('api/patents')
export class PatentAnalysisController {
  constructor(private readonly patentAnalysisService: PatentAnalysisService) {}

  @Get('my')
  getMyPatents(@Query() query: PatentListQueryDto) {
    return this.patentAnalysisService.getMyPatents(query);
  }

  @Get(':publicationNumber')
  getPatentDetail(
    @Param('publicationNumber') publicationNumber: string,
    @Query() query: PatentDetailQueryDto,
  ) {
    return this.patentAnalysisService.getPatentDetail(publicationNumber, query);
  }

  @Get(':publicationNumber/embodiments')
  getEmbodiments(
    @Param('publicationNumber') publicationNumber: string,
    @Query() query: EmbodimentListQueryDto,
  ) {
    return this.patentAnalysisService.getEmbodiments(publicationNumber, query);
  }
}
