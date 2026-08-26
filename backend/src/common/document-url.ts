/**
 * 문서 URL을 **밖에서 닿는 주소로** 바꿔 준다.
 *
 * OA DB가 주는 `document_path`는 사내망 주소다(`http://172.16.1.210:8888/oa/2022/….pdf`).
 * 브라우저가 그 주소를 직접 열어야 PDF가 보이는데, 사무실 밖에서는 그 호스트에 닿지
 * 않는다. 앞에 Nginx를 세워 같은 경로로 중계하므로, 응답에 실어 보낼 때 **origin만**
 * 갈아 끼운다.
 *
 * ## 저장이 아니라 전달 시점에 바꾼다
 *
 * 값을 바꿔서 DB에 넣지 않는다. PATENT_DOCUMENT_BASE_URL은 배포 설정이지 데이터가 아니다 — 도메인이
 * 바뀌거나 프록시를 걷어내면 저장해 둔 주소가 전부 틀린 값이 된다. 원본은 상류가 준 그대로
 * 두고, 나가는 길에 한 번 옮긴다.
 *
 * ## PATENT_DOCUMENT_BASE_URL이 없으면 아무것도 하지 않는다
 *
 * 사내에서 쓰는 개발·운영 환경은 그 호스트에 직접 닿으므로 프록시가 필요 없다. 설정이
 * 없으면 상류가 준 주소를 그대로 내보낸다.
 */

/** origin만 갈아 끼운다. 뒤쪽(경로·쿼리·프래그먼트)은 **원문 그대로** 옮긴다. */
const rebase = (value: string, baseUrl: URL): string => {
  let source: URL;
  try {
    source = new URL(value);
  } catch {
    // 절대 URL이 아니다(상대 경로이거나 빈 값). 무엇을 바꿔야 할지 알 수 없으니 그대로 둔다.
    return value;
  }

  // http(s)가 아니면 프록시로 옮길 수 있는 주소가 아니다(data:, file: 등).
  if (source.protocol !== "http:" && source.protocol !== "https:") return value;

  /**
   * PATENT_DOCUMENT_BASE_URL에도 경로가 있을 수 있다(`https://ip.example.com/files`). 그때는 두 경로를
   * 이어 붙여야 Nginx의 location과 맞는다.
   */
  const basePath = baseUrl.pathname.replace(/\/$/, "");

  /**
   * 뒤쪽을 `source.pathname`으로 다시 만들지 않고 원문에서 잘라 낸다.
   *
   * OA 문서의 파일명에는 한글이 들어 있는데(`…_의견제출통지서_20230620.pdf`),
   * `URL.pathname`은 그것을 퍼센트 인코딩해서 돌려준다. 기능상 같은 주소지만 우리가
   * 하겠다고 한 일은 origin 치환 하나다 — 시키지 않은 변형을 끼워 넣으면, 이 값을 그대로
   * 비교하거나 파일명을 뽑아 쓰는 쪽에서 조용히 어긋난다.
   */
  const rest = value.toLowerCase().startsWith(source.origin.toLowerCase())
    ? value.slice(source.origin.length)
    : `${source.pathname}${source.search}${source.hash}`;

  return `${baseUrl.origin}${basePath}${rest}`;
};

/**
 * 문서 URL 변환기 하나를 만든다.
 *
 * baseUrl이 없거나 형식이 틀리면 **그대로 돌려주는 함수**를 준다. 설정이 잘못됐다고 문서
 * 목록 자체를 못 쓰게 만들 이유가 없다 — 사내에서는 원본 주소로 여전히 열린다.
 */
export const createDocumentUrlRewriter = (
  baseUrl: string | undefined | null,
): ((value: string | null | undefined) => string | null) => {
  /** 값이 없거나 공백뿐이면 null. 빈 문자열을 그대로 흘려보내면 화면이 '문서 있음'으로 읽는다. */
  const passThrough = (value: string | null | undefined): string | null =>
    (value && value.trim() ? value : null);

  const trimmed = baseUrl?.trim();
  if (!trimmed) return passThrough;

  let base: URL;
  try {
    base = new URL(trimmed);
  } catch {
    return passThrough;
  }

  return (value) => {
    const kept = passThrough(value);
    return kept === null ? null : rebase(kept, base);
  };
};
