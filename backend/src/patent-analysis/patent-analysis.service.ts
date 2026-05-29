import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompoundSearchQueryDto } from './dto/compound-search-query.dto';
import { EmbodimentListQueryDto } from './dto/embodiment-list-query.dto';
import { PatentDetailQueryDto } from './dto/patent-detail-query.dto';
import { PatentListQueryDto } from './dto/patent-list-query.dto';
import { PatentAnalysisHelperClient } from './patent-analysis-helper.client';
import {
  CompoundSearchResult,
  EmbodimentListResult,
  PatentDetailResult,
  PatentListResult,
} from './types/patent-analysis-helper.types';

const fallbackJsonString = (value: string | undefined, fallback: string): string => {
  if (!value) return fallback;
  return value;
};

const STRUCTURE_SEARCH_MAX_RESULT_WINDOW = 10000;

type HelperFilter = {
  filter_column: string;
  filter_condition: string;
  filter_value: string;
  filter_conjunction: 'AND' | 'OR' | 'and' | 'or';
  filter_group_condition?: string;
};

type StructureSearchCompoundRow = {
  compoundId: string;
  svgImg: string;
  smiles: string;
  mw: unknown;
  logP: unknown;
  tpsa: unknown;
  patentCount: number;
  patents: unknown[];
};

const getTotalCount = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (Array.isArray(value)) {
    const first = value[0];
    if (first && typeof first === 'object' && 'total' in first) {
      return getTotalCount((first as { total?: unknown }).total);
    }
    return value.length;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if ('value' in record) {
      return getTotalCount(record.value);
    }
    if ('total' in record) {
      return getTotalCount(record.total);
    }
  }
  return 0;
};

