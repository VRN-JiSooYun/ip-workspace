import {
  Controller,
  Get,
  Headers,
  Logger,
  NotFoundException,
  Param,
  Req,
  Res,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { RequirePermissions } from "../authorization/require-permissions.decorator";
import { SkipTimeout } from "../common/decorators/skip-timeout.decorator";
import { toUpstreamDocumentUrl } from "../common/document-url";

/**
 * OA 문서 PDF 중계.
 *
 * 파일 호스트(SeaweedFS)에는 인증이 없다. 그 호스트를 밖에 여는 대신 여기로 받아, 이미
 * 걸려 있는 세션·권한을 거쳐 내보낸다(설명 이미지의 `note-images`와 같은 방식이다).
 *
 * **본문을 메모리에 담지 않는다.** 문서가 수십~수백 KB이고 한 화면에서 여러 건이 동시에
 * 열린다. 상류 응답 스트림을 그대로 흘려보낸다.
 *
 * Range를 그대로 넘기는 것도 필요하다 — PDF.js가 첫 화면만 먼저 받아 그리는데, 여기서
 * 삼켜 버리면 매번 파일 전체를 받아야 열린다(상류는 `Accept-Ranges: bytes`를 준다).
 */
@RequirePermissions("patentAnalysis.read")
@Controller("api/patent-documents")
export class PatentDocumentController {
  private readonly logger = new Logger(PatentDocumentController.name);
  private readonly fileOrigin: string | null;

  constructor(config: ConfigService) {
    this.fileOrigin = config.get<string | null>("documents.fileOrigin", null);
  }

  /**
   * 상류 경로를 그대로 물려받는다(`/patent-documents/oa/2022/….pdf`).
   *
   * 경로 모양을 유지하는 이유는 화면이 이 주소에서 파일명과 날짜를 읽기 때문이다
   * (common/document-url의 주석 참고).
   */
  @Get("*path")
  // 문서는 수 MB일 수 있고 상류가 느릴 때가 있다. 전역 30s 타임아웃을 적용하지 않는다.
  @SkipTimeout()
  async streamDocument(
    @Param("path") path: string | string[],
    @Req() request: Request,
    @Res() response: Response,
    @Headers("range") range?: string,
  ): Promise<void> {
    if (!this.fileOrigin) throw new NotFoundException("DOCUMENT_PROXY_DISABLED");

    /**
     * Express 5의 와일드카드는 마디 **배열**로 오고, 각 마디는 이미 퍼센트 디코딩돼 있다
     * (`1020220059638_의견제출통지서_20230629.pdf`). 여기서 한 번 더 풀면 파일명에 `%`가
     * 들어 있을 때 값이 망가지므로, 이어 붙이기만 한다. 다시 인코딩하는 일은 URL이 한다.
     */
    const pathname = `/${(Array.isArray(path) ? path : [path]).join("/")}`;
    const upstreamUrl = toUpstreamDocumentUrl(pathname, this.fileOrigin);
    // 허용하지 않는 경로다. 무엇이 막혔는지 알려 주지 않는다 — 있는지 없는지도 단서가 된다.
    if (!upstreamUrl) throw new NotFoundException("DOCUMENT_NOT_FOUND");

    let upstream: globalThis.Response;
    try {
      upstream = await fetch(upstreamUrl, {
        headers: range ? { Range: range } : undefined,
        signal: AbortSignal.timeout(30000),
      });
    } catch (error) {
      this.logger.warn(
        `Document upstream unreachable (${upstreamUrl}): ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
      response.status(502).json({ message: "DOCUMENT_UPSTREAM_ERROR" });
      return;
    }

    if (!upstream.ok && upstream.status !== 206) {
      response.status(upstream.status === 404 ? 404 : 502).json({
        message: upstream.status === 404 ? "DOCUMENT_NOT_FOUND" : "DOCUMENT_UPSTREAM_ERROR",
      });
      return;
    }

    // 부분 응답이 성립하려면 이 머리글들이 그대로 가야 한다.
    for (const header of [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "last-modified",
      "etag",
    ]) {
      const value = upstream.headers.get(header);
      if (value) response.setHeader(header, value);
    }
    // 브라우저가 새 창에서 열 때 내려받지 않고 그 자리에서 보게 한다.
    response.setHeader("Content-Disposition", "inline");
    response.setHeader("Cache-Control", "private, max-age=300");
    response.status(upstream.status);

    if (!upstream.body) {
      response.end();
      return;
    }

    // 클라이언트가 중간에 끊으면 상류 읽기도 함께 멈춘다.
    const reader = upstream.body.getReader();
    request.on("close", () => void reader.cancel().catch(() => undefined));
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!response.write(value)) {
          await new Promise((resolve) => response.once("drain", resolve));
        }
      }
      response.end();
    } catch (error) {
      this.logger.warn(
        `Document stream aborted (${upstreamUrl}): ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
      response.destroy();
    }
  }
}
