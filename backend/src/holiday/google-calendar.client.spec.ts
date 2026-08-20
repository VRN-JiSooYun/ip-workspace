import { HttpService } from "@nestjs/axios";
import { createPublicKey, createVerify, generateKeyPairSync } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GoogleCalendarClient } from "./google-calendar.client";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const serviceAccountFile = join(
  mkdtempSync(join(tmpdir(), "gcal-spec-")),
  "sa.json",
);
writeFileSync(
  serviceAccountFile,
  JSON.stringify({
    client_email: "ipws-calendar@example.iam.gserviceaccount.com",
    private_key: privateKey,
    token_uri: "https://oauth2.example/token",
  }),
);

const fromBase64Url = (value: string): string =>
  Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
    "utf8",
  );

type Axios = {
  get: jest.Mock;
  post: jest.Mock;
};

const clientWith = (
  eventPages: Array<Record<string, unknown>>,
  overrides: Record<string, unknown> = {},
): { client: GoogleCalendarClient; axios: Axios } => {
  const post = jest
    .fn()
    .mockResolvedValue({ data: { access_token: "token-1", expires_in: 3600 } });
  const get = jest.fn();
  eventPages.forEach((page) => get.mockResolvedValueOnce({ data: page }));

  const httpService = { axiosRef: { get, post } } as unknown as HttpService;
  const config = {
    get: (key: string, fallback?: unknown) =>
      ({
        "googleCalendar.serviceAccountFile": serviceAccountFile,
        "googleCalendar.timeoutMs": 15000,
        ...overrides,
      })[key] ?? fallback,
  } as never;

  return {
    client: new GoogleCalendarClient(httpService, config),
    axios: { get, post },
  };
};

describe("GoogleCalendarClient", () => {
  it("서비스 계정 키로 서명한 JWT bearer assertion을 보낸다", async () => {
    const { client, axios } = clientWith([{ items: [] }]);

    await client.listEvents("holidays@example.com", "2026-01-01", "2027-01-01");

    const [tokenUri, body] = axios.post.mock.calls[0];
    expect(tokenUri).toBe("https://oauth2.example/token");
    const params = body as URLSearchParams;
    expect(params.get("grant_type")).toBe(
      "urn:ietf:params:oauth:grant-type:jwt-bearer",
    );

    const assertion = params.get("assertion") as string;
    const [header, claims, signature] = assertion.split(".");
    expect(JSON.parse(fromBase64Url(header))).toEqual({
      alg: "RS256",
      typ: "JWT",
    });
    const parsedClaims = JSON.parse(fromBase64Url(claims));
    expect(parsedClaims.iss).toBe(
      "ipws-calendar@example.iam.gserviceaccount.com",
    );
    expect(parsedClaims.scope).toBe(
      "https://www.googleapis.com/auth/calendar.readonly",
    );
    expect(parsedClaims.aud).toBe("https://oauth2.example/token");
    expect(parsedClaims.exp).toBeGreaterThan(parsedClaims.iat);

    // 서명이 실제로 그 키로 검증되는지 확인한다.
    const verified = createVerify("RSA-SHA256")
      .update(`${header}.${claims}`)
      .verify(
        createPublicKey(publicKey),
        Buffer.from(
          signature.replace(/-/g, "+").replace(/_/g, "/"),
          "base64",
        ),
      );
    expect(verified).toBe(true);
  });

  it("캘린더 ID의 #을 인코딩해 경로에 넣는다", async () => {
    const { client, axios } = clientWith([{ items: [] }]);

    await client.listEvents(
      "ko.south_korea#holiday@group.v.calendar.google.com",
      "2026-01-01",
      "2027-01-01",
    );

    const [path, options] = axios.get.mock.calls[0];
    expect(path).toBe(
      "https://www.googleapis.com/calendar/v3/calendars/" +
        "ko.south_korea%23holiday%40group.v.calendar.google.com/events",
    );
    expect(options.headers.Authorization).toBe("Bearer token-1");
    expect(options.params).toMatchObject({
      timeMin: "2026-01-01",
      timeMax: "2027-01-01",
      singleEvents: true,
    });
  });

  it("nextPageToken을 끝까지 따라간다", async () => {
    const { client, axios } = clientWith([
      { items: [{ summary: "a" }], nextPageToken: "p2" },
      { items: [{ summary: "b" }] },
    ]);

    const events = await client.listEvents("c@example.com", "min", "max");

    expect(events.map((event) => event.summary)).toEqual(["a", "b"]);
    expect(axios.get.mock.calls[1][1].params.pageToken).toBe("p2");
  });

  it("access token을 캐시해 호출마다 재발급하지 않는다", async () => {
    const { client, axios } = clientWith([{ items: [] }, { items: [] }]);

    await client.listEvents("c@example.com", "min", "max");
    await client.listEvents("c@example.com", "min", "max");

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  it("자격증명 경로가 비어 있으면 isConfigured가 false다", () => {
    const { client } = clientWith([], {
      "googleCalendar.serviceAccountFile": "",
    });

    expect(client.isConfigured).toBe(false);
  });

  it("상위 실패는 BadGateway로 접어 원본 오류를 흘리지 않는다", async () => {
    const { client, axios } = clientWith([]);
    axios.get.mockRejectedValueOnce({
      message: "boom",
      response: { status: 404 },
    });

    await expect(
      client.listEvents("missing@example.com", "min", "max"),
    ).rejects.toThrow("GOOGLE_CALENDAR_UNAVAILABLE");
  });
});
