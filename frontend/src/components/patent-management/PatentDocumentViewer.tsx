import React, { useEffect, useMemo, useState } from 'react';
import { Button, Empty, Tag, Typography } from 'antd';
import PatentDocumentPdfPane from './PatentDocumentPdfPane';
import PdfSearchTermTray, { type PdfSearchTerm } from './PdfSearchTermTray';
import PatentDocumentTimeline, { type TimelineSelection } from './PatentDocumentTimeline';
import { buildTimelineEntries, type PdfSource } from './patentDocumentNodes';
import { formatDisplayDateTime } from '../../utils/displayFormat';
import { getLegalStatusTagColor } from '../../utils/legalStatusTag';
import './PatentDocumentViewer.css';
import type {
  PatentSearchItem,
  PatentSearchKeyword,
  PatentSearchKeywordTarget,
} from '../../services/patentSearchApi';

const { Text } = Typography;
const NO_SEARCH_TERMS: string[] = [];

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
  /**
   * 보고 있는 문서 노드의 key. 통지 건을 바꿔도 같은 종류의 문서를 유지하려면 부르는 쪽이
   * 들고 있어야 한다(이 컴포넌트는 문서마다 다시 그려지므로 여기서 기억하면 뷰어가
   * 사라질 때 함께 사라진다). 넘기지 않으면 스스로 들고 있는다.
   */
  activeTabKey?: string | null;
  onActiveTabKeyChange?: (key: string) => void;
  /** Office Actions 본문 검색으로 들어온 경우 선택 문서의 매칭 근거를 표시한다. */
  searchKeywords?: PatentSearchKeyword[];
};

const NODE_KIND_BY_TARGET: Record<
  PatentSearchKeywordTarget,
  'OFFICE_ACTION' | 'OPINION' | 'AMENDMENT'
> = {
  officeAction: 'OFFICE_ACTION',
  opinion: 'OPINION',
  amendment: 'AMENDMENT',
};

const tokenizeSearchQuery = (query: string): string[] => (
  query.normalize('NFC').match(/[\p{L}\p{N}]+/gu) ?? []
);

const normalizedSearchText = (value: string): string => (
  value.normalize('NFC').toLocaleLowerCase()
);

/**
 * 공백만 무시하고 견주기 위한 형태.
 *
 * PDF 검색도 같은 규칙으로 공백을 지우고 찾으므로(`usePatentPdfViewer`의 공백 무시 어댑터),
 * 이 기준으로 "본문에 있다"고 판단한 구는 PDF에서도 실제로 하이라이트된다.
 */
const compactSearchText = (value: string): string => (
  normalizedSearchText(value).replace(/\s+/gu, '')
);

