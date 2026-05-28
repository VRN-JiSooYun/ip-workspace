import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbodimentListQueryDto } from './dto/embodiment-list-query.dto';
import { PatentDetailQueryDto } from './dto/patent-detail-query.dto';
import { PatentListQueryDto } from './dto/patent-list-query.dto';
import { PatentAnalysisHelperClient } from './patent-analysis-helper.client';
import {
  EmbodimentListResult,
  PatentDetailResult,
  PatentListResult,
} from './types/patent-analysis-helper.types';

const fallbackJsonString = (value: string | undefined, fallback: string): string => {
  if (!value) return fallback;
  return value;
};

@Injectable()
export class PatentAnalysisService {
  constructor(
    private readonly helperClient: PatentAnalysisHelperClient,
    private readonly configService: ConfigService,
  ) {}

  async getMyPatents(query: PatentListQueryDto) {
    const ownerId = this.getOwnerId(query.ownerId);
    const result = await this.helperClient.call<PatentListResult>({
      operation: 'GET-PATENT-LIST',
      owner_id: ownerId,
      filter_dict: fallbackJsonString(query.filter, '{}'),
      order_dict: fallbackJsonString(query.order, '[]'),
      filter_group_conjunction_list: '[]',
      'num-rows-per-page': query.pageSize,
      'page-no': query.page,
      whose: 'my',
      folder_id: query.folderId ?? '',
    });

    return {
      items: result.partial_rows ?? [],
      totalCount: result.total_count ?? result.total_rows ?? 0,
      raw: result,
    };
  }

  async getPatentDetail(
    publicationNumber: string,
    query: PatentDetailQueryDto,
  ) {
    const ownerId = this.getOwnerId(query.ownerId);
    const result = await this.helperClient.call<PatentDetailResult>({
      operation: 'GET-PATENT-DATA',
      publication_number: publicationNumber,
      owner_id: ownerId,
    });

    return {
      publicationNumber,
      metadata: result.data?.[0] ?? null,
      compounds: result.patent_compound ?? [],
      modifiedCompounds: result.modified_patent_compound ?? [],
      tables: result.tables ?? null,
      raw: result,
    };
  }

  async getEmbodiments(
    publicationNumber: string,
    query: EmbodimentListQueryDto,
  ) {
    const ownerId = this.getOwnerId(query.ownerId);
    const result = await this.helperClient.call<EmbodimentListResult>({
      operation: 'GET-EMBODIMENT-LIST',
      publication_number: publicationNumber,
      owner_id: ownerId,
      filter_dict: fallbackJsonString(query.filter, '{}'),
      ligand_filter_dict: fallbackJsonString(query.ligandFilter, '[]'),
      order_dict: fallbackJsonString(query.order, '[]'),
      filter_group_conjunction_list: '[]',
      'num-rows-per-page': query.pageSize,
      'page-no': query.page,
      whose: 'my',
    });

    return {
      items: result.partial_rows ?? [],
      totalCount: result.total_rows ?? 0,
      modifiedItems: result.modified_partial_rows ?? [],
      modifiedTotalCount: result.modified_total_rows ?? 0,
      raw: result,
    };
  }

  private getOwnerId(ownerId?: string): string {
    return (
      ownerId ??
      this.configService.get<string>('patentAnalysis.ownerId', '171')
    );
  }
}
