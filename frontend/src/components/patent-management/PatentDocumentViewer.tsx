import React, { useMemo, useState } from 'react';
import { Button, Empty, Segmented, Tabs, Tag, Tooltip, Typography } from 'antd';
import { ExternalLink, FileText, X } from 'lucide-react';
import PatentDocumentPdfPane from './PatentDocumentPdfPane';
import { formatDisplayDateOnly } from '../../utils/displayFormat';
import './PatentDocumentViewer.css';
import type {
  PatentSearchItem,
  PatentSearchRejection,
  PatentSearchSubmission,
} from '../../services/patentSearchApi';

const { Text } = Typography;

type Props = {
  /** 목록에서 선택한 OA. null이면 안내 문구만 보여준다. */
  item: PatentSearchItem | null;
  legalStatusLabel: string | null;
  examStatusLabel: string | null;
  onClose: () => void;
};

/** `http://.../oa/2023/1020237016326_의견제출통지서_20260526.pdf` → 마지막 경로 조각. */
const fileNameOf = (documentPath: string | null): string | null => {
  if (!documentPath) return null;
  const lastSegment = documentPath.split('/').pop();
  if (!lastSegment) return null;
  // 경로에 한글이 들어 있어 서버가 인코딩해 보내는 경우가 있다.
  try {
    return decodeURIComponent(lastSegment);
  } catch {
    return lastSegment;
  }
};

/** `제29조 제2항 제1호` 형태로 조립한다. 없는 단위는 건너뛴다. */
const formatRejection = (rejection: PatentSearchRejection): string => {
  const parts: string[] = [];
  if (rejection.article !== null) parts.push(`제${rejection.article}조`);
  if (rejection.paragraph !== null) parts.push(`제${rejection.paragraph}항`);
  if (rejection.subParagraph !== null) parts.push(`제${rejection.subParagraph}호`);
  return parts.length > 0 ? parts.join(' ') : '조문 미지정';
};

/**
 * 본문은 외부 API가 markdown에 가까운 평문으로 준다(`# 의견제출통지서`, `【제출인】` 등).
 * 렌더러를 붙이지 않고 줄바꿈만 살려 원문 그대로 보여준다.
 */
const DocumentBody: React.FC<{
  content: string | null;
  contentLength: number;
  documentPath: string | null;
}> = ({ content, contentLength, documentPath }) => (
  <div className="pm-viewer-preview">
    {documentPath && (
      <div style={{ marginBottom: 12 }}>
        <Button
          size="small"
          icon={<ExternalLink size={13} />}
          href={documentPath}
          target="_blank"
          rel="noreferrer"
        >
          PDF 원본 열기
        </Button>
      </div>
    )}
    {content ? (
      <pre className="pm-doc-body">{content}</pre>
    ) : (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {contentLength > 0
          ? '본문을 불러오지 않았습니다.'
          : '등록된 본문이 없습니다.'}
      </Text>
    )}
  </div>
);

type PdfSource = { label: string; path: string };

/**
 * `문서 전문` 탭. 특허 분석 화면과 같은 PDF 뷰어로 원본을 그대로 보여준다.
 *
 * OA 하나에 통지서·의견서·보정서 PDF가 각각 딸릴 수 있어, 문서가 둘 이상이면 위에
 * 선택 버튼을 둔다. 하나뿐이면 선택 UI 없이 바로 그린다.
 */
const FullTextPane: React.FC<{ sources: PdfSource[] }> = ({ sources }) => {
  const [activePath, setActivePath] = useState(sources[0].path);
  // 선택이 바뀌어 문서 구성이 달라지면 첫 문서로 되돌린다.
  const resolvedPath = sources.some((source) => source.path === activePath)
    ? activePath
    : sources[0].path;

  return (
    <div className="pm-doc-fulltext">
      {sources.length > 1 && (
        <Segmented
          size="small"
          value={resolvedPath}
          onChange={(value) => setActivePath(value as string)}
          options={sources.map((source) => ({
            label: source.label,
            value: source.path,
          }))}
          className="pm-doc-fulltext-switch"
        />
      )}
      {/* key를 주어 문서가 바뀌면 뷰어를 새로 마운트한다. */}
      <PatentDocumentPdfPane key={resolvedPath} documentPath={resolvedPath} />
    </div>
  );
};

/**
 * 문서 뷰어 — 관련 특허 목록에서 선택한 OA의 의견제출통지서·의견서·보정서를 보여준다.
 *
 * 데이터는 `patentSearchApi`의 결과 항목을 그대로 쓴다. 목록을
 * `includeContent: false`로 받았다면 본문이 비어 있으므로 길이만 표시된다.
 */