const entryKeyOf = (
  officeActionId: number | null,
  nodeKey: string,
): string => `${officeActionId ?? 'none'}::${nodeKey}`;

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
const FullTextPane: React.FC<{
  sources: PdfSource[];
  /** 트레이에 놓을 검색어들. 개수 배지는 pane이 문서를 읽어 붙인다. */
  searchTerms: PdfSearchTerm[];
  /** 지금 하이라이트할 검색어. */
  activeTerm: string | null;
  /** 같은 검색어를 다시 눌렀을 때도 하이라이트를 다시 걸기 위한 번호. */
  termRequest: number;
  onActivateTerm: (term: string) => void;
  onAddTerm: (term: string) => void;
  onRemoveTerm: (term: string) => void;
  onManualSearch: () => void;
}> = ({
  sources,
  searchTerms,
  activeTerm,
  termRequest,
  onActivateTerm,
  onAddTerm,
  onRemoveTerm,
  onManualSearch,
}) => {
  // sources가 빌 수 있다. PDF 없이 본문만 있는 통지서, PDF가 딸리지 않은 의견서·보정서가
  // 그렇다 — 부르는 쪽이 그 경우 []를 그대로 넘긴다. sources[0].path로 바로 읽으면
  // 그런 문서를 고르는 순간 뷰어가 아니라 앱 전체가 죽는다(위에 error boundary가 없다).
  const resolvedPath = sources[0]?.path ?? null;

  if (!resolvedPath) {
    /**
     * PDF가 없는 문서. 트레이는 그대로 두고 칩만 누를 수 없게 한다 —
     * 어떤 검색어가 이 문서의 근거였는지는 원본이 없어도 알려 줘야 하고,
     * 줄을 빼면 문서를 옮길 때 그만큼 아래가 위로 밀린다.
     */
    return (
      <div className="pm-doc-fulltext">
        <PdfSearchTermTray
          terms={searchTerms}
          activeTerm={null}
          onSelect={onActivateTerm}
          onRemove={onRemoveTerm}
          canHighlight={false}
        />
        <div className="pm-viewer-preview">
          <Text type="secondary" style={{ fontSize: 12 }}>
            이 문서에는 첨부된 PDF 원본이 없습니다.
          </Text>
        </div>
      </div>
    );
  }

  return (
    <div className="pm-doc-fulltext">
      {/* key를 주어 문서가 바뀌면 뷰어를 새로 마운트한다. */}
      <PatentDocumentPdfPane
        key={resolvedPath}
        documentPath={resolvedPath}
        searchTerms={searchTerms}
        activeTerm={activeTerm}
        termRequest={termRequest}
        onActivateTerm={onActivateTerm}
        onAddTerm={onAddTerm}
        onRemoveTerm={onRemoveTerm}
        onManualSearch={onManualSearch}
      />
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
  activeTabKey,
  onActiveTabKeyChange,
  searchKeywords = [],
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

  const handleSelect = React.useCallback((next: TimelineSelection) => {
    if (next.officeActionId !== selection.officeActionId) {
      onActiveItemChange(next.officeActionId);
    }
    setOwnNodeKey(next.nodeKey);
    onActiveTabKeyChange?.(next.nodeKey);
  }, [onActiveItemChange, onActiveTabKeyChange, selection.officeActionId]);

  /**
   * API 결과는 OA ID만 주므로 선택 문서의 지연 조회 본문에서 실제 일치 조건을 다시 확인한다.
   * 목록 전체 본문을 받지 않고 현재 레일 문서 한 건에 대해서만 계산한다.
   */
  const searchEvidence = useMemo(() => {
    const included = searchKeywords.filter((keyword) => keyword.operator !== 'NOT');
    const byEntry = new Map<string, string[]>();

    entries.forEach(({ item, node }) => {
      if (!node.content) return;
      const contentTokens = new Set(
        tokenizeSearchQuery(node.content).map(normalizedSearchText),
      );
      const compactContent = compactSearchText(node.content);
      const terms: string[] = [];
      const pushTerm = (term: string) => {
        if (terms.some((item) => normalizedSearchText(item) === normalizedSearchText(term))) {
          return;
        }
        terms.push(term);
      };
      included.forEach((keyword) => {
        if (node.kind !== NODE_KIND_BY_TARGET[keyword.target]) return;
        const tokens = tokenizeSearchQuery(keyword.query);
        if (tokens.length === 0) return;
        if (!tokens.every((token) => contentTokens.has(normalizedSearchText(token)))) return;
        /**
         * 낱말이 여럿인 검색어가 본문에 **그대로** 있으면 구 전체를 먼저 넣는다.
         *
         * 낱말 근거만 보여 주면 '따로따로 나온 문서'와 '검색어 그대로 나온 문서'를 구분할
         * 수 없다. 후자가 사용자가 실제로 찾던 것이므로 첫 근거(= 자동 하이라이트 대상)로
         * 둔다. 본문에 붙어 있지 않으면 넣지 않는다 — 눌러도 하이라이트되지 않을 근거는
         * 없는 편이 낫다.
         */
        const phrase = keyword.query.trim();
        if (tokens.length > 1 && compactContent.includes(compactSearchText(phrase))) {
          pushTerm(phrase);
        }
        tokens.forEach(pushTerm);
      });
      if (terms.length > 0) {
        byEntry.set(entryKeyOf(item.officeActionId, node.key), terms);
      }
    });
    return byEntry;
  }, [entries, searchKeywords]);
  const matchedEntryKeys = useMemo(
    () => new Set(searchEvidence.keys()),
    [searchEvidence],
  );

  const firstMatchedEntry = useMemo(() => {
    const included = searchKeywords.filter((keyword) => keyword.operator !== 'NOT');
    for (const keyword of included) {
      const matched = entries.find(({ item, node }) => (
        node.kind === NODE_KIND_BY_TARGET[keyword.target]
        && searchEvidence.has(entryKeyOf(item.officeActionId, node.key))
      ));
      if (matched) return matched;
    }
    return null;
  }, [entries, searchEvidence, searchKeywords]);

  // 선택 문서 본문이 도착한 뒤 실제 첫 매칭 target을 한 번만 자동으로 연다.
  const autoSelectionKey = `${activeItemId ?? 'none'}::${searchKeywords
    .map((keyword) => `${keyword.operator ?? 'AND'}:${keyword.target}:${keyword.query}`)
    .join('|')}`;
  const autoSelectedKeyRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!firstMatchedEntry || autoSelectedKeyRef.current === autoSelectionKey) return;
    autoSelectedKeyRef.current = autoSelectionKey;
    const next = {
      officeActionId: firstMatchedEntry.item.officeActionId,
      nodeKey: firstMatchedEntry.node.key,
    };
    if (
      next.officeActionId !== selection.officeActionId
      || next.nodeKey !== selection.nodeKey
    ) {
      handleSelect(next);
    }
  }, [
    autoSelectionKey,
    firstMatchedEntry,
    handleSelect,
    selection.nodeKey,
    selection.officeActionId,
  ]);

  const activeSearchTerms = activeEntry
    ? (searchEvidence.get(
      entryKeyOf(activeEntry.item.officeActionId, activeEntry.node.key),
    ) ?? NO_SEARCH_TERMS)
    : NO_SEARCH_TERMS;

  /**
   * 사용자가 toolbar에서 쌓아 둔 검색어.
   *
   * PDF pane이 아니라 여기서 들고 있는다 — pane은 문서마다 remount되므로(`key={resolvedPath}`)
   * 거기 두면 문서를 옮길 때 쌓아 둔 검색어가 사라진다. 여러 문서에 같은 검색어를 대 보는
   * 것이 이 기능의 목적이라 문서보다 오래 살아야 한다.
   */
  const [userTerms, setUserTerms] = React.useState<string[]>([]);
  /** 지금 PDF에 걸려 있는 검색어. 근거 칩과 사용자 칩을 함께 가리킨다. */
  const [activeTerm, setActiveTerm] = React.useState<string | null>(null);
  /** 같은 검색어를 다시 걸어 달라는 요청 번호(같은 값을 다시 눌러도 하이라이트가 다시 걸린다). */
  const [termRequest, setTermRequest] = React.useState(0);

  /**
   * 트레이에 놓을 검색어. 근거 칩이 먼저, 사용자 칩이 뒤다.
   *
   * 근거 칩은 문서마다 갈리고 사용자 칩은 특허를 보는 동안 남는다. 같은 낱말이 양쪽에 있으면
   * 근거 쪽만 남긴다 — 그쪽이 "이 문서가 왜 검색에 걸렸는지"를 말해 주는 출처다.
   */
  const searchTerms = useMemo<PdfSearchTerm[]>(() => {
    const seen = new Set<string>();
    const terms: PdfSearchTerm[] = [];
    activeSearchTerms.forEach((term) => {
      const key = normalizedSearchText(term);
      if (seen.has(key)) return;
      seen.add(key);
      terms.push({ term, source: 'evidence' });
    });
    userTerms.forEach((term) => {
      const key = normalizedSearchText(term);
      if (seen.has(key)) return;
      seen.add(key);
      terms.push({ term, source: 'user' });
    });
    return terms;
  }, [activeSearchTerms, userTerms]);

  const requestTerm = React.useCallback((term: string | null) => {
    setActiveTerm(term);
    setTermRequest((request) => request + 1);
  }, []);

  const addTerm = React.useCallback((term: string) => {
    setUserTerms((prev) => (
      prev.some((item) => normalizedSearchText(item) === normalizedSearchText(term))
        ? prev
        : [...prev, term]
    ));
    // 방금 입력한 검색어를 활성 칩으로 둔다. 검색은 toolbar가 이미 실행했으므로
    // 번호는 올리지 않는다 — 올리면 같은 검색을 한 번 더 걸어 첫 결과로 되돌아간다.
    setActiveTerm(term);
  }, []);

  const removeTerm = React.useCallback((term: string) => {
    setUserTerms((prev) => prev.filter((item) => item !== term));
    // 지운 칩이 활성이었다면 하이라이트도 함께 걷는다.
    setActiveTerm((prev) => {
      if (prev !== term) return prev;
      setTermRequest((request) => request + 1);
      return null;
    });
  }, []);

  /**
   * 문서를 옮겼을 때 어떤 칩을 활성으로 둘지.
   *
   * 새 문서의 근거 칩이 있으면 그것이 먼저다 — 검색으로 들어온 사용자가 가장 먼저 보려는
   * 것이 그 문서가 걸린 이유다. 없으면 쌓아 둔 사용자 칩 중 지금 것을 유지하고, 그것도
   * 없으면 첫 사용자 칩으로 내려간다.
   *
   * 사용자 칩을 effect의 의존성에 넣지 않는 이유: 칩을 하나 더 쌓을 때마다 이 effect가 돌면
   * 방금 고른 칩을 근거 칩으로 되돌려 버린다. 그래서 '문서가 바뀐 순간'에만 돌게 두고
   * 목록은 ref로 읽는다.
   */
  const userTermsRef = React.useRef(userTerms);
  userTermsRef.current = userTerms;

  useEffect(() => {
    const evidenceTerm = activeSearchTerms[0];
    if (evidenceTerm) {
      requestTerm(evidenceTerm);
      return;
    }
    setActiveTerm((prev) => (
      prev && userTermsRef.current.includes(prev) ? prev : userTermsRef.current[0] ?? null
    ));
    setTermRequest((request) => request + 1);
  }, [activeSearchTerms, requestTerm]);

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
          {/* 파일 아이콘 자리에 법적 상태를 둔다. 모든 문서가 같은 아이콘이라 알려 주는 것이
              없었고, 이 줄에서 정작 궁금한 것은 "이 특허가 지금 어떤 상태인가"다. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            {legalStatusLabel && (
              <Tag
                color={getLegalStatusTagColor(legalStatusLabel)}
                style={{ marginInlineEnd: 0, flexShrink: 0 }}
              >
                {legalStatusLabel}
              </Tag>
            )}
            <span className="pm-ellipsis" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              {headerFileName}
            </span>
          </div>

          {/* 탭 두 줄(통지 건 + 문서)을 대신하는 가로 타임라인.
              검색어 칩은 PDF 검색 상태라 toolbar 옆(pane 안)에 있다 — 타임라인 탭과 그 내용
              사이에 다른 줄이 끼면 탭이 무엇을 여는 책갈피인지 흐려진다. */}
          <PatentDocumentTimeline
            entries={entries}
            selection={selection}
            onSelect={handleSelect}
            matchedEntryKeys={matchedEntryKeys}
          />

          {/* 고른 문서 하나만 그린다. 타임라인이 무엇을 보고 있는지 이미 밝히므로
              여기서 제목을 다시 쓰지 않는다. */}
          <div className="pm-doc-viewer-pane">
            {activeNode ? (
              <FullTextPane
                sources={activeNode.sources}
                searchTerms={searchTerms}
                activeTerm={activeTerm}
                termRequest={termRequest}
                onActivateTerm={requestTerm}
                onAddTerm={addTerm}
                onRemoveTerm={removeTerm}
                // 사용자가 PDF toolbar에서 직접 입력하면 칩의 선택 표시를 풀어 둔다.
                // 번호는 올리지 않는다 — 올리면 방금 입력한 검색이 지워진다(pane 주석 참고).
                onManualSearch={() => setActiveTerm(null)}
              />
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
