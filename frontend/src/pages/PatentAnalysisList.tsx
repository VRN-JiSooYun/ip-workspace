import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { 
  Table, 
  Button, 
  Input, 
  Space, 
  Tag, 
  Card, 
  Typography, 
  Row, 
  Col, 
  theme,
  Segmented,
  DatePicker,
  Alert,
  Modal
} from 'antd';
import { 
  Search, 
  Plus, 
  ChevronDown,
  ChevronUp,
  ExternalLink
} from 'lucide-react';
import BenzeneIcon from '../components/common/BenzeneIcon';
import { Patent, mockPatents } from '../mocks/patents';
import ChemDrawModal from '../components/common/ChemDrawModal';
import CompoundStructureView from '../components/common/CompoundStructureView';
import { getPatentAnalysisLayoutPreset } from '../config/patentAnalysisLayout';
import { useUIStore } from '../store/useUIStore';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import ToggleTag from '../components/common/ToggleTag';
import { mapPatentListItem, patentAnalysisApi } from '../services/patentAnalysisApi';
import { formatDisplayDate, formatNumberWithComma } from '../utils/displayFormat';

const { Text } = Typography;

const PATENT_LIST_TITLE_COLUMN_WIDTH = 520;
const PATENT_LIST_STRUCTURE_COLUMN_WIDTH = 212;
const PATENT_LIST_STRUCTURE_IMAGE_WIDTH = 168;
const PATENT_LIST_STRUCTURE_IMAGE_HEIGHT = 168;
const PATENT_LIST_TABLE_SCROLL_X = 1994;
const STRUCTURE_SEARCH_MAX_RESULT_WINDOW = 10000;
const PATENT_ANALYSIS_PAGE_SIZE_OPTIONS = [10, 30, 50, 100] as const;
const PATENT_ANALYSIS_DEFAULT_PAGE_SIZE = 30;
const STRUCTURE_SEARCH_EXPAND_COLUMN_WIDTH = 48;
const STRUCTURE_SEARCH_COLUMN_WIDTHS = {
  rowNumber: 72,
  structure: 212,
  compoundId: 180,
  mw: 110,
  logP: 110,
  tpsa: 110,
  patentCount: 120,
  smiles: 218,
} as const;
const STRUCTURE_SEARCH_TABLE_SCROLL_X =
  STRUCTURE_SEARCH_EXPAND_COLUMN_WIDTH +
  Object.values(STRUCTURE_SEARCH_COLUMN_WIDTHS).reduce((total, width) => total + width, 0);
const DEFAULT_PATENT_ORDER = JSON.stringify([{ column_name: 'p.publication_date', order: 'desc' }]);
const PATENT_OFFICE_FILTER_OPTIONS = ['ALL', 'WIPO', 'USPTO', 'KIPO', 'EPO'];
const STATUS_FILTER_OPTIONS = ['ALL', '분석중', '완료'];
const RECENT_PROJECTS = ['EGFR', 'AKT1', 'MET', 'FGFR3', 'VRK1', 'PKMYT1', 'WEE1', 'UBP1'];
const PATENT_ANALYSIS_LIST_STATE_KEY = 'patent-analysis-list-state:v1';
const SEARCH_TYPE_OPTIONS = [
  { label: '특허 제목', value: 'title' },
  { label: '특허 번호', value: 'publicationNumber' },
  { label: '구조 검색', value: 'structure' },
];

const normalizePatentAnalysisPageSize = (value?: number): number =>
  PATENT_ANALYSIS_PAGE_SIZE_OPTIONS.includes(value as (typeof PATENT_ANALYSIS_PAGE_SIZE_OPTIONS)[number])
    ? Number(value)
    : PATENT_ANALYSIS_DEFAULT_PAGE_SIZE;

type PatentSearchType = 'title' | 'publicationNumber' | 'structure';

type StructureSearchCompound = {
  compoundId: string;
  svgImg?: string;
  smiles?: string;
  mw?: number | string | null;
  logP?: number | string | null;
  tpsa?: number | string | null;
  patentCount: number;
  patents: Record<string, any>[];
};

type StructurePreview = {
  title: string;
  svg: string;
};

const normalizePatentListStructureSvg = (svg: string, width: number, height: number) => {
  if (typeof window === 'undefined' || !svg.trim()) return svg;

  try {
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const root = doc.documentElement;
    if (!root || root.nodeName.toLowerCase() !== 'svg') return svg;

    const viewBox = root.getAttribute('viewBox')?.trim();
    const viewBoxValues = viewBox?.split(/\s+/).map(Number);
    const viewBoxWidth = viewBoxValues?.length === 4 && Number.isFinite(viewBoxValues[2]) && viewBoxValues[2] > 0
      ? viewBoxValues[2]
      : width;
    const viewBoxHeight = viewBoxValues?.length === 4 && Number.isFinite(viewBoxValues[3]) && viewBoxValues[3] > 0
      ? viewBoxValues[3]
      : height;

    if (!viewBox) {
      root.setAttribute('viewBox', `0 0 ${viewBoxWidth} ${viewBoxHeight}`);
    }
    root.setAttribute('width', '100%');
    root.setAttribute('height', '100%');
    root.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    root.querySelectorAll(':scope > rect').forEach((rect) => {
      if (rect.getAttribute('transform')) return;
      rect.setAttribute('width', String(viewBoxWidth));
      rect.setAttribute('height', String(viewBoxHeight));
    });

    return new XMLSerializer().serializeToString(root);
  } catch {
    return svg;
  }
};

type HelperFilter = {
  filter_column: string;
  filter_condition: string;
  filter_value: string;
  filter_conjunction: 'and' | 'or';
  filter_group_condition: string;
};

type PatentAnalysisListStoredState = {
  searchType?: PatentSearchType;
  appliedSearchType?: PatentSearchType;
  searchText?: string;
  appliedSearchText?: string;
  showFilters?: boolean;
  selectedProjects?: string[];
  appliedProjects?: string[];
  selectedOffices?: string[];
  selectedStatuses?: string[];
  period?: string;
  appliedPeriod?: string;
  customDateRange?: [string | null, string | null] | null;
  appliedCustomDateRange?: [string | null, string | null] | null;
  currentPage?: number;
  pageSize?: number;
  expandedStructureCompoundIds?: string[];
};