const splitCsv = (value: string | undefined): string[] => {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const escapeFilterValue = (value: string): string => value.replace(/'/g, "''");

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const buildPatentListFilters = (query: PatentListQueryDto) => {
  const filterDict: Record<string, HelperFilter[]> = {};
  const conjunctions: string[] = [];
  let groupIndex = 1;

  const addGroup = (filters: HelperFilter[]) => {
    if (filters.length === 0) return;
    if (groupIndex > 1) conjunctions.push('AND');
    filterDict[`group_${groupIndex}`] = filters;
    groupIndex += 1;
  };

  const title = (query.title ?? query.keyword)?.trim();
  if (title) {
    addGroup([
      {
        filter_column: 'str#title',
        filter_condition: "%s ILIKE '%%%s%%'",
        filter_value: escapeFilterValue(title),
        filter_conjunction: 'AND',
      },
    ]);
  }

  const publicationNumber = query.publicationNumber?.trim();
  if (publicationNumber) {
    addGroup([
      {
        filter_column: 'str#p.publication_number',
        filter_condition: "%s ilike '%%%s%%'",
        filter_value: escapeFilterValue(publicationNumber),
        filter_conjunction: 'and',
        filter_group_condition: '',
      },
    ]);
  }

  const targets = splitCsv(query.target).filter((target) => target !== 'ALL');
  if (targets.length > 0) {
    addGroup(targets.map((target, index) => ({
      filter_column: 'str#target',
      filter_condition: "%s='%s'",
      filter_value: escapeFilterValue(target),
      filter_conjunction: index === targets.length - 1 ? 'AND' : 'OR',
    })));
  }

  const dateFilters: HelperFilter[] = [];
  if (query.dateFrom) {
    dateFilters.push({
      filter_column: 'str#publication_date',
      filter_condition: "%s>='%s'",
      filter_value: escapeFilterValue(query.dateFrom),
      filter_conjunction: 'AND',
    });
  }
  if (query.dateTo) {
    dateFilters.push({
      filter_column: 'str#publication_date',
      filter_condition: "%s<='%s'",
      filter_value: escapeFilterValue(query.dateTo),
      filter_conjunction: 'AND',
    });
  }
  addGroup(dateFilters);

  if (conjunctions.length > Math.max(Object.keys(filterDict).length - 1, 0)) {
    conjunctions.length = Math.max(Object.keys(filterDict).length - 1, 0);
  }

  return {
    filterDict,
    filterGroupConjunctions: conjunctions,
  };
};

@Injectable()
export class PatentAnalysisService {
  private readonly logger = new Logger(PatentAnalysisService.name);

  constructor(
    private readonly helperClient: PatentAnalysisHelperClient,
    private readonly configService: ConfigService,
  ) {}

  async getMyPatents(query: PatentListQueryDto) {
    const ownerId = this.getOwnerId(query.ownerId);
    const builtFilters = buildPatentListFilters(query);
    const result = await this.helperClient.call<PatentListResult>({
      actionType: 'GET-PATENT-LIST',
      operation: 'GET-PATENT-LIST',
      owner_id: ownerId,
      filter_conjunction: 'and',
      filter_dict: query.filter ?? JSON.stringify(builtFilters.filterDict),
      order_dict: fallbackJsonString(query.order, '[]'),
      filter_group_conjunction_list: JSON.stringify(builtFilters.filterGroupConjunctions),
      'num-rows-per-page': query.pageSize,
      'page-no': query.page,
      whose: 'my',
      folder_id: query.folderId ?? '',
      smiles: query.smiles,
      type: query.type,
      sim: query.sim,
    });

    return {
      items: result.partial_rows ?? [],
      totalCount: getTotalCount(result.total_count ?? result.total_rows),
      raw: result,
    };
  }

  async searchCompounds(query: CompoundSearchQueryDto) {
    const compoundPage = query.page;
    const compoundPageSize = query.compoundPageSize || query.size;
    const requestedOffset = (compoundPage - 1) * compoundPageSize;
    if (requestedOffset >= STRUCTURE_SEARCH_MAX_RESULT_WINDOW) {
      throw new BadRequestException(
        `Structure search supports compound pages within the first ${STRUCTURE_SEARCH_MAX_RESULT_WINDOW} Elasticsearch results.`,
      );
    }

    const operation = compoundPage > 1
      ? 'GET-ELASTIC-COMPOUND-LIST-BY-PAGE'
      : 'GET-ELASTIC-COMPOUND-LIST';

    this.logger.log(
      [
        '[StructureSearch] request',
        `compoundPage=${compoundPage}`,
        `compoundPageSize=${compoundPageSize}`,
        'loadMode=compound-page',
        `smiles=${query.smiles}`,
        `type=${query.type}`,
      ].join(' '),
    );

    const compoundSearchResult = await this.searchElasticCompounds(
      query,
      operation,
      compoundPage,
      compoundPageSize,
    );
    const compoundItems = this.getCompoundSearchItems(compoundSearchResult, query.type);
    const compoundTotalCount = this.getCompoundSearchTotalCount(compoundSearchResult, query.type);
    const patentCountByCompoundId = this.getCompoundSearchPatentCounts(compoundSearchResult, query.type);
    const compoundRows = compoundItems
      .map((item) => this.toStructureSearchCompoundRow(item, patentCountByCompoundId))
      .filter((item): item is StructureSearchCompoundRow => Boolean(item));
    const compoundIds = compoundRows.map((item) => item.compoundId);

    this.logger.log(
      [
        '[StructureSearch] response',
        `compoundPage=${compoundPage}`,
        `items=${compoundRows.length}`,
        `compoundTotal=${compoundTotalCount}`,
        `compoundIds=${compoundIds.length}`,
      ].join(' '),
    );

    return {
      items: compoundRows,
      totalCount: compoundTotalCount,
      raw: {
        compoundIds,
        compoundTotalCount,
        helperOperation: operation,
        pagination: {
          mode: 'compound',
          currentPage: compoundPage,
          pageSize: compoundPageSize,
          totalCountExact: true,
        },
        proof: {
          helperOperation: operation,
          smiles: query.smiles,
          type: query.type,
          compoundPage,
          compoundPageSize,
          compoundTotalCount,
          searchedCompoundCount: compoundIds.length,
        },
      },
    };
  }

  async getPatentsByCompoundId(compoundId: string) {
    const result = await this.helperClient.call<PatentListResult>({
      compound_id: compoundId,
      actionType: 'GET-PATENT-LIST-BY-COMPOUND-ID',
      operation: 'GET-PATENT-LIST-BY-COMPOUND-ID',
    });

    const items = this.getPatentRows(result);
    return {
      compoundId,
      items,
      totalCount: items.length,
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

  async downloadPatentPdf(publicationNumber: string, query: PatentDetailQueryDto) {
    const ownerId = this.getOwnerId(query.ownerId);
    const detail = await this.helperClient.call<PatentDetailResult>({
      operation: 'GET-PATENT-DATA',
      publication_number: publicationNumber,
      owner_id: ownerId,
    });
    const metadata = detail.data?.[0] ?? {};
    const filePath = this.getPdfPath(metadata);

    if (!filePath) {
      throw new NotFoundException('PDF file path was not found');
    }

    return this.helperClient.download({
      operation: 'DOWNLOAD-FILE',
      actionType: 'DOWNLOAD-FILE',
      file_path: filePath,
      file_extension: 'pdf',
    });
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
      totalCount: getTotalCount(result.total_rows),
      modifiedItems: result.modified_partial_rows ?? [],
      modifiedTotalCount: getTotalCount(result.modified_total_rows),
      raw: result,
    };
  }

  private getOwnerId(ownerId?: string): string {
    return (
      ownerId ??
      this.configService.get<string>('patentAnalysis.ownerId', '171')
    );
  }

  private getPdfPath(metadata: Record<string, unknown>): string | null {
    const value = metadata.ocr_pdf_path ?? metadata.pdf_path ?? metadata.pdf_url;
    if (typeof value !== 'string' || !value.trim()) {
      return null;
    }
    return value.trim();
  }

  private getCompoundSearchItems(result: CompoundSearchResult, type: string): unknown[] {
    const typedItems = result[type];
    if (Array.isArray(typedItems)) {
      return typedItems;
    }
    const typedRecord = asRecord(typedItems);
    if (Array.isArray(typedRecord?.compounds_to_display)) {
      return this.mergeCompoundDisplayItems(
        typedRecord.compounds_to_display,
        asRecord(typedRecord?.hits)?.hits,
      );
    }
    const typedHits = asRecord(typedRecord?.hits);
    if (Array.isArray(typedHits?.hits)) {
      return typedHits.hits;
    }

    const fallbackKeys = ['substructure', 'identical', 'similarity', 'pattern', 'bm', 'csk'];
    for (const key of fallbackKeys) {
      const value = result[key];
      if (Array.isArray(value)) {
        return value;
      }
      const record = asRecord(value);
      if (Array.isArray(record?.compounds_to_display)) {
        return this.mergeCompoundDisplayItems(
          record.compounds_to_display,
          asRecord(record?.hits)?.hits,
        );
      }
      const hits = asRecord(record?.hits);
      if (Array.isArray(hits?.hits)) {
        return hits.hits;
      }
    }

    return [];
  }

  private mergeCompoundDisplayItems(displayItems: unknown[], hitItems: unknown): unknown[] {
    if (!Array.isArray(hitItems)) {
      return displayItems;
    }

    const hitByCompoundId = new Map<string, Record<string, unknown>>();
    hitItems.forEach((item) => {
      const hitRecord = asRecord(item);
      const hitSource = asRecord(hitRecord?._source) ?? {};
      const compoundId = this.getStringValue(
        hitSource.compound_id
          ?? hitSource.id
          ?? hitRecord?._id,
      );

      if (compoundId) {
        hitByCompoundId.set(compoundId, hitRecord ?? {});
      }
    });

    return displayItems.map((item) => {
      const displayRecord = asRecord(item) ?? {};
      const compoundId = this.getStringValue(
        displayRecord.compound_id
          ?? displayRecord.id
          ?? displayRecord._id,
      );
      const hitRecord = hitByCompoundId.get(compoundId);
      if (!hitRecord) {
        return item;
      }

      const hitSource = asRecord(hitRecord._source) ?? {};
      return {
        ...hitRecord,
        ...displayRecord,
        _source: {
          ...hitSource,
          ...displayRecord,
        },
      };
    });
  }

  private getCompoundSearchTotalCount(result: CompoundSearchResult, type: string): number {
    const typedRecord = asRecord(result[type]);
    const typedHits = asRecord(typedRecord?.hits);
    const typedTotal = getTotalCount(
      typedHits?.total
        ?? typedRecord?.total
        ?? typedRecord?.total_count
        ?? typedRecord?.total_rows,
    );
    if (typedTotal > 0) {
      return typedTotal;
    }

    return getTotalCount(result.total_count ?? result.total_rows);
  }

  private getCompoundSearchPatentCounts(
    result: CompoundSearchResult,
    type: string,
  ): Record<string, number> {
    const typedRecord = asRecord(result[type]);
    const numPerPatent = asRecord(typedRecord?.num_per_patent);
    const counts: Record<string, number> = {};

    Object.entries(numPerPatent ?? {}).forEach(([compoundId, count]) => {
      const parsed = Number(count);
      if (Number.isFinite(parsed)) {
        counts[String(compoundId)] = parsed;
      }
    });

    return counts;
  }

  private async searchElasticCompounds(
    query: CompoundSearchQueryDto,
    operation: string,
    page: number,
    size: number,
  ): Promise<CompoundSearchResult> {
    return this.helperClient.call<CompoundSearchResult>({
      wasm: query.wasm,
      smiles: query.smiles,
      type: query.type,
      sim: query.sim,
      actionType: query.actionType,
      operation,
      page,
      size,
      owner_id: query.ownerId,
    });
  }

  private toStructureSearchCompoundRow(
    item: unknown,
    patentCountByCompoundId: Record<string, number>,
  ): StructureSearchCompoundRow | null {
    const record = asRecord(item);
    const source = asRecord(record?._source) ?? asRecord(record?.source) ?? record;
    const compoundId = this.getStringValue(
      source?.compound_id
        ?? source?.id
        ?? source?._id
        ?? record?._id,
    );

    if (!compoundId) {
      return null;
    }

    return {
      compoundId,
      svgImg: this.getStringValue(source?.svg_img ?? source?.svgImg),
      smiles: this.getStringValue(source?.smiles ?? source?.canonical_smiles),
      mw: source?.mw ?? source?.molecular_weight ?? null,
      logP: source?.log_p ?? source?.logP ?? null,
      tpsa: source?.tpsa ?? source?.topological_polar_surface_area ?? null,
      patentCount: patentCountByCompoundId[compoundId] ?? 0,
      patents: [],
    };
  }

  private getStringValue(value: unknown): string {
    if (value === undefined || value === null) {
      return '';
    }
    return String(value).trim();
  }

  private getPatentRows(result: PatentListResult): unknown[] {
    return result.partial_rows ?? result.data ?? [];
  }
}
