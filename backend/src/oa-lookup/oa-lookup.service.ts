import { BadGatewayException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OaDatabaseService } from "../oa-database/oa-database.service";
import type {
  OaCountryLookup,
  OaLookups,
  OaStatusLookup,
} from "./oa-lookup.types";

@Injectable()
export class OaLookupService {
  private readonly logger = new Logger(OaLookupService.name);
  private readonly cacheTtlMs: number;
  private cached: { expiresAt: number; value: OaLookups } | null = null;
  private pending: Promise<OaLookups> | null = null;

  constructor(
    private readonly database: OaDatabaseService,
    config: ConfigService,
  ) {
    this.cacheTtlMs = config.get<number>(
      "oaDatabase.lookupCacheTtlMs",
      5 * 60 * 1000,
    );
  }

  async list(): Promise<OaLookups> {
    if (this.cached && this.cached.expiresAt > Date.now()) {
      return this.cached.value;
    }
    if (this.pending) return this.pending;

    this.pending = this.load();
    try {
      const value = await this.pending;
      this.cached = { value, expiresAt: Date.now() + this.cacheTtlMs };
      return value;
    } finally {
      this.pending = null;
    }
  }

  private async load(): Promise<OaLookups> {
    try {
      const [countries, examStatuses, legalStatuses] = await Promise.all([
        this.database.query<OaCountryLookup>(`
          SELECT id, country
          FROM public.country
          WHERE btrim(country) <> ''
          ORDER BY country, id
        `),
        this.database.query<OaStatusLookup>(`
          SELECT id, status
          FROM public.exam_status
          WHERE status IS NOT NULL AND btrim(status) <> ''
          ORDER BY status, id
        `),
        this.database.query<OaStatusLookup>(`
          SELECT id, status
          FROM public.legal_status
          WHERE btrim(status) <> ''
          ORDER BY status, id
        `),
      ]);

      return { countries, examStatuses, legalStatuses };
    } catch (error) {
      this.logger.error(
        `OA lookup query failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
      throw new BadGatewayException("OA_DATABASE_LOOKUP_FAILED");
    }
  }
}
