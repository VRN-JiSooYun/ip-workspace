import React, { useCallback, useEffect, useRef, useState } from 'react';
import { App as AntApp } from 'antd';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import OfficeActionAdvancedFilters, {
  EMPTY_OFFICE_ACTION_FILTERS,
  toPatentSearchFilters,
  type OfficeActionFilterState,
} from '../components/office-action/OfficeActionAdvancedFilters';
import OfficeActionResultList, {
  type OfficeActionSort,
} from '../components/office-action/OfficeActionResultList';
import OfficeActionSearchBar from '../components/office-action/OfficeActionSearchBar';
import {
  patentSearchApi,
  type OaLookups,
  type PatentSearchItem,
} from '../services/patentSearchApi';
import { useRightSidebarStore } from '../store/useRightSidebarStore';
import { useUIStore } from '../store/useUIStore';
import './OfficeActionAnalysis.css';

const DEFAULT_PAGE_SIZE = 10;

/** 레일 문서 뷰어에 넣은 것이 이 화면 것임을 표시한다. 떠날 때 자기 것만 치우려고 쓴다. */
const DOCUMENT_SOURCE = 'office-action';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

/**
 * 의견제출통지서 — 전문 검색 화면.
 *
 * 검색 바 + 고급 검색 필터로 조건을 만들고, 결과를 카드 목록으로 보여준다.
 * 카드를 클릭하면 **우측 상시 레일**의 문서 뷰어에 그 통지서가 열린다.
 *
 * 예전에는 이 화면이 뷰어를 직접 들고 있었다. 레일에도 같은 뷰어가 생기면서 두 뷰어가 서로
 * 다른 문서를 보여 주는 상태가 가능해졌고(동기화되지 않는다), 그래서 이 화면의 뷰어를 걷어내고
 * 레일 하나만 쓴다.
 *
 * 고른 문서는 로컬 state로 갖지 않는다. 목록의 선택 표시도 레일 store에서 읽어, 뷰어에 뜬
 * 문서와 목록에서 강조된 카드가 어긋날 수 없게 한다.
 */
