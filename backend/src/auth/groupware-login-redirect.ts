// Groupware 링크에는 base64 Token의 `+`가 인코딩되지 않은 채 실려 오고, 쿼리 파서는
// 이를 공백으로 바꾼다. base64에 공백은 없으므로 되돌려도 안전하다.
export const normalizeLoginToken = (value: string): string =>
  value.replace(/ /g, "+");

const PROBE_ORIGIN = "http://localhost";

/**
 * 로그인 뒤 돌려보낼 주소. 앱 prefix(`basePath`) 아래의 화면 경로만 허용하고, 그 밖이면
 * 앱 첫 화면(`basePath`)으로 보낸다. `//evil.com`, `/\evil.com`, `/ip-workspace/../evil`,
 * API 직접 이동을 모두 막는다.
 *
 * @param basePath 항상 `/`로 시작하고 끝나는 앱 prefix (예: `/ip-workspace/`, prefix 없으면 `/`)
 */
export const resolveSafeNext = (
  value: string | undefined,
  basePath: string,
): string => {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return basePath;
  }
  let target: URL;
  try {
    // 브라우저와 같은 규칙으로 정규화해서 `..`와 역슬래시 우회를 걸러낸다.
    target = new URL(value, PROBE_ORIGIN);
  } catch {
    return basePath;
  }
  if (target.origin !== PROBE_ORIGIN) return basePath;
  if (!target.pathname.startsWith(basePath)) return basePath;
  if (target.pathname.startsWith(`${basePath}api/`)) return basePath;
  return `${target.pathname}${target.search}${target.hash}`;
};
