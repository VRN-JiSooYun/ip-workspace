import { Button } from 'antd';
import { ChevronDown, ChevronUp } from 'lucide-react';
import React from 'react';
import { hasRichContent, richTextToPlain, sanitizeRichHtml } from '../../utils/richText';

type ContactContentViewerProps = {
  html?: string;
  expanded?: boolean;
  onToggle?: () => void;
  alwaysExpanded?: boolean;
  emptyText?: string;
};

/**
 * 거름망은 utils/richText로 옮겼다 — 관리 특허 상세의 '설명'도 같은 편집기를 쓰는데
 * 규칙을 두 벌 두면 한쪽만 고쳐진다. 이름은 그대로 두어 이 화면의 호출부를 건드리지
 * 않는다.
 */
export const sanitizeContactHtml = sanitizeRichHtml;
export const getContactPlainText = richTextToPlain;
export const hasContactContent = hasRichContent;

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