const escapeFilterValue = (value: string): string => value.replace(/'/g, "''");

const buildPatentNumberFilter = (
  publicationNumber: string,
  targets: string[],
  dateFrom?: string,
  dateTo?: string,
) => {
  const filters: HelperFilter[] = [
    {
      filter_column: 'str#p.publication_number',
      filter_condition: "%s ilike '%%%s%%'",
      filter_value: escapeFilterValue(publicationNumber),
      filter_conjunction: 'and',
      filter_group_condition: '',
    },
  ];

  const activeTargets = targets.filter(target => target !== 'ALL');
  activeTargets.forEach((target, index) => {
    filters.push({
      filter_column: 'str#target',
      filter_condition: "%s='%s'",
      filter_value: escapeFilterValue(target),
      filter_conjunction: index === activeTargets.length - 1 ? 'and' : 'or',
      filter_group_condition: '',
    });
  });

  if (dateFrom) {
    filters.push({
      filter_column: 'str#p.publication_date',
      filter_condition: "%s>='%s'",
      filter_value: escapeFilterValue(dateFrom),
      filter_conjunction: 'and',
      filter_group_condition: '',
    });
  }
  if (dateTo) {
    filters.push({
      filter_column: 'str#p.publication_date',
      filter_condition: "%s<='%s'",
      filter_value: escapeFilterValue(dateTo),
      filter_conjunction: 'and',
      filter_group_condition: '',
    });
  }

  return JSON.stringify({ 84: filters });
};

const normalizeTotalCount = (value: unknown, fallback: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  if (Array.isArray(value)) {
    const first = value[0];
    if (first && typeof first === 'object' && 'total' in first) {
      return normalizeTotalCount((first as { total?: unknown }).total, fallback);
    }
    return value.length;
  }
  return fallback;
};

const formatMetric = (value: unknown) => {
  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) {
    return formatNumberWithComma(numericValue, { fractionDigits: 2 });
  }
  return '-';
};

