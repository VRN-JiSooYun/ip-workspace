import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  App,
  Alert,
  Button,
  DatePicker,
  Empty,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { TableColumnsType, TablePaginationConfig } from 'antd';
import type { Dayjs } from 'dayjs';
import {
  Bookmark,
  FileDown,
  FileImage,
  Play,
  Search,
  Star,
} from 'lucide-react';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import {
  conferenceApi,
  type ConferenceAbstractListItem,
  type ConferenceListItem,
} from '../services/conferenceApi';
import { useUIStore } from '../store/useUIStore';
import { formatDisplayDateOnly, formatNumberWithComma } from '../utils/displayFormat';
import './Conference.css';

const { Text } = Typography;
const { RangePicker } = DatePicker;
const PAGE_SIZE_OPTIONS = [10, 30, 50, 100];
const LIST_STATE_STORAGE_KEY = 'conference:list-state:v1';
type DateRange = [Dayjs | null, Dayjs | null] | null;

interface ListFilter {
  q: string;
  favoriteOnly: boolean;
  dateRange: DateRange;
}

const EMPTY_FILTER: ListFilter = {
  q: '',
  favoriteOnly: false,
  dateRange: null,
};

interface StoredListState {
  conferencePageSize?: number;
  abstractPageSize?: number;
  conferenceSort?: 'titleAsc' | 'yearDesc';
  abstractSort?: 'abstractNumberAsc' | 'titleAsc' | 'dateOpenDesc' | 'commentCountDesc';
}

const restoreListState = (): StoredListState => {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.sessionStorage.getItem(LIST_STATE_STORAGE_KEY) || '{}') as StoredListState;
  } catch {
    return {};
  }
};

const dateRangeParams = (range: DateRange) => ({
  dateFrom: range?.[0]?.format('YYYY-MM-DD'),
  dateTo: range?.[1]?.format('YYYY-MM-DD'),
});

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

const useTableScrollHeight = () => {
  const regionRef = useRef<HTMLDivElement>(null);
  const [scrollHeight, setScrollHeight] = useState(240);

  useLayoutEffect(() => {
    const region = regionRef.current;
    if (!region) return undefined;

    let animationFrame = 0;
    const updateHeight = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        const tableHeader = region.querySelector<HTMLElement>('.ant-table-thead');
        const tablePagination = region.querySelector<HTMLElement>('.ant-pagination');
        const paginationStyle = tablePagination
          ? window.getComputedStyle(tablePagination)
          : null;
        const paginationHeight = tablePagination
          ? tablePagination.offsetHeight
            + Number.parseFloat(paginationStyle?.marginTop || '0')
            + Number.parseFloat(paginationStyle?.marginBottom || '0')
          : 0;
        const nextHeight = Math.max(
          120,
          Math.floor(region.clientHeight - (tableHeader?.offsetHeight || 0) - paginationHeight - 2),
        );
        setScrollHeight((current) => current === nextHeight ? current : nextHeight);
      });
    };

    const resizeObserver = new ResizeObserver(updateHeight);
    const mutationObserver = new MutationObserver(updateHeight);
    resizeObserver.observe(region);
    mutationObserver.observe(region, { childList: true, subtree: true });
    updateHeight();

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  return { regionRef, scrollHeight };
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

const FilterBar: React.FC<{
  value: ListFilter;
  placeholder: string;
  loading: boolean;
  onChange: (value: ListFilter) => void;
  onSearch: () => void;
  onFavoriteSearch: (value: ListFilter) => void;
}> = ({
  value,
  placeholder,
  loading,
  onChange,
  onSearch,
  onFavoriteSearch,
}) => (
  <div className="conference-filter-bar">
    <Input
      className="conference-filter-keyword"
      allowClear
      prefix={<Search size={16} />}
      placeholder={placeholder}
      value={value.q}
      onChange={(event) => onChange({ ...value, q: event.target.value })}
      onPressEnter={onSearch}
    />
    <RangePicker
      className="conference-filter-period"
      value={value.dateRange}
      onChange={(range) => onChange({ ...value, dateRange: range })}
      placeholder={['시작일', '종료일']}
      format="YYYY.MM.DD"
      allowEmpty={[true, true]}
      style={{ borderRadius: 8 }}
    />
    <Button
      type={value.favoriteOnly ? 'primary' : 'default'}
      className="conference-favorite-toggle"
      aria-pressed={value.favoriteOnly}
      icon={(
        <Star
          size={16}
          fill={value.favoriteOnly ? '#F8B84E' : 'none'}
          color={value.favoriteOnly ? '#D89116' : 'currentColor'}
        />
      )}
      onClick={() => {
        const nextValue = { ...value, favoriteOnly: !value.favoriteOnly };
        onChange(nextValue);
        onFavoriteSearch(nextValue);
      }}
    >
      즐겨찾기 {value.favoriteOnly ? 'ON' : 'OFF'}
    </Button>
    <Button
      type="primary"
      className="conference-filter-search"
      icon={<Search size={16} />}
      loading={loading}
      onClick={onSearch}
    >
      검색
    </Button>
  </div>
);

