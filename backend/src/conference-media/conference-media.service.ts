import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { PrismaService } from '../database/prisma.service';

type ResolvedAsset = {
  kind: string;
  storageProvider: string;
  legacySourceUrl: string | null;
  storageKey: string | null;
  originalFilename: string;
  mimeType: string | null;
};

const sanitizeAsciiFilename = (filename: string): string => {
  const safe = filename
    .replace(/[\u0000-\u001f\u007f"\\/:*?<>|]/g, '_')
    .trim();
  return safe || 'download';
};

const buildAttachmentDisposition = (filename: string): string => {
  const ascii = sanitizeAsciiFilename(filename).replace(/[^\x20-\x7e]/g, '_');
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
};

@Injectable()
export class ConferenceMediaService {
  private readonly legacyBaseUrl: URL;
  private readonly legacyPathPrefix: string;
  private readonly redirectMode: string;
  private readonly requestTimeoutMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    config: ConfigService,
  ) {
    this.legacyBaseUrl = new URL(
      config.get<string>(
        'conferenceMedia.legacyBaseUrl',
        'https://voronoi.app',
      ),
    );
    this.legacyPathPrefix = config.get<string>(
      'conferenceMedia.legacyPathPrefix',
      '/media/conference/',
    );
    this.redirectMode = config.get<string>(
      'conferenceMedia.redirectMode',
      'DIRECT',
    );
    this.requestTimeoutMs = config.get<number>(
      'conferenceMedia.requestTimeoutMs',
      30000,
    );
  }

  async getContentTarget(
    assetId: string,
    organizationId?: string,
  ): Promise<{ url: string }> {
    const asset = await this.findAsset(assetId, organizationId);
    return { url: this.resolveAssetUrl(asset).toString() };
  }

  async pipeDownload(
    assetId: string,
    response: Response,
    organizationId?: string,
  ): Promise<void> {
    const asset = await this.findAsset(assetId, organizationId);
    if (asset.kind === 'VIDEO') {
      throw new UnprocessableEntityException('CONFERENCE_VIDEO_DOWNLOAD_NOT_SUPPORTED');
    }
    const url = this.resolveAssetUrl(asset);

    try {
      const upstream = await this.http.axiosRef.get(url.toString(), {
        responseType: 'stream',
        timeout: this.requestTimeoutMs,
        maxRedirects: 0,
        headers: {
          Accept: '*/*',
          'Accept-Encoding': 'identity',
        },
        validateStatus: (status) => status >= 200 && status < 300,
      });
      const contentType = String(
        upstream.headers['content-type'] ?? asset.mimeType ?? 'application/octet-stream',
      );
      const contentLength = upstream.headers['content-length'];

      response.setHeader('Content-Type', contentType);
      response.setHeader(
        'Content-Disposition',
        buildAttachmentDisposition(asset.originalFilename),
      );
      response.setHeader('X-Content-Type-Options', 'nosniff');
      if (contentLength !== undefined) {
        response.setHeader('Content-Length', String(contentLength));
      }

      upstream.data.on('error', (error: Error) => {
        if (!response.destroyed) response.destroy(error);
      });
      upstream.data.pipe(response);
    } catch (error) {
      if (!response.headersSent) {
        throw new BadGatewayException({
          message: 'CONFERENCE_MEDIA_DOWNLOAD_FAILED',
          detail: error instanceof Error ? error.message : 'Unknown upstream error',
        });
      }
      if (!response.destroyed) response.destroy();
    }
  }

  private async findAsset(
    assetId: string,
    organizationId?: string,
  ): Promise<ResolvedAsset> {
    const abstractAsset = await this.prisma.client.conferenceAbstractAsset.findFirst({
      where: {
        id: assetId,
        abstract: {
          deletedAt: null,
          conference: { deletedAt: null, organizationId },
        },
      },
      select: {
        kind: true,
        storageProvider: true,
        legacySourceUrl: true,
        storageKey: true,
        originalFilename: true,
        mimeType: true,
      },
    });
    if (abstractAsset) return abstractAsset;

    const conferenceAsset = await this.prisma.client.conferenceAsset.findFirst({
      where: {
        id: assetId,
        conference: { deletedAt: null, organizationId },
      },
      select: {
        kind: true,
        storageProvider: true,
        legacySourceUrl: true,
        storageKey: true,
        originalFilename: true,
        mimeType: true,
      },
    });
    if (conferenceAsset) return conferenceAsset;
    throw new NotFoundException('CONFERENCE_ASSET_NOT_FOUND');
  }

  private resolveAssetUrl(asset: ResolvedAsset): URL {
    if (asset.storageProvider === 'NAS') {
      throw new ServiceUnavailableException('CONFERENCE_NAS_MEDIA_NOT_CONFIGURED');
    }
    if (asset.storageProvider !== 'LEGACY_HTTP' || !asset.legacySourceUrl) {
      throw new UnprocessableEntityException('CONFERENCE_ASSET_SOURCE_UNAVAILABLE');
    }
    if (this.redirectMode !== 'DIRECT') {
      throw new ServiceUnavailableException('CONFERENCE_MEDIA_GATEWAY_NOT_CONFIGURED');
    }

    return new URL(this.normalizeLegacySourceUrl(asset.legacySourceUrl));
  }

  normalizeLegacySourceUrl(sourceUrl: string): string {
    const resolved = new URL(sourceUrl, this.legacyBaseUrl);
    let decodedPath: string;
    try {
      decodedPath = decodeURIComponent(resolved.pathname);
    } catch {
      throw new UnprocessableEntityException('CONFERENCE_ASSET_URL_INVALID');
    }
    const basePath = this.legacyBaseUrl.pathname.replace(/\/?$/, '/');
    const allowedPath = new URL(
      this.legacyPathPrefix.replace(/^\//, ''),
      `${this.legacyBaseUrl.origin}${basePath}`,
    ).pathname;

    if (
      resolved.origin !== this.legacyBaseUrl.origin
      || resolved.username
      || resolved.password
      || !decodedPath.startsWith(allowedPath)
      || decodedPath.includes('\\')
      || resolved.hash
    ) {
      throw new UnprocessableEntityException('CONFERENCE_ASSET_URL_NOT_ALLOWED');
    }
    return resolved.toString();
  }
}