const readStoredPatentAnalysisListState = (): PatentAnalysisListStoredState => {
  if (typeof window === 'undefined') return {};

  try {
    const rawState = window.sessionStorage.getItem(PATENT_ANALYSIS_LIST_STATE_KEY);
    if (!rawState) return {};
    const parsed = JSON.parse(rawState);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const restoreDateRange = (range?: [string | null, string | null] | null) => {
  if (!range?.[0] || !range?.[1]) return null;
  return [dayjs(range[0]), dayjs(range[1])] as [any, any];
};

const serializeDateRange = (range: [any, any] | null): [string | null, string | null] | null => {
  if (!range?.[0] || !range?.[1]) return null;
  return [
    typeof range[0].format === 'function' ? range[0].format('YYYY-MM-DD') : null,
    typeof range[1].format === 'function' ? range[1].format('YYYY-MM-DD') : null,
  ];
};

const PatentAnalysisList: React.FC = () => {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const storedListState = React.useMemo(readStoredPatentAnalysisListState, []);
  const hasMountedForCollapseRef = React.useRef(false);
  
  const [isChemDrawVisible, setIsChemDrawVisible] = useState(false);
  const [patents, setPatents] = useState<Patent[]>([]);
  const [structureCompounds, setStructureCompounds] = useState<StructureSearchCompound[]>([]);
  const [structurePatentCache, setStructurePatentCache] = useState<Record<string, Record<string, any>[]>>({});
  const [loadingStructurePatentIds, setLoadingStructurePatentIds] = useState<string[]>([]);
  const [expandedStructureCompoundIds, setExpandedStructureCompoundIds] = useState<string[]>(
    () => storedListState.expandedStructureCompoundIds ?? []
  );
  const [previewStructure, setPreviewStructure] = useState<StructurePreview | null>(null);
  const [totalPatents, setTotalPatents] = useState(0);
  const [currentPage, setCurrentPage] = useState(() => storedListState.currentPage ?? 1);
  const [pageSize, setPageSize] = useState(() => normalizePatentAnalysisPageSize(storedListState.pageSize));
  const [isLoadingPatents, setIsLoadingPatents] = useState(false);
  const [patentListError, setPatentListError] = useState<string | null>(null);
  const [isUsingMockFallback, setIsUsingMockFallback] = useState(false);
  const [searchType, setSearchType] = useState<PatentSearchType>(() => storedListState.searchType ?? 'title');
  const [appliedSearchType, setAppliedSearchType] = useState<PatentSearchType>(() => storedListState.appliedSearchType ?? 'title');
  const [searchText, setSearchText] = useState(() => storedListState.searchText ?? '');
  const [appliedSearchText, setAppliedSearchText] = useState(() => storedListState.appliedSearchText ?? '');
  const [showFilters, setShowFilters] = useState(() => storedListState.showFilters ?? false);
  const [selectedProjects, setSelectedProjects] = useState<string[]>(() => storedListState.selectedProjects ?? []);
  const [appliedProjects, setAppliedProjects] = useState<string[]>(() => storedListState.appliedProjects ?? []);
  const [selectedOffices, setSelectedOffices] = useState(() => storedListState.selectedOffices ?? PATENT_OFFICE_FILTER_OPTIONS);
  const [selectedStatuses, setSelectedStatuses] = useState(() => storedListState.selectedStatuses ?? STATUS_FILTER_OPTIONS);
  const [period, setPeriod] = useState(() => storedListState.period ?? '전체');
  const [appliedPeriod, setAppliedPeriod] = useState(() => storedListState.appliedPeriod ?? '전체');
  const [customDateRange, setCustomDateRange] = useState<[any, any] | null>(
    () => restoreDateRange(storedListState.customDateRange)
  );
  const [appliedCustomDateRange, setAppliedCustomDateRange] = useState<[any, any] | null>(
    () => restoreDateRange(storedListState.appliedCustomDateRange)
  );
  const [viewportWidth, setViewportWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 1920;
    return window.innerWidth;
  });
  const [viewportHeight, setViewportHeight] = useState<number>(() => {
    if (typeof window === 'undefined') return 1080;
    return window.innerHeight;
  });
  const { setHeaderContent } = useUIStore();
  const layoutPreset = React.useMemo(() => getPatentAnalysisLayoutPreset(viewportWidth), [viewportWidth]);
  const isResponsiveToolbar = viewportWidth <= 1100;
  const isStructureSearchMode = searchType === 'structure';
  const openPatentDetail = React.useCallback((patent: Patent) => {
    navigate(`/patents/analysis/${patent.patentNumber}`, {
      state: { patent },
    });
  }, [navigate]);
  const applySearchFilters = React.useCallback(() => {
    setAppliedSearchType(searchType);
    setAppliedSearchText(searchText.trim());
    setAppliedProjects(selectedProjects);
    setAppliedPeriod(period);
    setAppliedCustomDateRange(customDateRange);
    setStructurePatentCache({});
    setLoadingStructurePatentIds([]);
    setExpandedStructureCompoundIds([]);
    setCurrentPage(1);
  }, [customDateRange, period, searchText, searchType, selectedProjects]);
  const resetSearchFilters = React.useCallback(() => {
    setSearchType('title');
    setSearchText('');
    setSelectedProjects([]);
    setSelectedOffices(PATENT_OFFICE_FILTER_OPTIONS);
    setSelectedStatuses(STATUS_FILTER_OPTIONS);
    setPeriod('전체');
    setCustomDateRange(null);
    setAppliedSearchType('title');
    setAppliedSearchText('');
    setAppliedProjects([]);
    setAppliedPeriod('전체');
    setAppliedCustomDateRange(null);
    setStructurePatentCache({});
    setLoadingStructurePatentIds([]);
    setExpandedStructureCompoundIds([]);
    setCurrentPage(1);
    setPreviewStructure(null);
  }, []);
  const updateAllSyncedOptions = React.useCallback((
    currentValues: string[],
    option: string,
    checked: boolean,
    allOptions: string[],
  ) => {
    const specificOptions = allOptions.filter(value => value !== 'ALL');

    if (option === 'ALL') {
      return checked ? allOptions : [];
    }

    const withoutAll = currentValues.filter(value => value !== 'ALL');
    const nextValues = checked
      ? [...withoutAll, option]
      : withoutAll.filter(value => value !== option);

    if (nextValues.length === specificOptions.length) {
      return ['ALL', ...specificOptions];
    }
    return nextValues;
  }, []);

  const appliedDateParams = React.useMemo(() => {
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (appliedPeriod === '직접설정' && appliedCustomDateRange?.[0] && appliedCustomDateRange?.[1]) {
      return {
        dateFrom: appliedCustomDateRange[0].format('YYYY-MM-DD'),
        dateTo: appliedCustomDateRange[1].format('YYYY-MM-DD'),
      };
    }
    if (appliedPeriod === '전체') {
      return {};
    }

    const monthCount = appliedPeriod === '3개월' ? 3 : appliedPeriod === '6개월' ? 6 : 12;
    const to = new Date();
    const from = new Date();
    from.setMonth(from.getMonth() - monthCount);

    return {
      dateFrom: formatDate(from),
      dateTo: formatDate(to),
    };
  }, [appliedCustomDateRange, appliedPeriod]);
  const appliedStructureSmiles = appliedSearchType === 'structure' ? appliedSearchText.trim() : '';
  const searchPlaceholder = searchType === 'title'
    ? '특허 제목 검색...'
    : searchType === 'publicationNumber'
      ? 'WO2026104323A1'
      : 'SMILES 입력 또는 구조 그리기';
  const appliedSearchTagLabel = appliedSearchType === 'title'
    ? '제목'
    : appliedSearchType === 'publicationNumber'
      ? '특허 번호'
      : '구조';

  useEffect(() => {
    setHeaderContent(
      <PageHeaderBreadcrumb 
        items={[
          { label: 'Documents' },
          { label: 'Patents' },
          { label: 'My 특허 분석' }
        ]} 
      />
    );
    return () => setHeaderContent(null);
  }, [setHeaderContent]);

  useEffect(() => {
    const onResize = () => {
      setViewportWidth(window.innerWidth);
      setViewportHeight(window.innerHeight);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (isStructureSearchMode && showFilters) {
      setShowFilters(false);
    }
  }, [isStructureSearchMode, showFilters]);

  useEffect(() => {
    const nextStoredState: PatentAnalysisListStoredState = {
      searchType,
      appliedSearchType,
      searchText,
      appliedSearchText,
      showFilters,
      selectedProjects,
      appliedProjects,
      selectedOffices,
      selectedStatuses,
      period,
      appliedPeriod,
      customDateRange: serializeDateRange(customDateRange),
      appliedCustomDateRange: serializeDateRange(appliedCustomDateRange),
      currentPage,
      pageSize,
      expandedStructureCompoundIds,
    };

    try {
      window.sessionStorage.setItem(
        PATENT_ANALYSIS_LIST_STATE_KEY,
        JSON.stringify(nextStoredState),
      );
    } catch (error) {
      console.warn('[PatentAnalysisList] Failed to persist list state.', error);
    }
  }, [
    appliedCustomDateRange,
    appliedPeriod,
    appliedProjects,
    appliedSearchText,
    appliedSearchType,
    currentPage,
    customDateRange,
    expandedStructureCompoundIds,
    pageSize,
    period,
    searchText,
    searchType,
    selectedOffices,
    selectedProjects,
    selectedStatuses,
    showFilters,
  ]);

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();

    const loadPatents = async () => {
      setIsLoadingPatents(true);
      setPatentListError(null);
      try {
        const patentNumberFilter = appliedSearchType === 'publicationNumber' && appliedSearchText
          ? buildPatentNumberFilter(
            appliedSearchText,
            appliedProjects,
            appliedDateParams.dateFrom,
            appliedDateParams.dateTo,
          )
          : undefined;
        const response = appliedStructureSmiles
          ? await patentAnalysisApi.searchCompounds({
              wasm: 1,
              smiles: appliedStructureSmiles,
              type: 'substructure',
              sim: 70,
              actionType: 'GET-ELASTIC-COMPOUND-LIST',
              operation: currentPage > 1
                ? 'GET-ELASTIC-COMPOUND-LIST-BY-PAGE'
                : 'GET-ELASTIC-COMPOUND-LIST',
              page: currentPage,
              size: pageSize,
              compoundPageSize: pageSize,
            }, {
              signal: controller.signal,
              timeoutMs: 60000,
            })
          : await patentAnalysisApi.getMyPatents({
            page: currentPage,
            pageSize,
            order: DEFAULT_PATENT_ORDER,
            filter: patentNumberFilter,
            keyword: appliedSearchType === 'title' ? appliedSearchText || undefined : undefined,
            target: patentNumberFilter ? undefined : appliedProjects.length > 0 ? appliedProjects.join(',') : undefined,
            dateFrom: patentNumberFilter ? undefined : appliedDateParams.dateFrom,
            dateTo: patentNumberFilter ? undefined : appliedDateParams.dateTo,
          });
        if (ignore) return;
        const rowOffsetPageSize = pageSize;
        const rawTotalCount = normalizeTotalCount(response.totalCount, response.items.length);
        const normalizedTotalCount = rawTotalCount;
        const paginationTotalCount = appliedStructureSmiles
          ? Math.min(normalizedTotalCount, STRUCTURE_SEARCH_MAX_RESULT_WINDOW)
          : normalizedTotalCount;
        const maxPage = Math.max(1, Math.ceil(paginationTotalCount / rowOffsetPageSize));
        if (currentPage > maxPage) {
          setCurrentPage(maxPage);
          return;
        }
        if (appliedStructureSmiles) {
          setStructureCompounds(response.items.slice(0, rowOffsetPageSize).map((item) => ({
            compoundId: String(item.compoundId ?? ''),
            svgImg: typeof item.svgImg === 'string' ? item.svgImg : '',
            smiles: typeof item.smiles === 'string' ? item.smiles : '',
            mw: item.mw ?? null,
            logP: item.logP ?? null,
            tpsa: item.tpsa ?? null,
            patentCount: Number(item.patentCount) || 0,
            patents: [],
          })));
          setPatents([]);
          setTotalPatents(normalizedTotalCount);
          setIsUsingMockFallback(false);
          if (response.raw?.proof) {
            const proof = response.raw.proof as {
              helperOperation?: string;
              searchedCompoundCount?: number;
              compoundTotalCount?: number;
            };
            console.info('[Patent structure search proof]', {
              operation: proof.helperOperation,
              searchedCompoundCount: proof.searchedCompoundCount,
              compoundTotalCount: proof.compoundTotalCount,
            });
          }
          return;
        }
        const mappedPatents = response.items.slice(0, rowOffsetPageSize).map((item, index) =>
          mapPatentListItem(item, (currentPage - 1) * rowOffsetPageSize + index)
        );
        setStructureCompounds([]);
        setPatents(mappedPatents);
        setTotalPatents(normalizedTotalCount);
        setIsUsingMockFallback(false);
      } catch (error) {
        if (!ignore) {
          const fallbackPatents = mockPatents.slice((currentPage - 1) * pageSize, currentPage * pageSize);
          setPatents(fallbackPatents);
          setStructureCompounds([]);
          setTotalPatents(mockPatents.length);
          setIsUsingMockFallback(true);
          const fallbackMessage = appliedStructureSmiles
            ? '구조 검색 API 요청에 실패했습니다.'
            : '특허 목록 API 요청에 실패했습니다.';
          setPatentListError(error instanceof Error ? error.message : fallbackMessage);
        }
      } finally {
        if (!ignore) {
          setIsLoadingPatents(false);
        }
      }
    };

    void loadPatents();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [
    appliedDateParams.dateFrom,
    appliedDateParams.dateTo,
    appliedProjects,
    appliedSearchText,
    appliedSearchType,
    appliedStructureSmiles,
    currentPage,
    pageSize,
  ]);

  useEffect(() => {
    if (!hasMountedForCollapseRef.current) {
      hasMountedForCollapseRef.current = true;
      return;
    }
    setExpandedStructureCompoundIds([]);
  }, [appliedStructureSmiles, currentPage]);

  const filteredPatents = React.useMemo(() => {
    return patents;
  }, [patents]);

  const filteredStructureCompounds = React.useMemo(() => {
    return structureCompounds;
  }, [structureCompounds]);

  const patentListTableScrollY = React.useMemo(() => {
    return Math.max(280, viewportHeight - 420);
  }, [viewportHeight]);

  const patentListTableScroll = React.useMemo(() => {
    const estimatedRowHeight = 64;
    const needsVerticalScroll = filteredPatents.length * estimatedRowHeight > patentListTableScrollY;
    return needsVerticalScroll
      ? { x: PATENT_LIST_TABLE_SCROLL_X, y: patentListTableScrollY }
      : { x: PATENT_LIST_TABLE_SCROLL_X };
  }, [filteredPatents.length, patentListTableScrollY]);

  const structureSearchTableScroll = React.useMemo(() => {
    const estimatedRowHeight = 92;
    const needsVerticalScroll = filteredStructureCompounds.length * estimatedRowHeight > patentListTableScrollY;
    return needsVerticalScroll
      ? { x: STRUCTURE_SEARCH_TABLE_SCROLL_X, y: patentListTableScrollY }
      : { x: STRUCTURE_SEARCH_TABLE_SCROLL_X };
  }, [filteredStructureCompounds.length, patentListTableScrollY]);

  const renderStructureColumn = React.useCallback((
    svg: string | undefined,
    title: string,
    smiles?: string,
  ) => {
    if (!svg) return <Text type="secondary">-</Text>;
    const width = PATENT_LIST_STRUCTURE_IMAGE_WIDTH;
    const height = PATENT_LIST_STRUCTURE_IMAGE_HEIGHT;
    const normalizedSvg = normalizePatentListStructureSvg(svg, width, height);
    return (
      <div
        className="patent-analysis-compound-structure"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        <CompoundStructureView
          svg={svg}
          renderedSvgOverride={normalizedSvg}
          title={title}
          smiles={smiles}
          width={width}
          height={height}
          iconSize={28}
          gap={0}
          actionPlacement="overlay"
          actionOverlayAnchor="container"
          frameless
          structureFitMode="contain"
          frameClassName="patent-analysis-compound-structure-frame"
          svgClassName="patent-analysis-compound-structure-svg"
          onPreview={() => setPreviewStructure({ title, svg: normalizedSvg })}
        />
      </div>
    );
  }, []);

  const columns = [
    {
      title: 'No.',
      key: 'rowNumber',
      width: 72,
      align: 'center' as const,
      className: 'table-center-column',
      render: (_: unknown, __: Patent, index: number) => (
        <Text type="secondary">
          {formatNumberWithComma((currentPage - 1) * pageSize + index + 1)}
        </Text>
      ),
    },
    {
      title: '특허 번호',
      dataIndex: 'patentNumber',
      key: 'patentNumber',
      width: 160,
      align: 'center' as const,
      className: 'table-center-column',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '타겟',
      dataIndex: 'target',
      key: 'target',
      width: 100,
      align: 'center' as const,
      className: 'table-center-column',
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '제목',
      dataIndex: 'title',
      key: 'title',
      width: PATENT_LIST_TITLE_COLUMN_WIDTH,
      className: 'responsive-text-column',
      ellipsis: true,
    },
    {
      title: '출원인',
      dataIndex: 'applicant',
      key: 'applicant',
      width: 220,
    },
    {
      title: '출판일',
      dataIndex: 'publicationDate',
      key: 'publicationDate',
      width: 120,
      align: 'center' as const,
      className: 'table-center-column',
      render: formatDisplayDate,
    },
    {
      title: '실시예 수',
      dataIndex: 'embodimentCount',
      key: 'embodimentCount',
      width: 110,
      align: 'center' as const,
      className: 'table-center-column',
      render: (value: number | null | undefined) => (
        value === null || value === undefined ? <Text type="secondary">-</Text> : formatNumberWithComma(value)
      ),
    },
    {
      title: 'Key Scaffold',
      dataIndex: 'keyScaffoldSvg',
      key: 'keyScaffoldSvg',
      width: PATENT_LIST_STRUCTURE_COLUMN_WIDTH,
      align: 'center' as const,
      className: 'table-center-column patent-analysis-list-structure-column my-board-structure-column',
      render: (svg: string | undefined, record: Patent) => (
        renderStructureColumn(svg, `${record.patentNumber} Key Scaffold`)
      ),
    },
    {
      title: 'AI Key Compound',
      dataIndex: 'aiKeyCompoundSvg',
      key: 'aiKeyCompoundSvg',
      width: PATENT_LIST_STRUCTURE_COLUMN_WIDTH,
      align: 'center' as const,
      className: 'table-center-column patent-analysis-list-structure-column my-board-structure-column',
      render: (svg: string | undefined, record: Patent) => (
        renderStructureColumn(svg, `${record.patentNumber} AI Key Compound`, record.keyCompoundSmiles)
      ),
    },
    {
      title: 'Analysis Date',
      dataIndex: 'analysisDate',
      key: 'analysisDate',
      width: 140,
      align: 'center' as const,
      className: 'table-center-column',
      render: formatDisplayDate,
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      align: 'center' as const,
      className: 'table-center-column',
      render: (status: string) => {
        let color = 'default';
        if (status === 'Completed') color = 'success';
        if (status === 'Analyzing') color = 'processing';
        return <Tag color={color}>{status}</Tag>;
      },
    },
  ];

  const structureSearchPatentColumns = [
    {
      title: '특허 번호',
      dataIndex: 'patentNumber',
      key: 'patentNumber',
      width: 170,
      align: 'center' as const,
      className: 'table-center-column',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '제목',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '출원인',
      dataIndex: 'applicant',
      key: 'applicant',
      width: 260,
    },
    {
      title: '타겟',
      dataIndex: 'target',
      key: 'target',
      width: 130,
      align: 'center' as const,
      className: 'table-center-column',
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '출판일',
      dataIndex: 'publicationDate',
      key: 'publicationDate',
      width: 120,
      align: 'center' as const,
      className: 'table-center-column',
      render: formatDisplayDate,
    },
    {
      title: '작업',
      key: 'action',
      width: 70,
      align: 'center' as const,
      render: (_: any, record: Patent) => (
        <Button
          type="text"
          icon={<ExternalLink size={16} />}
          onClick={(event) => {
            event.stopPropagation();
            openPatentDetail(record);
          }}
        />
      ),
    },
  ];

  const structureSearchColumns = [
    {
      title: 'No.',
      key: 'rowNumber',
      width: STRUCTURE_SEARCH_COLUMN_WIDTHS.rowNumber,
      align: 'center' as const,
      className: 'table-center-column',
      render: (_: unknown, __: StructureSearchCompound, index: number) => (
        <Text type="secondary">
          {formatNumberWithComma((currentPage - 1) * pageSize + index + 1)}
        </Text>
      ),
    },
    {
      title: '구조',
      dataIndex: 'svgImg',
      key: 'structure',
      width: STRUCTURE_SEARCH_COLUMN_WIDTHS.structure,
      align: 'center' as const,
      render: (svg: string, record: StructureSearchCompound) => (
        <div
          className="patent-analysis-compound-structure"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <CompoundStructureView
            svg={svg}
            title={record.compoundId || 'Structure'}
            smiles={record.smiles}
            width={168}
            height={108}
            iconSize={40}
            gap={6}
            frameClassName="patent-analysis-compound-structure-frame"
            svgClassName="patent-analysis-compound-structure-svg"
            onPreview={svg ? () => {
              setPreviewStructure({ title: record.compoundId || 'Structure', svg });
            } : undefined}
          />
        </div>
      ),
    },
    {
      title: 'Compound ID',
      dataIndex: 'compoundId',
      key: 'compoundId',
      width: STRUCTURE_SEARCH_COLUMN_WIDTHS.compoundId,
      align: 'center' as const,
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'MW',
      dataIndex: 'mw',
      key: 'mw',
      width: STRUCTURE_SEARCH_COLUMN_WIDTHS.mw,
      align: 'center' as const,
      render: formatMetric,
    },
    {
      title: 'LogP',
      dataIndex: 'logP',
      key: 'logP',
      width: STRUCTURE_SEARCH_COLUMN_WIDTHS.logP,
      align: 'center' as const,
      render: formatMetric,
    },
    {
      title: 'TPSA',
      dataIndex: 'tpsa',
      key: 'tpsa',
      width: STRUCTURE_SEARCH_COLUMN_WIDTHS.tpsa,
      align: 'center' as const,
      render: formatMetric,
    },
    {
      title: '관련 특허',
      dataIndex: 'patentCount',
      key: 'patentCount',
      width: STRUCTURE_SEARCH_COLUMN_WIDTHS.patentCount,
      align: 'center' as const,
      render: (count: number) => <Tag color={count > 0 ? 'blue' : 'default'}>{formatNumberWithComma(count)}건</Tag>,
    },
    {
      title: 'SMILES',
      dataIndex: 'smiles',
      key: 'smiles',
      width: STRUCTURE_SEARCH_COLUMN_WIDTHS.smiles,
      ellipsis: true,
      render: (text: string) => <Text type="secondary">{text || '-'}</Text>,
    },
  ];

  const loadStructureCompoundPatents = React.useCallback(async (compoundId: string) => {
    if (!compoundId || structurePatentCache[compoundId] || loadingStructurePatentIds.includes(compoundId)) {
      return;
    }

    setLoadingStructurePatentIds((prev) => [...prev, compoundId]);
    try {
      const response = await patentAnalysisApi.getPatentsByCompoundId(compoundId);
      setStructurePatentCache((prev) => ({
        ...prev,
        [compoundId]: response.items,
      }));
    } catch (error) {
      setStructurePatentCache((prev) => ({
        ...prev,
        [compoundId]: [],
      }));
      console.error('[Patent structure compound patents]', error);
    } finally {
      setLoadingStructurePatentIds((prev) => prev.filter((id) => id !== compoundId));
    }
  }, [loadingStructurePatentIds, structurePatentCache]);

  useEffect(() => {
    if (!appliedStructureSmiles || expandedStructureCompoundIds.length === 0) {
      return;
    }

    const currentCompoundIds = new Set(structureCompounds.map((compound) => compound.compoundId));
    expandedStructureCompoundIds.forEach((compoundId) => {
      if (currentCompoundIds.has(compoundId)) {
        void loadStructureCompoundPatents(compoundId);
      }
    });
  }, [
    appliedStructureSmiles,
    expandedStructureCompoundIds,
    loadStructureCompoundPatents,
    structureCompounds,
  ]);

  const renderStructureCompoundPatents = (compound: StructureSearchCompound) => {
    const isLoading = loadingStructurePatentIds.includes(compound.compoundId);
    const patentRows = structurePatentCache[compound.compoundId] ?? [];
    const mappedPatents = patentRows.map((item, index) =>
      mapPatentListItem(item, index)
    );

    if (isLoading || !structurePatentCache[compound.compoundId]) {
      return (
        <div className="structure-patent-subtable-empty">
          <Text type="secondary">특허 목록을 불러오는 중입니다.</Text>
        </div>
      );
    }

    if (structurePatentCache[compound.compoundId] && mappedPatents.length === 0) {
      return (
        <div className="structure-patent-subtable-empty">
          <Text type="secondary">연결된 특허가 없습니다.</Text>
        </div>
      );
    }

    return (
      <div className="structure-patent-subtable-wrap">
        <Table
          className="structure-patent-subtable"
          columns={structureSearchPatentColumns}
          dataSource={mappedPatents}
          rowKey="id"
          pagination={mappedPatents.length > 5 ? {
            pageSize: 5,
            size: 'small',
            itemRender: (page, type, originalElement) => (
              type === 'page' ? <span>{formatNumberWithComma(page)}</span> : originalElement
            ),
          } : false}
          size="small"
          onRow={(record) => ({
            onClick: () => openPatentDetail(record),
            style: { cursor: 'pointer' },
          })}
        />
      </div>
    );
  };

  return (
    <div className="patent-analysis-list-page" style={{ maxWidth: layoutPreset.maxWidth, margin: '0 auto', padding: `0 ${layoutPreset.sidePadding}px`, height: '100%', width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'fadeIn 0.3s ease-out' }}>
        <Card variant="borderless" className="c-card compact-filter-card" style={{ marginBottom: 12, flexShrink: 0 }}>
          <Row gutter={[12, 8]} align="middle">
            <Col flex="auto" style={{ minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                  minWidth: 0,
                }}
              >
                <Segmented
                  options={SEARCH_TYPE_OPTIONS}
                  value={searchType}
                  onChange={(value) => setSearchType(value as PatentSearchType)}
                />
                <Input
                  prefix={<Search size={18} color={token.colorTextTertiary} />}
                  placeholder={searchPlaceholder}
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  onPressEnter={applySearchFilters}
                  className="v-search-input"
                  style={{
                    flex: '1 1 260px',
                    minWidth: 180,
                    maxWidth: isResponsiveToolbar ? '100%' : 350,
                  }}
                />
                {searchType === 'structure' && (
                  <Button
                    icon={<BenzeneIcon size={18} />}
                    onClick={() => setIsChemDrawVisible(true)}
                    className="v-action-btn"
                  >
                    구조 검색
                  </Button>
                )}
                <Button
                  icon={showFilters ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  onClick={() => setShowFilters(!showFilters)}
                  disabled={isStructureSearchMode}
                  className="v-action-btn"
                >
                  상세 필터 {showFilters ? '닫기' : '열기'}
                </Button>
                <Button
                  type="primary"
                  icon={<Search size={16} />}
                  onClick={applySearchFilters}
                  className="v-action-btn"
                >
                  검색
                </Button>
              </div>
            </Col>
            <Col flex={isResponsiveToolbar ? '1 1 100%' : 'none'}>
              <Button 
                type="primary" 
                icon={<Plus size={18} />} 
                className="v-action-btn"
                style={{
                  background: '#F87C63',
                  borderColor: '#F87C63',
                  width: isResponsiveToolbar ? '100%' : undefined,
                }}
              >
                신규 특허 등록
              </Button>
            </Col>
          </Row>
          {showFilters && (
            <div className="compact-filter-panel">
              <Row gutter={[24, 12]}>
                <Col span={6}>
                  <Text strong>특허청</Text><br />
                  <div style={{ marginTop: 4 }}>
                    <Space wrap>
                      {PATENT_OFFICE_FILTER_OPTIONS.map(opt => (
                        <ToggleTag
                          key={opt}
                          checked={opt === 'ALL'
                            ? PATENT_OFFICE_FILTER_OPTIONS.every(value => selectedOffices.includes(value))
                            : selectedOffices.includes(opt)}
                          onChange={(checked) => {
                            setSelectedOffices(prev => updateAllSyncedOptions(prev, opt, checked, PATENT_OFFICE_FILTER_OPTIONS));
                          }}
                        >
                          {opt}
                        </ToggleTag>
                      ))}
                    </Space>
                  </div>
                </Col>
                <Col span={6}>
                  <Text strong>분석 상태</Text><br />
                  <div style={{ marginTop: 4 }}>
                    <Space wrap>
                      {STATUS_FILTER_OPTIONS.map(opt => (
                        <ToggleTag
                          key={opt}
                          checked={opt === 'ALL'
                            ? STATUS_FILTER_OPTIONS.every(value => selectedStatuses.includes(value))
                            : selectedStatuses.includes(opt)}
                          onChange={(checked) => {
                            setSelectedStatuses(prev => updateAllSyncedOptions(prev, opt, checked, STATUS_FILTER_OPTIONS));
                          }}
                        >
                          {opt}
                        </ToggleTag>
                      ))}
                    </Space>
                  </div>
                </Col>
                <Col span={12}>
                  <Text strong>Recent Projects</Text><br />
                  <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {RECENT_PROJECTS.map(project => (
                      <Tag.CheckableTag 
                        key={project}
                        checked={selectedProjects.includes(project)}
                        onChange={(checked) => {
                          setSelectedProjects(prev => (
                            checked
                              ? [...prev, project]
                              : prev.filter(item => item !== project)
                          ));
                        }}
                        className="v-project-tag"
                      >
                        {project}
                      </Tag.CheckableTag>
                    ))}
                  </div>
                </Col>
                <Col span={24}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <Text strong>기간</Text>
                    <Segmented 
                      options={['3개월', '6개월', '12개월', '전체', '직접설정']}
                      value={period} 
                      onChange={(v) => setPeriod(v as string)} 
                    />
                    {period === '직접설정' && (
                      <DatePicker.RangePicker
                        allowEmpty={[true, true]}
                        value={customDateRange}
                        onChange={(range) => setCustomDateRange(range as [any, any] | null)}
                        format="YYYY.MM.DD"
                      />
                    )}
                    <Button type="primary" onClick={applySearchFilters}>적용</Button>
                    <Button onClick={resetSearchFilters}>초기화</Button>
                  </div>
                </Col>
              </Row>
            </div>
          )}
        </Card>

        <div className="v-table-card patent-analysis-table-card" style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
          <div className="v-table-header patent-analysis-table-header" style={{ flexWrap: 'wrap', gap: 12 }}>
            <Text strong style={{ color: token.colorPrimary }}>
              {appliedStructureSmiles ? '구조 검색 Compound 목록' : '특허 분석 리스트'}
            </Text>
            <Text type="secondary">
              {appliedStructureSmiles
                ? `${formatNumberWithComma(totalPatents)} compounds`
                : `${formatNumberWithComma(totalPatents)} patents`}
            </Text>
          </div>
          {(appliedSearchText || (!appliedStructureSmiles && (appliedProjects.length > 0 || appliedPeriod !== '전체'))) && (
            <Space wrap style={{ padding: '12px 12px 10px' }}>
              {appliedSearchText && (
                <Tag color={appliedSearchType === 'structure' ? 'cyan' : 'blue'}>
                  {appliedSearchTagLabel}: {appliedSearchText}
                </Tag>
              )}
              {!appliedStructureSmiles && (
                <>
                  {appliedProjects.map(project => (
                    <Tag key={project} color="green">타겟: {project}</Tag>
                  ))}
                  {appliedPeriod !== '전체' && (
                    <Tag color="purple">
                      기간: {appliedPeriod === '직접설정'
                        ? `${formatDisplayDate(appliedDateParams.dateFrom)} ~ ${formatDisplayDate(appliedDateParams.dateTo)}`
                        : appliedPeriod}
                    </Tag>
                  )}
                </>
              )}
            </Space>
          )}
          {isUsingMockFallback && patentListError && (
            <Alert
              type="warning"
              showIcon
              message={appliedStructureSmiles ? '구조 검색 API 연결 실패' : '특허 목록 API 연결 실패'}
              description={`${patentListError} 현재 화면은 mock 데이터로 표시됩니다.`}
              style={{ margin: '12px 12px 0' }}
            />
          )}
          {appliedStructureSmiles ? (
            <Table
              className="my-board-table patent-analysis-list-table patent-analysis-structure-table"
              columns={structureSearchColumns}
              dataSource={filteredStructureCompounds}
              rowKey="compoundId"
              size="small"
              loading={isLoadingPatents}
              expandable={{
                columnWidth: STRUCTURE_SEARCH_EXPAND_COLUMN_WIDTH,
                expandedRowKeys: expandedStructureCompoundIds,
                expandedRowRender: renderStructureCompoundPatents,
                rowExpandable: (record) => record.patentCount > 0,
                onExpandedRowsChange: (expandedKeys) => {
                  setExpandedStructureCompoundIds(expandedKeys.map(String));
                },
                onExpand: (expanded, record) => {
                  if (expanded) {
                    void loadStructureCompoundPatents(record.compoundId);
                  }
                },
              }}
              pagination={{
                current: currentPage,
                pageSize,
                total: Math.min(totalPatents, STRUCTURE_SEARCH_MAX_RESULT_WINDOW),
                showSizeChanger: true,
                pageSizeOptions: PATENT_ANALYSIS_PAGE_SIZE_OPTIONS.map(String),
                itemRender: (page, type, originalElement) => (
                  type === 'page' ? <span>{formatNumberWithComma(page)}</span> : originalElement
                ),
                onChange: (page, nextPageSize) => {
                  setCurrentPage(page);
                  setPageSize(normalizePatentAnalysisPageSize(nextPageSize));
                },
              }}
              scroll={structureSearchTableScroll}
              style={{ flex: 1 }}
              tableLayout="fixed"
            />
          ) : (
            <Table
              className="my-board-table patent-analysis-list-table"
              columns={columns}
              dataSource={filteredPatents}
              rowKey="id"
              size="small"
              loading={isLoadingPatents}
              onRow={(record) => ({
                onClick: () => openPatentDetail(record),
                style: { cursor: 'pointer' }
              })}
              pagination={{
                current: currentPage,
                pageSize,
                total: totalPatents,
                showSizeChanger: true,
                pageSizeOptions: PATENT_ANALYSIS_PAGE_SIZE_OPTIONS.map(String),
                itemRender: (page, type, originalElement) => (
                  type === 'page' ? <span>{formatNumberWithComma(page)}</span> : originalElement
                ),
                onChange: (page, nextPageSize) => {
                  setCurrentPage(page);
                  setPageSize(normalizePatentAnalysisPageSize(nextPageSize));
                },
              }}
              scroll={patentListTableScroll}
              style={{ flex: 1 }}
              tableLayout="fixed"
            />
          )}
        </div>

        <ChemDrawModal 
          open={isChemDrawVisible} 
          onCancel={() => setIsChemDrawVisible(false)} 
          onConfirm={(data) => {
            setSearchText(data.smiles);
            setIsChemDrawVisible(false);
          }}
          title="구조 검색"
          confirmText="이 구조로 검색"
          initialSmiles={searchType === 'structure' ? searchText : undefined}
        />
        <Modal
          open={Boolean(previewStructure)}
          footer={null}
          onCancel={() => setPreviewStructure(null)}
          width="min(1200px, calc(100vw - 48px))"
          title={previewStructure?.title || '구조 미리보기'}
          centered
        >
          {previewStructure?.svg ? (
            <div
              className="patent-analysis-structure-preview"
              style={{
                width: '100%',
                height: 'min(720px, calc(100vh - 180px))',
                background: token.colorBgContainer,
                borderRadius: 8,
                border: `1px solid ${token.colorBorderSecondary}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
              dangerouslySetInnerHTML={{ __html: previewStructure.svg }}
            />
          ) : null}
        </Modal>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ant-table-row:hover > td {
          background: var(--table-row-hover-bg) !important;
        }
        .patent-analysis-table-header {
          min-height: 48px;
        }
        .patent-analysis-table-card {
          flex-grow: 0;
        }
        .patent-analysis-list-table {
          flex: 0 0 auto !important;
        }
        .patent-analysis-list-table .ant-pagination {
          margin: 12px 16px !important;
        }
        .patent-analysis-list-table .ant-table-container {
          border: 1px solid ${token.colorBorderSecondary};
          overflow: hidden;
          box-shadow: inset 0 1px 0 ${token.colorFillQuaternary};
        }
        .patent-analysis-list-table .ant-table,
        .patent-analysis-list-table .ant-table-container,
        .patent-analysis-list-table .ant-table-header,
        .patent-analysis-list-table .ant-table-body,
        .patent-analysis-list-table .ant-table-content,
        .patent-analysis-list-table .ant-table-thead > tr > th,
        .patent-analysis-list-table .ant-table-thead > tr > td {
          border-radius: 0 !important;
          border-start-start-radius: 0 !important;
          border-start-end-radius: 0 !important;
          border-end-start-radius: 0 !important;
          border-end-end-radius: 0 !important;
        }
        .patent-analysis-list-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid ${token.colorBorderSecondary};
        }
        .patent-analysis-list-table .ant-table-tbody > tr:last-child > td {
          border-bottom: 1px solid transparent !important;
        }
        .patent-analysis-list-table .ant-table-tbody > tr > td.patent-analysis-list-structure-column {
          padding: 1px 1px !important;
          line-height: 0 !important;
          vertical-align: middle !important;
        }
        .patent-analysis-list-table .ant-table-thead > tr > th.patent-analysis-list-structure-column {
          padding-left: 4px !important;
          padding-right: 4px !important;
        }
        .patent-analysis-list-table .patent-analysis-list-structure-column .compound-structure-view,
        .patent-analysis-list-table .patent-analysis-list-structure-column .compound-structure-frame {
          line-height: 0 !important;
        }
        .patent-analysis-list-table .patent-analysis-list-structure-column .compound-structure-actions-overlay {
          top: auto;
          right: 4px;
          bottom: 4px;
        }
        .patent-analysis-list-table .patent-analysis-list-structure-column .compound-structure-frame {
          border: 0 !important;
          outline: 0 !important;
          box-shadow: none !important;
          background: transparent !important;
        }
        .patent-analysis-list-table .patent-analysis-list-structure-column .patent-analysis-compound-structure-svg,
        .patent-analysis-list-table .patent-analysis-list-structure-column .patent-analysis-compound-structure-svg svg {
          width: 100% !important;
          height: 100% !important;
          max-width: 100% !important;
          max-height: 100% !important;
        }
        .patent-analysis-list-table .ant-table-body {
          background: ${token.colorBgContainer} !important;
          scrollbar-gutter: stable;
          overflow-y: auto !important;
        }
        .patent-analysis-list-table .ant-table-body table {
          background: ${token.colorBgContainer} !important;
        }
        .patent-analysis-structure-table .ant-table-expanded-row > .ant-table-cell {
          background: var(--content-bg) !important;
          padding: 12px 18px 18px !important;
        }
        .structure-patent-subtable-wrap,
        .structure-patent-subtable-empty {
          border: 1px solid ${token.colorBorderSecondary};
          background: ${token.colorBgContainer};
          box-shadow: inset 0 1px 0 ${token.colorFillQuaternary};
        }
        .structure-patent-subtable-empty {
          padding: 18px 20px;
        }
        .structure-patent-subtable .ant-table {
          background: transparent;
          margin-inline: 0 !important;
          margin-block: 0 !important;
        }
        .structure-patent-subtable .ant-table-tbody > tr > td {
          border-bottom: 1px solid ${token.colorBorderSecondary};
        }
        .structure-patent-subtable .ant-table-tbody > tr:last-child > td {
          border-bottom: 1px solid transparent !important;
        }
        .patent-analysis-compound-structure .compound-structure-frame {
          padding: 0 !important;
          background: ${token.colorBgContainer} !important;
        }
        .patent-analysis-compound-structure-svg svg {
          width: 98% !important;
          height: 98% !important;
          max-width: 98% !important;
          max-height: 98% !important;
        }
        .cursor-pointer { cursor: pointer; }
        .patent-analysis-structure-preview svg {
          width: 94%;
          height: 94%;
        }
      `}</style>
    </div>
  );
};

export default PatentAnalysisList;
