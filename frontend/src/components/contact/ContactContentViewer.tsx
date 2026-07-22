import { Button } from 'antd';
import { ChevronDown, ChevronUp } from 'lucide-react';
import React from 'react';

type ContactContentViewerProps = {
  html?: string;
  expanded?: boolean;
  onToggle?: () => void;
  alwaysExpanded?: boolean;
  emptyText?: string;
};

const ALLOWED_TAGS = new Set([
  'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'UL', 'OL', 'LI', 'A', 'IMG', 'SPAN',
]);
const REMOVED_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH']);

const isSafeImageSource = (value: string) => (
  value.startsWith('/') || /^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(value)
);

const isSafeLink = (value: string) => (
  value.startsWith('/') || /^https?:\/\//i.test(value) || /^mailto:/i.test(value)
);

export const sanitizeContactHtml = (html?: string): string => {
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

export const getContactPlainText = (html?: string): string => {
  if (!html || typeof DOMParser === 'undefined') return '';
  return new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim() ?? '';
};

export const hasContactContent = (html?: string): boolean => (
  Boolean(getContactPlainText(html)) || /<img\b/i.test(html ?? '')
);

const ContactContentViewer: React.FC<ContactContentViewerProps> = ({
  html,
  expanded = false,
  onToggle,
  alwaysExpanded = false,
  emptyText = '-',
}) => {
  const sanitizedHtml = React.useMemo(() => sanitizeContactHtml(html), [html]);
  const plainText = React.useMemo(() => getContactPlainText(sanitizedHtml), [sanitizedHtml]);
  const canExpand = Boolean(onToggle);
  const showFullContent = alwaysExpanded || expanded;

  if (!sanitizedHtml) return <span className="contact-empty-cell">{emptyText}</span>;

  return (
    <div className={`contact-content-viewer ${showFullContent ? 'is-expanded' : 'is-collapsed'}`}>
      {showFullContent ? (
        <div
          className="contact-content-html"
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      ) : (
        <div className="contact-content-summary">{plainText || '첨부 이미지'}</div>
      )}
      {canExpand ? (
        <Button
          className="contact-content-toggle"
          type="link"
          size="small"
          icon={showFullContent ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          aria-expanded={showFullContent}
          onClick={onToggle}
        >
          {showFullContent ? '접기' : '펼치기'}
        </Button>
      ) : null}
    </div>
  );
};

export default ContactContentViewer;