const OfficeActionAnalysis: React.FC = () => {
  const { setHeaderContent } = useUIStore();
  const { message } = AntApp.useApp();
  const showDocuments = useRightSidebarStore((store) => store.showDocuments);
  const clearDocuments = useRightSidebarStore((store) => store.clearDocuments);
  const openRailItem = useRightSidebarStore((store) => store.openItem);
  /** 이 화면이 넣은 문서만 목록 강조에 쓴다. 다른 화면이 채운 것에 반응하면 안 된다. */
  const selectedId = useRightSidebarStore((store) => (
    store.documentContext?.source === DOCUMENT_SOURCE
      ? store.documentContext.activeId
      : null
  ));

  const [keyword, setKeyword] = useState('');
  const [filters, setFilters] = useState<OfficeActionFilterState>(
    EMPTY_OFFICE_ACTION_FILTERS,
  );

  const [items, setItems] = useState<PatentSearchItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pristine, setPristine] = useState(true);
  const [sortBy, setSortBy] = useState<OfficeActionSort>('actionDateDesc');
  const [lookups, setLookups] = useState<OaLookups | null>(null);
  const [lookupsLoading, setLookupsLoading] = useState(true);

  useEffect(() => {
    setHeaderContent(
      <PageHeaderBreadcrumb items={[{ label: '분석' }, { label: '특허 거절 대응 전략' }]} />,
    );
    return () => setHeaderContent(null);
  }, [setHeaderContent]);

  /** 화면을 떠나면 이 화면이 올린 문서를 치운다(다른 화면이 이미 채웠으면 그대로 둔다). */
  useEffect(() => () => clearDocuments(DOCUMENT_SOURCE), [clearDocuments]);

  useEffect(() => {
    let active = true;
    setLookupsLoading(true);
    patentSearchApi.lookups()
      .then((value) => {
        if (active) setLookups(value);
      })
      .catch((caught) => {
        if (active) {
          void message.error(
            `OA 선택 목록을 불러오지 못했습니다: ${getErrorMessage(caught)}`,
          );
        }
      })
      .finally(() => {
        if (active) setLookupsLoading(false);
      });
    return () => { active = false; };
  }, [message]);


  /**
   * 카드를 고르면 레일에 통지서 한 건을 올린다.
   *
   * `items`에 검색 결과 전체를 넣지 않는 이유: 뷰어의 통지서 선택 Segmented가 결과 수만큼
   * 늘어나 쓸 수 없게 된다. 목록에서 고르는 것이 이 화면의 방식이다.
   */
  const openInRail = useCallback((item: PatentSearchItem) => {
    showDocuments({
      source: DOCUMENT_SOURCE,
      patentId: item.patentId,
      label: String(item.actionNumber),
      items: [item],
      activeId: item.officeActionId,
      legalStatusLabel:
        lookups?.legalStatuses.find((status) => status.id === item.legalStatusId)?.status
        ?? item.legalStatus,
      examStatusLabel:
        lookups?.examStatuses.find((status) => status.id === item.examStatusId)?.status
        ?? null,
    });
  }, [lookups, showDocuments]);

  const runSearch = useCallback(
    async (nextPage: number, nextPageSize: number) => {
      setLoading(true);
      setError('');
      try {
        const trimmed = keyword.trim();
        setSortBy(trimmed ? 'relevance' : 'actionDateDesc');
        const result = await patentSearchApi.search({
          page: nextPage,
          size: nextPageSize,
          // 카드 클릭 즉시 뷰어에 본문을 그려야 한다. 검색 API에 단건 조회가 없어
          // 목록에서 함께 받아 두는 것 말고는 방법이 없다.
          includeContent: true,
          // 카드 하단의 출원일자·공개번호·등록번호는 검색 응답에 없는 column이다.
          includePatentDetail: true,
          filters: toPatentSearchFilters(filters),
          ...(trimmed
            ? { keywords: [{ query: trimmed, target: 'officeAction' as const }] }
            : {}),
        });
        setItems(result.items);
        setTotal(result.total);
        setPage(nextPage);
        setPageSize(nextPageSize);
        // 목록이 바뀌면 이전 선택은 더 이상 화면에 없을 수 있다. 레일에서도 내린다.
        // 다만 패널은 접지 않는다 — 이 화면은 뷰어를 늘 펼쳐 두는 것이 규칙이라,
        // 검색할 때마다 레일이 닫히면 그 규칙이 깨진다.
        clearDocuments(DOCUMENT_SOURCE, { keepPanelOpen: true });
      } catch (caught) {
        setItems([]);
        setTotal(0);
        setError(getErrorMessage(caught));
        void message.error(`검색에 실패했습니다: ${getErrorMessage(caught)}`);
      } finally {
        setPristine(false);
        setLoading(false);
      }
    },
    [clearDocuments, filters, keyword, message],
  );

  /**
   * 진입 시 한 번: 조건 없이 기본 검색을 돌리고 레일의 문서 뷰어를 펼친다.
   *
   * ref로 한 번만 막는 이유: runSearch는 keyword·filters를 닫아 물고 있어 그것들이 바뀔
   * 때마다 새 함수가 된다. 의존성에 그대로 두면 글자를 칠 때마다 검색이 나가는
   * 실시간 검색이 되어 버린다. 여기서 원하는 것은 '진입 시 1회'다.
   *
   * 뷰어는 아직 고른 문서가 없어 빈 상태로 열린다. 그래도 펼쳐 두는 이유는 카드를 눌렀을 때
   * 레일이 갑자기 나타나며 본문 폭이 밀리지 않게 하려는 것이다(자리를 미리 잡아 둔다).
   */
  const didInitialLoad = useRef(false);
  useEffect(() => {
    if (didInitialLoad.current) return;
    didInitialLoad.current = true;
    openRailItem('documents');
    void runSearch(1, DEFAULT_PAGE_SIZE);
  }, [openRailItem, runSearch]);

  return (
    <div className="oa-page">
      <div className="oa-main">
        <OfficeActionSearchBar
          value={keyword}
          onChange={setKeyword}
          onSearch={() => void runSearch(1, pageSize)}
          loading={loading}
        />

        <OfficeActionAdvancedFilters
          value={filters}
          lookups={lookups}
          lookupsLoading={lookupsLoading}
          onChange={setFilters}
        />

        <OfficeActionResultList
          items={items}
          total={total}
          page={page}
          pageSize={pageSize}
          loading={loading}
          pristine={pristine}
          error={error}
          selectedId={selectedId}
          sortBy={sortBy}
          onSelect={openInRail}
          onPageChange={(nextPage, nextPageSize) =>
            void runSearch(nextPage, nextPageSize)
          }
        />
      </div>
    </div>
  );
};

export default OfficeActionAnalysis;
