import { Body, Controller, Post } from '@nestjs/common';
import { CompoundApiService } from './compound-api.service';
import { GetCompoundSarDataDto } from './dto/get-compound-sar-data.dto';
import { GetCompoundsDto } from './dto/get-compounds.dto';
import { SearchCompoundsDto } from './dto/search-compounds.dto';

@Controller('api/compound-api')
export class CompoundApiController {
  constructor(private readonly compoundApiService: CompoundApiService) {}

  @Post('search-compounds')
  searchCompounds(@Body() body: SearchCompoundsDto) {
    return this.compoundApiService.searchCompounds(body);
  }

  @Post('get-compounds')
  getCompounds(@Body() body: GetCompoundsDto) {
    return this.compoundApiService.getCompounds(body);
  }

  @Post('get-compound-sar-data')
  getCompoundSarData(@Body() body: GetCompoundSarDataDto) {
    return this.compoundApiService.getCompoundSarData(body);
  }
}
