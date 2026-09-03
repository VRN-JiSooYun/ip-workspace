import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { filterOfficeActionIndex } from '../components/office-action/officeActionClientFilter';
import {
  officeActionKeywordLabel,
  toPatentSearchKeywords,
  type OfficeActionKeywordCondition,
} from '../components/office-action/officeActionKeywords';
import {
  patentSearchApi,
  type OaLookups,
  type PatentSearchDocumentContent,
  type PatentSearchIndexItem,
  type PatentSearchItem,
  type PatentSearchKeyword,
  type PatentSearchKeywordTarget,
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
 * 고급 검색 조건의 지문.
 *
 * 화면 state 그대로가 아니라 API 조건으로 바꿔 비교해야, 결과가 달라지지 않는 변경(조건
 * 없이 날짜 유형만 바꾸는 등)을 '미적용'으로 오해하지 않는다. 키워드 조건은 검색바가
 * 별도 관리하므로 이 지문에 넣지 않는다.
 */
const filterKeyOf = (state: OfficeActionFilterState) =>
  JSON.stringify({
    filters: toPatentSearchFilters(state),
    ...(state.statutes.length > 0
      ? { statuteOperators: state.statutes.slice(1).map((item) => item.operator ?? 'OR') }
      : {}),
    ...(state.ipc.length > 0
      ? { ipcOperators: state.ipc.slice(1).map((item) => item.operator ?? 'OR') }
      : {}),
  });

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

  /** 검색바에서 조합한 문서별 본문 검색 조건. 상세 필터와 독립적으로 관리한다. */
  const [keywordConditions, setKeywordConditions] =
    useState<OfficeActionKeywordCondition[]>([]);
  const [filters, setFilters] = useState<OfficeActionFilterState>(
    EMPTY_OFFICE_ACTION_FILTERS,
  );
  /**
   * 마지막으로 검색에 실어 보낸 고급 검색 조건. 지금 화면의 조건과 달라졌는지만 본다
   * (= 아직 '조건 적용'을 누르지 않았다). 검색 바의 검색어·문서는 여기 넣지 않는다 —
   * 그쪽은 '검색' 버튼이 따로 있어, 글자를 칠 때마다 고급 검색 패널이 '미적용'을 켜면
   * 다른 컨트롤의 상태를 잘못 알리는 것이 된다.
   */
  const [appliedFilterKey, setAppliedFilterKey] = useState(
    () => filterKeyOf(EMPTY_OFFICE_ACTION_FILTERS),
  );
  const filtersDirty = filterKeyOf(filters) !== appliedFilterKey;

  const [items, setItems] = useState<PatentSearchItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pristine, setPristine] = useState(true);
  const [sortBy, setSortBy] = useState<OfficeActionSort>('actionDateDesc');
  /**
   * 마지막 검색이 본문을 뒤진 문서들(포함 조건만). 결과 카드에 '어느 문서에서 맞았는지'를
   * 표시하는 데 쓴다 — 의견서 본문으로 찾아도 결과는 통지서 카드로 나오기 때문에, 이
   * 표시가 없으면 왜 이 카드가 나왔는지 알 방법이 없다.
   */
  const [matchedTargets, setMatchedTargets] = useState<PatentSearchKeywordTarget[]>([]);
  /** 현재 입력 중인 조건이 아니라 마지막으로 성공한 기준 목록에 실제 적용된 키워드. */
  const [appliedSearchKeywords, setAppliedSearchKeywords] =
    useState<PatentSearchKeyword[]>([]);
  const [lookups, setLookups] = useState<OaLookups | null>(null);
  const [lookupsLoading, setLookupsLoading] = useState(true);
  /** content 없는 전체 OA 인덱스. 검색 결과를 프런트 필터용 구조와 결합할 때도 쓴다. */
  const indexItemsRef = useRef<PatentSearchIndexItem[] | null>(null);
  const indexRequestRef = useRef<Promise<PatentSearchIndexItem[]> | null>(null);
  /** 마지막 키워드 검색으로 갱신한 목록. 상세 필터와 페이지 이동의 유일한 원본이다. */
  const searchBaseItemsRef = useRef<PatentSearchIndexItem[] | null>(null);
  /** 키워드 검색 요청 번호. 겹친 요청 중 마지막 것만 결과를 반영한다. */
  const keywordSearchSeqRef = useRef(0);
  const documentContentRef = useRef(new Map<number, PatentSearchDocumentContent>());
  const pendingDocumentIdRef = useRef<number | null>(null);

  useEffect(() => {
    setHeaderContent(
      <PageHeaderBreadcrumb items={[{ label: '분석' }, { label: '특허 거절 대응 전략' }]} />,
    );
    return () => setHeaderContent(null);
  }, [setHeaderContent]);

  /**
   * 레일에 올린 문서를 치우는 **유일한** 자리. 화면을 떠날 때다.
   *
   * 목록 조작으로는 닫지 않는다 — 페이지 이동·한 페이지 크기 변경·상세 필터·새 키워드 검색
   * 모두 그대로 둔다. 목록을 이리저리 바꿔 가며 같은 문서를 곁에 두고 보는 것이 이 레일의
   * 목적이라, 목록이 갱신될 때마다 닫히면 그 목적이 사라진다. 지금 결과에 없는 문서가 열려
   * 있는 것은 이상하지 않다 — 레일은 목록의 미리보기가 아니라 따로 여는 작업 공간이다.
   *
   * 목록에 없는 문서는 카드 강조(`selectedId`)만 사라지고 뷰어는 유지된다.
   */
  useEffect(() => () => {
    pendingDocumentIdRef.current = null;
    clearDocuments(DOCUMENT_SOURCE);
  }, [clearDocuments]);

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
    const showItem = (nextItem: PatentSearchItem) => showDocuments({
      source: DOCUMENT_SOURCE,
      patentId: nextItem.patentId,
      label: String(nextItem.actionNumber),
      items: [nextItem],
      activeId: nextItem.officeActionId,
      legalStatusLabel:
        lookups?.legalStatuses.find((status) => status.id === nextItem.legalStatusId)?.status
        ?? nextItem.legalStatus,
      searchKeywords: appliedSearchKeywords,
    });

    // PDF 경로는 즉시 열고, 인덱스에서 제외한 본문은 선택한 한 건만 뒤이어 채운다.
    showItem(item);
    const officeActionId = item.officeActionId;
    if (officeActionId === null) return;
    pendingDocumentIdRef.current = officeActionId;

    const applyContent = (document: PatentSearchDocumentContent) => {
      if (pendingDocumentIdRef.current !== officeActionId) return;
      showItem({
        ...item,
        content: document.content,
        contentLength: document.contentLength,
        submissions: document.submissions,
      });
    };

    const cached = documentContentRef.current.get(officeActionId);
    if (cached) {
      applyContent(cached);
      return;
    }

    void patentSearchApi.documentContent(officeActionId)
      .then((document) => {
        documentContentRef.current.set(officeActionId, document);
        applyContent(document);
      })
      .catch((caught) => {
        if (pendingDocumentIdRef.current === officeActionId) {
          void message.warning(`문서 본문을 불러오지 못했습니다: ${getErrorMessage(caught)}`);
        }
      });
  }, [appliedSearchKeywords, lookups, message, showDocuments]);

  const loadIndex = useCallback(async (): Promise<PatentSearchIndexItem[]> => {
    if (indexItemsRef.current) return indexItemsRef.current;
    if (!indexRequestRef.current) {
      indexRequestRef.current = patentSearchApi.index()
        .then((result) => {
          indexItemsRef.current = result.items;
          return result.items;
        })
        .catch((error) => {
          // 일시 실패는 다음 적용 때 다시 받을 수 있어야 한다.
          indexRequestRef.current = null;
          throw error;
        });
    }
    return indexRequestRef.current;
  }, []);

  /** 현재 기준 목록에 상세 필터와 로컬 페이지네이션만 적용한다. Search API는 호출하지 않는다. */
  const applyClientFilters = useCallback(
    async (
      nextPage: number,
      nextPageSize: number,
      nextFilters: OfficeActionFilterState = filters,
    ) => {
      setLoading(true);
      setError('');
      try {
        const baseItems = searchBaseItemsRef.current ?? await loadIndex();
        searchBaseItemsRef.current ??= baseItems;
        const filtered = filterOfficeActionIndex(baseItems, nextFilters);
        const start = (nextPage - 1) * nextPageSize;
        setItems(filtered.slice(start, start + nextPageSize));
        setTotal(filtered.length);
        setPage(nextPage);
        setPageSize(nextPageSize);
        setAppliedFilterKey(filterKeyOf(nextFilters));
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
    [filters, loadIndex, message],
  );

  /**
   * 명시적인 검색 버튼 클릭으로만 새 키워드 기준 목록을 만든다.
   *
   * 경량 matches endpoint가 전체 OA ID와 관련도만 한 번에 반환한다. 이후 상세 필터와 UI
   * 페이지 이동에서는 이 API를 다시 호출하지 않는다.
   */
  const runKeywordSearch = useCallback(async () => {
    /**
     * 늦게 도착한 옛 결과가 최신 결과를 덮지 않게 한다.
     *
     * 조건 chip을 잇달아 지우면(자동 검색) 요청이 겹칠 수 있다. 버튼 클릭만 있던 때는
     * `loading` 중 버튼이 잠겨 겹칠 일이 없었다.
     */
    const requestId = keywordSearchSeqRef.current + 1;
    keywordSearchSeqRef.current = requestId;
    const isStale = () => keywordSearchSeqRef.current !== requestId;

    setLoading(true);
    setError('');
    try {
      const keywords = toPatentSearchKeywords(keywordConditions);
      if (keywordConditions.length > 0 && keywords.length === 0) {
        void message.warning('제외 조건을 적용하려면 포함 키워드 조건이 하나 이상 필요합니다.');
        return;
      }

      const indexItems = await loadIndex();
      let nextBaseItems = indexItems;
      if (keywords.length > 0) {
        const result = await patentSearchApi.matches(keywords);
        const indexByOfficeActionId = new Map(
          indexItems.map((item) => [item.officeActionId, item]),
        );
        nextBaseItems = result.items.flatMap((match) => {
          const indexed = indexByOfficeActionId.get(match.officeActionId);
          return indexed ? [{ ...indexed, relevanceScore: match.relevanceScore }] : [];
        });
      }

      if (isStale()) return;

      searchBaseItemsRef.current = nextBaseItems;
      setSortBy(keywords.length > 0 ? 'relevance' : 'actionDateDesc');
      setMatchedTargets([
        ...new Set(
          keywords
            .filter((item) => item.operator !== 'NOT')
            .map((item) => item.target),
        ),
      ]);
      setAppliedSearchKeywords(keywords);
      const filtered = filterOfficeActionIndex(nextBaseItems, filters);
      setItems(filtered.slice(0, pageSize));
      setTotal(filtered.length);
      setPage(1);
      setAppliedFilterKey(filterKeyOf(filters));
    } catch (caught) {
      if (isStale()) return;
      setItems([]);
      setTotal(0);
      setError(getErrorMessage(caught));
      void message.error(`검색에 실패했습니다: ${getErrorMessage(caught)}`);
    } finally {
      // 옛 요청은 loading을 내리지 않는다. 뒤에 시작한 요청이 아직 달리고 있다.
      if (!isStale()) {
        setPristine(false);
        setLoading(false);
      }
    }
  }, [filters, keywordConditions, loadIndex, message, pageSize]);

  /**
   * Enter와 버튼 적용은 같은 tick의 필터 state 갱신까지 포함해야 하므로 다음 render에서 실행한다.
   * 키워드 검색도 검색 버튼이 draft를 조건에 추가한 다음 실행되어야 해 별도 token을 쓴다.
   */
  const [filterApplyToken, setFilterApplyToken] = useState(0);
  const [searchToken, setSearchToken] = useState(0);
  const requestFilterApply = useCallback(
    () => setFilterApplyToken((token) => token + 1),
    [],
  );
  const requestKeywordSearch = useCallback(() => setSearchToken((token) => token + 1), []);
  const filterApplyRef = useRef(() => {});
  const keywordSearchRef = useRef(() => {});
  useEffect(() => {
    filterApplyRef.current = () => void applyClientFilters(1, pageSize);
    keywordSearchRef.current = () => void runKeywordSearch();
  });
  useEffect(() => {
    if (filterApplyToken === 0) return;
    filterApplyRef.current();
  }, [filterApplyToken]);
  useEffect(() => {
    if (searchToken === 0) return;
    keywordSearchRef.current();
  }, [searchToken]);

  /**
   * 조건 목록이 바뀌면 바로 검색한다.
   *
   * 조건 chip은 이미 확정된 값이다(입력 중인 글자가 아니다) — 추가·삭제는 그때마다
   * "이 조건으로 다시 보여 달라"는 뜻이므로, 검색 버튼을 한 번 더 누르게 할 이유가 없었다.
   * 특히 chip의 ×로 조건을 지웠을 때는 누를 버튼이 화면 반대쪽에 있어, 지워 놓고도 옛 결과를
   * 보고 있는 상태가 되기 쉬웠다.
   *
   * 글자를 칠 때마다 검색하는 것은 **아니다.** 입력창의 draft는 '조건 추가'나 Enter로
   * 확정되어 이 목록에 들어온 뒤에만 검색을 부른다.
   */
  const keywordConditionsKey = useMemo(
    () => keywordConditions.map(officeActionKeywordLabel).join('|'),
    [keywordConditions],
  );
  // 진입 시 값(빈 목록)으로 시작해 첫 render에서는 검색하지 않는다(초기 목록은 아래 1회 로드가 맡는다).
  const autoSearchedKeyRef = useRef(keywordConditionsKey);
  useEffect(() => {
    if (autoSearchedKeyRef.current === keywordConditionsKey) return;
    autoSearchedKeyRef.current = keywordConditionsKey;
    /**
     * 제외 조건만 남은 상태에서는 검색하지 않는다. 서버가 거부하는 조합이고, 안내는 검색
     * 바가 이미 띄우고 있다 — 여기서 부르면 조건을 짜는 중에 경고 toast만 반복해 뜬다.
     * 포함 조건이 더해지는 순간 key가 다시 바뀌어 검색이 나간다.
     */
    if (
      keywordConditions.length > 0
      && toPatentSearchKeywords(keywordConditions).length === 0
    ) {
      return;
    }
    requestKeywordSearch();
  }, [keywordConditions, keywordConditionsKey, requestKeywordSearch]);

  /**
   * 진입 시 한 번: 전체 OA 인덱스로 기본 목록을 만들고 레일의 문서 뷰어를 펼친다.
   *
   * ref로 한 번만 막는 이유: applyClientFilters는 filters를 닫아 물고 있어 바뀔
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
    void applyClientFilters(1, DEFAULT_PAGE_SIZE, EMPTY_OFFICE_ACTION_FILTERS);
  }, [applyClientFilters, openRailItem]);

  return (
    <div className="oa-page">
      <div className="oa-main">
        <section className="oa-search-controls" aria-label="특허 거절 대응 검색 조건">
          <OfficeActionSearchBar
            conditions={keywordConditions}
            onConditionsChange={setKeywordConditions}
            onSearch={requestKeywordSearch}
            loading={loading}
          />

          <OfficeActionAdvancedFilters
            value={filters}
            lookups={lookups}
            lookupsLoading={lookupsLoading}
            onChange={setFilters}
            onApply={requestFilterApply}
            applying={loading}
            dirty={filtersDirty}
          />
        </section>

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
          matchedTargets={matchedTargets}
          onSelect={openInRail}
          onPageChange={(nextPage, nextPageSize) =>
            void applyClientFilters(nextPage, nextPageSize)
          }
        />
      </div>
    </div>
  );
};

export default OfficeActionAnalysis;
