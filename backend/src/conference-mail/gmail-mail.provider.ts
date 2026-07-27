import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import type {
  MailProvider,
  MailProviderReadiness,
  SendMailInput,
} from './mail-provider';

type AuthorizedUserToken = {
  token?: string;
  refresh_token?: string;
  token_uri?: string;
  client_id?: string;
  client_secret?: string;
  expiry?: string;
  scopes?: string[];
  account?: string;
};

export class MailProviderError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    readonly providerStatus?: number,
  ) {
    super(code);
  }
}

const base64Url = (value: string): string => Buffer
  .from(value, 'utf8')
  .toString('base64url');

const encodedHeader = (value: string): string => (
  `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
);

const allowedTokenHosts = new Set([
  'oauth2.googleapis.com',
  'accounts.google.com',
]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class GmailMailProvider implements MailProvider {
  private readonly tokenFile: string;
  private readonly configuredFromEmail: string;
  private accessToken?: string;
  private accessTokenExpiresAt = 0;
  private tokenConfig?: AuthorizedUserToken;

  constructor(config: ConfigService) {
    this.tokenFile = config.get<string>(
      'gmail.oauthTokenFile',
      '/run/secrets/gmail/token.json',
    );
    this.configuredFromEmail = config.get<string>('gmail.fromEmail', '').trim();
  }

  async readiness(): Promise<MailProviderReadiness> {
    try {
      const token = await this.loadTokenConfig();
      this.assertTokenConfig(token);
      if (!this.resolveFromEmail(token)) {
        throw new MailProviderError('GMAIL_FROM_EMAIL_MISSING', false);
      }
      return {
        ready: true,
        fromEmailConfigured: true,
        tokenFileConfigured: true,
      };
    } catch (error) {
      return {
        ready: false,
        fromEmailConfigured: Boolean(this.configuredFromEmail),
        tokenFileConfigured: false,
        errorCode: error instanceof MailProviderError
          ? error.code
          : 'GMAIL_TOKEN_NOT_READY',
      };
    }
  }

  async send(input: SendMailInput): Promise<{ providerMessageId: string }> {
    const token = await this.loadTokenConfig();
    this.assertTokenConfig(token);
    const fromEmail = this.resolveFromEmail(token);
    if (!fromEmail) throw new MailProviderError('GMAIL_FROM_EMAIL_MISSING', false);
    if (!emailPattern.test(fromEmail) || !emailPattern.test(input.to)) {
      throw new MailProviderError('GMAIL_EMAIL_INVALID', false);
    }

    const raw = this.buildMime(input, fromEmail);
    let accessToken = await this.getAccessToken(token, false);
    let response = await this.sendRequest(accessToken, raw);
    if (response.status === 401) {
      accessToken = await this.getAccessToken(token, true);
      response = await this.sendRequest(accessToken, raw);
    }
    if (!response.ok) throw this.responseError(response.status);
    const result = await response.json() as { id?: unknown };
    if (typeof result.id !== 'string' || !result.id) {
      throw new MailProviderError('GMAIL_RESPONSE_INVALID', true);
    }
    return { providerMessageId: result.id };
  }

  private async loadTokenConfig(): Promise<AuthorizedUserToken> {
    if (this.tokenConfig) return this.tokenConfig;
    try {
      const parsed = JSON.parse(await readFile(this.tokenFile, 'utf8')) as AuthorizedUserToken;
      this.tokenConfig = parsed;
      if (
        parsed.token
        && parsed.expiry
        && Date.parse(parsed.expiry) > Date.now() + 60_000
      ) {
        this.accessToken = parsed.token;
        this.accessTokenExpiresAt = Date.parse(parsed.expiry);
      }
      return parsed;
    } catch {
      throw new MailProviderError('GMAIL_TOKEN_FILE_INVALID', false);
    }
  }

  private assertTokenConfig(token: AuthorizedUserToken): void {
    if (!token.client_id || !token.client_secret || !token.refresh_token) {
      throw new MailProviderError('GMAIL_REFRESH_CREDENTIAL_MISSING', false);
    }
    const scopes = token.scopes ?? [];
    if (
      !scopes.includes('https://www.googleapis.com/auth/gmail.send')
      && !scopes.includes('https://mail.google.com/')
    ) {
      throw new MailProviderError('GMAIL_SEND_SCOPE_MISSING', false);
    }
    let tokenUrl: URL;
    try {
      tokenUrl = new URL(token.token_uri || 'https://oauth2.googleapis.com/token');
    } catch {
      throw new MailProviderError('GMAIL_TOKEN_URI_INVALID', false);
    }
    if (tokenUrl.protocol !== 'https:' || !allowedTokenHosts.has(tokenUrl.hostname)) {
      throw new MailProviderError('GMAIL_TOKEN_URI_NOT_ALLOWED', false);
    }
  }

  private resolveFromEmail(token: AuthorizedUserToken): string {
    return this.configuredFromEmail || token.account?.trim() || '';
  }

  private async getAccessToken(
    token: AuthorizedUserToken,
    forceRefresh: boolean,
  ): Promise<string> {
    if (
      !forceRefresh
      && this.accessToken
      && this.accessTokenExpiresAt > Date.now() + 60_000
    ) {
      return this.accessToken;
    }
    const tokenUri = token.token_uri || 'https://oauth2.googleapis.com/token';
    let response: Response;
    try {
      response = await fetch(tokenUri, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: token.client_id!,
          client_secret: token.client_secret!,
          refresh_token: token.refresh_token!,
          grant_type: 'refresh_token',
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new MailProviderError('GMAIL_TOKEN_REFRESH_NETWORK', true);
    }
    if (!response.ok) {
      throw new MailProviderError(
        `GMAIL_TOKEN_REFRESH_${response.status}`,
        response.status === 429 || response.status >= 500,
        response.status,
      );
    }
    const body = await response.json() as {
      access_token?: unknown;
      expires_in?: unknown;
    };
    if (
      typeof body.access_token !== 'string'
      || typeof body.expires_in !== 'number'
    ) {
      throw new MailProviderError('GMAIL_TOKEN_REFRESH_RESPONSE_INVALID', false);
    }
    this.accessToken = body.access_token;
    this.accessTokenExpiresAt = Date.now() + body.expires_in * 1000;
    return body.access_token;
  }

  private sendRequest(accessToken: string, raw: string): Promise<Response> {
    return fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
      signal: AbortSignal.timeout(30_000),
    }).catch(() => {
      throw new MailProviderError('GMAIL_SEND_NETWORK', true);
    });
  }

  private responseError(status: number): MailProviderError {
    if (status === 401 || status === 403) {
      return new MailProviderError(`GMAIL_SEND_${status}`, false, status);
    }
    if (status === 429 || status >= 500) {
      return new MailProviderError(`GMAIL_SEND_${status}`, true, status);
    }
    return new MailProviderError(`GMAIL_SEND_${status}`, false, status);
  }

  private buildMime(input: SendMailInput, fromEmail: string): string {
    const boundary = `conference-outbox-${input.outboxId}`;
    const mime = [
      `From: ${fromEmail}`,
      `To: ${input.to}`,
      `Subject: ${encodedHeader(input.subject)}`,
      `Message-ID: ${input.messageId}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(input.textBody, 'utf8').toString('base64'),
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(input.htmlBody, 'utf8').toString('base64'),
      `--${boundary}--`,
      '',
    ].join('\r\n');
    return base64Url(mime);
  }
}
