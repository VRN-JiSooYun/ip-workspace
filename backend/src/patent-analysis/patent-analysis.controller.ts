import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { CompoundSearchQueryDto } from './dto/compound-search-query.dto';
import { EmbodimentListQueryDto } from './dto/embodiment-list-query.dto';
import { PatentFavoriteDto, PatentFavoriteShareDto } from './dto/patent-favorite.dto';
import { PatentDetailQueryDto } from './dto/patent-detail-query.dto';
import { PatentInsightStatisticsDto } from './dto/patent-insight-statistics.dto';
import { PatentListQueryDto } from './dto/patent-list-query.dto';
import { PatentAnalysisService } from './patent-analysis.service';

@Controller('api/patents')
export class PatentAnalysisController {
  constructor(private readonly patentAnalysisService: PatentAnalysisService) {}

  @Get('my')
  getMyPatents(@Query() query: PatentListQueryDto) {
    return this.patentAnalysisService.getMyPatents(query);
  }

  @Get('favorites')
  getFavorites(@Query() query: PatentListQueryDto) {
    return this.patentAnalysisService.getFavorites(query);
  }

  @Post('favorites')
  addFavorite(@Body() body: PatentFavoriteDto) {
    return this.patentAnalysisService.addFavorite(body);
  }

  @Post('favorites/remove')
  removeFavorite(@Body() body: PatentFavoriteDto) {
    return this.patentAnalysisService.removeFavorite(body);
  }

  @Post('favorites/share')
  shareFavorites(@Body() body: PatentFavoriteShareDto) {
    return this.patentAnalysisService.shareFavorites(body);
  }

  @Get('compound-search')
  searchCompounds(@Query() query: CompoundSearchQueryDto) {
    return this.patentAnalysisService.searchCompounds(query);
  }

  @Get('compounds/:compoundId/patents')
  getPatentsByCompoundId(@Param('compoundId') compoundId: string) {
    return this.patentAnalysisService.getPatentsByCompoundId(compoundId);
  }

  @Post('insight/statistics')
  getPatentInsightStatistics(@Body() body: PatentInsightStatisticsDto) {
    return this.patentAnalysisService.getPatentInsightStatistics(body);
  }

  @Post('insight/refresh')
  refreshPatentInsightStatistics() {
    return this.patentAnalysisService.refreshPatentInsightStatistics();
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

  @Get(':publicationNumber/embodiments/excel')
  async downloadEmbodimentsExcel(
    @Param('publicationNumber') publicationNumber: string,
    @Query() query: PatentDetailQueryDto,
    @Res() response: Response,
  ) {
    const helperResponse = await this.patentAnalysisService.downloadEmbodimentsExcel(
      publicationNumber,
      query.bioactivityType,
      query,
    );
    const suffix = query.bioactivityType === 'modified_bioactivity' ? 'clean_data' : 'raw_data';
    const filename = `${publicationNumber.replace(/[^A-Za-z0-9_-]/g, '_')}_${suffix}_embodiments.xlsx`;
    const contentTypeHeader = helperResponse.headers['content-type'];
    const contentType = typeof contentTypeHeader === 'string'
      ? contentTypeHeader
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    response.setHeader('Content-Type', contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    helperResponse.data.pipe(response);
  }

  @Get(':publicationNumber/embodiments')
  getEmbodiments(
    @Param('publicationNumber') publicationNumber: string,
    @Query() query: EmbodimentListQueryDto,
  ) {
    return this.patentAnalysisService.getEmbodiments(publicationNumber, query);
  }

  @Get(':publicationNumber')
  getPatentDetail(
    @Param('publicationNumber') publicationNumber: string,
    @Query() query: PatentDetailQueryDto,
  ) {
    return this.patentAnalysisService.getPatentDetail(publicationNumber, query);
  }
}
