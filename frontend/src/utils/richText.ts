/**
 * 서식 있는 글(WYSIWYG 편집기가 만든 HTML 조각)을 그리기 전에 거르는 규칙.
 *
 * 원래 문의 화면(ContactContentViewer) 안에 있던 것을 끌어냈다. 관리 특허 상세의 '설명'도
 * 같은 편집기를 쓰는데, **거름망을 복사해 두 벌 두면 한쪽만 고쳐지는 날이 온다.**
 * 무엇을 허용하는지는 한 자리에만 적는다.
 *
 * 서버는 이 HTML을 검사하지 않고 그대로 보관한다(길이 상한만 본다). 그래서 거르는 일은
 * 여기서, 그리고 **그릴 때마다** 한다 — 저장 시점에 한 번만 걸러 두면 그 전에 들어온
 * 값이나 다른 경로(CSV 임포트)로 들어온 값이 걸러지지 않은 채 innerHTML로 간다.
 */

/**
 * 남길 태그.
 *
 * 전부 서식 태그다 — 스크립트를 실행하거나 바깥을 부르는 태그는 하나도 없다. 여기 없는
 * 태그는 지우지 않고 **껍데기만 벗긴다**(자식은 남긴다). 모르는 래퍼 하나 때문에 글이
 * 통째로 사라지는 편이 더 나쁘다.
 */
const ALLOWED_TAGS = new Set([
  'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'STRIKE',
  'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE',
  'H1', 'H2', 'H3', 'A', 'IMG', 'SPAN',
]);

/** 껍데기를 벗기는 것으로 부족한 태그. 자식째 들어낸다. */
const REMOVED_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH']);

/** 같은 출처의 경로이거나, 편집기가 붙여 넣기로 만든 data URL 이미지만. */
const isSafeImageSource = (value: string) => (
  value.startsWith('/') || /^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(value)
);

const isSafeLink = (value: string) => (
  value.startsWith('/') || /^https?:\/\//i.test(value) || /^mailto:/i.test(value)
);

/**
 * innerHTML에 넣어도 되는 조각으로 만든다.
 *
 * DOMParser로 파싱하는 이유: 정규식으로 태그를 지우면 `<img src=x onerror=...` 같은
 * 반쯤 깨진 마크업에서 늘 진다. 파서가 브라우저와 **같은 방식으로** 읽은 트리를 손본다.
 */
export const sanitizeRichHtml = (html?: string | null): string => {
  if (!html || typeof DOMParser === 'undefined') return '';
  const documentNode = new DOMParser().parseFromString(html, 'text/html');

  Array.from(documentNode.body.querySelectorAll('*')).forEach((element) => {
    if (REMOVED_TAGS.has(element.tagName)) {
      element.remove();
      return;
    }
    if (!ALLOWED_TAGS.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }

    // 속성은 화이트리스트 방식이다. on*·style·class가 모두 여기서 떨어진다.
    const allowedAttributes = element.tagName === 'IMG'
      ? new Set(['src', 'alt', 'title'])
      : element.tagName === 'A'
        ? new Set(['href', 'title'])
        : new Set<string>();
    Array.from(element.attributes).forEach((attribute) => {
      if (!allowedAttributes.has(attribute.name.toLowerCase())) {
        element.removeAttribute(attribute.name);
      }
    });

    if (element instanceof HTMLImageElement) {
      if (!isSafeImageSource(element.src.replace(window.location.origin, ''))) {
        element.remove();
        return;
      }
      element.loading = 'lazy';
    }
    if (element instanceof HTMLAnchorElement) {
      const href = element.getAttribute('href') ?? '';
      if (!isSafeLink(href)) element.removeAttribute('href');
      if (element.hasAttribute('href')) {
        element.target = '_blank';
        element.rel = 'noopener noreferrer';
      }
    }
  });

  return documentNode.body.innerHTML;
};

/** 태그를 벗긴 글자만. 요약·미리보기·빈 값 판정에 쓴다. */
export const richTextToPlain = (html?: string | null): string => {
  if (!html || typeof DOMParser === 'undefined') return '';
  return new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim() ?? '';
};

/**
 * 사람이 보기에 내용이 있는가.
 *
 * 편집기는 내용을 지워도 `<p><br></p>`를 남기므로 문자열 길이로는 판정할 수 없다.
 * 글자가 없어도 이미지 한 장이면 내용이 있는 것이다.
 */
export const hasRichContent = (html?: string | null): boolean => (
  Boolean(richTextToPlain(html)) || /<img\b/i.test(html ?? '')
);
