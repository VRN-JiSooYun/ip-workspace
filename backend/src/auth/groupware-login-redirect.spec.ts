import {
  normalizeLoginToken,
  resolveSafeNext,
} from "./groupware-login-redirect";

describe("normalizeLoginToken", () => {
  it("공백으로 바뀐 base64 `+`를 되돌린다", () => {
    expect(normalizeLoginToken("ab cd ef==")).toBe("ab+cd+ef==");
  });

  it("`+`, `/`, `=`는 그대로 둔다", () => {
    expect(normalizeLoginToken("ab+cd/ef==")).toBe("ab+cd/ef==");
  });
});

describe("resolveSafeNext", () => {
  const base = "/ip-workspace/";

  it("값이 없으면 앱 첫 화면으로 보낸다", () => {
    expect(resolveSafeNext(undefined, base)).toBe(base);
    expect(resolveSafeNext("", base)).toBe(base);
  });

  it("앱 prefix 아래 경로는 query와 hash까지 그대로 허용한다", () => {
    expect(
      resolveSafeNext("/ip-workspace/patent-management?tab=a#top", base),
    ).toBe("/ip-workspace/patent-management?tab=a#top");
  });

  it.each([
    ["외부 절대 주소", "https://evil.com/"],
    ["scheme-relative", "//evil.com/ip-workspace/"],
    ["역슬래시 우회", "/\\evil.com"],
    ["상대 경로", "patent-management"],
    ["prefix 밖 경로", "/other/path"],
    ["`..`로 prefix 탈출", "/ip-workspace/../evil"],
    ["인코딩된 `..`로 prefix 탈출", "/ip-workspace/%2e%2e/evil"],
    ["API 직접 이동", "/ip-workspace/api/auth/login"],
    ["`..`로 API 이동", "/ip-workspace/a/../api/patents"],
  ])("%s는 앱 첫 화면으로 보낸다", (_label, value) => {
    expect(resolveSafeNext(value, base)).toBe(base);
  });

  it("prefix가 없는 배포(`/`)에서도 API만 막고 나머지는 허용한다", () => {
    expect(resolveSafeNext("/dashboard", "/")).toBe("/dashboard");
    expect(resolveSafeNext("/api/auth/login", "/")).toBe("/");
    expect(resolveSafeNext("//evil.com", "/")).toBe("/");
  });
});
