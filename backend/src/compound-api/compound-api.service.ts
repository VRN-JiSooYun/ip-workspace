import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { AxiosError } from "axios";
import { checkGroupwareToken } from "../auth/groupware-login-check";
import { PrismaService } from "../database/prisma.service";
import { GetCompoundCalculateDto } from "./dto/get-compound-calculate.dto";
import { GetCompoundSarDataDto } from "./dto/get-compound-sar-data.dto";
import { GetCompoundsDto } from "./dto/get-compounds.dto";
import { SearchCompoundsDto } from "./dto/search-compounds.dto";
import {
  CompoundSearchItem,
  CompoundCalculateData,
  GetCompoundCalculateResponse,
  GetCompoundsResponse,
  GroupedCompoundSarData,
  CompoundSarDataRow,
} from "./types/compound-api.types";

@Injectable()
export class CompoundApiService {
  private readonly apiUrl: string;
  private readonly authToken: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.apiUrl = this.configService.get<string>(
      "compoundApi.apiUrl",
      "http://172.16.1.32:10050",
    );
    this.authToken = this.configService.get<string>(
      "compoundApi.authToken",
      "",
    );
    this.timeoutMs = this.configService.get<number>(
      "compoundApi.timeoutMs",
      30000,
    );
  }

  async searchCompounds(
    userId: string,
    loginToken: string,
    body: SearchCompoundsDto,
  ): Promise<CompoundSearchItem[]> {
    const query = body.query?.trim() ?? "";
    if (!query) return [];

    const data = await this.postExternal<CompoundSearchItem[]>(
      "/search_compounds",
      {
        login_token: loginToken,
        project: [],
        keyword: "",
        smiles: "",
        mol_block: "",
        search_type: "substructure",
        similarity_range_start: 0,
        similarity_range_end: 100,
      },
      userId,
      loginToken,
    );

    return this.filterCompoundSearchItems(
      Array.isArray(data) ? data : [],
      query,
    );
  }

  async getCompounds(
    userId: string,
    loginToken: string,
    body: GetCompoundsDto,
  ): Promise<GetCompoundsResponse> {
    return this.postExternal<GetCompoundsResponse>(
      "/get_compounds",
      {
        login_token: loginToken,
        compounds: this.normalizeCompoundCodes(body.compounds),
        type: body.type ?? "smiles",
      },
      userId,
      loginToken,
    );
  }

  async getCompoundSarData(
    userId: string,
    loginToken: string,
    body: GetCompoundSarDataDto,
  ): Promise<{
    rows: CompoundSarDataRow[];
    groups: GroupedCompoundSarData[];
  }> {
    const data = await this.postExternal<CompoundSarDataRow[]>(
      "/get_compound_sar_data",
      {
        login_token: loginToken,
        compounds: this.normalizeCompoundCodes(body.compounds),
      },
      userId,
      loginToken,
    );
    const rows = Array.isArray(data) ? data : [];

    return {
      rows,
      groups: this.groupSarRows(rows),
    };
  }

  async getCompoundCalculate(
    userId: string,
    loginToken: string,
    body: GetCompoundCalculateDto,
  ): Promise<GetCompoundCalculateResponse> {
    const response = await this.postExternal<GetCompoundCalculateResponse>(
      "/get_compound_calculate",
      {
        login_token: loginToken,
        smiles: body.smiles.trim(),
      },
      userId,
      loginToken,
    );

    if (!response?.result || !this.isCompoundCalculateData(response.data)) {
      throw new BadGatewayException({
        message: "Compound calculation returned an invalid response.",
      });
    }

    return response;
  }

  private async postExternal<T>(
    path: string,
    payload: Record<string, unknown>,
    userId: string,
    loginToken: string,
  ): Promise<T> {
    if (!this.authToken.trim()) {
      throw new BadRequestException(
        "Compound API authorization token is not configured.",
      );
    }

    try {
      const response = await this.httpService.axiosRef.post<T>(
        `${this.apiUrl.replace(/\/$/, "")}${path}`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
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
      if (upstreamStatus === 401) {
        await this.revokeSessionIfGroupwareLoggedOut(userId, loginToken);
      }
      throw new BadGatewayException({
        message: "Failed to request compound API.",
        upstreamStatus,
        detail:
          typeof upstreamMessage === "string"
            ? upstreamMessage
            : axiosError.message,
      });
    }
  }

  private async revokeSessionIfGroupwareLoggedOut(
    userId: string,
    loginToken: string,
  ): Promise<void> {
    let result: Awaited<ReturnType<typeof checkGroupwareToken>>;
    try {
      result = await checkGroupwareToken(loginToken);
    } catch (error) {
      throw new BadGatewayException({
        message: "Failed to verify Groupware session.",
        upstreamStatus: 401,
        detail:
          error instanceof Error
            ? error.message
            : "GROUPWARE_LOGIN_CHECK_FAILED",
      });
    }

    if (result.loginCheck) return;
    await this.prisma.client.session.deleteMany({ where: { userId } });
    throw new UnauthorizedException("GROUPWARE_REAUTH_REQUIRED");
  }

  private normalizeCompoundCodes(compounds: string[]) {
    const normalized = Array.from(
      new Set(compounds.map((compound) => compound.trim()).filter(Boolean)),
    );

    if (normalized.length === 0) {
      throw new BadRequestException("At least one compound code is required.");
    }

    return normalized;
  }

  private isCompoundCalculateData(
    data: unknown,
  ): data is CompoundCalculateData {
    if (!data || typeof data !== "object") return false;
    const value = data as Record<string, unknown>;
    const numberFields: Array<keyof CompoundCalculateData> = [
      "heavy_atom_count",
      "fsp3",
      "num_rotatable_bonds",
      "log_s",
      "cns_mpo_score",
      "log_p",
      "log_d",
      "molecular_weight",
      "topological_polar_surface_area",
      "num_h_bond_donors",
      "pka",
      "exact_mass",
      "num_h_bond_acceptors",
      "num_h_bond_donors_site",
      "num_h_bond_acceptors_site",
      "num_rule_of_5_violations",
    ];
    const composition = value.composition;

    return (
      numberFields.every(
        (field) =>
          typeof value[field] === "number" && Number.isFinite(value[field]),
      ) &&
      typeof value.chemical_formula === "string" &&
      Boolean(composition) &&
      typeof composition === "object" &&
      Object.values(composition as Record<string, unknown>).every(
        (item) => typeof item === "string",
      )
    );
  }

  private filterCompoundSearchItems(
    items: CompoundSearchItem[],
    query: string,
  ) {
    const normalizedQuery = query.toLowerCase();

    return [...items]
      .filter((item) =>
        item.compound_code?.toLowerCase().includes(normalizedQuery),
      )
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
      const compoundCode =
        typeof row.compound_code === "string" ? row.compound_code : "";
      if (!compoundCode) return;
      groups.set(compoundCode, [...(groups.get(compoundCode) ?? []), row]);
    });

    return Array.from(groups.entries()).map(([compound_code, groupedRows]) => ({
      compound_code,
      rows: groupedRows,
    }));
  }
}
