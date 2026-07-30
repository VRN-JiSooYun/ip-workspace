import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { TableColumnsType, TablePaginationConfig } from 'antd';
import {
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  FileDown,
  FileImage,
  Play,
  RotateCcw,
  Search,
  Star,
} from 'lucide-react';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import ToggleTag from '../components/common/ToggleTag';
import {
  conferenceApi,
  type ConferenceAbstractListItem,
  type ConferenceOption,
} from '../services/conferenceApi';
import { useUIStore } from '../store/useUIStore';
import { formatDisplayDateOnly, formatNumberWithComma } from '../utils/displayFormat';
import './Conference.css';

const { Text } = Typography;

const PAGE_SIZE_OPTIONS = [10, 30, 50, 100];
const DEFAULT_PAGE_SIZE = 30;
const LIST_STATE_STORAGE_KEY = 'conference:list-state:v3';
const SORT_OPTIONS = [
  { value: 'conferenceYearDesc', label: '최신 Conference순' },
  { value: 'abstractNumberAsc', label: 'Abstract 번호순' },
  { value: 'dateOpenDesc', label: '최신 공개순' },
  { value: 'titleAsc', label: '제목순' },
  { value: 'commentCountDesc', label: '댓글 많은 순' },
];

type AbstractSort =
  | 'conferenceYearDesc'
  | 'abstractNumberAsc'
  | 'titleAsc'
  | 'dateOpenDesc'
  | 'commentCountDesc';

interface ListFilter {
  q: string;
  conferenceIds: string[];
  years: number[];
  favoriteOnly: boolean;
  hasPoster: boolean;
  hasVideo: boolean;
  hasDocument: boolean;
}

interface StoredListState {
  filter?: ListFilter;
  showFilters?: boolean;
  sort?: AbstractSort;
  page?: number;
  pageSize?: number;
}

const emptyFilter = (): ListFilter => ({
  q: '',
  conferenceIds: [],
  years: [],
  favoriteOnly: false,
  hasPoster: false,
  hasVideo: false,
  hasDocument: false,
});

const readStoredListState = (): StoredListState => {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(
      window.sessionStorage.getItem(LIST_STATE_STORAGE_KEY) || '{}',
    ) as StoredListState;
  } catch {
    return {};
  }
};

const restoreFilter = (stored?: StoredListState['filter']): ListFilter => {
  return {
    ...emptyFilter(),
    ...stored,
    conferenceIds: stored?.conferenceIds ?? [],
    years: stored?.years ?? [],
  };
};

const normalizePageSize = (value?: number) => (
  PAGE_SIZE_OPTIONS.includes(value ?? 0) ? Number(value) : DEFAULT_PAGE_SIZE
);

