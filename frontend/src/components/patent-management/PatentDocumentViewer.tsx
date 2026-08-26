import React, { useMemo, useState } from 'react';
import { Empty, Tag, Tooltip, Typography } from 'antd';
import { FileText } from 'lucide-react';
import PatentDocumentPdfPane from './PatentDocumentPdfPane';
import PatentDocumentTimeline, { type TimelineSelection } from './PatentDocumentTimeline';
import { buildTimelineEntries, type PdfSource } from './patentDocumentNodes';
import { formatDisplayDateTime } from '../../utils/displayFormat';
import { getLegalStatusTagColor } from '../../utils/legalStatusTag';
import './PatentDocumentViewer.css';
import type { PatentSearchItem } from '../../services/patentSearchApi';

const { Text } = Typography;

type Props = {
  /**
   * 이 특허의 통지 건 전부. 타임라인이 통지일 순으로 늘어놓는다.
   *
   * 예전에는 통지 건 하나(`item`)만 받고 건 선택은 부르는 쪽의 Segmented가 했다. 축이
   * 둘로 갈려 있으면(건 선택 + 문서 선택) 하나의 타임라인으로 합칠 수 없어 목록을 받는다.
   */
  items: PatentSearchItem[];
  /** 보고 있는 통지 건(officeActionId). null이면 타임라인의 첫 건. */
  activeItemId: number | null;
  onActiveItemChange: (officeActionId: number | null) => void;
  legalStatusLabel: string | null;
  examStatusLabel: string | null;
  /**
   * 보고 있는 문서 노드의 key. 통지 건을 바꿔도 같은 종류의 문서를 유지하려면 부르는 쪽이
   * 들고 있어야 한다(이 컴포넌트는 문서마다 다시 그려지므로 여기서 기억하면 뷰어가
   * 사라질 때 함께 사라진다). 넘기지 않으면 스스로 들고 있는다.
   */
  activeTabKey?: string | null;
  onActiveTabKeyChange?: (key: string) => void;
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

/**
 * 타임라인에서 고른 문서 하나의 원본. 특허 분석 화면과 같은 PDF 뷰어를 쓴다.
 *
 * 문서 선택은 타임라인이 하므로 여기서는 선택 UI를 두지 않는다.
 */
const FullTextPane: React.FC<{ sources: PdfSource[] }> = ({ sources }) => {
  // sources가 빌 수 있다. PDF 없이 본문만 있는 통지서, PDF가 딸리지 않은 의견서·보정서가
  // 그렇다 — 부르는 쪽이 그 경우 []를 그대로 넘긴다. sources[0].path로 바로 읽으면
  // 그런 문서를 고르는 순간 뷰어가 아니라 앱 전체가 죽는다(위에 error boundary가 없다).
  const resolvedPath = sources[0]?.path ?? null;

  if (!resolvedPath) {
    return (
      <div className="pm-viewer-preview">
        <Text type="secondary" style={{ fontSize: 12 }}>
          이 문서에는 첨부된 PDF 원본이 없습니다.
        </Text>
      </div>
    );
  }

  return (
    <div className="pm-doc-fulltext">
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
  items,
  activeItemId,
  onActiveItemChange,
  legalStatusLabel,
  examStatusLabel,
  activeTabKey,
  onActiveTabKeyChange,
}) => {
  /**
   * 특허의 모든 문서를 날짜순 한 줄로. 통지 건 경계가 아니라 날짜가 순서를 정한다
   * (통지서와 그 대응 서류가 몇 달 떨어져 있으면 축에서도 떨어진다).
   */
  const entries = useMemo(() => buildTimelineEntries(items), [items]);

  /** 부르는 쪽이 문서 선택을 관리하지 않을 때 쓰는 자체 상태. */
  const [ownNodeKey, setOwnNodeKey] = useState<string | null>(null);
  const requestedNodeKey = activeTabKey !== undefined ? activeTabKey : ownNodeKey;

  /**
   * 실제로 열 문서.
   *
   * (통지 건, 노드 key) 짝으로 찾고, 없으면 그 통지 건의 첫 문서 → 축의 첫 문서로 떨어진다.
   * 건마다 딸린 문서가 달라서다(의견서가 두 건인 통지도 있고 없는 통지도 있다).
   */
  const activeEntry = useMemo(() => {
    const ofItem = entries.filter((entry) => entry.item.officeActionId === activeItemId);
    return (
      ofItem.find((entry) => entry.node.key === requestedNodeKey)
      // 기억해 둔 문서가 이 건에 없으면 통지서로 연다. 축에서 날짜가 가장 앞인 문서가
      // 아니라 통지서인 이유: 통지가 그 건의 시작이고, 대응 서류만 먼저 열리면 무엇에
      // 대한 대응인지 모르는 채로 보게 된다.
      ?? ofItem.find((entry) => entry.node.kind === 'OFFICE_ACTION')
      ?? ofItem[0]
      ?? entries[0]
      ?? null
    );
  }, [entries, activeItemId, requestedNodeKey]);

  const activeItem = activeEntry?.item ?? null;
  const activeNode = activeEntry?.node ?? null;

  const selection: TimelineSelection = {
    officeActionId: activeItem?.officeActionId ?? null,
    nodeKey: activeNode?.key ?? '',
  };

  const handleSelect = (next: TimelineSelection) => {
    if (next.officeActionId !== selection.officeActionId) {
      onActiveItemChange(next.officeActionId);
    }
    setOwnNodeKey(next.nodeKey);
    onActiveTabKeyChange?.(next.nodeKey);
  };

  const headerFileName = activeItem
    ? (fileNameOf(activeItem.koreanTitle) ?? 'UNKNOWN')
    : null;

  // 높이·flex 배치는 PatentDocumentViewer.css의 .pm-doc-viewer가 갖는다.
  return (
    <section className="pm-doc-viewer">
      {!activeItem ? (
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
            <span>출원번호 <span className="pm-viewer-meta-value">{activeItem.applicationNumber ?? '-'}</span></span>
            <span className="pm-viewer-divider">|</span>
            {legalStatusLabel && (
              <>
                <span>법적 상태 <span className="pm-viewer-meta-value"></span></span>
                <Tag
                  color={getLegalStatusTagColor(legalStatusLabel)}
                  style={{ marginInlineEnd: 0 }}
                >
                  {legalStatusLabel}
                </Tag>
              </>
            )}
            {examStatusLabel && <Tag style={{ marginInlineEnd: 0 }}>{examStatusLabel}</Tag>}
          </div>

          {/* 탭 두 줄(통지 건 + 문서)을 대신하는 가로 타임라인. */}
          <PatentDocumentTimeline
            entries={entries}
            selection={selection}
            onSelect={handleSelect}
          />

          {/* 고른 문서 하나만 그린다. 타임라인이 무엇을 보고 있는지 이미 밝히므로
              여기서 제목을 다시 쓰지 않는다. */}
          <div className="pm-doc-viewer-pane">
            {activeNode ? (
              <FullTextPane sources={activeNode.sources} />
            ) : (
              <div className="pm-viewer-preview">
                <Text type="secondary" style={{ fontSize: 12 }}>
                  이 통지 건에 등록된 문서가 없습니다.
                </Text>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
};

export default PatentDocumentViewer;
