import { HttpService } from "@nestjs/axios";
import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AxiosError } from "axios";
import {
  UpstreamPatentDetail,
  UpstreamSearchRequest,
  UpstreamSearchResponse,
} from "./patent-search.types";

@Injectable()
export class PatentSearchClient {
  private readonly logger = new Logger(PatentSearchClient.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService
      .get<string>("patentSearch.apiUrl", "http://172.16.1.210:10000")
      .replace(/\/$/, "");
    this.timeoutMs = this.configService.get<number>(
      "patentSearch.timeoutMs",
      60000,
    );
  }

  async search(body: UpstreamSearchRequest): Promise<UpstreamSearchResponse> {
    try {
      const response =
        await this.httpService.axiosRef.post<UpstreamSearchResponse>(
          `${this.baseUrl}/patents/search`,
          body,
          { timeout: this.timeoutMs },
        );
      return this.assertShape(response.data);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  /**
   * 출원번호로 `patent` 한 행을 받아온다. 없으면 `null`(외부가 그대로 null을 준다).
   *
   * 검색 응답에 없는 column을 채우려고 건별로 부르는 보조 조회다. 실패해도 검색 결과
   * 자체는 쓸 수 있어야 하므로 예외를 던지지 않고 null로 접는다.
   */
  async findPatentByApplicationNumber(
    applicationNumber: string,
  ): Promise<UpstreamPatentDetail | null> {
    try {
      const response =
        await this.httpService.axiosRef.get<UpstreamPatentDetail | null>(
          `${this.baseUrl}/patents/`,
          {
            params: { application_number: applicationNumber },
            timeout: this.timeoutMs,
          },
        );
      return response.data ?? null;
    } catch (error) {
      this.logger.warn(
        `Patent detail lookup failed for ${applicationNumber}: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
      return null;
    }
  }

  /**
   * 외부 API는 검색 실패도 `{"detail": "..."}` 로 내려주므로 성공 응답인지 형태로 확인한다.
   */
  private assertShape(value: unknown): UpstreamSearchResponse {
    if (
      !value ||
      typeof value !== "object" ||
      !Array.isArray((value as UpstreamSearchResponse).data)
    ) {
      throw new BadGatewayException({
        message: "PATENT_SEARCH_UPSTREAM_INVALID_RESPONSE",
        detail: this.describeDetail(value),
      });
    }
    return value as UpstreamSearchResponse;
  }

  private toHttpException(error: unknown) {
    const axiosError = error as AxiosError;

    if (
      axiosError?.code === "ECONNABORTED" ||
      axiosError?.code === "ETIMEDOUT"
    ) {
      this.logger.warn(
        `Patent search upstream timed out after ${this.timeoutMs}ms`,
      );
      return new GatewayTimeoutException({
        message: "PATENT_SEARCH_UPSTREAM_TIMEOUT",
        detail: `Upstream did not respond within ${this.timeoutMs}ms`,
      });
    }

    const status = axiosError?.response?.status;
    const detail = this.describeDetail(axiosError?.response?.data);

    if (status !== undefined) {
      this.logger.warn(
        `Patent search upstream responded ${status}: ${detail ?? "no detail"}`,
      );
    } else {
      this.logger.error(
        `Patent search upstream unreachable: ${axiosError?.message ?? "unknown error"}`,
      );
    }

    return new BadGatewayException({
      message: "PATENT_SEARCH_UPSTREAM_ERROR",
      // 외부 API의 원문 detail을 그대로 노출한다. 422 validation 오류가 대부분이라
      // 무엇이 잘못됐는지 호출자가 바로 알 수 있어야 한다.
      ...(status !== undefined ? { upstreamStatus: status } : {}),
      ...(detail !== undefined ? { detail } : {}),
    });
  }

  private describeDetail(payload: unknown): string | undefined {
    if (payload === undefined || payload === null) return undefined;
    if (typeof payload === "string") return payload.slice(0, 2000);
    if (typeof payload === "object" && "detail" in payload) {
      const { detail } = payload;
      return typeof detail === "string"
        ? detail.slice(0, 2000)
        : JSON.stringify(detail).slice(0, 2000);
    }
    return JSON.stringify(payload).slice(0, 2000);
  }
}
