import { BadGatewayException, BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CompoundSearchQueryDto } from './dto/compound-search-query.dto';
import { EmbodimentListQueryDto } from './dto/embodiment-list-query.dto';
import { EmbodimentSearchDto } from './dto/embodiment-search.dto';
import { PatentFavoriteDto, PatentFavoriteShareDto } from './dto/patent-favorite.dto';
import { PatentDetailQueryDto } from './dto/patent-detail-query.dto';
import { PatentInsightStatisticsDto } from './dto/patent-insight-statistics.dto';
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

type PatentFolderNode = {
  id?: string | number;
  folder_name?: string;
  children?: PatentFolderNode[];
  patents?: Record<string, unknown>[];
  [key: string]: unknown;
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

const assertSafeDynamicFilterKey = (value: string, label: string): string => {
  const normalized = value.trim();
  if (!normalized || /["'\\\u0000-\u001f]/.test(normalized)) {
    throw new BadRequestException(`${label} is invalid`);
  }
  return normalized;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const buildCompoundRangeFilterValue = (min?: number, max?: number): string | undefined => {
  const hasMin = typeof min === 'number' && Number.isFinite(min);
  const hasMax = typeof max === 'number' && Number.isFinite(max);
  if (!hasMin && !hasMax) return undefined;
  const lower = hasMin ? min : -1000000000000;
  const upper = hasMax ? max : 1000000000000;
  return `${lower}#${upper}`;
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

  const applicant = query.applicant?.trim();
  if (applicant) {
    addGroup([
      {
        filter_column: 'str#applicant',
        filter_condition: "%s ilike '%%%s%%'",
        filter_value: escapeFilterValue(applicant),
        filter_conjunction: 'and',
        filter_group_condition: '',
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
      filter_condition: "%s ilike '%%%s%%'",
      filter_value: escapeFilterValue(target),
      filter_conjunction: index === targets.length - 1 ? 'and' : 'or',
      filter_group_condition: '',
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
  private readonly favoriteFolderResolveLocks = new Map<string, Promise<string>>();
  private readonly favoriteFolderIdCache = new Map<string, string>();

  constructor(
    private readonly helperClient: PatentAnalysisHelperClient,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async getMyPatents(query: PatentListQueryDto) {
    const ownerId = this.getOwnerId(query.ownerId);
    const builtFilters = buildPatentListFilters(query);
    const favoriteFolderId = query.favoriteOnly
      ? await this.resolveDefaultFavoriteFolderId(ownerId)
      : undefined;
    const folderId = favoriteFolderId ?? query.folderId ?? '';
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
      folder_id: folderId,
      smiles: query.smiles,
      type: query.type,
      sim: query.sim,
    });
    return {
      items: (result.partial_rows ?? []).map((item) => this.annotateFavorite(item, query.favoriteOnly)),
      totalCount: getTotalCount(result.total_count ?? result.total_rows),
      raw: result,
    };
  }

  async addFavorite(body: PatentFavoriteDto) {
    const ownerId = this.getOwnerId(body.ownerId);
    const publicationNumber = body.publicationNumber?.trim();
    if (!publicationNumber) {
      throw new BadRequestException('publicationNumber is required');
    }
    const folderId = await this.resolveDefaultFavoriteFolderId(ownerId);
    const result = await this.helperClient.call<Record<string, unknown>>({
      owner_id: ownerId,
      actionType: 'ADD-PATENTS-TO-FOLDER',
      operation: 'ADD-PATENTS-TO-FOLDER',
      folder_id: folderId,
      selected_patent_list: JSON.stringify([publicationNumber]),
    });

    return {
      ok: true,
      ownerId,
      folderId,
      publicationNumber,
      raw: result,
    };
  }

  async getFavorites(query: Pick<PatentListQueryDto, 'ownerId'>) {
    const ownerId = this.getOwnerId(query.ownerId);
    const folders = await this.getFolderTrees(ownerId);
    const root = this.findDefaultWorkspaceRoot(folders.myList, ownerId);
    const ownerFolder = root
      ? this.findDirectFolder(root.children ?? [], ownerId)
      : null;
    const publicationNumbers = (ownerFolder?.patents ?? [])
      .map((patent) => String(patent.publication_number ?? patent.publicationNumber ?? '').trim())
      .filter(Boolean);

    return {
      ownerId,
      folderId: ownerFolder ? this.getFolderId(ownerFolder) : null,
      publicationNumbers,
    };
  }

  async removeFavorite(body: PatentFavoriteDto) {
    const ownerId = this.getOwnerId(body.ownerId);
    const publicationNumber = body.publicationNumber?.trim();
    if (!publicationNumber) {
      throw new BadRequestException('publicationNumber is required');
    }
    const folderId = await this.resolveDefaultFavoriteFolderId(ownerId);
    const result = await this.helperClient.call<Record<string, unknown>>({
      owner_id: ownerId,
      actionType: 'DELETE-PATENTS-FROM-FOLDER',
      operation: 'DELETE-PATENTS-FROM-FOLDER',
      folder_id: folderId,
      selected_patent_list: JSON.stringify([publicationNumber]),
    });

    return {
      ok: true,
      ownerId,
      folderId,
      publicationNumber,
      raw: result,
    };
  }

  async shareFavorites(body: PatentFavoriteShareDto) {
    const ownerId = this.getOwnerId(body.ownerId);
    const cc = body.cc?.trim();
    if (!cc) {
      throw new BadRequestException('cc is required');
    }
    const folderId = await this.resolveDefaultFavoriteFolderId(ownerId);
    const result = await this.helperClient.call<Record<string, unknown>>({
      owner_id: ownerId,
      actionType: 'SHARE-FOLDER',
      operation: 'SHARE-FOLDER',
      folder_id: folderId,
      cc,
    });

    return {
      ok: true,
      ownerId,
      folderId,
      cc,
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

  async downloadEmbodimentsExcel(
    publicationNumber: string,
    bioactivityType: string | undefined,
    query: PatentDetailQueryDto,
  ) {
    const ownerId = this.getOwnerId(query.ownerId);
    const resolvedBioactivityType = bioactivityType === 'modified_bioactivity'
      ? 'modified_bioactivity'
      : 'bioactivity';

    return this.helperClient.download({
      owner_id: ownerId,
      filter_conjunction: 'and',
      file_extension: 'xlsx',
      publication_number: publicationNumber,
      filter_dict: '{}',
      ligand_filter_dict: '[]',
      order_dict: JSON.stringify([
        { column_name: 'ranking', order: 'asc' },
        { column_name: 'ranking', order: 'asc' },
      ]),
      actionType: 'DOWNLOAD-EMBODIMENTS-EXCEL',
      operation: 'DOWNLOAD-EMBODIMENTS-EXCEL',
      filter_group_conjunction_list: '[]',
      bioactivity_type: resolvedBioactivityType,
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

  async searchEmbodiments(
    publicationNumber: string,
    body: EmbodimentSearchDto,
  ) {
    if (!/^[A-Za-z0-9_-]+$/.test(publicationNumber)) {
      throw new BadRequestException('publicationNumber is invalid');
    }
    if (
      body.rankingMin !== undefined
      && body.rankingMax !== undefined
      && body.rankingMin > body.rankingMax
    ) {
      throw new BadRequestException('rankingMin must be less than or equal to rankingMax');
    }
    if (
      body.bioactivity?.min !== undefined
      && body.bioactivity.max !== undefined
      && body.bioactivity.min > body.bioactivity.max
    ) {
      throw new BadRequestException('bioactivity.min must be less than or equal to bioactivity.max');
    }
    if (
      body.bioactivity
      && body.bioactivity.min === undefined
      && body.bioactivity.max === undefined
    ) {
      throw new BadRequestException('A bioactivity minimum or maximum value is required');
    }

    const ownerId = this.getOwnerId();
    if (body.bioactivity) {
      const detail = await this.helperClient.call<PatentDetailResult>({
        operation: 'GET-PATENT-DATA',
        publication_number: publicationNumber,
        owner_id: ownerId,
      });
      const metadata = detail.data?.[0] ?? {};
      const allowedBioactivityKeys = body.dataset === 'clean'
        ? metadata.modified_bioactivity_list
        : metadata.bioactivity_list;
      const bioactivityKey = assertSafeDynamicFilterKey(body.bioactivity.key, 'bioactivity.key');
      if (
        !Array.isArray(allowedBioactivityKeys)
        || !allowedBioactivityKeys.some((value) => String(value) === bioactivityKey)
      ) {
        throw new BadRequestException('bioactivity.key is not available for this patent');
      }
    }

    const filters: HelperFilter[] = [];
    const addFilter = (
      filterColumn: string,
      filterCondition: string,
      filterValue: string,
    ) => {
      filters.push({
        filter_column: filterColumn,
        filter_condition: filterCondition,
        filter_value: filterValue,
        filter_conjunction: 'and',
        filter_group_condition: '',
      });
    };

    if (body.humanKeyCompound !== undefined) {
      addFilter(
        'bool#is_human_key_compound',
        '%s = %s',
        body.humanKeyCompound ? 'true' : 'false',
      );
    }
    if (body.rankingMin !== undefined) {
      addFilter('num#ranking', '%s >= %s', String(body.rankingMin));
    }
    if (body.rankingMax !== undefined) {
      addFilter('num#ranking', '%s <= %s', String(body.rankingMax));
    }
    if (body.scaffoldRanking !== undefined) {
      addFilter('num#scaffold_ranking', '%s = %s', String(body.scaffoldRanking));
    }
    if (body.pageNumber !== undefined) {
      addFilter('num#page', '%s @> ARRAY[%s]', String(body.pageNumber));
    }
    if (body.bioactivity) {
      const key = assertSafeDynamicFilterKey(body.bioactivity.key, 'bioactivity.key');
      const column = body.dataset === 'clean' ? 'modified_bioactivity' : 'bioactivity';
      if (body.bioactivity.min !== undefined) {
        addFilter(`num#${column};;${key}`, '>=', String(body.bioactivity.min));
      }
      if (body.bioactivity.max !== undefined) {
        addFilter(`num#${column};;${key}`, '<=', String(body.bioactivity.max));
      }
    }
    if (body.scaffold?.trim()) {
      addFilter('str#scaffold', "%s ilike '%s'", escapeFilterValue(body.scaffold.trim()));
    }
    if (body.rGroup) {
      const rGroupKey = assertSafeDynamicFilterKey(body.rGroup.key, 'rGroup.key');
      addFilter(
        `str#r_group;;${rGroupKey}`,
        "%s ilike '%s'",
        escapeFilterValue(body.rGroup.value.trim()),
      );
    }

    const result = await this.helperClient.call<EmbodimentListResult>({
      operation: 'GET-EMBODIMENT-LIST',
      publication_number: publicationNumber,
      owner_id: ownerId,
      filter_dict: JSON.stringify(filters.length > 0 ? { preset: filters } : {}),
      ligand_filter_dict: '[]',
      order_dict: '[]',
      filter_group_conjunction_list: '[]',
      'num-rows-per-page': body.pageSize,
      'page-no': body.page,
      whose: 'my',
    });

    const items = body.dataset === 'clean'
      ? result.modified_partial_rows ?? []
      : result.partial_rows ?? [];
    const totalRows = body.dataset === 'clean'
      ? result.modified_total_rows
      : result.total_rows;

    return {
      dataset: body.dataset,
      page: body.page,
      pageSize: body.pageSize,
      items,
      totalCount: getTotalCount(totalRows),
    };
  }

  async getPatentInsightStatistics(body: PatentInsightStatisticsDto) {
    return this.callPatentInsightApi(
      '/get_all_statistics/',
      {
        applicant: body.applicant ?? '',
        from_date: body.from_date ?? '',
        to_date: body.to_date ?? '',
        top_n_applicant: body.top_n_applicant,
        top_n_target: body.top_n_target,
      },
      'GET',
    );
  }

  async refreshPatentInsightStatistics() {
    return this.callPatentInsightApi('/patent_statistics_refresh/', {});
  }

  private async resolveDefaultFavoriteFolderId(ownerId: string): Promise<string> {
    const existingLock = this.favoriteFolderResolveLocks.get(ownerId);
    if (existingLock) {
      return existingLock;
    }

    const lock = this.resolveDefaultFavoriteFolderIdUnsafe(ownerId)
      .finally(() => {
        if (this.favoriteFolderResolveLocks.get(ownerId) === lock) {
          this.favoriteFolderResolveLocks.delete(ownerId);
        }
      });

    this.favoriteFolderResolveLocks.set(ownerId, lock);
    return lock;
  }

  private async resolveDefaultFavoriteFolderIdUnsafe(ownerId: string): Promise<string> {
    const cachedFolderId = this.favoriteFolderIdCache.get(ownerId);
    if (cachedFolderId) {
      return cachedFolderId;
    }

    const folders = await this.getFolderTrees(ownerId);
    const root = this.findDefaultWorkspaceRoot(folders.myList, ownerId)
      ?? await this.createFolder(ownerId, 'myworkspace', '-1');
    const rootId = this.getFolderId(root);
    if (!rootId) {
      throw new BadGatewayException('Default favorite root folder id was not found');
    }

    const ownerFolder = this.findDirectFolder(root.children ?? [], ownerId)
      ?? await this.createFolder(ownerId, ownerId, rootId);
    const ownerFolderId = this.getFolderId(ownerFolder);
    if (!ownerFolderId) {
      throw new BadGatewayException('Default favorite folder id was not found');
    }
    this.favoriteFolderIdCache.set(ownerId, ownerFolderId);
    return ownerFolderId;
  }

  private annotateFavorite(
    item: unknown,
    forceFavorite?: boolean,
  ) {
    const record = asRecord(item);
    if (!record) return item;
    return {
      ...record,
      is_favorite: forceFavorite
        ? true
        : Boolean(record.is_favorite ?? record.favorite),
    };
  }

  private async getFolderTrees(ownerId: string): Promise<{
    myList: PatentFolderNode[];
    sharedList: PatentFolderNode[];
  }> {
    const result = await this.helperClient.call<PatentListResult>({
      actionType: 'GET-TARGET-LIST',
      operation: 'GET-TARGET-LIST',
      owner_id: ownerId,
      filter_conjunction: 'and',
    });
    const folders = asRecord(result.folders);
    return {
      myList: this.toFolderList(folders?.my_list),
      sharedList: this.toFolderList(folders?.shared_list),
    };
  }

  private async createFolder(
    ownerId: string,
    folderName: string,
    parentId: string,
  ): Promise<PatentFolderNode> {
    const result = await this.helperClient.call<PatentListResult>({
      owner_id: ownerId,
      actionType: 'ADD-FOLDER',
      operation: 'ADD-FOLDER',
      folder_name: folderName,
      parent_id: parentId,
    });
    const folders = asRecord(result.folders);
    const myList = this.toFolderList(folders?.my_list);
    const created = this.findFolderRecursive(myList, folderName);
    if (!created) {
      throw new BadGatewayException(`Created favorite folder "${folderName}" was not found`);
    }
    return created;
  }

  private toFolderList(value: unknown): PatentFolderNode[] {
    return Array.isArray(value)
      ? value.filter((item): item is PatentFolderNode => Boolean(asRecord(item)))
      : [];
  }

  private findDirectFolder(folders: PatentFolderNode[], folderName: string): PatentFolderNode | null {
    const normalizedFolderName = this.normalizeFolderName(folderName);
    return folders.find((folder) => this.normalizeFolderName(folder.folder_name) === normalizedFolderName) ?? null;
  }

  private findDefaultWorkspaceRoot(folders: PatentFolderNode[], ownerId: string): PatentFolderNode | null {
    const roots = folders.filter((folder) => this.normalizeFolderName(folder.folder_name) === 'myworkspace');
    return roots.find((folder) => this.findDirectFolder(folder.children ?? [], ownerId)) ?? roots[0] ?? null;
  }

  private findFolderRecursive(folders: PatentFolderNode[], folderName: string): PatentFolderNode | null {
    const normalizedFolderName = this.normalizeFolderName(folderName);
    for (const folder of folders) {
      if (this.normalizeFolderName(folder.folder_name) === normalizedFolderName) return folder;
      const found = this.findFolderRecursive(folder.children ?? [], folderName);
      if (found) return found;
    }
    return null;
  }

  private normalizeFolderName(value: unknown): string {
    return String(value ?? '').trim().replace(/\/+$/, '').toLowerCase();
  }

  private getFolderId(folder: PatentFolderNode): string | null {
    const id = folder.id;
    if (id === undefined || id === null || id === '') return null;
    return String(id);
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
    const rangeFilterValue = buildCompoundRangeFilterValue(query.rangeMin, query.rangeMax);
    return this.helperClient.call<CompoundSearchResult>({
      wasm: query.wasm,
      smiles: query.smiles,
      type: query.type,
      sim: query.sim,
      actionType: query.actionType,
      operation,
      page,
      size,
      order_by: query.orderBy,
      ...(query.rangeField && rangeFilterValue ? { [query.rangeField]: rangeFilterValue } : {}),
      owner_id: query.ownerId,
    });
  }

  private async callPatentInsightApi(
    path: string,
    body: Record<string, unknown>,
    method: 'GET' | 'POST' = 'POST',
  ) {
    const baseUrl = this.configService.get<string>(
      'patentAnalysis.insightApiUrl',
      'http://172.16.1.210:8000',
    ).replace(/\/$/, '');
    const timeoutMs = this.configService.get<number>('httpTimeoutMs', 30000);

    try {
      const url = `${baseUrl}${path}`;
      if (method === 'GET') {
        const response = await this.httpService.axiosRef.get(url, {
          params: body,
          timeout: timeoutMs,
        });
        return response.data;
      }

      const response = await this.httpService.axiosRef.post(url, body, {
        timeout: timeoutMs,
      });
      return response.data;
    } catch (error) {
      const errorRecord = asRecord(error);
      const responseRecord = asRecord(errorRecord?.response);
      const upstreamStatus = responseRecord?.status;
      const upstreamData = responseRecord?.data;
      const detail = {
        upstreamUrl: `${baseUrl}${path}`,
        method,
        upstreamStatus,
        upstreamData,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };

      this.logger.error('[PatentInsight] upstream request failed', JSON.stringify(detail));

      if (error instanceof Error) {
        throw new BadGatewayException({
          message: 'Failed to call patent insight API',
          detail,
        });
      }
      throw new BadGatewayException({
        message: 'Unknown patent insight API error',
        detail,
      });
    }
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
