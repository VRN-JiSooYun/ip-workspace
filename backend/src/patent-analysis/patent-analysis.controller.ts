import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { CompoundSearchQueryDto } from './dto/compound-search-query.dto';
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

  @Get('compound-search')
  searchCompounds(@Query() query: CompoundSearchQueryDto) {
    return this.patentAnalysisService.searchCompounds(query);
  }

  @Get('compounds/:compoundId/patents')
  getPatentsByCompoundId(@Param('compoundId') compoundId: string) {
    return this.patentAnalysisService.getPatentsByCompoundId(compoundId);
  }

  @Get(':publicationNumber')
  getPatentDetail(
    @Param('publicationNumber') publicationNumber: string,
    @Query() query: PatentDetailQueryDto,
  ) {
    return this.patentAnalysisService.getPatentDetail(publicationNumber, query);
  }

  @Get(':publicationNumber/pdf')
  async downloadPatentPdf(
    @Param('publicationNumber') publicationNumber: string,
    @Query() query: PatentDetailQueryDto,
    @Res() response: Response,
  ) {
    const helperResponse = await this.patentAnalysisService.downloadPatentPdf(publicationNumber, query);
    const filename = `${publicationNumber.replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`;
    const contentTypeHeader = helperResponse.headers['content-type'];
    const contentType = typeof contentTypeHeader === 'string'
      ? contentTypeHeader
      : 'application/pdf';

    response.setHeader('Content-Type', contentType);
    response.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    helperResponse.data.pipe(response);
  }

  @Get(':publicationNumber/embodiments')
  getEmbodiments(
    @Param('publicationNumber') publicationNumber: string,
    @Query() query: EmbodimentListQueryDto,
  ) {
    return this.patentAnalysisService.getEmbodiments(publicationNumber, query);
  }
}