const ConferenceList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { message } = App.useApp();
  const { setHeaderContent } = useUIStore();
  const restoredState = useMemo(restoreListState, []);
  const [conferenceDraft, setConferenceDraft] = useState<ListFilter>(EMPTY_FILTER);
  const [conferenceFilter, setConferenceFilter] = useState<ListFilter>(EMPTY_FILTER);
  const [abstractDraft, setAbstractDraft] = useState<ListFilter>(EMPTY_FILTER);
  const [abstractFilter, setAbstractFilter] = useState<ListFilter>(EMPTY_FILTER);
  const [conferencePage, setConferencePage] = useState(1);
  const [conferencePageSize, setConferencePageSize] = useState(restoredState.conferencePageSize || 30);
  const [abstractPage, setAbstractPage] = useState(1);
  const [abstractPageSize, setAbstractPageSize] = useState(restoredState.abstractPageSize || 30);
  const [conferenceSort, setConferenceSort] = useState<'titleAsc' | 'yearDesc'>(
    restoredState.conferenceSort === 'titleAsc' ? 'titleAsc' : 'yearDesc',
  );
  const [abstractSort, setAbstractSort] = useState<
    'abstractNumberAsc' | 'titleAsc' | 'dateOpenDesc' | 'commentCountDesc'
  >(restoredState.abstractSort || 'abstractNumberAsc');
  const [splitPercent, setSplitPercent] = useState(30);
  const [conferences, setConferences] = useState<ConferenceListItem[]>([]);
  const [abstracts, setAbstracts] = useState<ConferenceAbstractListItem[]>([]);
  const [conferenceTotal, setConferenceTotal] = useState(0);
  const [abstractTotal, setAbstractTotal] = useState(0);
  const [conferenceLoading, setConferenceLoading] = useState(false);
  const [abstractLoading, setAbstractLoading] = useState(false);
  const [conferenceError, setConferenceError] = useState<string | null>(null);
  const [abstractError, setAbstractError] = useState<string | null>(null);
  const [pendingBookmarks, setPendingBookmarks] = useState<Set<string>>(new Set());
  const [isResizingSplit, setIsResizingSplit] = useState(false);
  const splitRef = useRef<HTMLDivElement>(null);
  const conferenceTable = useTableScrollHeight();
  const abstractTable = useTableScrollHeight();
  const selectedConferenceId = searchParams.get('conferenceId');

  useEffect(() => {
    setHeaderContent(<PageHeaderBreadcrumb items={[{ label: 'Conference' }]} />);
    return () => setHeaderContent(null);
  }, [setHeaderContent]);

  useEffect(() => {
    const state: StoredListState = {
      conferencePageSize,
      abstractPageSize,
      conferenceSort,
      abstractSort,
    };
    window.sessionStorage.setItem(LIST_STATE_STORAGE_KEY, JSON.stringify(state));
  }, [
    abstractPageSize,
    abstractSort,
    conferencePageSize,
    conferenceSort,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    setConferenceLoading(true);
    setConferenceError(null);
    conferenceApi.listConferences({
      q: conferenceFilter.q.trim() || undefined,
      favoriteOnly: conferenceFilter.favoriteOnly || undefined,
      ...dateRangeParams(conferenceFilter.dateRange),
      sort: conferenceSort,
      page: conferencePage,
      pageSize: conferencePageSize,
    }, controller.signal)
      .then((response) => {
        setConferences(response.items);
        setConferenceTotal(response.total);
        if (response.items.length === 0) {
          if (selectedConferenceId) setSearchParams({}, { replace: true });
          return;
        }
        const selectedIsVisible = response.items.some(({ id }) => id === selectedConferenceId);
        if (!selectedIsVisible) {
          setSearchParams({ conferenceId: response.items[0].id }, { replace: true });
        }
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        const nextError = error instanceof Error ? error.message : 'Conference 목록을 불러오지 못했습니다.';
        setConferenceError(nextError);
        void message.error(nextError);
      })
      .finally(() => {
        if (!controller.signal.aborted) setConferenceLoading(false);
      });
    return () => controller.abort();
  }, [
    conferenceFilter,
    conferencePage,
    conferencePageSize,
    conferenceSort,
    message,
    selectedConferenceId,
    setSearchParams,
  ]);

  useEffect(() => {
    if (!selectedConferenceId) {
      setAbstracts([]);
      setAbstractTotal(0);
      return;
    }
    const controller = new AbortController();
    setAbstractLoading(true);
    setAbstractError(null);
    conferenceApi.listAbstracts(selectedConferenceId, {
      q: abstractFilter.q.trim() || undefined,
      favoriteOnly: abstractFilter.favoriteOnly || undefined,
      ...dateRangeParams(abstractFilter.dateRange),
      sort: abstractSort,
      page: abstractPage,
      pageSize: abstractPageSize,
    }, controller.signal)
      .then((response) => {
        setAbstracts(response.items);
        setAbstractTotal(response.total);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setAbstracts([]);
        setAbstractTotal(0);
        const nextError = error instanceof Error ? error.message : 'Abstract 목록을 불러오지 못했습니다.';
        setAbstractError(nextError);
        void message.error(nextError);
      })
      .finally(() => {
        if (!controller.signal.aborted) setAbstractLoading(false);
      });
    return () => controller.abort();
  }, [
    abstractFilter,
    abstractPage,
    abstractPageSize,
    abstractSort,
    message,
    selectedConferenceId,
  ]);

  const selectConference = useCallback((conferenceId: string) => {
    if (conferenceId === selectedConferenceId) return;
    setAbstractDraft(EMPTY_FILTER);
    setAbstractFilter(EMPTY_FILTER);
    setAbstractPage(1);
    setAbstractError(null);
    setSearchParams({ conferenceId });
  }, [selectedConferenceId, setSearchParams]);

  const updateSplitPercent = useCallback((clientX: number) => {
    const container = splitRef.current;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    const percent = ((clientX - bounds.left) / bounds.width) * 100;
    setSplitPercent(Math.min(60, Math.max(20, percent)));
  }, []);

  useEffect(() => {
    if (!isResizingSplit) return undefined;

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const resize = (event: PointerEvent) => updateSplitPercent(event.clientX);
    const stop = () => setIsResizingSplit(false);
    window.addEventListener('pointermove', resize);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);

    return () => {
      window.removeEventListener('pointermove', resize);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [isResizingSplit, updateSplitPercent]);

  const startResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.focus();
    setIsResizingSplit(true);
  }, []);

  const handleSplitKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = 2;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setSplitPercent((current) => Math.max(20, current - step));
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setSplitPercent((current) => Math.min(60, current + step));
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setSplitPercent(20);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setSplitPercent(60);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSplitPercent(30);
    }
  }, []);

  const toggleConferenceBookmark = useCallback(async (
    record: ConferenceListItem,
    event: React.MouseEvent<HTMLElement>,
  ) => {
    event.stopPropagation();
    const pendingKey = `conference:${record.id}`;
    if (pendingBookmarks.has(pendingKey)) return;
    const nextFavorite = !record.isFavorite;
    setPendingBookmarks((current) => new Set(current).add(pendingKey));
    try {
      await conferenceApi.setConferenceBookmark(record.id, nextFavorite);
      if (conferenceFilter.favoriteOnly && !nextFavorite) {
        setConferences((current) => current.filter(({ id }) => id !== record.id));
        setConferenceTotal((current) => Math.max(0, current - 1));
      } else {
        setConferences((current) => current.map((item) => (
          item.id === record.id ? { ...item, isFavorite: nextFavorite } : item
        )));
      }
      void message.success(nextFavorite ? 'Conference를 즐겨찾기에 추가했습니다.' : 'Conference 즐겨찾기를 해제했습니다.');
    } catch (error) {
      void message.error(error instanceof Error ? error.message : '즐겨찾기를 변경하지 못했습니다.');
    } finally {
      setPendingBookmarks((current) => {
        const next = new Set(current);
        next.delete(pendingKey);
        return next;
      });
    }
  }, [conferenceFilter.favoriteOnly, message, pendingBookmarks]);

  const toggleAbstractBookmark = useCallback(async (
    record: ConferenceAbstractListItem,
    event: React.MouseEvent<HTMLElement>,
  ) => {
    event.stopPropagation();
    const pendingKey = `abstract:${record.id}`;
    if (pendingBookmarks.has(pendingKey)) return;
    const nextFavorite = !record.isFavorite;
    setPendingBookmarks((current) => new Set(current).add(pendingKey));
    try {
      await conferenceApi.setAbstractBookmark(record.id, nextFavorite);
      if (abstractFilter.favoriteOnly && !nextFavorite) {
        setAbstracts((current) => current.filter(({ id }) => id !== record.id));
        setAbstractTotal((current) => Math.max(0, current - 1));
      } else {
        setAbstracts((current) => current.map((item) => (
          item.id === record.id ? { ...item, isFavorite: nextFavorite } : item
        )));
      }
      void message.success(nextFavorite ? 'Abstract를 즐겨찾기에 추가했습니다.' : 'Abstract 즐겨찾기를 해제했습니다.');
    } catch (error) {
      void message.error(error instanceof Error ? error.message : '즐겨찾기를 변경하지 못했습니다.');
    } finally {
      setPendingBookmarks((current) => {
        const next = new Set(current);
        next.delete(pendingKey);
        return next;
      });
    }
  }, [abstractFilter.favoriteOnly, message, pendingBookmarks]);

  const conferenceColumns = useMemo<TableColumnsType<ConferenceListItem>>(() => [
    {
      title: 'Conference',
      dataIndex: 'title',
      render: (_, record) => (
        <div className="conference-title-cell">
          <div className="conference-title-line">
            <Button
              className="conference-row-bookmark"
              type="text"
              size="small"
              aria-label={record.isFavorite ? 'Conference 즐겨찾기 해제' : 'Conference 즐겨찾기 추가'}
              loading={pendingBookmarks.has(`conference:${record.id}`)}
              icon={(
                <Bookmark
                  size={15}
                  fill={record.isFavorite ? '#F87C63' : 'none'}
                  color={record.isFavorite ? '#F87C63' : 'currentColor'}
                />
              )}
              onClick={(event) => void toggleConferenceBookmark(record, event)}
            />
            <Text strong ellipsis={{ tooltip: record.fullTitle || record.title }}>
              <HighlightedText
                text={record.abbreviation || record.title}
                query={conferenceFilter.q}
              />
            </Text>
            {record.status === 'NOT_OPENED' && <Tag>오픈 예정</Tag>}
          </div>
          <Text type="secondary" className="conference-title-meta">
            {record.year} · Abstract {formatNumberWithComma(record.abstractCount)}
          </Text>
        </div>
      ),
    },
    {
      title: '기간',
      key: 'period',
      width: 336,
      align: 'center',
      render: (_, record) => (
        <span className="conference-period">
          {record.dateStart
            ? `${formatDisplayDateOnly(record.dateStart)}${record.dateEnd ? ` ~ ${formatDisplayDateOnly(record.dateEnd)}` : ''}`
            : '-'}
        </span>
      ),
    },
  ], [conferenceFilter.q, pendingBookmarks, toggleConferenceBookmark]);

  const abstractColumns = useMemo<TableColumnsType<ConferenceAbstractListItem>>(() => [
    {
      title: '북마크',
      key: 'bookmark',
      width: 72,
      align: 'center',
      render: (_, record) => (
        <Button
          className="conference-row-bookmark"
          type="text"
          size="small"
          aria-label={record.isFavorite ? 'Abstract 즐겨찾기 해제' : 'Abstract 즐겨찾기 추가'}
          loading={pendingBookmarks.has(`abstract:${record.id}`)}
          icon={(
            <Bookmark
              size={14}
              fill={record.isFavorite ? '#F87C63' : 'none'}
              color={record.isFavorite ? '#F87C63' : 'currentColor'}
            />
          )}
          onClick={(event) => void toggleAbstractBookmark(record, event)}
        />
      ),
    },
    {
      title: 'No.',
      dataIndex: 'abstractNumber',
      width: 100,
      align: 'center',
      render: (value: string | null) => <Text>{value || '-'}</Text>,
    },
    {
      title: 'Title',
      dataIndex: 'title',
      render: (value: string, record) => (
        <div className="conference-abstract-title-cell">
          <Text strong ellipsis={{ tooltip: value }}>
            <HighlightedText text={value} query={abstractFilter.q} />
          </Text>
          <Text type="secondary" ellipsis>
            <HighlightedText
              text={[record.firstAuthorName, record.firstAuthorOrganization].filter(Boolean).join(' · ') || '-'}
              query={abstractFilter.q}
            />
          </Text>
        </div>
      ),
    },
    {
      title: 'Session',
      dataIndex: 'sessionTitle',
      width: 380,
      ellipsis: true,
      render: (value: string | null, record) => (
        <HighlightedText
          text={value || record.sessionType || record.track || '-'}
          query={abstractFilter.q}
        />
      ),
    },
    {
      title: '자료',
      key: 'assets',
      width: 92,
      align: 'center',
      render: (_, record) => (
        <Space size={7} className="conference-asset-summary">
          {record.assetSummary.hasVideo && <Tooltip title="동영상"><Play size={15} /></Tooltip>}
          {record.assetSummary.hasPoster && <Tooltip title="포스터"><FileImage size={15} /></Tooltip>}
          {record.assetSummary.hasDocument && <Tooltip title="문서"><FileDown size={15} /></Tooltip>}
          {!record.assetSummary.hasVideo
            && !record.assetSummary.hasPoster
            && !record.assetSummary.hasDocument
            && <Text type="secondary">-</Text>}
        </Space>
      ),
    },
    {
      title: '댓글',
      dataIndex: 'commentCount',
      width: 72,
      align: 'center',
      render: (value: number) => formatNumberWithComma(value),
    },
  ], [abstractFilter.q, pendingBookmarks, toggleAbstractBookmark]);

  const selectedConference = conferences.find(({ id }) => id === selectedConferenceId);

  return (
    <div className="conference-page">
      <div
        ref={splitRef}
        className="conference-split"
        style={{ '--conference-split-percent': `${splitPercent}%` } as React.CSSProperties}
      >
        <section className="v-table-card conference-panel conference-list-panel">
          <div className="conference-panel-header">
            <div>
              <Text strong>Conference 목록</Text>
              <Text type="secondary">{formatNumberWithComma(conferenceTotal)}건</Text>
            </div>
            <Select
              value={conferenceSort}
              onChange={(value) => {
                setConferenceSort(value);
                setConferencePage(1);
              }}
              options={[
                { value: 'yearDesc', label: '연도순' },
                { value: 'titleAsc', label: '이름순' },
              ]}
            />
          </div>
          <FilterBar
            value={conferenceDraft}
            placeholder="학회명 검색"
            loading={conferenceLoading}
            onChange={setConferenceDraft}
            onSearch={() => {
              setConferencePage(1);
              setConferenceFilter(conferenceDraft);
            }}
            onFavoriteSearch={(nextFilter) => {
              setConferencePage(1);
              setConferenceFilter(nextFilter);
            }}
          />
          {conferenceError && (
            <Alert className="conference-list-alert" type="error" showIcon message={conferenceError} />
          )}
          <div ref={conferenceTable.regionRef} className="conference-table-region">
            <Table
              className="conference-table conference-list-table"
              rowKey="id"
              size="small"
              loading={conferenceLoading}
              columns={conferenceColumns}
              dataSource={conferences}
              tableLayout="fixed"
              scroll={{ x: 520, y: conferenceTable.scrollHeight }}
              locale={{ emptyText: <Empty description="조회된 Conference가 없습니다." /> }}
              rowClassName={(record) => record.id === selectedConferenceId ? 'conference-selected-row' : ''}
              onRow={(record) => ({
                onClick: () => selectConference(record.id),
                onKeyDown: (event) => {
                  if (event.key === 'Enter' || event.key === ' ') selectConference(record.id);
                },
                tabIndex: 0,
                'aria-selected': record.id === selectedConferenceId,
              })}
              pagination={pagination(
                conferencePage,
                conferencePageSize,
                conferenceTotal,
                (page, nextPageSize) => {
                  setConferencePage(nextPageSize === conferencePageSize ? page : 1);
                  setConferencePageSize(nextPageSize);
                },
              )}
            />
          </div>
        </section>

        <div
          className={`conference-split-handle${isResizingSplit ? ' is-resizing' : ''}`}
          role="separator"
          aria-label="Conference와 Abstract 목록 너비 조절"
          aria-orientation="vertical"
          aria-valuemin={20}
          aria-valuemax={60}
          aria-valuenow={Math.round(splitPercent)}
          tabIndex={0}
          onPointerDown={startResize}
          onDoubleClick={() => setSplitPercent(30)}
          onKeyDown={handleSplitKeyDown}
        >
          <div className="conference-split-handle-bar" />
        </div>

        <section className="v-table-card conference-panel conference-abstract-panel">
          <div className="conference-panel-header">
            <div>
              <Text strong>{selectedConference?.abbreviation || 'Abstract'} 목록</Text>
              <Text type="secondary">{formatNumberWithComma(abstractTotal)}건</Text>
            </div>
            <Select
              value={abstractSort}
              disabled={!selectedConferenceId}
              onChange={(value) => {
                setAbstractSort(value);
                setAbstractPage(1);
              }}
              options={[
                { value: 'abstractNumberAsc', label: 'Abstract 번호순' },
                { value: 'dateOpenDesc', label: '최신 공개순' },
                { value: 'titleAsc', label: '제목순' },
                { value: 'commentCountDesc', label: '댓글 많은 순' },
              ]}
            />
          </div>
          <FilterBar
            value={abstractDraft}
            placeholder="제목, 저자, 세션 검색"
            loading={abstractLoading}
            onChange={setAbstractDraft}
            onSearch={() => {
              setAbstractPage(1);
              setAbstractFilter(abstractDraft);
            }}
            onFavoriteSearch={(nextFilter) => {
              setAbstractPage(1);
              setAbstractFilter(nextFilter);
            }}
          />
          {abstractError && (
            <Alert className="conference-list-alert" type="error" showIcon message={abstractError} />
          )}
          <div ref={abstractTable.regionRef} className="conference-table-region">
            <Table
              className="conference-table conference-abstract-table"
              rowKey="id"
              size="small"
              loading={abstractLoading}
              columns={abstractColumns}
              dataSource={abstracts}
              tableLayout="fixed"
              scroll={{ x: 1066, y: abstractTable.scrollHeight }}
              locale={{
                emptyText: (
                  <Empty description={selectedConferenceId ? '조회된 Abstract가 없습니다.' : 'Conference를 선택해 주세요.'} />
                ),
              }}
              onRow={(record) => ({
                onClick: () => navigate(
                  `/conferences/abstracts/${record.id}?conferenceId=${encodeURIComponent(selectedConferenceId || '')}`,
                  {
                    state: { conferenceId: selectedConferenceId },
                  },
                ),
                onKeyDown: (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    navigate(
                      `/conferences/abstracts/${record.id}?conferenceId=${encodeURIComponent(selectedConferenceId || '')}`,
                      { state: { conferenceId: selectedConferenceId } },
                    );
                  }
                },
                tabIndex: 0,
              })}
              pagination={pagination(
                abstractPage,
                abstractPageSize,
                abstractTotal,
                (page, nextPageSize) => {
                  setAbstractPage(nextPageSize === abstractPageSize ? page : 1);
                  setAbstractPageSize(nextPageSize);
                },
              )}
            />
          </div>
        </section>
      </div>
    </div>
  );
};

export default ConferenceList;