const PatentDocumentViewer: React.FC<Props> = ({
  item,
  legalStatusLabel,
  examStatusLabel,
  onClose,
}) => {
  const tabItems = useMemo(() => {
    if (!item) return [];

    const labelFor = (
      submission: PatentSearchSubmission,
      index: number,
      sameKindCount: number,
    ) => {
      const base = submission.kind === 'OPINION' ? '의견서' : '보정서';
      return sameKindCount > 1 ? `${base} ${index + 1}` : base;
    };

    const opinions = item.submissions.filter((s) => s.kind === 'OPINION');
    const amendments = item.submissions.filter((s) => s.kind === 'AMENDMENT');
    // kind를 해석하지 못한 코드도 버리지 않고 별도 tab으로 남긴다.
    const others = item.submissions.filter((s) => s.kind === null);

    const tabs = [];

    if (item.content || item.documentPath || item.contentLength > 0) {
      tabs.push({
        key: 'office-action',
        label: item.action ?? '의견제출통지서',
        children: (
          <DocumentBody
            content={item.content}
            contentLength={item.contentLength}
            documentPath={item.documentPath}
          />
        ),
      });
    }

    [...opinions, ...amendments].forEach((submission) => {
      const sameKind = submission.kind === 'OPINION' ? opinions : amendments;
      const index = sameKind.indexOf(submission);
      tabs.push({
        key: `submission-${submission.id ?? `${submission.kind}-${index}`}`,
        label: labelFor(submission, index, sameKind.length),
        children: (
          <DocumentBody
            content={submission.content}
            contentLength={submission.contentLength}
            documentPath={submission.documentPath}
          />
        ),
      });
    });

    others.forEach((submission, index) => {
      tabs.push({
        key: `submission-other-${submission.id ?? index}`,
        label: `기타 문서${others.length > 1 ? ` ${index + 1}` : ''}`,
        children: (
          <DocumentBody
            content={submission.content}
            contentLength={submission.contentLength}
            documentPath={submission.documentPath}
          />
        ),
      });
    });

    // PDF가 있는 문서만 `문서 전문`에서 고를 수 있다.
    const pdfSources = [
      ...(item.documentPath
        ? [{ label: item.action ?? '의견제출통지서', path: item.documentPath }]
        : []),
      ...[...opinions, ...amendments, ...others].flatMap((submission, index) => {
        if (!submission.documentPath) return [];
        const sameKind =
          submission.kind === 'OPINION'
            ? opinions
            : submission.kind === 'AMENDMENT'
              ? amendments
              : others;
        const label =
          submission.kind === null
            ? `기타 문서${others.length > 1 ? ` ${index + 1}` : ''}`
            : labelFor(submission, sameKind.indexOf(submission), sameKind.length);
        return [{ label, path: submission.documentPath }];
      }),
    ];

    if (pdfSources.length > 0) {
      tabs.push({
        key: 'full-text',
        label: '문서 전문',
        // antd Tabs는 활성화된 뒤에야 pane을 그린다. 탭을 누르기 전에는 PDF를
        // 내려받지 않는다는 뜻이라 그대로 둔다.
        children: <FullTextPane sources={pdfSources} />,
      });
    }

    tabs.push({
      key: 'info',
      label: '정보',
      children: (
        <div className="pm-viewer-preview">
          <div className="pm-doc-field">
            <span className="pm-doc-field-label">출원번호</span>
            <span className="pm-doc-field-value">{item.applicationNumber ?? '-'}</span>
          </div>
          <div className="pm-doc-field">
            <span className="pm-doc-field-label">발명의 명칭</span>
            <span className="pm-doc-field-value">
              {item.koreanTitle ?? item.englishTitle ?? '-'}
            </span>
          </div>
          {item.englishTitle && item.koreanTitle && (
            <div className="pm-doc-field">
              <span className="pm-doc-field-label">영문 명칭</span>
              <span className="pm-doc-field-value">{item.englishTitle}</span>
            </div>
          )}
          <div className="pm-doc-field">
            <span className="pm-doc-field-label">출원인</span>
            <span className="pm-doc-field-value">{item.applicant ?? '-'}</span>
          </div>
          <div className="pm-doc-field">
            <span className="pm-doc-field-label">문서구분</span>
            <span className="pm-doc-field-value">{item.action ?? '-'}</span>
          </div>
          <div className="pm-doc-field">
            <span className="pm-doc-field-label">통지일</span>
            <span className="pm-doc-field-value">
              {formatDisplayDateOnly(item.actionDate)}
            </span>
          </div>
          <div className="pm-doc-field">
            <span className="pm-doc-field-label">발송번호</span>
            <span className="pm-doc-field-value">{item.actionNumber ?? '-'}</span>
          </div>
          <div className="pm-doc-field">
            <span className="pm-doc-field-label">법적 상태</span>
            <span className="pm-doc-field-value">{legalStatusLabel ?? '-'}</span>
          </div>
          <div className="pm-doc-field">
            <span className="pm-doc-field-label">심사 상태</span>
            <span className="pm-doc-field-value">{examStatusLabel ?? '-'}</span>
          </div>
          <div className="pm-doc-field">
            <span className="pm-doc-field-label">심사청구</span>
            <span className="pm-doc-field-value">
              {item.exam === null ? '-' : item.exam ? '청구' : '미청구'}
            </span>
          </div>

          <div className="pm-viewer-section-title">심사관</div>
          {item.examiners.length === 0 ? (
            <Text type="secondary" style={{ fontSize: 12 }}>정보가 없습니다.</Text>
          ) : (
            item.examiners.map((examiner, index) => (
              <div key={examiner.id ?? index} className="pm-doc-field">
                <span className="pm-doc-field-label">{examiner.name ?? '-'}</span>
                <span className="pm-doc-field-value">
                  {[examiner.office, examiner.bureau, examiner.department]
                    .filter(Boolean)
                    .join(' · ') || '-'}
                </span>
              </div>
            ))
          )}

          <div className="pm-viewer-section-title">거절이유</div>
          {item.rejections.length === 0 ? (
            <Text type="secondary" style={{ fontSize: 12 }}>정보가 없습니다.</Text>
          ) : (
            item.rejections.map((rejection, index) => (
              <div key={rejection.rejectionId ?? index} className="pm-doc-field">
                <span className="pm-doc-field-label">
                  <Tooltip title={`법종류 코드 ${rejection.lawType ?? '-'}`}>
                    <span>{formatRejection(rejection)}</span>
                  </Tooltip>
                </span>
                <span className="pm-doc-field-value">{rejection.claim ?? '-'}</span>
              </div>
            ))
          )}
        </div>
      ),
    });

    return tabs;
  }, [item, legalStatusLabel, examStatusLabel]);

  const headerFileName = item
    ? (fileNameOf(item.documentPath) ?? item.action ?? '문서')
    : null;

  return (
    <section
      className="pm-card pm-doc-viewer h-full"
      style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}
    >
      <div className="pm-card-header">
        <span className="pm-card-title">문서 뷰어</span>
        <Button icon={<X size={14} />} onClick={onClose} style={{ height: 32 }}>
          뷰어 닫기
        </Button>
      </div>

      {!item ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Text type="secondary" style={{ fontSize: 12 }}>
              관련 특허 목록에서 문서가 있는 특허를 선택하세요.
            </Text>
          }
          style={{ padding: '48px 0' }}
        />
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <FileText size={20} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
            <Tooltip title={headerFileName}>
              <span className="pm-ellipsis" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                {headerFileName}
              </span>
            </Tooltip>
          </div>

          <div className="pm-viewer-meta" style={{ marginBottom: 6 }}>
            <span>출원번호 <span className="pm-viewer-meta-value">{item.applicationNumber ?? '-'}</span></span>
            <span className="pm-viewer-divider">|</span>
            <span>통지일 <span className="pm-viewer-meta-value">{formatDisplayDateOnly(item.actionDate)}</span></span>
          </div>
          <div className="pm-viewer-meta" style={{ marginBottom: 12 }}>
            <span>문서구분 <span className="pm-viewer-meta-value">{item.action ?? '-'}</span></span>
            {legalStatusLabel && (
              <>
                <span className="pm-viewer-divider">|</span>
                <Tag color="blue" style={{ marginInlineEnd: 0 }}>{legalStatusLabel}</Tag>
              </>
            )}
            {examStatusLabel && <Tag style={{ marginInlineEnd: 0 }}>{examStatusLabel}</Tag>}
          </div>

          {/* 선택이 바뀌면 첫 tab부터 다시 보여준다. */}
          <Tabs key={item.officeActionId ?? 'none'} items={tabItems} />
        </>
      )}
    </section>
  );
};

export default PatentDocumentViewer;
