/**
 * 문서 PDF 주소를 **우리 서비스를 거치는 주소로** 바꾼다.
 *
 * ## 왜 우리를 거치게 하는가
 *
 * OA 파일 호스트(SeaweedFS)는 **인증이 없다.** 주소만 알면 누구나 받아 갈 수 있고, 주소도
 * 규칙적이다(`/oa/{연도}/{출원번호}_{문서종류}_{YYYYMMDD}.pdf`). 지금은 사내망 안이라
 * 가려져 있을 뿐이라, 그 호스트를 그대로 밖에 열면 5만여 건이 전부 공개된다.
 *
 * 그래서 파일 호스트를 노출하는 대신 이 서비스가 중계한다 — 설명 편집기의 이미지를
 * `/patent-records/:id/note-images/:fileName`으로 내보내는 것과 같은 이유이고 같은 방식이다.
 * 중계 endpoint에는 기존 세션·권한(`patentAnalysis.read`)이 그대로 걸린다.
 *
 * ## origin만 바꾸고 경로는 그대로 둔다
 *
 * `http://172.16.1.210:8888/oa/2022/….pdf` → `/patent-documents/oa/2022/….pdf`
 *
 * 뒤쪽을 손대지 않는 것이 중요하다. 화면이 이 주소에서 **파일명과 날짜를 읽어**
 * 타임라인을 만든다(patentDocumentNodes.ts). 질의 문자열에 경로를 담는 식으로 모양을
 * 바꾸면 그 파싱이 조용히 깨진다.
 *
 * ## 저장은 원본 그대로 한다
 *
 * DB에는 상류가 준 주소를 그대로 둔다. 중계 경로는 배포 구조지 데이터가 아니다 — 저장해
 * 두면 구조가 바뀔 때마다 쌓인 주소가 전부 틀린 값이 된다. 나가는 길에만 바꾼다.
 */

/** 중계 endpoint의 경로. 컨트롤러의 @Controller 경로와 반드시 같아야 한다. */
export const DOCUMENT_PROXY_PATH = "/patent-documents";

/**
 * 중계해 줄 경로의 첫 마디.
 *
 * 이 목록이 곧 **열린 프록시가 되지 않게 막는 문**이다. 파일 호스트의 이 두 갈래 밑에만
 * 문서가 있다(OA DB 기준 `/oa` 23,163건 · `/response` 30,032건). 여기 없는 경로는 우리가
 * 대신 불러 줄 이유가 없다.
 */
export const DOCUMENT_PROXY_ALLOWED_SEGMENTS = ["oa", "response"] as const;

/** `/oa/2022/x.pdf` → `oa`. 앞의 빈 마디를 건너뛴다. */
const firstSegment = (pathname: string): string =>
  pathname.split("/").filter(Boolean)[0] ?? "";

const isProxyablePathname = (pathname: string): boolean =>
  (DOCUMENT_PROXY_ALLOWED_SEGMENTS as readonly string[]).includes(
    firstSegment(pathname),
  );

/**
 * 상류 문서 주소 → 중계 주소.
 *
 * 돌려주는 값은 **API 기준 상대 경로**다(`/patent-documents/oa/…`). 절대 주소로 만들지
 * 않는 이유: 이 서버는 브라우저가 자기를 어떤 주소로 부르는지 모른다(앞단 nginx가
 * `/ip-workspace/` 같은 prefix를 붙인다). 완성은 화면이 한다 —
 * `patentRecordApi.documentDisplayUrl`이 다른 API 호출과 같은 규칙으로 앞을 붙인다.
 */
const toProxyPath = (value: string, fileOrigin: string): string | null => {
  let source: URL;
  try {
    source = new URL(value);
  } catch {
    // 절대 URL이 아니다. 어디를 중계해야 할지 알 수 없으니 그대로 둔다.
    return null;
  }

  // 우리가 아는 파일 호스트가 아니면 손대지 않는다. 중계 대상이 아니다.
  if (source.origin.toLowerCase() !== fileOrigin.toLowerCase()) return null;
  if (!isProxyablePathname(source.pathname)) return null;

  /**
   * 뒤쪽을 `source.pathname`으로 다시 만들지 않고 원문에서 잘라 낸다.
   *
   * 파일명에는 한글이 들어 있는데(`…_의견제출통지서_20230620.pdf`) `URL.pathname`은 그것을
   * 퍼센트 인코딩해 돌려준다. 같은 주소이긴 하지만, 화면이 이 문자열에서 파일명을 뽑아
   * 쓰므로 시키지 않은 변형을 끼워 넣지 않는다.
   */
  const rest = value.slice(source.origin.length);
  return `${DOCUMENT_PROXY_PATH}${rest}`;
};

/**
 * 문서 주소 변환기 하나를 만든다.
 *
 * fileOrigin이 없으면 **그대로 돌려주는 함수**를 준다. 중계할 대상을 모르는 상태에서
 * 주소를 건드리면 어디로도 닿지 않는 주소가 된다 — 차라리 상류 주소를 그대로 두면
 * 사내에서는 여전히 열린다.
 */
export const createDocumentUrlRewriter = (
  fileOrigin: string | undefined | null,
): ((value: string | null | undefined) => string | null) => {
  /** 값이 없거나 공백뿐이면 null. 빈 문자열을 흘려보내면 화면이 '문서 있음'으로 읽는다. */
  const keep = (value: string | null | undefined): string | null =>
    (value && value.trim() ? value : null);

  const trimmed = fileOrigin?.trim();
  if (!trimmed) return keep;

  let origin: string;
  try {
    origin = new URL(trimmed).origin;
  } catch {
    return keep;
  }

  return (value) => {
    const kept = keep(value);
    if (kept === null) return null;
    return toProxyPath(kept, origin) ?? kept;
  };
};

/**
 * 중계 경로 → 실제로 받아 올 상류 주소.
 *
 * 중계 endpoint가 쓴다. **검사 없이 이어 붙이면 열린 프록시가 된다** — 통과 조건을 이 한
 * 곳에 두어, 주소를 만드는 쪽과 받아 오는 쪽이 같은 규칙을 보게 한다.
 */
export const toUpstreamDocumentUrl = (
  pathname: string,
  fileOrigin: string,
): string | null => {
  const withSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  // `..`로 상위 경로를 짚어 빠져나가는 것을 막는다.
  if (withSlash.includes("..")) return null;
  if (!isProxyablePathname(withSlash)) return null;

  try {
    return `${new URL(fileOrigin).origin}${withSlash}`;
  } catch {
    return null;
  }
};
