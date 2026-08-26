import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";

export const PATENT_NOTE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

const IMAGE_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
} as const;

type PatentNoteImageType = keyof typeof IMAGE_TYPES;

const FILE_NAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:png|jpg|gif|webp)$/;

const trimSlashes = (value: string): string => value.replace(/^\/+|\/+$/g, "");

const hasImageSignature = (
  buffer: Buffer,
  mimeType: PatentNoteImageType,
): boolean => {
  if (mimeType === "image/png") {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }
  if (mimeType === "image/jpeg") {
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }
  if (mimeType === "image/gif") {
    const signature = buffer.subarray(0, 6).toString("ascii");
    return signature === "GIF87a" || signature === "GIF89a";
  }
  return buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP";
};

@Injectable()
export class PatentNoteImageService {
  private readonly logger = new Logger(PatentNoteImageService.name);
  private readonly filerUrl: string;
  private readonly publicUrl: string;
  private readonly rootPath: string;

  constructor(private readonly config: ConfigService) {
    this.filerUrl = this.requireUrl("seaweedFs.filerUrl");
    this.publicUrl = this.requireUrl("seaweedFs.publicUrl");
    const rootDir = trimSlashes(
      this.config.get<string>("seaweedFs.rootDir") ?? "buckets",
    );
    const configuredEnvDir = trimSlashes(
      this.config.get<string>("seaweedFs.envDir") ?? "ip_ws_dev",
    );
    // /buckets 바로 아래는 S3 bucket 이름으로 검증되어 underscore를 허용하지 않는다.
    // 환경변수의 논리 이름은 유지하고 실제 bucket segment만 호환되는 이름으로 바꾼다.
    const storageEnvDir = rootDir === "buckets"
      ? configuredEnvDir.replaceAll("_", "-")
      : configuredEnvDir;
    this.rootPath = [
      rootDir,
      storageEnvDir,
      this.config.get<string>("seaweedFs.basePath") ?? "",
    ].map(trimSlashes).filter(Boolean).join("/");
  }

  async upload(
    patentId: number,
    file: { buffer: Buffer; mimetype?: string; size?: number },
  ) {
    const mimeType = file.mimetype as PatentNoteImageType;
    const extension = IMAGE_TYPES[mimeType];
    if (!extension) {
      throw new BadRequestException("PATENT_NOTE_IMAGE_TYPE_NOT_ALLOWED");
    }
    if (file.buffer.length === 0) {
      throw new BadRequestException("PATENT_NOTE_IMAGE_EMPTY");
    }
    if ((file.size ?? file.buffer.length) > PATENT_NOTE_IMAGE_MAX_BYTES) {
      throw new BadRequestException("PATENT_NOTE_IMAGE_TOO_LARGE");
    }
    if (!hasImageSignature(file.buffer, mimeType)) {
      throw new BadRequestException("PATENT_NOTE_IMAGE_INVALID_CONTENT");
    }

    const fileName = `${randomUUID()}.${extension}`;
    // 런타임별 FormData 구현이 filename을 다르게 직렬화하지 않도록 multipart body를
    // 직접 만든다. CRLF와 마지막 `--`까지 RFC 7578 형식으로 고정한다.
    const boundary = `----ipworkspace-${randomUUID()}`;
    const multipartHeader = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`,
      "utf8",
    );
    const multipartFooter = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
    const multipartBuffer = Buffer.concat([
      multipartHeader,
      file.buffer,
      multipartFooter,
    ]);
    // Buffer<ArrayBufferLike>와 DOM BodyInit의 타입 충돌을 피하면서 byte는 그대로 보낸다.
    const requestBody = new Uint8Array(multipartBuffer.length);
    requestBody.set(multipartBuffer);
    // multipart upload는 파일 URL이 아니라 trailing slash가 있는 디렉터리 URL로 보낸다.
    // 실제 저장 파일명은 위 multipart filename(UUID)을 SeaweedFS가 사용한다.
    const response = await this.request(this.filerUrl, patentId, "", {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": String(requestBody.byteLength),
      },
      body: requestBody,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      this.logger.error(
        `SeaweedFS upload failed: patentId=${patentId} file=${fileName} ` +
        `status=${response.status} detail=${detail.slice(0, 500)}`,
      );
      throw new BadGatewayException("SEAWEEDFS_IMAGE_UPLOAD_FAILED");
    }
    const result = await response.json().catch(() => null) as {
      name?: unknown;
      size?: unknown;
    } | null;
    if (result?.name !== fileName || Number(result.size) !== file.buffer.length) {
      this.logger.error(
        `SeaweedFS upload result mismatch: patentId=${patentId} ` +
        `expected=${fileName}/${file.buffer.length} actual=${String(result?.name)}/${String(result?.size)}`,
      );
      throw new BadGatewayException("SEAWEEDFS_IMAGE_UPLOAD_RESULT_INVALID");
    }
    this.logger.log(
      `SeaweedFS image uploaded: patentId=${patentId} file=${fileName} bytes=${file.buffer.length}`,
    );

    return {
      fileName,
      mimeType,
      byteSize: file.buffer.length,
      url: `/patent-records/${patentId}/note-images/${fileName}`,
    };
  }

  async read(patentId: number, fileName: string) {
    this.assertFileName(fileName);
    const response = await this.request(this.publicUrl, patentId, fileName);
    if (response.status === 404) {
      throw new NotFoundException("PATENT_NOTE_IMAGE_NOT_FOUND");
    }
    if (!response.ok) {
      throw new BadGatewayException("SEAWEEDFS_IMAGE_READ_FAILED");
    }
    const contentType = (
      response.headers.get("content-type") ?? "application/octet-stream"
    )
      .split(";", 1)[0]
      .trim()
      .toLowerCase();
    if (!Object.hasOwn(IMAGE_TYPES, contentType)) {
      throw new BadGatewayException("SEAWEEDFS_IMAGE_CONTENT_TYPE_INVALID");
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (
      buffer.length > PATENT_NOTE_IMAGE_MAX_BYTES ||
      !hasImageSignature(buffer, contentType as PatentNoteImageType)
    ) {
      throw new BadGatewayException("SEAWEEDFS_IMAGE_CONTENT_INVALID");
    }
    return {
      buffer,
      contentType,
    };
  }

  async remove(patentId: number, fileName: string): Promise<void> {
    this.assertFileName(fileName);
    const response = await this.request(this.filerUrl, patentId, fileName, {
      method: "DELETE",
    });
    if (!response.ok && response.status !== 404) {
      throw new BadGatewayException("SEAWEEDFS_IMAGE_DELETE_FAILED");
    }
    this.logger.log(
      `SeaweedFS image deleted: patentId=${patentId} file=${fileName} status=${response.status}`,
    );
  }

  private requireUrl(key: string): string {
    const value = this.config.get<string>(key)?.replace(/\/+$/, "");
    if (!value) throw new Error(`${key} is required`);
    return value;
  }

  private assertFileName(fileName: string): void {
    if (!FILE_NAME_PATTERN.test(fileName)) {
      throw new BadRequestException("PATENT_NOTE_IMAGE_NAME_INVALID");
    }
  }

  private request(
    origin: string,
    patentId: number,
    fileName: string,
    init?: RequestInit,
  ): Promise<Response> {
    const path = `${this.rootPath}/patent-records/${patentId}/note-images/${fileName}`;
    return fetch(`${origin}/${path}`, {
      ...init,
      signal: AbortSignal.timeout(30_000),
    });
  }
}
