import { HttpService } from "@nestjs/axios";
import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AxiosError } from "axios";
import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  GoogleCalendarEvent,
  GoogleCalendarEventsResponse,
} from "./holiday.types";

const TOKEN_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";
/** 만료 직전에 쓰다 401을 맞지 않도록 남겨두는 여유. */
const TOKEN_EXPIRY_MARGIN_MS = 60_000;

type ServiceAccountKey = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

const base64Url = (input: Buffer | string): string =>
  Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/**
 * 서비스 계정 JWT로 Google Calendar API를 읽는 최소 client.
 *
 * googleapis SDK를 들이지 않고 JWT bearer grant(RFC 7523)를 직접 만든다. 필요한 것은
 * 서명과 토큰 캐시뿐이고, 이 레포의 다른 외부 client(PatentSearchClient)와 형태를 맞췄다.
 *
 * 자격증명 파일은 컨테이너에 read-only로 마운트되며, 이 클래스 밖으로 나가지 않는다.
 */
@Injectable()
export class GoogleCalendarClient {
  private readonly logger = new Logger(GoogleCalendarClient.name);
  private readonly serviceAccountFile: string;
  private readonly timeoutMs: number;

  private serviceAccount: ServiceAccountKey | null = null;
  private accessToken: { value: string; expiresAt: number } | null = null;
  /** 같은 시점에 여러 요청이 들어와도 토큰 발급은 한 번만 한다. */
  private tokenRequest: Promise<string> | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.serviceAccountFile = this.configService.get<string>(
      "googleCalendar.serviceAccountFile",
      "",
    );
    this.timeoutMs = this.configService.get<number>(
      "googleCalendar.timeoutMs",
      15000,
    );
  }

  get isConfigured(): boolean {
    return this.serviceAccountFile.length > 0;
  }

  /**
   * `timeMin` 이상 `timeMax` 미만 구간의 일정을 모두 가져온다.
   * 반복 일정은 `singleEvents`로 펼쳐 받고, 페이지가 나뉘면 끝까지 따라간다.
   */
  async listEvents(
    calendarId: string,
    timeMin: string,
    timeMax: string,
  ): Promise<GoogleCalendarEvent[]> {
    const token = await this.getAccessToken();
    const events: GoogleCalendarEvent[] = [];
    let pageToken: string | undefined;

    do {
      const response = await this.getEventsPage(
        calendarId,
        token,
        timeMin,
        timeMax,
        pageToken,
      );
      events.push(...(response.items ?? []));
      pageToken = response.nextPageToken;
      // 방어적 상한. 공휴일 캘린더가 이 정도로 커질 일은 없다.
    } while (pageToken && events.length < 5000);

    return events;
  }

  private async getEventsPage(
    calendarId: string,
    token: string,
    timeMin: string,
    timeMax: string,
    pageToken: string | undefined,
  ): Promise<GoogleCalendarEventsResponse> {
    // 캘린더 ID에는 `#`가 들어 있어(ko.south_korea#holiday@...) 반드시 인코딩해야 한다.
    const path = `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(
      calendarId,
    )}/events`;
    try {
      const response =
        await this.httpService.axiosRef.get<GoogleCalendarEventsResponse>(
          path,
          {
            params: {
              timeMin,
              timeMax,
              singleEvents: true,
              orderBy: "startTime",
              maxResults: 2500,
              ...(pageToken ? { pageToken } : {}),
            },
            headers: { Authorization: `Bearer ${token}` },
            timeout: this.timeoutMs,
          },
        );
      return response.data ?? {};
    } catch (error) {
      throw this.toHttpException(error, `calendar ${calendarId}`);
    }
  }

  private async getAccessToken(): Promise<string> {
    const cached = this.accessToken;
    if (cached && cached.expiresAt - TOKEN_EXPIRY_MARGIN_MS > Date.now()) {
      return cached.value;
    }
    // 이미 발급 중이면 그 약속을 함께 기다린다.
    this.tokenRequest ??= this.requestAccessToken().finally(() => {
      this.tokenRequest = null;
    });
    return this.tokenRequest;
  }

  private async requestAccessToken(): Promise<string> {
    const key = await this.loadServiceAccount();
    const tokenUri = key.token_uri ?? "https://oauth2.googleapis.com/token";
    const assertion = this.signAssertion(key, tokenUri);

    try {
      const response = await this.httpService.axiosRef.post<{
        access_token?: string;
        expires_in?: number;
      }>(
        tokenUri,
        new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion,
        }),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          timeout: this.timeoutMs,
        },
      );
      const token = response.data?.access_token;
      if (!token) {
        throw new BadGatewayException("GOOGLE_CALENDAR_TOKEN_MISSING");
      }
      const expiresInMs = (response.data?.expires_in ?? 3600) * 1000;
      this.accessToken = { value: token, expiresAt: Date.now() + expiresInMs };
      return token;
    } catch (error) {
      this.accessToken = null;
      throw this.toHttpException(error, "token exchange");
    }
  }

  private signAssertion(key: ServiceAccountKey, tokenUri: string): string {
    const issuedAt = Math.floor(Date.now() / 1000);
    const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = base64Url(
      JSON.stringify({
        iss: key.client_email,
        scope: TOKEN_SCOPE,
        aud: tokenUri,
        iat: issuedAt,
        exp: issuedAt + 3600,
      }),
    );
    const signingInput = `${header}.${claims}`;
    const signature = createSign("RSA-SHA256")
      .update(signingInput)
      .sign(key.private_key);
    return `${signingInput}.${base64Url(signature)}`;
  }

  private async loadServiceAccount(): Promise<ServiceAccountKey> {
    if (this.serviceAccount) return this.serviceAccount;
    if (!this.isConfigured) {
      throw new BadGatewayException("GOOGLE_CALENDAR_NOT_CONFIGURED");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(this.serviceAccountFile, "utf8"));
    } catch (error) {
      this.logger.error(
        `Failed to read service account file ${this.serviceAccountFile}: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
      throw new BadGatewayException("GOOGLE_CALENDAR_CREDENTIAL_UNREADABLE");
    }
    const key = parsed as Partial<ServiceAccountKey>;
    if (!key.client_email || !key.private_key) {
      // 값 자체는 로그에 남기지 않는다.
      throw new BadGatewayException("GOOGLE_CALENDAR_CREDENTIAL_INVALID");
    }
    this.serviceAccount = key as ServiceAccountKey;
    this.logger.log(
      `Google Calendar service account loaded (${key.client_email})`,
    );
    return this.serviceAccount;
  }

  private toHttpException(error: unknown, context: string): Error {
    if (error instanceof BadGatewayException) return error;
    const axiosError = error as AxiosError;
    if (axiosError?.code === "ECONNABORTED") {
      return new GatewayTimeoutException("GOOGLE_CALENDAR_TIMEOUT");
    }
    const status = axiosError?.response?.status;
    this.logger.warn(
      `Google Calendar request failed (${context})${
        status ? ` with status ${status}` : ""
      }: ${axiosError?.message ?? "unknown error"}`,
    );
    return new BadGatewayException("GOOGLE_CALENDAR_UNAVAILABLE");
  }
}