const countDetailFilters = (filter: ListFilter) => (
  filter.conferenceIds.length
  + filter.years.length
  + Number(filter.hasPoster)
  + Number(filter.hasVideo)
  + Number(filter.hasDocument)
);

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const HighlightedText: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(normalizedQuery)})`, 'gi'));
  return (
    <>
      {parts.map((part, index) => (
        index % 2 === 1
          ? <mark className="conference-search-highlight" key={`${part}-${index}`}>{part}</mark>
          : <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
      ))}
    </>
  );
};

const formatConferencePeriod = (conference: ConferenceOption) => {
  if (!conference.dateStart && !conference.dateEnd) return '-';
  const start = conference.dateStart ? formatDisplayDateOnly(conference.dateStart) : '-';
  const end = conference.dateEnd ? formatDisplayDateOnly(conference.dateEnd) : '-';
  return `${start} ~ ${end}`;
};

const pagination = (
  current: number,
  pageSize: number,
  total: number,
  onChange: (page: number, nextPageSize: number) => void,
): TablePaginationConfig => ({
  current,
  pageSize,
  total,
  position: ['bottomRight'],
  showSizeChanger: true,
  pageSizeOptions: PAGE_SIZE_OPTIONS,
  showTotal: undefined,
  onChange,
  itemRender: (page, type, originalElement) => (
    type === 'page' ? <span>{formatNumberWithComma(page)}</span> : originalElement
  ),
});

const ConferenceList: React.FC = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { setHeaderContent } = useUIStore();
  const storedState = useMemo(readStoredListState, []);
  const initialFilter = useMemo(() => restoreFilter(storedState.filter), [storedState.filter]);

  const [draft, setDraft] = useState<ListFilter>(initialFilter);
  const [filter, setFilter] = useState<ListFilter>(initialFilter);
  const [showFilters, setShowFilters] = useState(storedState.showFilters ?? false);
  const [draftSort, setDraftSort] = useState<AbstractSort>(
    storedState.sort ?? 'conferenceYearDesc',
  );
  const [sort, setSort] = useState<AbstractSort>(storedState.sort ?? 'conferenceYearDesc');
  const [page, setPage] = useState(storedState.page ?? 1);
  const [pageSize, setPageSize] = useState(normalizePageSize(storedState.pageSize));
  const [items, setItems] = useState<ConferenceAbstractListItem[]>([]);
  const [conferenceOptions, setConferenceOptions] = useState<ConferenceOption[]>([]);
  const [yearOptions, setYearOptions] = useState<number[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingBookmarkIds, setPendingBookmarkIds] = useState<Set<string>>(new Set());
  const tableRegionRef = useRef<HTMLDivElement>(null);
  const [tableScrollY, setTableScrollY] = useState<number | undefined>();

  useEffect(() => {
    setHeaderContent(
      <PageHeaderBreadcrumb items={[{ label: 'Conference' }]} />,
    );
    return () => setHeaderContent(null);
  }, [setHeaderContent]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        LIST_STATE_STORAGE_KEY,
        JSON.stringify({
          filter,
          showFilters,
          sort,
          page,
          pageSize,
        } satisfies StoredListState),
      );
    } catch {
      // 목록 상태 저장 실패는 조회 기능에 영향을 주지 않는다.
    }
  }, [filter, page, pageSize, showFilters, sort]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    conferenceApi.listAbstracts({
      q: filter.q.trim() || undefined,
      searchField: 'all',
      conferenceIds: filter.conferenceIds.length
        ? filter.conferenceIds.join(',')
        : undefined,
      years: filter.years.length ? filter.years.join(',') : undefined,
      favoriteOnly: filter.favoriteOnly || undefined,
      hasPoster: filter.hasPoster || undefined,
      hasVideo: filter.hasVideo || undefined,
      hasDocument: filter.hasDocument || undefined,
      sort,
      page,
      pageSize,
    }, controller.signal)
      .then((response) => {
        setItems(response.items);
        setTotal(response.total);
        setConferenceOptions(response.facets.conferences);
        setYearOptions(response.facets.years);
        if (response.total > 0 && response.items.length === 0 && page > 1) {
          setPage(Math.max(1, Math.ceil(response.total / pageSize)));
        }
      })
      .catch((requestError) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
        setItems([]);
        setTotal(0);
        const nextError = requestError instanceof Error
          ? requestError.message
          : 'Abstract 목록을 불러오지 못했습니다.';
        setError(nextError);
        void message.error(nextError);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [filter, message, page, pageSize, sort]);

  useLayoutEffect(() => {
    const region = tableRegionRef.current;
    if (!region) return undefined;
    let animationFrame = 0;
    const updateTableHeight = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const body = region.querySelector<HTMLElement>('.ant-table-body');
        const content = region.querySelector<HTMLElement>('.ant-table-content');
        const rows = region.querySelector<HTMLElement>('.ant-table-tbody');
        const measureElement = body ?? content ?? rows;
        if (!measureElement) return;
        const tablePagination = region.querySelector<HTMLElement>('.ant-pagination');
        const paginationStyle = tablePagination
          ? window.getComputedStyle(tablePagination)
          : null;
        const paginationReserve = tablePagination
          ? Math.ceil(
            tablePagination.getBoundingClientRect().height
            + Number.parseFloat(paginationStyle?.marginTop || '0')
            + Number.parseFloat(paginationStyle?.marginBottom || '0'),
          )
          : 48;
        const maxBodyHeight = Math.max(
          160,
          Math.floor(
            window.innerHeight
            - measureElement.getBoundingClientRect().top
            - paginationReserve
            - 16
            - 2,
          ),
        );
        setTableScrollY((current) => current === maxBodyHeight ? current : maxBodyHeight);
      });
    };
    const resizeObserver = new ResizeObserver(updateTableHeight);
    const mutationObserver = new MutationObserver(updateTableHeight);
    resizeObserver.observe(region);
    const searchCard = region
      .closest<HTMLElement>('.conference-page')
      ?.querySelector<HTMLElement>('.conference-search-card');
    if (searchCard) resizeObserver.observe(searchCard);
    mutationObserver.observe(region, { childList: true, subtree: true });
    window.addEventListener('resize', updateTableHeight);
    updateTableHeight();
    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', updateTableHeight);
    };
  }, []);

  const applyFilter = useCallback((nextFilter = draft, nextSort = draftSort) => {
    setDraft(nextFilter);
    setFilter(nextFilter);
    setDraftSort(nextSort);
    setSort(nextSort);
    setPage(1);
  }, [draft, draftSort]);

  const resetFilter = useCallback(() => {
    const nextFilter = emptyFilter();
    setDraft(nextFilter);
    setFilter(nextFilter);
    setDraftSort('conferenceYearDesc');
    setSort('conferenceYearDesc');
    setPage(1);
  }, []);

  const applyImmediateFilter = useCallback((updater: (current: ListFilter) => ListFilter) => {
    const nextFilter = updater(filter);
    setDraft(nextFilter);
    setFilter(nextFilter);
    setDraftSort(sort);
    setPage(1);
  }, [filter, sort]);

  const toggleAbstractBookmark = useCallback(async (
    record: ConferenceAbstractListItem,
    event: React.MouseEvent<HTMLElement>,
  ) => {
    event.stopPropagation();
    if (pendingBookmarkIds.has(record.id)) return;
    const nextFavorite = !record.isFavorite;
    setPendingBookmarkIds((current) => new Set(current).add(record.id));
    try {
      await conferenceApi.setAbstractBookmark(record.id, nextFavorite);
      if (filter.favoriteOnly && !nextFavorite) {
        setItems((current) => current.filter(({ id }) => id !== record.id));
        setTotal((current) => Math.max(0, current - 1));
      } else {
        setItems((current) => current.map((item) => (
          item.id === record.id ? { ...item, isFavorite: nextFavorite } : item
        )));
      }
      void message.success(
        nextFavorite
          ? 'Abstract를 즐겨찾기에 추가했습니다.'
          : 'Abstract 즐겨찾기를 해제했습니다.',
      );
    } catch (requestError) {
      void message.error(
        requestError instanceof Error
          ? requestError.message
          : '즐겨찾기를 변경하지 못했습니다.',
      );
    } finally {
      setPendingBookmarkIds((current) => {
        const next = new Set(current);
        next.delete(record.id);
        return next;
      });
    }
  }, [filter.favoriteOnly, message, pendingBookmarkIds]);

  const columns = useMemo<TableColumnsType<ConferenceAbstractListItem>>(() => [
    {
      title: '즐겨찾기',
      key: 'bookmark',
      width: 76,
      align: 'center',
      fixed: 'left',
      render: (_, record) => (
        <Button
          className="conference-row-bookmark"
          type="text"
          size="small"
          aria-label={record.isFavorite ? 'Abstract 즐겨찾기 해제' : 'Abstract 즐겨찾기 추가'}
          loading={pendingBookmarkIds.has(record.id)}
          icon={(
            <Bookmark
              size={15}
              fill={record.isFavorite ? '#F87C63' : 'none'}
              color={record.isFavorite ? '#F87C63' : 'currentColor'}
            />
          )}
          onClick={(event) => void toggleAbstractBookmark(record, event)}
        />
      ),
    },
    {
      title: 'Conference',
      key: 'conference',
      width: 150,
      align: 'center',
      fixed: 'left',
      render: (_, record) => (
        <div className="conference-name-cell">
          <Text strong>
            <HighlightedText
              text={record.conference.abbreviation || record.conference.title}
              query={filter.q}
            />
          </Text>
          {record.conference.status === 'NOT_OPENED' && <Tag>오픈 예정</Tag>}
        </div>
      ),
    },
    {
      title: 'Year',
      dataIndex: ['conference', 'year'],
      width: 82,
      align: 'center',
    },
    {
      title: 'Period',
      key: 'period',
      width: 210,
      align: 'center',
      render: (_, record) => (
        <span className="conference-period">{formatConferencePeriod(record.conference)}</span>
      ),
    },
    {
      title: 'Abstract No.',
      dataIndex: 'abstractNumber',
      width: 118,
      align: 'center',
      render: (value: string | null) => (
        <HighlightedText
          text={value || '-'}
          query={filter.q}
        />
      ),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      width: 440,
      render: (value: string, record) => (
        <div className="conference-abstract-title-cell">
          <Text strong ellipsis={{ tooltip: value }}>
            <HighlightedText
              text={value}
              query={filter.q}
            />
          </Text>
          <Text type="secondary" ellipsis>
            <HighlightedText
              text={[record.firstAuthorName, record.firstAuthorOrganization]
                .filter(Boolean)
                .join(' · ') || '-'}
              query={filter.q}
            />
          </Text>
        </div>
      ),
    },
    {
      title: 'Session',
      dataIndex: 'sessionTitle',
      width: 280,
      ellipsis: true,
      render: (value: string | null, record) => (
        <HighlightedText
          text={value || record.track || '-'}
          query={filter.q}
        />
      ),
    },
    {
      title: 'Session Type',
      dataIndex: 'sessionType',
      width: 190,
      ellipsis: true,
      render: (value: string | null) => (
        <HighlightedText
          text={value || '-'}
          query={filter.q}
        />
      ),
    },
    {
      title: '공개일',
      dataIndex: 'dateOpen',
      width: 112,
      align: 'center',
      render: (value: string | null) => value ? formatDisplayDateOnly(value) : '-',
    },
    {
      title: '자료',
      key: 'assets',
      width: 126,
      align: 'center',
      render: (_, record) => (
        <Space size={8} className="conference-asset-summary">
          {record.assetSummary.videoCount > 0 && (
            <Tooltip title={`동영상 ${formatNumberWithComma(record.assetSummary.videoCount)}개`}>
              <span><Play size={15} /></span>
            </Tooltip>
          )}
          {record.assetSummary.posterCount > 0 && (
            <Tooltip title={`포스터 ${formatNumberWithComma(record.assetSummary.posterCount)}개`}>
              <span><FileImage size={15} /></span>
            </Tooltip>
          )}
          {record.assetSummary.documentCount > 0 && (
            <Tooltip title={`문서 ${formatNumberWithComma(record.assetSummary.documentCount)}개`}>
              <span><FileDown size={15} /></span>
            </Tooltip>
          )}
          {record.assetSummary.videoCount === 0
            && record.assetSummary.posterCount === 0
            && record.assetSummary.documentCount === 0
            && <Text type="secondary">-</Text>}
        </Space>
      ),
    },
    {
      title: '댓글',
      dataIndex: 'commentCount',
      width: 82,
      align: 'center',
      render: (value: number) => formatNumberWithComma(value),
    },
  ], [filter.q, pendingBookmarkIds, toggleAbstractBookmark]);

  const selectedConferenceLabels = useMemo(() => new Map(
    conferenceOptions.map((conference) => [
      conference.id,
      `${conference.abbreviation} ${conference.year}`,
    ]),
  ), [conferenceOptions]);

  const appliedDetailFilterCount = (
    countDetailFilters(filter) + Number(sort !== 'conferenceYearDesc')
  );
  return (
    <div className="conference-page">
      <Card
        variant="borderless"
        className="c-card compact-filter-card conference-search-card"
      >
        <div className="conference-search-primary">
          <Input
            className="v-search-input conference-search-input"
            allowClear
            prefix={<Search size={18} />}
            placeholder="Conference, 제목, 저자, Abstract No. 검색"
            value={draft.q}
            onChange={(event) => setDraft({ ...draft, q: event.target.value })}
            onPressEnter={() => applyFilter()}
          />
          <Button
            type={draft.favoriteOnly ? 'primary' : 'default'}
            className="v-action-btn conference-favorite-toggle"
            aria-pressed={draft.favoriteOnly}
            icon={(
              <Star
                size={16}
                fill={draft.favoriteOnly ? '#F8B84E' : 'none'}
                color={draft.favoriteOnly ? '#D89116' : 'currentColor'}
              />
            )}
            onClick={() => applyFilter({
              ...draft,
              favoriteOnly: !draft.favoriteOnly,
            })}
          >
            즐겨찾기
          </Button>
          <Button
            className="v-action-btn"
            icon={showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            onClick={() => setShowFilters((current) => !current)}
          >
            상세 필터
          </Button>
          <Button
            type="primary"
            className="v-action-btn"
            loading={loading}
            icon={<Search size={16} />}
            onClick={() => applyFilter()}
          >
            검색
          </Button>
        </div>

        {showFilters && (
          <div className="compact-filter-panel conference-detail-filters">
            <Row
              className="conference-filter-layout"
              gutter={[12, 12]}
            >
              <Col flex="320px">
                <div className="conference-filter-section conference-filter-section-compact conference-filter-conference-section">
                  <Text strong>Conference</Text>
                  <Select
                    mode="multiple"
                    allowClear
                    maxTagCount="responsive"
                    value={draft.conferenceIds}
                    placeholder="전체 Conference"
                    optionFilterProp="label"
                    options={conferenceOptions.map((conference) => ({
                      value: conference.id,
                      label: `${conference.abbreviation} ${conference.year}`,
                    }))}
                    onChange={(conferenceIds) => setDraft({ ...draft, conferenceIds })}
                  />
                </div>
              </Col>
              <Col flex="0 1 220px">
                <div className="conference-filter-section">
                  <Text strong>연도</Text>
                  <Space size={[6, 6]} wrap>
                    {yearOptions.map((year) => (
                      <ToggleTag
                        key={year}
                        checked={draft.years.includes(year)}
                        onChange={(checked) => setDraft({
                          ...draft,
                          years: checked
                            ? [...draft.years, year]
                            : draft.years.filter((value) => value !== year),
                        })}
                      >
                        {year}
                      </ToggleTag>
                    ))}
                  </Space>
                </div>
              </Col>
              <Col flex="0 1 260px">
                <div className="conference-filter-section">
                  <Text strong>자료</Text>
                  <Space size={[6, 6]} wrap>
                    <ToggleTag
                      checked={draft.hasPoster}
                      onChange={(hasPoster) => setDraft({ ...draft, hasPoster })}
                    >
                      Poster
                    </ToggleTag>
                    <ToggleTag
                      checked={draft.hasVideo}
                      onChange={(hasVideo) => setDraft({ ...draft, hasVideo })}
                    >
                      Video
                    </ToggleTag>
                    <ToggleTag
                      checked={draft.hasDocument}
                      onChange={(hasDocument) => setDraft({ ...draft, hasDocument })}
                    >
                      Document
                    </ToggleTag>
                  </Space>
                </div>
              </Col>
              <Col flex="300px">
                <div className="conference-filter-section conference-filter-section-compact">
                  <Text strong>정렬</Text>
                  <Select
                    value={draftSort}
                    options={SORT_OPTIONS}
                    onChange={(value) => setDraftSort(value as AbstractSort)}
                  />
                </div>
              </Col>
              <Col flex="none" className="conference-filter-action-column">
                <div className="conference-filter-actions">
                  <Button
                    type="primary"
                    icon={<Check size={15} />}
                    loading={loading}
                    onClick={() => applyFilter()}
                  >
                    적용
                  </Button>
                  <Button icon={<RotateCcw size={15} />} onClick={resetFilter}>
                    초기화
                  </Button>
                </div>
              </Col>
            </Row>
          </div>
        )}

        {(filter.q
          || filter.favoriteOnly
          || appliedDetailFilterCount > 0) && (
          <div className="conference-applied-filters">
            <Text type="secondary">적용 필터</Text>
            {filter.q && (
              <Tag
                closable
                onClose={(event) => {
                  event.preventDefault();
                  applyImmediateFilter((current) => ({ ...current, q: '' }));
                }}
              >
                전체 검색: {filter.q}
              </Tag>
            )}
            {filter.favoriteOnly && (
              <Tag
                closable
                color="orange"
                onClose={(event) => {
                  event.preventDefault();
                  applyImmediateFilter((current) => ({ ...current, favoriteOnly: false }));
                }}
              >
                즐겨찾기
              </Tag>
            )}
            {filter.conferenceIds.map((conferenceId) => (
              <Tag
                key={conferenceId}
                closable
                onClose={(event) => {
                  event.preventDefault();
                  applyImmediateFilter((current) => ({
                    ...current,
                    conferenceIds: current.conferenceIds.filter((id) => id !== conferenceId),
                  }));
                }}
              >
                {selectedConferenceLabels.get(conferenceId) ?? conferenceId}
              </Tag>
            ))}
            {filter.years.map((year) => (
              <Tag
                key={year}
                closable
                onClose={(event) => {
                  event.preventDefault();
                  applyImmediateFilter((current) => ({
                    ...current,
                    years: current.years.filter((value) => value !== year),
                  }));
                }}
              >
                {year}
              </Tag>
            ))}
            {(['hasPoster', 'hasVideo', 'hasDocument'] as const).map((key) => (
              filter[key] && (
                <Tag
                  key={key}
                  closable
                  onClose={(event) => {
                    event.preventDefault();
                    applyImmediateFilter((current) => ({ ...current, [key]: false }));
                  }}
                >
                  {key === 'hasPoster' ? 'Poster' : key === 'hasVideo' ? 'Video' : 'Document'}
                </Tag>
              )
            ))}
            {sort !== 'conferenceYearDesc' && (
              <Tag
                closable
                onClose={(event) => {
                  event.preventDefault();
                  setDraftSort('conferenceYearDesc');
                  setSort('conferenceYearDesc');
                  setPage(1);
                }}
              >
                정렬: {SORT_OPTIONS.find(({ value }) => value === sort)?.label}
              </Tag>
            )}
          </div>
        )}
      </Card>

      <div className="v-table-card conference-list-card">
        <div className="v-table-header conference-list-toolbar">
          <Text strong className="conference-list-toolbar-title">Abstract 목록</Text>
          <Text type="secondary">{formatNumberWithComma(total)} abstracts</Text>
        </div>
        {error && (
          <Alert className="conference-list-alert" type="error" showIcon message={error} />
        )}
        <div
          ref={tableRegionRef}
          className="conference-unified-table-region"
          style={{
            '--viewport-table-body-height': tableScrollY !== undefined ? `${tableScrollY}px` : undefined,
          } as React.CSSProperties}
        >
          <Table
            className="conference-table conference-unified-table viewport-fill-table"
            rowKey="id"
            size="small"
            loading={loading}
            columns={columns}
            dataSource={items}
            tableLayout="fixed"
            scroll={{
              x: 1_866,
              ...(tableScrollY ? { y: tableScrollY } : {}),
            }}
            locale={{ emptyText: <Empty description="조회된 Abstract가 없습니다." /> }}
            onRow={(record) => ({
              onClick: () => navigate(
                `/conferences/abstracts/${record.id}`,
                { state: { conferenceId: record.conference.id } },
              ),
              onKeyDown: (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  navigate(
                    `/conferences/abstracts/${record.id}`,
                    { state: { conferenceId: record.conference.id } },
                  );
                }
              },
              tabIndex: 0,
            })}
            pagination={pagination(
              page,
              pageSize,
              total,
              (nextPage, nextPageSize) => {
                setPage(nextPageSize === pageSize ? nextPage : 1);
                setPageSize(nextPageSize);
              },
            )}
          />
        </div>
      </div>
    </div>
  );
};

export default ConferenceList;
