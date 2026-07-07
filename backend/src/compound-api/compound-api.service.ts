import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { GetCompoundSarDataDto } from './dto/get-compound-sar-data.dto';
import { GetCompoundsDto } from './dto/get-compounds.dto';
import { SearchCompoundsDto } from './dto/search-compounds.dto';
import {
  CompoundSearchItem,
  GetCompoundsResponse,
  GroupedCompoundSarData,
  CompoundSarDataRow,
} from './types/compound-api.types';

@Injectable()
export class CompoundApiService {
  private readonly apiUrl: string;
  private readonly authToken: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl = this.configService.get<string>('compoundApi.apiUrl', 'http://172.16.1.32:10050');
    this.authToken = this.configService.get<string>('compoundApi.authToken', '');
    this.timeoutMs = this.configService.get<number>('compoundApi.timeoutMs', 30000);
  }

  async searchCompounds(body: SearchCompoundsDto): Promise<CompoundSearchItem[]> {
    const query = body.query?.trim() ?? '';
    if (!query) return [];

    const data = await this.postExternal<CompoundSearchItem[]>('/search_compounds', {
      login_token: body.login_token,
      project: [],
      keyword: '',
      smiles: '',
      mol_block: '',
      search_type: 'substructure',
      similarity_range_start: 0,
      similarity_range_end: 100,
    });

    return this.filterCompoundSearchItems(Array.isArray(data) ? data : [], query);
  }

  async getCompounds(body: GetCompoundsDto): Promise<GetCompoundsResponse> {
    return this.postExternal<GetCompoundsResponse>('/get_compounds', {
      login_token: body.login_token,
      compounds: this.normalizeCompoundCodes(body.compounds),
      type: body.type ?? 'smiles',
    });
  }

  async getCompoundSarData(body: GetCompoundSarDataDto): Promise<{
    rows: CompoundSarDataRow[];
    groups: GroupedCompoundSarData[];
  }> {
    const data = await this.postExternal<CompoundSarDataRow[]>('/get_compound_sar_data', {
      login_token: body.login_token,
      compounds: this.normalizeCompoundCodes(body.compounds),
    });
    const rows = Array.isArray(data) ? data : [];

    return {
      rows,
      groups: this.groupSarRows(rows),
    };
  }

  private async postExternal<T>(path: string, payload: Record<string, unknown>): Promise<T> {
    if (!this.authToken.trim()) {
      throw new BadRequestException('Compound API authorization token is not configured.');
    }

    try {
      const response = await this.httpService.axiosRef.post<T>(
        `${this.apiUrl.replace(/\/$/, '')}${path}`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.authToken}`,
          },
          timeout: this.timeoutMs,
          maxBodyLength: Infinity,
        },
      );

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: unknown }>;
      const upstreamStatus = axiosError.response?.status;
      const upstreamMessage = axiosError.response?.data?.message;
      throw new BadGatewayException({
        message: 'Failed to request compound API.',
        upstreamStatus,
        detail: typeof upstreamMessage === 'string' ? upstreamMessage : axiosError.message,
      });
    }
  }

  private normalizeCompoundCodes(compounds: string[]) {
    const normalized = Array.from(new Set(
      compounds
        .map((compound) => compound.trim())
        .filter(Boolean),
    ));

    if (normalized.length === 0) {
      throw new BadRequestException('At least one compound code is required.');
    }

    return normalized;
  }

  private filterCompoundSearchItems(items: CompoundSearchItem[], query: string) {
    const normalizedQuery = query.toLowerCase();

    return [...items]
      .filter((item) => item.compound_code?.toLowerCase().includes(normalizedQuery))
      .sort((first, second) => {
        const firstCode = first.compound_code.toLowerCase();
        const secondCode = second.compound_code.toLowerCase();
        const firstPrefix = firstCode.startsWith(normalizedQuery);
        const secondPrefix = secondCode.startsWith(normalizedQuery);
        if (firstPrefix !== secondPrefix) return firstPrefix ? -1 : 1;
        return firstCode.localeCompare(secondCode);
      });
  }

  private groupSarRows(rows: CompoundSarDataRow[]): GroupedCompoundSarData[] {
    const groups = new Map<string, CompoundSarDataRow[]>();

    rows.forEach((row) => {
      const compoundCode = typeof row.compound_code === 'string' ? row.compound_code : '';
      if (!compoundCode) return;
      groups.set(compoundCode, [...(groups.get(compoundCode) ?? []), row]);
    });

    return Array.from(groups.entries()).map(([compound_code, groupedRows]) => ({
      compound_code,
      rows: groupedRows,
    }));
  }
}
