/**
 * 문서 중계 검증.
 *
 * 상류를 실제로 부르지 않고 `fetch`를 가로챈다 — 이 테스트가 봐야 하는 것은 파일 서버가
 * 살아 있는지가 아니라 **우리가 무엇을 요청하고 무엇을 돌려주는가**다.
 *
 * (실제 파일 호스트로도 한 번 돌려 확인했다: 103,987바이트 PDF 전체 전달, `bytes=0-99`에
 *  206 + `content-range: bytes 0-99/103987`.)
 */
import type { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { PatentDocumentController } from "./patent-document.controller";

const FILE_ORIGIN = "http://172.16.1.210:8888";

const configWith = (fileOrigin: string | null) =>
  ({
    get: (key: string, fallback: unknown) =>
      (key === "documents.fileOrigin" ? fileOrigin : fallback),
  }) as unknown as ConfigService;

/** 응답에 무엇이 실렸는지 붙잡아 두는 가짜 express Response. */
const fakeResponse = () => {
  const headers: Record<string, string> = {};
  const chunks: Buffer[] = [];
  const state = { statusCode: 0, body: undefined as unknown };
  const res = {
    headers,
    chunks,
    state,
    setHeader: (key: string, value: string) => { headers[key.toLowerCase()] = value; },
    status(code: number) { state.statusCode = code; return this; },
    write: (chunk: Uint8Array) => { chunks.push(Buffer.from(chunk)); return true; },
    end: jest.fn(),
    once: jest.fn(),
    destroy: jest.fn(),
    json(body: unknown) { state.body = body; return this; },
  };
  return res as unknown as Response & typeof res;
};

const fakeRequest = () => ({ on: jest.fn() }) as unknown as Request;

/** 상류가 준 것처럼 보이는 응답 하나. */
const upstreamResponse = (options: {
  status?: number;
  headers?: Record<string, string>;
  body?: string | null;
}) => ({
  ok: (options.status ?? 200) < 400,
  status: options.status ?? 200,
  headers: new Headers(options.headers ?? {}),
  body: options.body === null
    ? null
    : new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(options.body ?? "%PDF-1.7"));
        controller.close();
      },
    }),
});

const OA_PATH = ["oa", "2022", "1020220059638_의견제출통지서_20230629.pdf"];

describe("PatentDocumentController", () => {
  const fetchMock = jest.fn();
  const controller = new PatentDocumentController(configWith(FILE_ORIGIN));

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("한글 파일명을 그대로 이어 붙여 상류를 부른다", async () => {
    // Express 5는 마디를 이미 디코딩해서 준다. 여기서 또 풀거나 다시 인코딩하면 어긋난다.
    fetchMock.mockResolvedValue(upstreamResponse({ headers: { "content-type": "application/pdf" } }));
    await controller.streamDocument(OA_PATH, fakeRequest(), fakeResponse());

    expect(fetchMock.mock.calls[0][0]).toBe(
      `${FILE_ORIGIN}/oa/2022/1020220059638_의견제출통지서_20230629.pdf`,
    );
  });

  it("Range를 상류로 그대로 넘긴다", async () => {
    // 삼켜 버리면 PDF.js가 첫 화면만 받는 대신 매번 파일 전체를 받아야 열린다.
    fetchMock.mockResolvedValue(upstreamResponse({ status: 206 }));
    await controller.streamDocument(OA_PATH, fakeRequest(), fakeResponse(), "bytes=0-99");

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ headers: { Range: "bytes=0-99" } });
  });

  it("부분 응답에 필요한 머리글을 그대로 옮긴다", async () => {
    fetchMock.mockResolvedValue(upstreamResponse({
      status: 206,
      headers: {
        "content-type": "application/pdf",
        "content-range": "bytes 0-99/103987",
        "accept-ranges": "bytes",
        etag: '"abc"',
      },
    }));
    const res = fakeResponse();
    await controller.streamDocument(OA_PATH, fakeRequest(), res, "bytes=0-99");

    expect(res.state.statusCode).toBe(206);
    expect(res.headers["content-range"]).toBe("bytes 0-99/103987");
    expect(res.headers["accept-ranges"]).toBe("bytes");
    expect(res.headers.etag).toBe('"abc"');
    // 새 창에서 눌렀을 때 내려받지 않고 그 자리에서 보이게 한다.
    expect(res.headers["content-disposition"]).toBe("inline");
  });

  it("본문을 그대로 흘려보낸다", async () => {
    fetchMock.mockResolvedValue(upstreamResponse({ body: "%PDF-1.7 body" }));
    const res = fakeResponse();
    await controller.streamDocument(OA_PATH, fakeRequest(), res);

    expect(Buffer.concat(res.chunks).toString()).toBe("%PDF-1.7 body");
    expect(res.end).toHaveBeenCalled();
  });

  describe("열린 프록시가 되지 않게", () => {
    it("허용하지 않은 경로는 상류를 부르지도 않는다", async () => {
      await expect(
        controller.streamDocument(["etc", "passwd"], fakeRequest(), fakeResponse()),
      ).rejects.toThrow("DOCUMENT_NOT_FOUND");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("상위 경로로 빠져나가려는 시도도 막는다", async () => {
      await expect(
        controller.streamDocument(["oa", "..", "etc"], fakeRequest(), fakeResponse()),
      ).rejects.toThrow("DOCUMENT_NOT_FOUND");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("파일 호스트 설정이 없으면 중계 자체를 하지 않는다", async () => {
      await expect(
        new PatentDocumentController(configWith(null))
          .streamDocument(OA_PATH, fakeRequest(), fakeResponse()),
      ).rejects.toThrow("DOCUMENT_PROXY_DISABLED");
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("상류가 말을 안 들을 때", () => {
    it("없는 문서는 404로 옮긴다", async () => {
      fetchMock.mockResolvedValue(upstreamResponse({ status: 404, body: null }));
      const res = fakeResponse();
      await controller.streamDocument(OA_PATH, fakeRequest(), res);

      expect(res.state.statusCode).toBe(404);
    });

    it("닿지 않으면 502로 알린다", async () => {
      // 상류 사정을 그대로 5xx로 흘리면 우리 서비스가 죽은 것처럼 보인다.
      fetchMock.mockRejectedValue(new Error("connect ECONNREFUSED"));
      const res = fakeResponse();
      await controller.streamDocument(OA_PATH, fakeRequest(), res);

      expect(res.state.statusCode).toBe(502);
      expect(res.state.body).toEqual({ message: "DOCUMENT_UPSTREAM_ERROR" });
    });
  });
});
