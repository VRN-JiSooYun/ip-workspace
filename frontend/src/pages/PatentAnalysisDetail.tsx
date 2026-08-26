import React, { useMemo, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  Button, 
  Space, 
  Tag, 
  Card, 
  Modal,
  Tooltip,
  Typography, 
  Tabs, 
  Row, 
  Col, 
  theme,
  Empty,
  Table,
  App,
  Alert,
  Badge,
  Pagination,
  Spin
} from 'antd';
import { 
  Plus, 
  ArrowLeft,
  ChevronLeft,
  Dna,
  Beaker,
  BarChart3,
  FileText,
  Activity,
  Database,
  LayoutGrid,
  Pin,
  Table as TableIcon,
  Layers,
  FileSpreadsheet,
  Copy,
  Download,
  Sparkles,
  Star,
} from 'lucide-react';
import type { Patent } from '../types/patent';
import { getPatentAnalysisLayoutPreset } from '../config/patentAnalysisLayout';
import { useUIStore } from '../store/useUIStore';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import DataCardItem from '../components/patent-analysis/DataCardItem';
import CleanDataRequestModal, {
  type CleanDataQuality,
} from '../components/patent-analysis/CleanDataRequestModal';
import PatentAnalysisDataFilter, {
  countPatentDataFilters,
} from '../components/patent-analysis/PatentAnalysisDataFilter';
import ScaffoldRankBadge, {
  normalizeScaffoldRank,
} from '../components/patent-analysis/ScaffoldRankBadge';
import PatentScaffoldFilterControls from '../components/patent-analysis/PatentScaffoldFilterControls';
import ChemDrawModal from '../components/common/ChemDrawModal';
import BenzeneIcon from '../components/common/BenzeneIcon';
import CompoundStructureView from '../components/common/CompoundStructureView';
import StructurePreviewModal from '../components/common/StructurePreviewModal';
import PatentPdfToolbar from '../components/patent-analysis/pdf/PatentPdfToolbar';
import PatentPdfViewer from '../components/patent-analysis/pdf/PatentPdfViewer';
import { usePatentPdfViewer } from '../hooks/usePatentPdfViewer';
import {
  mapPatentListItem,
  patentAnalysisApi,
  type EmbodimentSearchResponse,
  type PatentDataFilterValue,
} from '../services/patentAnalysisApi';
import { formatDisplayDate, formatNumberWithComma } from '../utils/displayFormat';
import {
  downloadPatentPdfFile,
  resolvePatentPdfDocument,
} from '../utils/patentPdf';

const { Title, Text, Paragraph } = Typography;

type StructurePreviewMeta = {
  smiles?: string | null;
  molblock?: string | null;
  cdxml?: string | null;
};

const ENABLE_HIGHLIGHT_DEBUG_LOG = false;
const SPLIT_MIN_PERCENT = 20;
const SPLIT_MAX_PERCENT = 70;
const SPLIT_DEFAULT_PERCENT = 45;
const DETAIL_STACK_BREAKPOINT = 1280;
const PATENT_ANALYSIS_FAVORITE_STATE_PREFIX = 'patent-analysis-favorite-state';
const RAW_DATA_DEFAULT_PAGE_SIZE = 30;
const RAW_DATA_PAGE_SIZE_OPTIONS = [10, 30, 50, 100];
const PATENT_DATA_STRUCTURE_SIZE = 176;

const useDeferredTableBinding = (active: boolean, bindingKey: string) => {
  const [readyKey, setReadyKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!active) {
      setReadyKey(null);
      return undefined;
    }

    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        setReadyKey(bindingKey);
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) {
        window.cancelAnimationFrame(secondFrame);
      }
    };
  }, [active, bindingKey]);

  return active && readyKey === bindingKey;
};

const getAvailableScaffoldRanks = (rows: any[]) => (
  Array.from(new Set(
    rows
      .map((row) => normalizeScaffoldRank(row?.scaffold_ranking))
      .filter((rank): rank is number => rank !== null),
  )).sort((a, b) => a - b)
);

const PatentDetailLoadingState: React.FC<{ description?: string }> = ({ description = '특허 상세 데이터를 불러오는 중입니다.' }) => (
  <div style={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Space direction="vertical" align="center" size={10}>
      <Spin />
      <Text type="secondary">{description}</Text>
    </Space>
  </div>
);

const normalizePublicationNumber = (value: string) => value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

const getFavoriteStateStorageKey = (publicationNumber: string) => (
  `${PATENT_ANALYSIS_FAVORITE_STATE_PREFIX}:${normalizePublicationNumber(publicationNumber)}`
);

const readFavoriteStateFromStorage = (publicationNumber: string): boolean | null => {
  try {
    const raw = window.localStorage.getItem(getFavoriteStateStorageKey(publicationNumber));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { isFavorite?: unknown };
    return typeof parsed.isFavorite === 'boolean' ? parsed.isFavorite : null;
  } catch {
    return null;
  }
};

const writeFavoriteStateToStorage = (publicationNumber: string, isFavorite: boolean) => {
  try {
    window.localStorage.setItem(
      getFavoriteStateStorageKey(publicationNumber),
      JSON.stringify({ isFavorite, updatedAt: Date.now() }),
    );
  } catch {
    // Storage is a best-effort handoff from the list page.
  }
};

const normalizeCompoundLookupValue = (value: unknown) => {
  if (value === undefined || value === null) return '';
  return String(value).trim().toLowerCase();
};

const getCompoundLookupValues = (value: unknown) => {
  const normalized = normalizeCompoundLookupValue(value);
  if (!normalized) return [];
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return compact && compact !== normalized ? [normalized, compact] : [normalized];
};

const getCompoundLookupCandidates = (compound: Record<string, any>) => [
  compound.compound_id,
  compound.id,
  compound.compound_source_id,
  compound.source_compound_id,
  compound._id,
].flatMap(getCompoundLookupValues);

const formatPatentExampleNumber = (value: unknown) => {
  const values = (Array.isArray(value) ? value : [value])
    .filter((item) => item !== undefined && item !== null)
    .map((item) => String(item).trim())
    .filter(Boolean);

  if (values.length === 0) return 'N/A';
  const exampleNumbers = values.filter((item) => item.toLowerCase() !== 'nan');
  if (exampleNumbers.length === 0) return 'Intermediate';
  return exampleNumbers.join(', ');
};

const normalizeAutoHighlightPage = (rawPage: unknown): number => {
  const value = Array.isArray(rawPage) ? rawPage[0] : rawPage;
  const page = Number(value);
  return Number.isFinite(page) && page > 0 ? page : 0;
};

const normalizeAutoHighlightBbox = (rawBbox: unknown): number[] | undefined => {
  if (typeof rawBbox === 'string') {
    const trimmed = rawBbox.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        return normalizeAutoHighlightBbox(JSON.parse(trimmed));
      } catch {
        // Fall through to regex parsing.
      }
    }

    const matched = trimmed.match(/-?\d+(?:\.\d+)?/g);
    if (!matched || matched.length < 4) return undefined;
    const bbox = matched.slice(0, 4).map(Number);
    return bbox.every(Number.isFinite) ? bbox : undefined;
  }

  const value = Array.isArray(rawBbox) && rawBbox.length > 0 && Array.isArray(rawBbox[0])
    ? rawBbox[0]
    : rawBbox;
  if (!Array.isArray(value) || value.length < 4) return undefined;
  const bbox = value.slice(0, 4).map(Number);
  return bbox.every(Number.isFinite) ? bbox : undefined;
};

const normalizeBboxList = (rawBbox: unknown): Array<number[] | undefined> => {
  if (!Array.isArray(rawBbox)) {
    return [normalizeAutoHighlightBbox(rawBbox)];
  }

  if (rawBbox.length > 0 && Array.isArray(rawBbox[0])) {
    return rawBbox.map((bbox) => normalizeAutoHighlightBbox(bbox));
  }

  return [normalizeAutoHighlightBbox(rawBbox)];
};

const bboxEquals = (a?: number[], b?: number[]) => {
  if (!a || !b || a.length < 4 || b.length < 4) return false;
  return a.slice(0, 4).every((value, index) => Math.abs(Number(value) - Number(b[index])) <= 2);
};

const getPdfHighlightSelectionKey = (pageNumber: number, bbox?: number[]) => (
  pageNumber && bbox ? `${pageNumber}:${bbox.slice(0, 4).map((value) => Math.round(Number(value))).join(',')}` : ''
);

const findRowIndexByPdfTarget = (rows: any[], targetPage: number, targetBbox?: number[]) => {
  if (!targetPage) return -1;

  const bboxMatchedIndex = rows.findIndex((row) => {
    const pageArray = Array.isArray(row.page) ? row.page : [row.page];
    const bboxArray = normalizeBboxList(row.bbox);
    return pageArray.some((pageValue: any, index: number) => (
      Number(pageValue) === targetPage && targetBbox && bboxEquals(bboxArray[index] ?? bboxArray[0], targetBbox)
    ));
  });

  if (bboxMatchedIndex >= 0) return bboxMatchedIndex;

  return rows.findIndex((row) => {
    const pageArray = Array.isArray(row.page) ? row.page : [row.page];
    return pageArray.some((pageValue: any) => Number(pageValue) === targetPage);
  });
};

const buildCleanRowsFromPatentResult = (patentResult: Record<string, any>) => {
  const modifiedRows: any[] = patentResult.modified_patent_compound ?? [];
  const modifiedPartialRows: any[] = (patentResult as any).modified_partial_rows ?? [];
  const rowById = new Map<number, any>();
  modifiedRows.forEach((row) => {
    if (!rowById.has(row.id)) rowById.set(row.id, row);
  });

  return modifiedPartialRows.length > 0
    ? modifiedPartialRows.map((item: any, idx: number) => {
      const rowId = typeof item === 'number' ? item : item?.id;
      const row = rowById.get(rowId);
      return row ? { ...row, __rowKey: `${row.id}-${idx}` } : null;
    }).filter(Boolean)
    : modifiedRows.map((row: any, idx: number) => ({ ...row, __rowKey: `${row.id}-${idx}` }));
};

type EmbodimentSearchState = {
  items: Array<Record<string, any> | string | number>;
  totalCount: number;
  loading: boolean;
  error: string | null;
};

const EMPTY_EMBODIMENT_SEARCH_STATE: EmbodimentSearchState = {
  items: [],
  totalCount: 0,
  loading: false,
  error: null,
};

const buildRowsFromSearchResult = (
  detailRows: any[],
  searchItems: Array<Record<string, any> | string | number>,
) => {
  const rowById = new Map<string, any>();
  detailRows.forEach((row) => {
    const rowId = row?.id;
    if (rowId === undefined || rowId === null) return;
    const key = String(rowId);
    if (!rowById.has(key)) rowById.set(key, row);
  });

  return searchItems
    .map((item, index) => {
      const rowId = typeof item === 'object' ? item?.id : item;
      const row = rowById.get(String(rowId));
      return row
        ? { ...row, __rowKey: `${String(rowId)}-${index}` }
        : null;
    })
    .filter(Boolean);
};

type PdfDataHighlightTarget = {
  id: string;
  pageNumber: number;
  rect: number[];
  source: {
    scope: 'raw' | 'clean';
    rowIndex: number;
    rowKey: string;
    activeKey: string;
    selected?: boolean;
  };
};

const findCompoundHighlightTarget = (
  patentResult: Record<string, any>,
  requestedCompoundId: string | null,
) => {
  const requestedTokens = getCompoundLookupValues(requestedCompoundId);
  if (requestedTokens.length === 0) return null;

  const compoundGroups = [
    { rows: patentResult.patent_compound, prefix: '' },
    { rows: patentResult.modified_patent_compound, prefix: 'clean-' },
  ];

  for (const group of compoundGroups) {
    const rows = Array.isArray(group.rows) ? group.rows : [];
    for (const row of rows) {
      const candidates = getCompoundLookupCandidates(row);
      const isMatch = requestedTokens.some((token) => candidates.includes(token));
      if (!isMatch) continue;

      const page = normalizeAutoHighlightPage(row.page);
      const bbox = normalizeAutoHighlightBbox(row.bbox);
      return {
        row,
        page,
        bbox,
        activeKey: `${group.prefix}${String(row.id ?? row.compound_id ?? requestedCompoundId)}`,
      };
    }
  }

  return null;
};

const parseFrequencyAnalysis = (value: unknown): Record<string, any> | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
  return typeof value === 'object' ? value as Record<string, any> : null;
};

const getRankNumber = (key: string) => {
  const match = key.match(/^rank(\d+)$/i);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
};

const buildSummaryAnalysis = (frequencyAnalysis: Record<string, any> | null) => {
  if (!frequencyAnalysis) return null;

  const parentScaffold = {
    svg: frequencyAnalysis.parent_scaffold?._svg ?? '',
    smiles: frequencyAnalysis.parent_scaffold?.smiles ?? '',
    molblock: frequencyAnalysis.parent_scaffold?.mol_block,
  };

  const scaffoldRanks = Object.keys(frequencyAnalysis)
    .filter((key) => /^rank\d+$/i.test(key) && frequencyAnalysis[key])
    .sort((a, b) => getRankNumber(a) - getRankNumber(b))
    .map((key) => {
      const rankData = frequencyAnalysis[key] ?? {};
      return {
        rank: getRankNumber(key),
        svg: rankData._svg ?? '',
        frequency: rankData.frequency ?? 0,
        smiles: rankData.smiles ?? '',
        molblock: rankData.mol_block,
      };
    })
    .filter((rankData) => rankData.svg || rankData.smiles);

  const rGroupSource = frequencyAnalysis.r_groups && typeof frequencyAnalysis.r_groups === 'object'
    ? frequencyAnalysis.r_groups as Record<string, any>
    : null;

  const rGroups = rGroupSource
    ? Object.keys(rGroupSource)
      .sort((a, b) => {
        const aNumber = Number(a.replace(/\D/g, ''));
        const bNumber = Number(b.replace(/\D/g, ''));
        if (Number.isFinite(aNumber) && Number.isFinite(bNumber) && aNumber !== bNumber) return aNumber - bNumber;
        return a.localeCompare(b);
      })
      .map((rId) => ({
        id: rId,
        variants: Array.isArray(rGroupSource[rId])
          ? rGroupSource[rId].map((variant: any) => ({
            frequency: variant?.frequency ?? 0,
            svg: variant?._svg ?? '',
            smiles: variant?.smiles ?? '',
            molblock: variant?.mol_block,
          })).filter((variant: any) => variant.svg || variant.smiles)
          : [],
      }))
      .filter((group) => group.variants.length > 0)
    : [];

  return {
    importantRGroups: Array.isArray(frequencyAnalysis.important_r_groups)
      ? frequencyAnalysis.important_r_groups
      : [],
    parentScaffold,
    scaffoldRanks,
    rGroups,
  };
};

const createRoutePatent = (id: string): Patent => {
  const publicationNumber = normalizePublicationNumber(id);
  return {
    id: publicationNumber,
    patentNumber: publicationNumber,
    title: publicationNumber,
    applicant: '-',
    publicationDate: '-',
    target: '-',
    status: 'Completed',
    isFavorite: false,
    keyCompoundSmiles: '',
    abstract: '',
  };
};

const PatentAnalysisDetail: React.FC = () => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const requestedCompoundId = React.useMemo(
    () => new URLSearchParams(location.search).get('compound_id'),
    [location.search],
  );
  const routePatent = (location.state as { patent?: Patent } | null)?.patent;
  const selectedPatent = useMemo(() => {
    if (!id) return null;
    if (routePatent) return routePatent;
    return createRoutePatent(id);
  }, [id, routePatent]);
  const [apiPatentResult, setApiPatentResult] = React.useState<Record<string, any> | null>(null);
  const [isLoadingPatentDetail, setIsLoadingPatentDetail] = React.useState(() => Boolean(selectedPatent?.patentNumber));
  const [hasPatentDetailLoaded, setHasPatentDetailLoaded] = React.useState(false);
  const [patentDetailError, setPatentDetailError] = React.useState<string | null>(null);
  const shouldShowPatentDetailEmpty = hasPatentDetailLoaded && !isLoadingPatentDetail;
  const patentResult = apiPatentResult ?? {};
  const displayedPatent = React.useMemo(() => {
    const storedFavorite = selectedPatent?.patentNumber
      ? readFavoriteStateFromStorage(selectedPatent.patentNumber)
      : null;
    const metadata = apiPatentResult?.data?.[0];
    if (metadata) {
      const mappedPatent = mapPatentListItem(metadata, 0);
      const hasFavoriteField = metadata.is_favorite !== undefined || metadata.favorite !== undefined;
      return {
        ...mappedPatent,
        isFavorite: hasFavoriteField
          ? mappedPatent.isFavorite
          : storedFavorite ?? selectedPatent?.isFavorite ?? mappedPatent.isFavorite,
      };
    }
    return selectedPatent
      ? { ...selectedPatent, isFavorite: storedFavorite ?? selectedPatent.isFavorite }
      : selectedPatent;
  }, [apiPatentResult, selectedPatent]);
  const [isFavoritePatent, setIsFavoritePatent] = React.useState(() => Boolean(displayedPatent?.isFavorite));
  const [isSavingFavoritePatent, setIsSavingFavoritePatent] = React.useState(false);
  const detailMetadata = apiPatentResult?.data?.[0] ?? null;
  const browserPdfDocument = React.useMemo(
    () => resolvePatentPdfDocument(detailMetadata, displayedPatent?.patentNumber),
    [detailMetadata, displayedPatent?.patentNumber],
  );
  const rawFrequencyAnalysis = patentResult.frequency_analysis_result_json
    ?? patentResult.data?.[0]?.frequency_analysis_result_json
    ?? null;
  const frequencyAnalysis = React.useMemo(
    () => parseFrequencyAnalysis(rawFrequencyAnalysis),
    [rawFrequencyAnalysis],
  );
  const summaryAnalysis = React.useMemo(
    () => buildSummaryAnalysis(frequencyAnalysis),
    [frequencyAnalysis],
  );
  const hasSummaryAnalysis = Boolean(
    summaryAnalysis?.parentScaffold.svg
    || summaryAnalysis?.scaffoldRanks.length
    || summaryAnalysis?.rGroups.length
  );
  const recommendedKeyCompounds = React.useMemo(
    () => Array.isArray(patentResult.patent_compound)
      ? patentResult.patent_compound.slice(0, 10)
      : [],
    [patentResult.patent_compound],
  );
  const rawDataExcelRowCount = React.useMemo(
    () => (Array.isArray(patentResult.patent_compound) ? patentResult.patent_compound.length : 0),
    [patentResult.patent_compound],
  );
  const cleanDataExcelRowCount = React.useMemo(
    () => buildCleanRowsFromPatentResult(patentResult).length,
    [patentResult],
  );

  const { setHeaderContent } = useUIStore();

  useEffect(() => {
    setIsFavoritePatent(Boolean(displayedPatent?.isFavorite));
  }, [displayedPatent?.isFavorite, displayedPatent?.patentNumber]);

  const currentHighlights = useMemo(() => {
    return [];
  }, []);
  const pdfDataHighlightTargets = React.useMemo(() => {
    const rawTargets: PdfDataHighlightTarget[] = [];
    if (Array.isArray(patentResult.patent_compound)) {
      patentResult.patent_compound.forEach((row: any, rowIndex: number) => {
        const pages = Array.isArray(row.page) ? row.page : [row.page];
        const bboxes = normalizeBboxList(row.bbox);
        pages.forEach((pageValue: any, bboxIndex: number) => {
          const pageNumber = Number(pageValue);
          const rect = bboxes[bboxIndex] ?? bboxes[0];
          if (!pageNumber || !rect) return;
          rawTargets.push({
            id: `raw-${row.id ?? row.compound_id ?? rowIndex}-${bboxIndex}`,
            pageNumber,
            rect,
            source: {
              scope: 'raw',
              rowIndex,
              rowKey: `${row.id}-${rowIndex}`,
              activeKey: String(row.id),
            },
          });
        });
      });
    }

    const cleanRows = buildCleanRowsFromPatentResult(patentResult);
    const cleanTargets: PdfDataHighlightTarget[] = [];
    cleanRows.forEach((row: any, rowIndex: number) => {
      const pages = Array.isArray(row.page) ? row.page : [row.page];
      const bboxes = normalizeBboxList(row.bbox);
      pages.forEach((pageValue: any, bboxIndex: number) => {
        const pageNumber = Number(pageValue);
        const rect = bboxes[bboxIndex] ?? bboxes[0];
        if (!pageNumber || !rect) return;
        cleanTargets.push({
          id: `clean-${row.__rowKey ?? row.id ?? rowIndex}-${bboxIndex}`,
          pageNumber,
          rect,
          source: {
            scope: 'clean',
            rowIndex,
            rowKey: row.__rowKey,
            activeKey: `clean-${row.__rowKey ?? row.id}`,
          },
        });
      });
    });

    return [...rawTargets, ...cleanTargets];
  }, [patentResult]);
  const pdfViewer = usePatentPdfViewer({
    patentNumber: displayedPatent?.patentNumber,
    currentHighlights,
    dataHighlightTargets: pdfDataHighlightTargets,
  });

  const loadPatentDetail = React.useCallback(async (clearCurrent = true) => {
    if (!selectedPatent?.patentNumber) return;
    const publicationNumber = normalizePublicationNumber(selectedPatent.patentNumber);
    setIsLoadingPatentDetail(true);
    if (clearCurrent) {
      setHasPatentDetailLoaded(false);
      setApiPatentResult(null);
    }
    setPatentDetailError(null);
    try {
      const detail = await patentAnalysisApi.getPatentDetail(publicationNumber);
      setApiPatentResult(detail.raw);
    } catch (error) {
      if (clearCurrent) setApiPatentResult(null);
      setPatentDetailError(error instanceof Error ? error.message : '특허 상세 API 요청에 실패했습니다.');
    } finally {
      setIsLoadingPatentDetail(false);
      setHasPatentDetailLoaded(true);
    }
  }, [selectedPatent?.patentNumber]);

  useEffect(() => {
    void loadPatentDetail();
  }, [loadPatentDetail]);

  const clampSplitRatio = React.useCallback((value: number) => {
    return Math.min(Math.max(value, SPLIT_MIN_PERCENT), SPLIT_MAX_PERCENT);
  }, []);

  const debugLog = React.useCallback((event: string, payload: Record<string, unknown>) => {
    if (!ENABLE_HIGHLIGHT_DEBUG_LOG) return;
    console.log('[PDFHighlightDebug]', event, payload);
  }, []);

  const [pageIndices, setPageIndices] = React.useState<Record<string, number>>({});
  const [activeCompId, setActiveCompId] = React.useState<string | null>(null);
  const [rawDataView, setRawDataView] = React.useState<'table' | 'card'>('table');
  const [cleanDataView, setCleanDataView] = React.useState<'table' | 'card'>('table');
  const [rawTableCurrentPage, setRawTableCurrentPage] = React.useState(1);
  const [rawTablePageSize, setRawTablePageSize] = React.useState(RAW_DATA_DEFAULT_PAGE_SIZE);
  const [cleanTableCurrentPage, setCleanTableCurrentPage] = React.useState(1);
  const [cleanTablePageSize, setCleanTablePageSize] = React.useState(RAW_DATA_DEFAULT_PAGE_SIZE);
  const [downloadingExcelType, setDownloadingExcelType] = React.useState<'bioactivity' | 'modified_bioactivity' | null>(null);
  const [activeTab, setActiveTab] = React.useState<string>('summary');
  const [rawFilterOpen, setRawFilterOpen] = React.useState(false);
  const [cleanFilterOpen, setCleanFilterOpen] = React.useState(false);
  const [rawDataFilter, setRawDataFilter] = React.useState<PatentDataFilterValue>({});
  const [cleanDataFilter, setCleanDataFilter] = React.useState<PatentDataFilterValue>({});
  const [rawSearchState, setRawSearchState] = React.useState<EmbodimentSearchState>(
    EMPTY_EMBODIMENT_SEARCH_STATE,
  );
  const [cleanSearchState, setCleanSearchState] = React.useState<EmbodimentSearchState>(
    EMPTY_EMBODIMENT_SEARCH_STATE,
  );
  const [rawSearchRevision, setRawSearchRevision] = React.useState(0);
  const [cleanSearchRevision, setCleanSearchRevision] = React.useState(0);
  const [cleanDataRequestOpen, setCleanDataRequestOpen] = React.useState(false);
  const [cleanDataRequestLoading, setCleanDataRequestLoading] = React.useState(false);
  const [rawScaffoldRankFilter, setRawScaffoldRankFilter] = React.useState<'all' | number>('all');
  const [cleanScaffoldRankFilter, setCleanScaffoldRankFilter] = React.useState<'all' | number>('all');
  const [rawShowFunctionalGroupColumns, setRawShowFunctionalGroupColumns] = React.useState(true);
  const [cleanShowFunctionalGroupColumns, setCleanShowFunctionalGroupColumns] = React.useState(true);
  const [rGroupFilter, setRGroupFilter] = React.useState<{ key: string; smiles: string } | null>(null);
  const [previewSvg, setPreviewSvg] = React.useState<string | null>(null);
  const [previewStructureMeta, setPreviewStructureMeta] = React.useState<StructurePreviewMeta | null>(null);
  const [chemDrawOpen, setChemDrawOpen] = React.useState(false);
  const [chemDrawSmiles, setChemDrawSmiles] = React.useState('');
  const [chemDrawMolblock, setChemDrawMolblock] = React.useState('');
  const [chemDrawTitle, setChemDrawTitle] = React.useState('');
  const [previewImageSrc, setPreviewImageSrc] = React.useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = React.useState<string>('이미지 미리보기');
  const [splitRatio, setSplitRatio] = React.useState<number>(SPLIT_DEFAULT_PERCENT);
  const [thumbnailCollapsed, setThumbnailCollapsed] = React.useState(true);
  const [isResizingSplit, setIsResizingSplit] = React.useState(false);
  const [viewportWidth, setViewportWidth] = React.useState<number>(() => {
    if (typeof window === 'undefined') return 1920;
    return window.innerWidth;
  });
  const [splitContainerWidth, setSplitContainerWidth] = React.useState<number>(() => {
    if (typeof window === 'undefined') return 1920;
    return window.innerWidth;
  });
  const splitContainerRef = React.useRef<HTMLDivElement | null>(null);
  const splitRafRef = React.useRef<number | null>(null);
  const pendingSplitRatioRef = React.useRef<number | null>(null);
  const splitGuideRef = React.useRef<HTMLDivElement | null>(null);
  const layoutResizeRafRef = React.useRef<number | null>(null);
  const autoCompoundHighlightRef = React.useRef('');
  const rawDataTableRef = React.useRef<any>(null);
  const rawDataTabContentRef = React.useRef<HTMLDivElement | null>(null);
  const rawDataTableShellRef = React.useRef<HTMLDivElement | null>(null);
  const cleanDataTableRef = React.useRef<any>(null);
  const cleanDataTabContentRef = React.useRef<HTMLDivElement | null>(null);
  const cleanDataTableShellRef = React.useRef<HTMLDivElement | null>(null);
  const [rawTableScrollY, setRawTableScrollY] = React.useState<number | undefined>(undefined);
  const [cleanTableScrollY, setCleanTableScrollY] = React.useState<number | undefined>(undefined);
  const rawScaffoldRanks = React.useMemo(
    () => getAvailableScaffoldRanks(Array.isArray(patentResult.patent_compound) ? patentResult.patent_compound : []),
    [patentResult.patent_compound],
  );
  const cleanScaffoldRanks = React.useMemo(
    () => getAvailableScaffoldRanks(buildCleanRowsFromPatentResult(patentResult)),
    [patentResult],
  );
  const rawBioactivityOptions = React.useMemo(
    () => Array.isArray(patentResult.data?.[0]?.bioactivity_list)
      ? patentResult.data[0].bioactivity_list.map(String)
      : [],
    [patentResult],
  );
  const cleanBioactivityOptions = React.useMemo(
    () => Array.isArray(patentResult.data?.[0]?.modified_bioactivity_list)
      ? patentResult.data[0].modified_bioactivity_list.map(String)
      : [],
    [patentResult],
  );
  const rawSearchRows = React.useMemo(
    () => buildRowsFromSearchResult(
      Array.isArray(patentResult.patent_compound) ? patentResult.patent_compound : [],
      rawSearchState.items,
    ),
    [patentResult.patent_compound, rawSearchState.items],
  );
  const cleanSearchRows = React.useMemo(
    () => buildRowsFromSearchResult(
      Array.isArray(patentResult.modified_patent_compound)
        ? patentResult.modified_patent_compound
        : [],
      cleanSearchState.items,
    ),
    [cleanSearchState.items, patentResult.modified_patent_compound],
  );
  const rawAppliedFilterCount = countPatentDataFilters(rawDataFilter)
    + Number(Boolean(rGroupFilter));
  const cleanAppliedFilterCount = countPatentDataFilters(cleanDataFilter);
  const layoutPreset = React.useMemo(() => getPatentAnalysisLayoutPreset(viewportWidth), [viewportWidth]);
  const effectiveSplitWidth = splitContainerWidth || viewportWidth;
  const isStackedSplitLayout = effectiveSplitWidth <= DETAIL_STACK_BREAKPOINT;
  const rawTableScroll = React.useMemo(() => (
    rawTableScrollY === undefined
      ? { x: 'max-content' as const }
      : { x: 'max-content' as const, y: rawTableScrollY }
  ), [rawTableScrollY]);
  const cleanTableScroll = React.useMemo(() => (
    cleanTableScrollY === undefined
      ? { x: 'max-content' as const }
      : { x: 'max-content' as const, y: cleanTableScrollY }
  ), [cleanTableScrollY]);
  const rawTableDataBindingKey = `${displayedPatent?.patentNumber ?? ''}:${rawTableCurrentPage}:${rawSearchRows.map((row: any) => row.__rowKey).join(',')}`;
  const cleanTableDataBindingKey = `${displayedPatent?.patentNumber ?? ''}:${cleanTableCurrentPage}:${cleanSearchRows.map((row: any) => row.__rowKey).join(',')}`;
  const isRawTableDataReady = useDeferredTableBinding(
    activeTab === 'raw-data' && rawDataView === 'table',
    rawTableDataBindingKey,
  );
  const isCleanTableDataReady = useDeferredTableBinding(
    activeTab === 'clean-data' && cleanDataView === 'table',
    cleanTableDataBindingKey,
  );
  const paginationItemRender = React.useCallback((page: number, type: string, originalElement: React.ReactNode) => (
    type === 'page' ? <span>{formatNumberWithComma(page)}</span> : originalElement
  ), []);
  const rawDataTablePagination = React.useMemo(() => ({
    current: rawTableCurrentPage,
    pageSize: rawTablePageSize,
    total: rawSearchState.totalCount,
    showSizeChanger: true,
    pageSizeOptions: RAW_DATA_PAGE_SIZE_OPTIONS,
    position: ['bottomRight' as const],
    itemRender: paginationItemRender,
    onChange: (page: number, pageSize: number) => {
      setRawTableCurrentPage(page);
      setRawTablePageSize(pageSize);
    },
  }), [paginationItemRender, rawSearchState.totalCount, rawTableCurrentPage, rawTablePageSize]);
  const cleanDataTablePagination = React.useMemo(() => ({
    current: cleanTableCurrentPage,
    pageSize: cleanTablePageSize,
    total: cleanSearchState.totalCount,
    showSizeChanger: true,
    pageSizeOptions: RAW_DATA_PAGE_SIZE_OPTIONS,
    position: ['bottomRight' as const],
    itemRender: paginationItemRender,
    onChange: (page: number, pageSize: number) => {
      setCleanTableCurrentPage(page);
      setCleanTablePageSize(pageSize);
    },
  }), [cleanSearchState.totalCount, cleanTableCurrentPage, cleanTablePageSize, paginationItemRender]);
  const resultTables = React.useMemo(() => {
    const tables = patentResult?.tables;
    return Array.isArray(tables) ? tables : [];
  }, [patentResult]);
  const compoundHighlightTarget = React.useMemo(
    () => findCompoundHighlightTarget(patentResult, requestedCompoundId),
    [patentResult, requestedCompoundId],
  );

  React.useEffect(() => {
    if (rawScaffoldRankFilter !== 'all' && !rawScaffoldRanks.includes(rawScaffoldRankFilter)) {
      setRawScaffoldRankFilter('all');
      setRawDataFilter((current) => ({ ...current, scaffoldRanking: undefined }));
    }
  }, [rawScaffoldRankFilter, rawScaffoldRanks]);

  React.useEffect(() => {
    if (cleanScaffoldRankFilter !== 'all' && !cleanScaffoldRanks.includes(cleanScaffoldRankFilter)) {
      setCleanScaffoldRankFilter('all');
      setCleanDataFilter((current) => ({ ...current, scaffoldRanking: undefined }));
    }
  }, [cleanScaffoldRankFilter, cleanScaffoldRanks]);

  useEffect(() => {
    setRawTableCurrentPage(1);
  }, [rawDataFilter, rGroupFilter, rawScaffoldRankFilter]);

  useEffect(() => {
    setCleanTableCurrentPage(1);
  }, [cleanDataFilter, cleanScaffoldRankFilter]);

  useEffect(() => {
    if (
      activeTab !== 'raw-data'
      || !displayedPatent?.patentNumber
      || !apiPatentResult
    ) {
      return undefined;
    }

    let ignore = false;
    const controller = new AbortController();
    setRawSearchState((current) => ({ ...current, loading: true, error: null }));

    void patentAnalysisApi.searchEmbodiments(
      normalizePublicationNumber(displayedPatent.patentNumber),
      {
        dataset: 'raw',
        page: rawTableCurrentPage,
        pageSize: rawTablePageSize,
        ...rawDataFilter,
        ...(rawScaffoldRankFilter !== 'all'
          ? { scaffoldRanking: rawScaffoldRankFilter }
          : {}),
        ...(rGroupFilter
          ? { rGroup: { key: rGroupFilter.key, value: rGroupFilter.smiles } }
          : {}),
      },
      { signal: controller.signal },
    ).then((response: EmbodimentSearchResponse) => {
      if (ignore) return;
      setRawSearchState({
        items: response.items,
        totalCount: response.totalCount,
        loading: false,
        error: null,
      });
    }).catch((error) => {
      if (ignore) return;
      setRawSearchState({
        items: [],
        totalCount: 0,
        loading: false,
        error: error instanceof Error ? error.message : 'Raw data Filter 요청에 실패했습니다.',
      });
    });

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [
    activeTab,
    apiPatentResult,
    displayedPatent?.patentNumber,
    rawDataFilter,
    rawScaffoldRankFilter,
    rawSearchRevision,
    rawTableCurrentPage,
    rawTablePageSize,
    rGroupFilter,
  ]);

  useEffect(() => {
    if (
      activeTab !== 'clean-data'
      || !displayedPatent?.patentNumber
      || !apiPatentResult
    ) {
      return undefined;
    }

    let ignore = false;
    const controller = new AbortController();
    setCleanSearchState((current) => ({ ...current, loading: true, error: null }));

    void patentAnalysisApi.searchEmbodiments(
      normalizePublicationNumber(displayedPatent.patentNumber),
      {
        dataset: 'clean',
        page: cleanTableCurrentPage,
        pageSize: cleanTablePageSize,
        ...cleanDataFilter,
        ...(cleanScaffoldRankFilter !== 'all'
          ? { scaffoldRanking: cleanScaffoldRankFilter }
          : {}),
      },
      { signal: controller.signal },
    ).then((response: EmbodimentSearchResponse) => {
      if (ignore) return;
      setCleanSearchState({
        items: response.items,
        totalCount: response.totalCount,
        loading: false,
        error: null,
      });
    }).catch((error) => {
      if (ignore) return;
      setCleanSearchState({
        items: [],
        totalCount: 0,
        loading: false,
        error: error instanceof Error ? error.message : 'Clean data Filter 요청에 실패했습니다.',
      });
    });

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [
    activeTab,
    apiPatentResult,
    cleanDataFilter,
    cleanScaffoldRankFilter,
    cleanSearchRevision,
    cleanTableCurrentPage,
    cleanTablePageSize,
    displayedPatent?.patentNumber,
  ]);

  useEffect(() => {
    const container = splitContainerRef.current;
    if (!container) return undefined;

    const updateLayoutWidths = () => {
      layoutResizeRafRef.current = null;
      const nextViewportWidth = window.innerWidth;
      const nextContainerWidth = container.getBoundingClientRect().width;

      setViewportWidth((current) => (
        Math.abs(current - nextViewportWidth) < 1 ? current : nextViewportWidth
      ));
      setSplitContainerWidth((current) => (
        Math.abs(current - nextContainerWidth) < 1 ? current : nextContainerWidth
      ));
    };
    const scheduleLayoutWidthUpdate = () => {
      if (layoutResizeRafRef.current !== null) {
        window.cancelAnimationFrame(layoutResizeRafRef.current);
      }
      layoutResizeRafRef.current = window.requestAnimationFrame(updateLayoutWidths);
    };

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleLayoutWidthUpdate);
    resizeObserver?.observe(container);
    window.addEventListener('resize', scheduleLayoutWidthUpdate);
    scheduleLayoutWidthUpdate();

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', scheduleLayoutWidthUpdate);
      if (layoutResizeRafRef.current !== null) {
        window.cancelAnimationFrame(layoutResizeRafRef.current);
        layoutResizeRafRef.current = null;
      }
    };
  }, [displayedPatent?.patentNumber]);

  React.useLayoutEffect(() => {
    if (activeTab !== 'raw-data' || rawDataView !== 'table') {
      return undefined;
    }

    const tabContent = rawDataTabContentRef.current;
    const tableShell = rawDataTableShellRef.current;
    if (!tabContent || !tableShell) return undefined;

    let animationFrame: number | null = null;
    const measureRawTableHeight = () => {
      animationFrame = null;

      const tabContentRect = tabContent.getBoundingClientRect();
      const tableShellRect = tableShell.getBoundingClientRect();
      const splitContainerBottom = splitContainerRef.current?.getBoundingClientRect().bottom;
      const tableBody = tableShell.querySelector<HTMLElement>('.ant-table-body');
      const tableContent = tableShell.querySelector<HTMLElement>('.ant-table-content');
      const tableContainer = tableShell.querySelector<HTMLElement>('.ant-table-container');
      const tableMeasureElement = tableBody ?? tableContent ?? tableContainer;
      if (
        tabContentRect.width <= 0
        || tabContentRect.height <= 0
        || tableShellRect.width <= 0
        || tableShellRect.height <= 0
        || !tableMeasureElement
      ) {
        return;
      }

      const pagination = tableShell.querySelector<HTMLElement>('.ant-pagination');
      const paginationStyle = pagination ? window.getComputedStyle(pagination) : null;
      const paginationReserve = pagination
        ? Math.ceil(
            pagination.getBoundingClientRect().height
            + Number.parseFloat(paginationStyle?.marginTop || '0')
            + Number.parseFloat(paginationStyle?.marginBottom || '0'),
          )
        : 48;
      const maxBodyHeight = isStackedSplitLayout
        ? Math.min(560, Math.max(240, Math.floor(window.innerHeight * 0.45)))
        : Math.max(
            160,
            Math.floor(
              (splitContainerBottom ?? tabContentRect.bottom)
              - tableMeasureElement.getBoundingClientRect().top
              - paginationReserve
              - 16
              - 2,
            ),
          );

      setRawTableScrollY((current) => (
        current === maxBodyHeight ? current : maxBodyHeight
      ));
    };
    const scheduleRawTableHeightUpdate = () => {
      if (animationFrame !== null) return;
      animationFrame = window.requestAnimationFrame(measureRawTableHeight);
    };

    const resizeObserver = new ResizeObserver(scheduleRawTableHeightUpdate);
    resizeObserver.observe(tabContent);
    resizeObserver.observe(tableShell);
    window.addEventListener('resize', scheduleRawTableHeightUpdate);
    scheduleRawTableHeightUpdate();

    // rc-tabs와 rc-table이 최초 활성 탭의 너비/본문 DOM을 순차 생성하므로
    // 짧고 제한된 재측정으로 첫 진입 레이아웃만 안정화한다.
    const initialRetryTimers = [0, 50, 150, 300].map((delay) => (
      window.setTimeout(scheduleRawTableHeightUpdate, delay)
    ));

    return () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
      initialRetryTimers.forEach((timer) => window.clearTimeout(timer));
      resizeObserver.disconnect();
      window.removeEventListener('resize', scheduleRawTableHeightUpdate);
    };
  }, [
    activeTab,
    isStackedSplitLayout,
    rawDataExcelRowCount,
    rawDataView,
    isRawTableDataReady,
    rawTableCurrentPage,
    rawTablePageSize,
    rGroupFilter,
    rawScaffoldRankFilter,
    rawShowFunctionalGroupColumns,
  ]);

  React.useLayoutEffect(() => {
    if (activeTab !== 'clean-data' || cleanDataView !== 'table') {
      return undefined;
    }

    const tabContent = cleanDataTabContentRef.current;
    const tableShell = cleanDataTableShellRef.current;
    if (!tabContent || !tableShell) return undefined;

    let animationFrame: number | null = null;
    const measureCleanTableHeight = () => {
      animationFrame = null;

      const tabContentRect = tabContent.getBoundingClientRect();
      const tableShellRect = tableShell.getBoundingClientRect();
      const splitContainerBottom = splitContainerRef.current?.getBoundingClientRect().bottom;
      const tableBody = tableShell.querySelector<HTMLElement>('.ant-table-body');
      const tableContent = tableShell.querySelector<HTMLElement>('.ant-table-content');
      const tableContainer = tableShell.querySelector<HTMLElement>('.ant-table-container');
      const tableMeasureElement = tableBody ?? tableContent ?? tableContainer;
      if (
        tabContentRect.width <= 0
        || tabContentRect.height <= 0
        || tableShellRect.width <= 0
        || tableShellRect.height <= 0
        || !tableMeasureElement
      ) {
        return;
      }

      const pagination = tableShell.querySelector<HTMLElement>('.ant-pagination');
      const paginationStyle = pagination ? window.getComputedStyle(pagination) : null;
      const paginationReserve = pagination
        ? Math.ceil(
            pagination.getBoundingClientRect().height
            + Number.parseFloat(paginationStyle?.marginTop || '0')
            + Number.parseFloat(paginationStyle?.marginBottom || '0'),
          )
        : 48;
      const maxBodyHeight = isStackedSplitLayout
        ? Math.min(560, Math.max(240, Math.floor(window.innerHeight * 0.45)))
        : Math.max(
            160,
            Math.floor(
              (splitContainerBottom ?? tabContentRect.bottom)
              - tableMeasureElement.getBoundingClientRect().top
              - paginationReserve
              - 16
              - 2,
            ),
          );

      setCleanTableScrollY((current) => (
        current === maxBodyHeight ? current : maxBodyHeight
      ));
    };
    const scheduleCleanTableHeightUpdate = () => {
      if (animationFrame !== null) return;
      animationFrame = window.requestAnimationFrame(measureCleanTableHeight);
    };

    const resizeObserver = new ResizeObserver(scheduleCleanTableHeightUpdate);
    resizeObserver.observe(tabContent);
    resizeObserver.observe(tableShell);
    window.addEventListener('resize', scheduleCleanTableHeightUpdate);
    scheduleCleanTableHeightUpdate();

    const initialRetryTimers = [0, 50, 150, 300].map((delay) => (
      window.setTimeout(scheduleCleanTableHeightUpdate, delay)
    ));

    return () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
      initialRetryTimers.forEach((timer) => window.clearTimeout(timer));
      resizeObserver.disconnect();
      window.removeEventListener('resize', scheduleCleanTableHeightUpdate);
    };
  }, [
    activeTab,
    cleanDataExcelRowCount,
    cleanDataView,
    isCleanTableDataReady,
    cleanTableCurrentPage,
    cleanTablePageSize,
    cleanScaffoldRankFilter,
    cleanShowFunctionalGroupColumns,
    isStackedSplitLayout,
  ]);

  useEffect(() => {
    if (!requestedCompoundId) return;

    const detailReady = Boolean(apiPatentResult) || Boolean(patentDetailError);
    if (!detailReady) return;
    const pdfReady = Boolean(browserPdfDocument)
      && pdfViewer.isPdfDocumentReady
      && pdfViewer.isHighlighterReady
      && pdfViewer.pdfTotalPages > 0;
    if (!pdfReady) return;

    const requestKey = `${displayedPatent?.patentNumber ?? id ?? ''}:${requestedCompoundId}`;
    if (autoCompoundHighlightRef.current === requestKey) return;
    autoCompoundHighlightRef.current = requestKey;

    if (!compoundHighlightTarget) {
      message.warning(`compound_id ${requestedCompoundId}에 해당하는 compound 위치를 찾을 수 없습니다.`);
      return;
    }

    setActiveTab('raw-data');
    setActiveCompId(compoundHighlightTarget.activeKey);
    setPageIndices((prev) => ({ ...prev, [compoundHighlightTarget.activeKey]: 0 }));

    if (compoundHighlightTarget.page) {
      if (!compoundHighlightTarget.bbox) {
        message.warning(`compound_id ${requestedCompoundId}의 PDF bbox 정보가 없어 페이지 이동만 수행합니다.`);
      }
      window.requestAnimationFrame(() => {
        pdfViewer.handleGoToPdf(compoundHighlightTarget.page, compoundHighlightTarget.bbox as any);
      });
      return;
    }

    message.warning(`compound_id ${requestedCompoundId}의 PDF page 정보가 없습니다.`);
  }, [
    apiPatentResult,
    browserPdfDocument,
    compoundHighlightTarget,
    displayedPatent?.patentNumber,
    id,
    message,
    patentDetailError,
    pdfViewer.handleGoToPdf,
    pdfViewer.isHighlighterReady,
    pdfViewer.isPdfDocumentReady,
    pdfViewer.pdfTotalPages,
    requestedCompoundId,
  ]);

  const previewSplitRatioFromClientX = React.useCallback((clientX: number) => {
    const container = splitContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return;
    const nextRatio = ((clientX - rect.left) / rect.width) * 100;
    const clampedRatio = clampSplitRatio(nextRatio);
    pendingSplitRatioRef.current = clampedRatio;
    if (splitGuideRef.current) {
      splitGuideRef.current.style.left = `${clampedRatio}%`;
    }
  }, [clampSplitRatio]);

  const stopSplitResize = React.useCallback((commit: boolean = true) => {
    const pendingSplitRatio = pendingSplitRatioRef.current;
    if (commit && pendingSplitRatio !== null) {
      setSplitRatio(pendingSplitRatio);
    }
    pendingSplitRatioRef.current = null;
    if (splitGuideRef.current) {
      splitGuideRef.current.style.display = 'none';
    }
    setIsResizingSplit(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    if (!isResizingSplit) return;

    const onMouseMove = (event: MouseEvent) => {
      if (splitRafRef.current !== null) {
        window.cancelAnimationFrame(splitRafRef.current);
      }
      splitRafRef.current = window.requestAnimationFrame(() => {
        splitRafRef.current = null;
        previewSplitRatioFromClientX(event.clientX);
      });
    };

    const onMouseUp = (event: MouseEvent) => {
      if (splitRafRef.current !== null) {
        window.cancelAnimationFrame(splitRafRef.current);
        splitRafRef.current = null;
      }
      previewSplitRatioFromClientX(event.clientX);
      stopSplitResize();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (splitRafRef.current !== null) {
        window.cancelAnimationFrame(splitRafRef.current);
        splitRafRef.current = null;
      }
      pendingSplitRatioRef.current = null;
      if (splitGuideRef.current) {
        splitGuideRef.current.style.display = 'none';
      }
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingSplit, previewSplitRatioFromClientX, stopSplitResize]);

  const handleSplitMouseDown = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    pendingSplitRatioRef.current = splitRatio;
    if (splitGuideRef.current) {
      splitGuideRef.current.style.left = `${splitRatio}%`;
      splitGuideRef.current.style.display = 'block';
    }
    setIsResizingSplit(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [splitRatio]);

  const handleSplitKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = 2;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setSplitRatio(prev => clampSplitRatio(prev - step));
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setSplitRatio(prev => clampSplitRatio(prev + step));
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setSplitRatio(SPLIT_MIN_PERCENT);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setSplitRatio(SPLIT_MAX_PERCENT);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSplitRatio(clampSplitRatio(layoutPreset.defaultSplit));
    }
  }, [clampSplitRatio, layoutPreset.defaultSplit]);

  const resetSplitRatio = React.useCallback(() => {
    setSplitRatio(clampSplitRatio(layoutPreset.defaultSplit));
  }, [clampSplitRatio, layoutPreset.defaultSplit]);

  const handlePdfDownload = React.useCallback(async () => {
    const publicationNumber = displayedPatent?.patentNumber;
    if (!browserPdfDocument || !publicationNumber) {
      message.error('다운로드할 PDF 파일이 없습니다.');
      return;
    }

    try {
      await downloadPatentPdfFile(publicationNumber);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'PDF 다운로드에 실패했습니다.');
    }
  }, [browserPdfDocument, displayedPatent?.patentNumber, message]);

  const handleOpenPdfInBrowser = React.useCallback(() => {
    if (!browserPdfDocument) {
      message.error('브라우저에서 열 PDF 파일이 없습니다.');
      return;
    }

    window.open(browserPdfDocument, '_blank', 'noopener,noreferrer');
  }, [browserPdfDocument, message]);

  const handleEmbodimentsExcelDownload = React.useCallback(async (
    bioactivityType: 'bioactivity' | 'modified_bioactivity',
  ) => {
    if (downloadingExcelType) return;

    const publicationNumber = displayedPatent?.patentNumber;
    if (!publicationNumber) {
      message.error('다운로드할 특허 번호가 없습니다.');
      return;
    }
    const rowCount = bioactivityType === 'modified_bioactivity'
      ? cleanDataExcelRowCount
      : rawDataExcelRowCount;
    if (rowCount === 0) {
      message.warning('다운로드할 데이터가 없습니다.');
      return;
    }

    const normalizedPublicationNumber = normalizePublicationNumber(publicationNumber);
    const suffix = bioactivityType === 'modified_bioactivity' ? 'clean_data' : 'raw_data';
    setDownloadingExcelType(bioactivityType);
    try {
      const { blob, filename } = await patentAnalysisApi.downloadEmbodimentsExcel(normalizedPublicationNumber, {
        bioactivityType,
      });
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename ?? `${normalizedPublicationNumber}_${suffix}_embodiments.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
      message.success('Excel 다운로드가 완료되었습니다.');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Excel 다운로드에 실패했습니다.');
    } finally {
      setDownloadingExcelType(null);
    }
  }, [cleanDataExcelRowCount, displayedPatent?.patentNumber, downloadingExcelType, message, rawDataExcelRowCount]);

  const handleCleanDataRequest = React.useCallback(async (quality: CleanDataQuality) => {
    if (cleanDataRequestLoading) return;
    const publicationNumber = displayedPatent?.patentNumber;
    if (!publicationNumber) {
      message.error('요청할 특허 번호가 없습니다.');
      return;
    }

    setCleanDataRequestLoading(true);
    try {
      await patentAnalysisApi.requestCleanData(
        normalizePublicationNumber(publicationNumber),
        quality,
      );
      setCleanDataRequestOpen(false);
      message.success('Clean data 요청이 완료되었습니다.');
      await loadPatentDetail(false);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Clean data 요청에 실패했습니다.');
    } finally {
      setCleanDataRequestLoading(false);
    }
  }, [
    cleanDataRequestLoading,
    displayedPatent?.patentNumber,
    loadPatentDetail,
    message,
  ]);

  const toggleFavoritePatent = React.useCallback(async () => {
    const publicationNumber = displayedPatent?.patentNumber;
    if (!publicationNumber || isSavingFavoritePatent) return;

    const nextFavorite = !isFavoritePatent;
    setIsSavingFavoritePatent(true);
    setIsFavoritePatent(nextFavorite);
    try {
      if (nextFavorite) {
        await patentAnalysisApi.addPatentFavorite({
          publicationNumber,
        });
      } else {
        await patentAnalysisApi.removePatentFavorite({
          publicationNumber,
        });
      }
      writeFavoriteStateToStorage(publicationNumber, nextFavorite);
      void message.success(nextFavorite ? '즐겨찾기에 추가했습니다.' : '즐겨찾기에서 제거했습니다.');
    } catch (error) {
      setIsFavoritePatent(isFavoritePatent);
      void message.warning(error instanceof Error ? error.message : '즐겨찾기 저장에 실패했습니다.');
    } finally {
      setIsSavingFavoritePatent(false);
    }
  }, [displayedPatent?.patentNumber, isFavoritePatent, isSavingFavoritePatent, message]);

  const handleClosePage = React.useCallback(() => {
    window.close();
    window.setTimeout(() => {
      if (!window.closed) {
        navigate('/patents/analysis');
      }
    }, 150);
  }, [navigate]);

  useEffect(() => {
    if (displayedPatent) {
      setHeaderContent(
        <div style={{ width: '100%', minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ minWidth: 0, flex: '0 1 auto', overflow: 'hidden' }}>
            <PageHeaderBreadcrumb
              items={[
                { label: 'Documents' },
                { label: 'Patents' },
                { label: 'My 특허 분석', onClick: () => navigate('/patents/analysis') },
                {
                  label: (
                    <>
                      <span>{displayedPatent.patentNumber}</span>
                      <span style={{ color: token.colorTextSecondary, fontWeight: 400 }}>
                        {' | '}
                        {formatDisplayDate(displayedPatent.publicationDate)}
                        {' | '}
                        {displayedPatent.applicant}
                        {' | '}
                        {displayedPatent.title}
                      </span>
                    </>
                  ),
                },
              ]}
            />
          </div>
          <Button
            type="primary"
            icon={<ArrowLeft size={18} />}
            className="v-action-btn"
            style={{
              flex: '0 0 auto',
              background: token.colorPrimary,
              borderColor: token.colorPrimary,
              color: token.colorBgContainer,
              minWidth: 117,
            }}
            onClick={handleClosePage}
          >
            돌아가기
          </Button>
        </div>
      );
    }
    return () => setHeaderContent(null);
  }, [displayedPatent, handleClosePage, setHeaderContent, navigate, token.colorTextSecondary]);

  if (!displayedPatent) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Empty description="해당 특허를 찾을 수 없습니다." />
        <Button onClick={() => navigate('/patents/analysis')} style={{ marginTop: 16 }}>목록으로 돌아가기</Button>
      </div>
    );
  }

  const handleGoToPdf = (targetPage: number, bboxCoords?: any[]) => {
    pdfViewer.handleGoToPdf(targetPage, bboxCoords);
  };

  const handlePageChange = (compId: string, direction: number, pages: any, bboxes?: any[]) => {
    const pageArray = Array.isArray(pages) ? pages : [pages];
    const bboxArray = Array.isArray(bboxes) ? bboxes : [];

    if (pageArray.length === 0) return;

    const currentIndex = pageIndices[compId] ?? 0;
    const isCurrentItemActive = activeCompId === compId;
    let nextIndex = isCurrentItemActive ? currentIndex + direction : currentIndex;
    if (nextIndex < 0) nextIndex = pageArray.length - 1;
    if (nextIndex >= pageArray.length) nextIndex = 0;

    setActiveCompId(compId);
    setPageIndices(prev => ({ ...prev, [compId]: nextIndex }));
    handleGoToPdf(pageArray[nextIndex], bboxArray[nextIndex]);
  };

  const handleCompoundCardClick = (comp: any, rank: number, compId = comp.id.toString()) => {
    const pageArray = Array.isArray(comp.page) ? comp.page : [comp.page];
    const bboxArray = Array.isArray((comp as any).bbox) ? (comp as any).bbox : [];
    setActiveCompId(compId);
    if (pageArray.length === 0) return;

    const currentIndex = pageIndices[compId] ?? 0;
    debugLog('compound-card-click', {
      rank,
      compId,
      currentIndex,
      targetPage: pageArray[currentIndex],
      targetBBox: bboxArray[currentIndex],
      allPages: pageArray,
    });
    handleGoToPdf(pageArray[currentIndex], bboxArray[currentIndex]);
  };

  const normalizeTablePageNumber = (rawPage: any): number => {
    if (Array.isArray(rawPage)) {
      return normalizeTablePageNumber(rawPage[0]);
    }
    const page = Number(rawPage);
    return Number.isFinite(page) ? page : 0;
  };

  const normalizeTableBbox = (rawBbox: any): number[] | undefined => {
    if (typeof rawBbox === 'string') {
      const trimmed = rawBbox.trim();

      // "[265, 871, 1387, 1863]" 형태
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsedJson = JSON.parse(trimmed);
          if (Array.isArray(parsedJson) && parsedJson.length === 4) {
            const parsedNums = parsedJson.map(Number);
            if (parsedNums.every(v => Number.isFinite(v))) return parsedNums;
          }
        } catch {
          // JSON 파싱 실패 시 regex fallback 사용
        }
      }

      // 숫자 추출 fallback (공백/쉼표/문자 혼합 대응)
      const matched = trimmed.match(/-?\d+(?:\.\d+)?/g);
      if (matched && matched.length >= 4) {
        const parsedNums = matched.slice(0, 4).map(Number);
        if (parsedNums.every(v => Number.isFinite(v))) return parsedNums;
      }

      return undefined;
    }

    if (Array.isArray(rawBbox)) {
      if (rawBbox.length === 4) {
        const parsed = rawBbox.map(Number);
        if (parsed.every(v => Number.isFinite(v))) {
          return parsed;
        }
      }
      if (rawBbox.length > 0) {
        return normalizeTableBbox(rawBbox[0]);
      }
      return undefined;
    }

    if (rawBbox && typeof rawBbox === 'object') {
      const { x1, y1, x2, y2 } = rawBbox as Record<string, unknown>;
      const parsed = [Number(x1), Number(y1), Number(x2), Number(y2)];
      if (parsed.every(v => Number.isFinite(v))) {
        return parsed;
      }
    }

    return undefined;
  };

  const handleTableCardClick = (tableItem: any, index: number) => {
    const cardKey = `table-${tableItem?.table_num ?? index}-${index}`;
    const pageArray = Array.isArray(tableItem?.page) ? tableItem.page : [];
    const bboxArray = Array.isArray(tableItem?.bbox) ? tableItem.bbox : [];
    if (pageArray.length === 0) return;

    const currentIndex = pageIndices[cardKey] ?? 0;
    const targetPage = normalizeTablePageNumber(pageArray[currentIndex]);
    const targetBbox = normalizeTableBbox(bboxArray[currentIndex]);

    debugLog('table-card-click', {
      cardKey,
      targetPage,
      rawBbox: bboxArray[currentIndex],
      normalizedBbox: targetBbox,
    });

    setActiveCompId(cardKey);
    if (targetPage) {
      handleGoToPdf(targetPage, targetBbox as any);
    }
  };

  const handleTablePageChange = (tableItem: any, index: number, direction: number) => {
    const cardKey = `table-${tableItem?.table_num ?? index}-${index}`;
    const pageArray = Array.isArray(tableItem?.page) ? tableItem.page : [];
    const bboxArray = Array.isArray(tableItem?.bbox) ? tableItem.bbox : [];
    if (pageArray.length === 0) return;

    const currentIndex = pageIndices[cardKey] ?? 0;
    const isCurrentItemActive = activeCompId === cardKey;
    let nextIndex = isCurrentItemActive ? currentIndex + direction : currentIndex;
    if (nextIndex < 0) nextIndex = pageArray.length - 1;
    if (nextIndex >= pageArray.length) nextIndex = 0;

    setPageIndices(prev => ({ ...prev, [cardKey]: nextIndex }));
    setActiveCompId(cardKey);
    const targetPage = normalizeTablePageNumber(pageArray[nextIndex]);
    const targetBbox = normalizeTableBbox(bboxArray[nextIndex]);

    debugLog('table-page-change', {
      cardKey,
      nextIndex,
      targetPage,
      rawBbox: bboxArray[nextIndex],
      normalizedBbox: targetBbox,
    });

    if (targetPage) {
      handleGoToPdf(targetPage, targetBbox as any);
    }
  };

  const normalizeTableClipboardText = (value: unknown): string => {
    if (Array.isArray(value)) {
      return value
        .map(normalizeTableClipboardText)
        .filter(Boolean)
        .join('\n');
    }
    if (typeof value !== 'string') return '';

    return value
      .replace(/\r\n?/g, '\n')
      .replace(/\\r\\n|\\n|\\r/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/^\n+|\n+$/g, '');
  };

  const getTableCopyText = (tableItem: any, tableIndex: number) => {
    const tsvSource = Array.isArray(tableItem?.table_tsv)
      ? tableItem.table_tsv[tableIndex]
      : tableItem?.table_tsv;
    const csvSource = Array.isArray(tableItem?.table_csv)
      ? tableItem.table_csv[tableIndex]
      : tableItem?.table_csv;
    const currentTableText = normalizeTableClipboardText(tsvSource)
      || normalizeTableClipboardText(csvSource);

    if (currentTableText) {
      return currentTableText;
    }

    const pageArray = Array.isArray(tableItem?.page) ? tableItem.page : [];
    const bboxArray = Array.isArray(tableItem?.bbox) ? tableItem.bbox : [];
    const tableBase64 = Array.isArray(tableItem?.table_base64) ? tableItem.table_base64 : [];

    return [
      ['Table Group', tableItem?.table_group ?? '-'],
      ['Table Number', tableItem?.table_num ?? '-'],
      ['Has Compound', tableItem?.has_compound ? 'O' : 'X'],
      ['Current Index', tableIndex + 1],
      ['Current Page', pageArray[tableIndex] ?? '-'],
      ['Current BBox', bboxArray[tableIndex] ?? '-'],
      ['Pages', pageArray.length > 0 ? pageArray.join(', ') : '-'],
      ['Images', tableBase64.length],
    ].map(([label, value]) => `${label}\t${value}`).join('\n');
  };

  const handleCopyTableInfo = (tableItem: any, tableIndex: number) => {
    const copyText = getTableCopyText(tableItem, tableIndex);
    const writePromise = navigator.clipboard?.writeText(copyText);

    if (!writePromise) {
      void message.error('클립보드를 지원하지 않는 브라우저입니다.');
      return;
    }

    void writePromise
      .then(() => {
        void message.success('테이블 정보 복사 완료');
      })
      .catch(() => {
        void message.error('테이블 정보 복사 실패');
      });
  };

  const openSvgPreview = (svg: string, title: string, meta?: StructurePreviewMeta) => {
    setPreviewImageSrc(null);
    setPreviewSvg(svg);
    setPreviewStructureMeta(meta ?? null);
    setPreviewTitle(title);
  };

  const scrollFocusedTableRow = (tableRef: React.RefObject<any>, rowKey: React.Key) => {
    const scrollToRow = () => {
      tableRef.current?.scrollTo?.({ key: rowKey });
    };

    requestAnimationFrame(() => {
      scrollToRow();
      window.setTimeout(scrollToRow, 120);
    });
  };

  const buildCleanRows = React.useCallback(() => {
    const modifiedRows: any[] = patentResult.modified_patent_compound ?? [];
    const modifiedPartialRows: any[] = (patentResult as any).modified_partial_rows ?? [];
    const rowById = new Map<number, any>();
    modifiedRows.forEach((row) => {
      if (!rowById.has(row.id)) rowById.set(row.id, row);
    });

    return modifiedPartialRows.length > 0
      ? modifiedPartialRows.map((item: any, idx: number) => {
        const rowId = typeof item === 'number' ? item : item?.id;
        const row = rowById.get(rowId);
        return row ? { ...row, __rowKey: `${row.id}-${idx}` } : null;
      }).filter(Boolean)
      : modifiedRows.map((row: any, idx: number) => ({ ...row, __rowKey: `${row.id}-${idx}` }));
  }, [patentResult]);

  const handlePdfHighlightClick = React.useCallback((highlight: any) => {
    const source = highlight?.source ?? pdfViewer.activeBBox;
    const targetPage = Number(source?.pageNumber ?? highlight?.position?.pageNumber);
    const targetBbox = normalizeAutoHighlightBbox(source?.rect);
    const selectionKey = getPdfHighlightSelectionKey(targetPage, targetBbox);

    if (!targetPage || !targetBbox || !selectionKey) return;

    // 클릭한 블루 bbox만 빨간색(선택)으로 표시. 선택 매칭은 baseId 기준(이미 선택된 box 재클릭 시 __selected 접미사 제거).
    const selectedBboxKey = (highlight?.source?.baseId as string | undefined)
      ?? String(highlight?.id ?? '').replace(/__selected$/, '').replace(/__layout_\d+$/, '');
    if (selectedBboxKey) {
      // 우측 활성화로 생긴 red(active_compound_highlight)는 제거 → red는 항상 하나만 유지
      pdfViewer.clearActiveCompoundHighlight();
      pdfViewer.setSelectedDataHighlightId(selectedBboxKey);
    }

    if (source?.scope === 'raw' && Number.isFinite(Number(source.rowIndex))) {
      const rowIndex = Number(source.rowIndex);
      const activeKey = String(source.activeKey ?? '');
      setRGroupFilter(null);
      setActiveTab('raw-data');
      setRawDataView('table');
      setRawTableCurrentPage(Math.floor(rowIndex / rawTablePageSize) + 1);
      setActiveCompId(activeKey);
      setPageIndices((prev) => ({ ...prev, [activeKey]: 0 }));
      scrollFocusedTableRow(rawDataTableRef, String(source.rowKey));
      return;
    }

    if (source?.scope === 'clean' && Number.isFinite(Number(source.rowIndex))) {
      const rowIndex = Number(source.rowIndex);
      const activeKey = String(source.activeKey ?? '');
      setActiveTab('clean-data');
      setCleanDataView('table');
      setCleanTableCurrentPage(Math.floor(rowIndex / cleanTablePageSize) + 1);
      setActiveCompId(activeKey);
      setPageIndices((prev) => ({ ...prev, [activeKey]: 0 }));
      scrollFocusedTableRow(cleanDataTableRef, String(source.rowKey));
      return;
    }

    const rawRows: any[] = patentResult.patent_compound ?? [];
    const rawIndex = findRowIndexByPdfTarget(rawRows, targetPage, targetBbox);
    if (rawIndex >= 0) {
      const row = rawRows[rawIndex];
      const rowKey = `${row.id}-${rawIndex}`;
      const activeKey = String(row.id);
      setRGroupFilter(null);
      setActiveTab('raw-data');
      setRawDataView('table');
      setRawTableCurrentPage(Math.floor(rawIndex / rawTablePageSize) + 1);
      setActiveCompId(activeKey);
      setPageIndices((prev) => ({ ...prev, [activeKey]: 0 }));
      scrollFocusedTableRow(rawDataTableRef, rowKey);
      return;
    }

    const cleanRows = buildCleanRows();
    const cleanIndex = findRowIndexByPdfTarget(cleanRows, targetPage, targetBbox);
    if (cleanIndex >= 0) {
      const row = cleanRows[cleanIndex];
      const rowKey = row.__rowKey;
      const activeKey = `clean-${rowKey ?? row.id}`;
      setActiveTab('clean-data');
      setCleanDataView('table');
      setCleanTableCurrentPage(Math.floor(cleanIndex / cleanTablePageSize) + 1);
      setActiveCompId(activeKey);
      setPageIndices((prev) => ({ ...prev, [activeKey]: 0 }));
      scrollFocusedTableRow(cleanDataTableRef, rowKey);
      return;
    }

    message.warning('선택한 PDF 하이라이트에 연결된 Raw data row를 찾을 수 없습니다.');
  }, [
    buildCleanRows,
    cleanTablePageSize,
    message,
    patentResult,
    pdfViewer.activeBBox,
    pdfViewer.clearActiveCompoundHighlight,
    pdfViewer.setSelectedDataHighlightId,
    rawTablePageSize,
  ]);

  const renderPatentStructureView = (opts: {
    svg: string;
    title: string;
    smiles?: string;
    molblock?: string;
    width?: number | string;
    height?: number | string;
    iconSize?: number;
    onClick?: React.MouseEventHandler<HTMLDivElement>;
    linkedImageFocus?: string;
    linkedImageTitle?: string;
  }) => (
    <CompoundStructureView
      svg={opts.svg}
      title={opts.title}
      smiles={opts.smiles}
      molBlock={opts.molblock}
      width={opts.width ?? '100%'}
      height={opts.height ?? '100%'}
      iconSize={opts.iconSize ?? 28}
      gap={0}
      fullWidth
      frameless
      structureFitMode="contain"
      transparentBackground
      actionPlacement="overlay"
      actionOverlayAnchor="container"
      actionOverlayPlacement="bottom-right"
      showCopyImageAction
      frameStyle={{ border: 0, outline: 0, boxShadow: 'none', background: 'transparent', overflow: 'visible' }}
      containerStyle={{ height: '100%', cursor: opts.onClick ? 'pointer' : undefined }}
      onClick={opts.onClick}
      onPreview={() => openSvgPreview(opts.svg, opts.title, {
        smiles: opts.smiles,
        molblock: opts.molblock,
      })}
      linkedImageCopy={getPatentDetailStructureLinkedImageCopy(
        opts.linkedImageTitle ?? opts.title,
        opts.linkedImageFocus ?? opts.title,
      )}
      actions={(opts.smiles || opts.molblock) ? [{
        key: 'chemdraw',
        title: 'ChemDraw',
        icon: <BenzeneIcon size={opts.iconSize ?? 14} />,
        onClick: (event) => {
          event.stopPropagation();
          setChemDrawSmiles(opts.smiles || '');
          setChemDrawMolblock(opts.molblock || '');
          setChemDrawTitle(opts.title);
          setChemDrawOpen(true);
        },
      }] : []}
    />
  );

  function getPatentDetailStructureLinkedImageCopy(title: string, focus: string) {
    const patentNumber = displayedPatent?.patentNumber;
    if (!patentNumber) return undefined;

    const normalizedPatentNumber = normalizePublicationNumber(patentNumber);
    const fallbackPath = `/patents/analysis/${encodeURIComponent(normalizedPatentNumber)}?focus=${encodeURIComponent(focus)}`;
    const url = typeof window === 'undefined'
      ? fallbackPath
      : (() => {
          const nextUrl = new URL(`/patents/analysis/${encodeURIComponent(normalizedPatentNumber)}`, window.location.origin);
          nextUrl.searchParams.set('focus', focus);
          return nextUrl.toString();
        })();

    return {
      url,
      title: `${normalizedPatentNumber} ${title}`,
    };
  }

  const openImagePreview = (src: string, title: string) => {
    setPreviewSvg(null);
    setPreviewStructureMeta(null);
    setPreviewImageSrc(src);
    setPreviewTitle(title);
  };

  const canOpenPreviewChemDraw = Boolean(previewStructureMeta?.smiles || previewStructureMeta?.molblock);

  const handlePreviewOpenChemDraw = () => {
    if (!canOpenPreviewChemDraw) return;

    setChemDrawSmiles(previewStructureMeta?.smiles || '');
    setChemDrawMolblock(previewStructureMeta?.molblock || '');
    setChemDrawTitle(previewTitle);
    setChemDrawOpen(true);
  };

  const fitPageToScreen = React.useCallback(() => {
    if (splitRatio <= SPLIT_MIN_PERCENT) {
      // 현재 최소 상태이면 기본 비율(PDF 45%, 탭 55%)로 확대
      debugLog('fit-to-page-expand', { currentRatio: splitRatio, targetRatio: SPLIT_DEFAULT_PERCENT });
      setSplitRatio(SPLIT_DEFAULT_PERCENT);
    } else {
      // 그 외 상태이면 최소 비율로 축소 (우측 분석 영역 최대화)
      debugLog('fit-to-page-shrink', { currentRatio: splitRatio, targetRatio: SPLIT_MIN_PERCENT });
      setSplitRatio(SPLIT_MIN_PERCENT);
    }
  }, [splitRatio, debugLog]);

  const cleanDataEmptyState = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        padding: '24px 0',
      }}
    >
      <Empty
        description={cleanDataExcelRowCount === 0
          ? 'Clean data 데이터가 없습니다.'
          : 'Filter 조건에 맞는 Clean data가 없습니다.'}
      />
      {cleanDataExcelRowCount === 0 && (
        <Button
          type="primary"
          loading={cleanDataRequestLoading}
          onClick={() => setCleanDataRequestOpen(true)}
        >
          Clean data 요청
        </Button>
      )}
    </div>
  );

  return (
    <div className="patent-analysis-detail-page" style={{ maxWidth: layoutPreset.maxWidth, margin: '0 auto', padding: `0 ${layoutPreset.sidePadding}px`, flex: 1, width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflow: isStackedSplitLayout ? 'auto' : 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: isStackedSplitLayout ? 'visible' : 'hidden', animation: 'fadeIn 0.3s ease-out', paddingBottom: isStackedSplitLayout ? 24 : 8 }}>
        {patentDetailError && (
          <Alert
            type="warning"
            showIcon
            message="특허 상세 API 연결 실패"
            description="특허 상세 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
            style={{ marginBottom: 12 }}
          />
        )}

        <div
          ref={splitContainerRef}
          className={isStackedSplitLayout ? 'patent-detail-split patent-detail-split-stacked' : 'patent-detail-split'}
          style={{
            flex: 1,
            minHeight: 0,
            overflow: isStackedSplitLayout ? 'visible' : 'hidden',
            display: 'flex',
            flexDirection: isStackedSplitLayout ? 'column' : 'row',
            gap: isStackedSplitLayout ? 16 : 0,
            position: 'relative',
          }}
        >
          {/* 좌측: PDF 뷰어 영역 */}
          <div
            style={{
              width: isStackedSplitLayout ? '100%' : `calc(${splitRatio}% - 6px)`,
              minWidth: 0,
              height: isStackedSplitLayout ? 'clamp(520px, 72vh, 760px)' : '100%',
              minHeight: isStackedSplitLayout ? 520 : 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
            >
            <PatentPdfToolbar
              splitRatio={splitRatio}
              minSplitPercent={SPLIT_MIN_PERCENT}
              borderColor={token.colorBorderSecondary}
              backgroundColor={token.colorBgContainer}
              textColor={token.colorText}
              searchQuery={pdfViewer.searchQuery}
              searchMatchCount={pdfViewer.matchCount.total}
              activeMatchIndex={pdfViewer.matchCount.current}
              searchExecuted={pdfViewer.matchCount.total > 0}
              currentPage={pdfViewer.pdfCurrentPage}
              totalPages={pdfViewer.pdfTotalPages}
              zoomPercent={pdfViewer.pdfZoomPercent}
              onZoomIn={pdfViewer.zoomPdfIn}
              onZoomOut={pdfViewer.zoomPdfOut}
              onResetZoom={pdfViewer.resetPdfZoom}
              onToggleFit={fitPageToScreen}
              onOpenPdfInBrowser={browserPdfDocument ? handleOpenPdfInBrowser : undefined}
              onSearchQueryChange={pdfViewer.setSearchQuery}
              onRunSearch={(value) => pdfViewer.searchPdf(value ?? pdfViewer.searchQuery)}
              onClearSearch={() => pdfViewer.searchPdf('')}
              onMoveSearchMatch={(dir) => dir > 0 ? pdfViewer.findNext() : pdfViewer.findPrevious()}
              onRotateLeft={() => pdfViewer.setPdfRotation(r => (r - 90 + 360) % 360)}
              onRotateRight={() => pdfViewer.setPdfRotation(r => (r + 90) % 360)}
              onDownloadPdf={handlePdfDownload}
              onGoToPage={(page) => handleGoToPdf(page)}
              onPageStep={(step) => {
                if (!pdfViewer.pdfTotalPages) return;
                const next = Math.min(
                  Math.max((pdfViewer.pdfCurrentPage || 1) + step, 1),
                  pdfViewer.pdfTotalPages
                );
                handleGoToPdf(next);
              }}
              thumbnailCollapsed={thumbnailCollapsed}
              onToggleThumbnail={() => setThumbnailCollapsed(prev => !prev)}
            />

            {browserPdfDocument ? (
              <PatentPdfViewer
                document={browserPdfDocument}
                rotation={pdfViewer.pdfRotation}
                pdfScaleValue={pdfViewer.pdfScaleValue}
                viewerContainerRef={pdfViewer.pdfViewerContainerRef}
                currentPage={pdfViewer.pdfCurrentPage}
                onGoToPage={pdfViewer.handleGoToPdf}
                pdfTotalPages={pdfViewer.pdfTotalPages}
                activeBBox={pdfViewer.activeBBox}
                dynamicHighlights={pdfViewer.dynamicHighlights}
                userHighlights={pdfViewer.userHighlights}
                onPdfDocumentReady={pdfViewer.setPdfDocument}
                onPdfTotalPagesChange={pdfViewer.setPdfTotalPages}
                setHighlighterUtils={pdfViewer.setHighlighterUtils}
                backgroundColor={token.colorBgContainer}
                borderColor={token.colorBorderSecondary}
                onAddHighlight={pdfViewer.addHighlight}
                onDeleteHighlight={pdfViewer.deleteHighlight}
                onScrollToHighlight={pdfViewer.scrollToHighlight}
                onHighlightClick={handlePdfHighlightClick}
                thumbnailCollapsed={thumbnailCollapsed}
              />
            ) : (
              <Card
                style={{
                  flex: 1,
                  borderRadius: 16,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  display: 'flex',
                  minHeight: 0,
                }}
                styles={{
                  body: {
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                }}
              >
                {isLoadingPatentDetail ? (
                  <PatentDetailLoadingState />
                ) : shouldShowPatentDetailEmpty ? (
                  <Empty description="브라우저에서 접근 가능한 PDF 파일이 없습니다." />
                ) : null}
              </Card>
            )}
          </div>

          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="PDF 영역 너비 조절"
            aria-valuemin={SPLIT_MIN_PERCENT}
            aria-valuemax={SPLIT_MAX_PERCENT}
            aria-valuenow={Math.round(splitRatio)}
            tabIndex={0}
            onMouseDown={handleSplitMouseDown}
            onDoubleClick={resetSplitRatio}
            onKeyDown={handleSplitKeyDown}
            style={{
              width: 12,
              flexShrink: 0,
              cursor: 'col-resize',
              display: isStackedSplitLayout ? 'none' : 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              outline: 'none'
            }}
          >
            <div
              style={{
                width: 4,
                height: 64,
                borderRadius: 999,
                background: token.colorBorder,
                opacity: isResizingSplit ? 0 : 1,
                transition: 'background-color 0.2s ease, opacity 0.12s ease'
              }}
            />
          </div>

          <div
            ref={splitGuideRef}
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${splitRatio}%`,
              width: 4,
              borderRadius: 999,
              background: token.colorPrimary,
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              zIndex: 20,
              display: 'none',
            }}
          />

          {/* 우측: 데이터 분석 영역 */}
          <div
            style={{
              width: isStackedSplitLayout ? '100%' : `calc(${100 - splitRatio}% - 6px)`,
              minWidth: 0,
              height: isStackedSplitLayout ? 'auto' : '100%',
              minHeight: isStackedSplitLayout ? 640 : 0,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div className="v-table-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: isStackedSplitLayout ? 640 : 0 }}>
              <Tabs
                className="patent-analysis-detail-tabs"
                activeKey={activeTab}
                onChange={(key) => {
                  setActiveTab(key);
                  if (key !== 'raw-data') setRGroupFilter(null);
                }}
                destroyOnHidden={false}
                animated={false}
                style={{ height: isStackedSplitLayout ? 'auto' : '100%', display: 'flex', flexDirection: 'column' }}
                tabBarStyle={{ margin: 0, flexShrink: 0 }}
                tabBarExtraContent={{
                  right: (
                    <Button
                      type={isFavoritePatent ? 'primary' : 'default'}
                      size="small"
                      icon={isSavingFavoritePatent ? undefined : (
                        <Star
                          size={15}
                          fill={isFavoritePatent ? '#F8B84E' : 'none'}
                          color={isFavoritePatent ? '#D89116' : token.colorTextTertiary}
                        />
                      )}
                      loading={isSavingFavoritePatent}
                      onClick={() => void toggleFavoritePatent()}
                      className="v-action-btn patent-analysis-tab-favorite"
                    >
                      즐겨찾기 {isFavoritePatent ? 'ON' : 'OFF'}
                    </Button>
                  ),
                }}
                items={[
                  {
                    key: 'summary',
                    label: (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Layers size={16} /> Summary
                      </span>
                    ),
                    children: activeTab === 'summary' ? (
                      <div className="raw-data-tab-content patent-summary-tab-content" style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
                        <div className="patent-analysis-tab-heading-row">
                          <Title level={5} style={{ margin: 0 }}>Patent analysis summary</Title>
                        </div>
                        
                        <Row gutter={[16, 16]}>
                          <Col span={24}>
                            <Card size="small" title="추천 key compounds (빈도수 기반)">
                              {recommendedKeyCompounds.length > 0 ? (
                                <div
                                  style={{
                                    display: 'grid',
                                    gridAutoFlow: 'column',
                                    gridTemplateRows: 'repeat(2, max-content)',
                                    gridAutoColumns: 260,
                                    overflowX: 'auto',
                                    gap: 16,
                                    paddingBottom: 8,
                                  }}
                                >
                                  {recommendedKeyCompounds.map((comp: any, idx: number) => {
                                    const compKey = `summary-${comp.id}-${idx}`;
                                    const pageArr: number[] = Array.isArray(comp.page) ? comp.page : [];
                                    const bboxArr: any[] = Array.isArray(comp.bbox) ? comp.bbox : [];
                                    const curIdx = pageIndices[compKey] ?? 0;

                                    return (
                                      <div key={`${comp.id}-${idx}`} style={{ width: 260 }}>
                                        <DataCardItem
                                          title={formatPatentExampleNumber(comp.example_number)}
                                          headerContent={(
                                            <div className="patent-key-compound-header">
                                              <Text strong style={{ fontSize: 12 }}>
                                                Rank {comp.ranking ?? '-'}
                                              </Text>
                                              <Space size={6}>
                                                <Text type="secondary" style={{ fontSize: 11 }}>
                                                  {comp.compound_id ?? '-'}
                                                </Text>
                                                {comp.is_human_key_compound && (
                                                  <span style={{ fontSize: 14 }} title="Key compound">🔑</span>
                                                )}
                                              </Space>
                                            </div>
                                          )}
                                          imageUrl={comp.compound_svg}
                                          imageType="svg"
                                          imageHeight={220}
                                          squareImage
                                          transparentImageBackground
                                          imageBorderless
                                          isActive={activeCompId === compKey}
                                          selectionOnlyBorder
                                          selectionVariant="sarHeader"
                                          onClick={() => handleCompoundCardClick(comp, comp.ranking, compKey)}
                                          onPreview={() => openSvgPreview(comp.compound_svg, `추천 key compound - ${comp.compound_id}`, {
                                            smiles: comp.smiles,
                                            molblock: comp.molblock,
                                          })}
                                          smiles={comp.smiles}
                                          molblock={comp.molblock}
                                          linkedImageCopy={getPatentDetailStructureLinkedImageCopy(
                                            `추천 key compound - ${comp.compound_id}`,
                                            `recommendedKeyCompound:${comp.compound_id}`,
                                          )}
                                          pagination={
                                            pageArr.length > 0
                                              ? {
                                                  currentIndex: curIdx,
                                                  totalCount: pageArr.length,
                                                  onPrev: () => handlePageChange(compKey, -1, pageArr, bboxArr),
                                                  onNext: () => handlePageChange(compKey, 1, pageArr, bboxArr),
                                                }
                                              : undefined
                                          }
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                isLoadingPatentDetail ? (
                                  <PatentDetailLoadingState />
                                ) : shouldShowPatentDetailEmpty ? (
                                  <Empty description="추천 key compounds 데이터가 없습니다." />
                                ) : null
                              )}
                            </Card>
                          </Col>

                          {hasSummaryAnalysis && summaryAnalysis ? (
                            <Col span={24}>
                              <Card
                                size="small"
                                title="Scaffold ranking"
                                className="patent-summary-card patent-summary-scaffold-ranking-card"
                              >
                                <div className="patent-summary-scaffold-scroll">
                                  <div className="patent-summary-scaffold-item patent-summary-scaffold-tile patent-summary-parent-scaffold">
                                    <div className="patent-summary-scaffold-tile-header">
                                      <Text strong>Parent scaffold</Text>
                                    </div>
                                    <div className="patent-summary-structure-frame">
                                      {renderPatentStructureView({
                                        svg: summaryAnalysis.parentScaffold.svg,
                                        title: 'Parent scaffold',
                                        smiles: (summaryAnalysis.parentScaffold as any).smiles ?? (summaryAnalysis.scaffoldRanks?.[0] as any)?.smiles,
                                        molblock: (summaryAnalysis.parentScaffold as any).molblock,
                                      })}
                                    </div>
                                  </div>
                                  {summaryAnalysis.scaffoldRanks.map((rankData) => {
                                    return (
                                      <div
                                        className="patent-summary-scaffold-item patent-summary-scaffold-tile patent-summary-scaffold-rank-tile"
                                        key={rankData.rank}
                                      >
                                        <div className="patent-summary-scaffold-tile-header">
                                          <span className="patent-summary-rank-label">
                                            <Text strong>Rank</Text>
                                            <ScaffoldRankBadge rank={rankData.rank} />
                                          </span>
                                          <Text type="secondary">Freq. {rankData.frequency}</Text>
                                        </div>
                                        <div className="patent-summary-structure-frame">
                                          {renderPatentStructureView({
                                            svg: rankData.svg,
                                            title: `Scaffold rank ${rankData.rank}`,
                                            smiles: (rankData as any).smiles,
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                <section className="patent-functional-group-section">
                                  <div className="patent-functional-group-title">
                                    <Title level={5} style={{ margin: 0 }}>Functional group analysis</Title>
                                  </div>
                                  <div className="patent-functional-group-list">
                                    {summaryAnalysis.rGroups.map((group) => (
                                      <div key={group.id}>
                                        <Title level={5} style={{ marginTop: 0, marginBottom: 8, color: token.colorPrimary }}>
                                          {group.id}
                                        </Title>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                                          {group.variants.map((variant: any, index: number) => (
                                            <div key={index} className="patent-rgroup-variant-item">
                                              <div className="patent-summary-structure-frame patent-functional-rgroup-frame">
                                                {renderPatentStructureView({
                                                  svg: variant.svg,
                                                  title: `${group.id} Variant ${index + 1}`,
                                                  smiles: variant.smiles,
                                                  iconSize: 10,
                                                })}
                                              </div>
                                              <Button
                                                type="link"
                                                size="small"
                                                className="patent-rgroup-frequency-button"
                                                onClick={() => {
                                                  setRGroupFilter({ key: group.id, smiles: variant.smiles });
                                                  React.startTransition(() => setActiveTab('raw-data'));
                                                }}
                                              >
                                                Freq. {variant.frequency}
                                              </Button>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </section>
                              </Card>
                            </Col>
                          ) : (
                            <Col span={24}>
                              <Card size="small">
                                {isLoadingPatentDetail ? (
                                  <PatentDetailLoadingState />
                                ) : shouldShowPatentDetailEmpty ? (
                                  <Empty description="Patent analysis summary 데이터가 없습니다." />
                                ) : null}
                              </Card>
                            </Col>
                          )}
                        </Row>
                      </div>
                    ) : null
                  },
                  {
                    key: 'raw-data',
                    label: (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FileSpreadsheet size={16} /> Raw data
                      </span>
                    ),
                    children: activeTab === 'raw-data' ? (
                      <div
                        ref={rawDataTabContentRef}
                        className="raw-data-tab-content"
                        style={{
                          padding: '24px 24px 16px',
                          flex: 1,
                          height: '100%',
                          minHeight: 0,
                          boxSizing: 'border-box',
                          display: 'flex',
                          flexDirection: 'column',
                          overflowY: rawDataView === 'table' ? 'hidden' : 'auto',
                        }}
                      >
                        <div className="patent-analysis-tab-heading-row" style={{ justifyContent: 'space-between' }}>
                          <div className="patent-data-heading-controls">
                            <Title level={5} style={{ margin: 0 }}>Embodiment 화합물 목록</Title>
                            <PatentScaffoldFilterControls
                              ranks={rawScaffoldRanks}
                              value={rawScaffoldRankFilter}
                              onChange={(value) => {
                                setRawScaffoldRankFilter(value);
                                setRawDataFilter((current) => ({
                                  ...current,
                                  scaffoldRanking: value === 'all' ? undefined : value,
                                }));
                              }}
                            />
                            {rawDataView === 'table' && (
                              <Button
                                size="small"
                                type={rawShowFunctionalGroupColumns ? 'primary' : 'default'}
                                className={`patent-functional-group-toggle${rawShowFunctionalGroupColumns ? ' is-active' : ''}`}
                                onClick={() => setRawShowFunctionalGroupColumns((current) => !current)}
                                aria-pressed={rawShowFunctionalGroupColumns}
                              >
                                작용기 {rawShowFunctionalGroupColumns ? 'On' : 'Off'}
                              </Button>
                            )}
                          </div>
                          <Space>
                            <div
                              className="patent-analysis-view-toggle"
                              style={{
                                background: token.colorBgLayout,
                                border: `1px solid ${token.colorBorderSecondary}`
                              }}
                            >
                              <Button
                                className="patent-analysis-view-toggle-button"
                                type="text"
                                size="small"
                                icon={<TableIcon size={14} />}
                                onClick={() => setRawDataView('table')}
                                style={{
                                  background: rawDataView === 'table' ? token.colorPrimaryBg : 'transparent',
                                  border: `1px solid ${rawDataView === 'table' ? token.colorPrimary : 'transparent'}`,
                                  color: rawDataView === 'table' ? token.colorPrimary : token.colorTextSecondary,
                                  fontWeight: rawDataView === 'table' ? 600 : 500
                                }}
                              >
                                Table
                              </Button>
                              <Button
                                className="patent-analysis-view-toggle-button"
                                type="text"
                                size="small"
                                icon={<LayoutGrid size={14} />}
                                onClick={() => setRawDataView('card')}
                                style={{
                                  background: rawDataView === 'card' ? token.colorPrimaryBg : 'transparent',
                                  border: `1px solid ${rawDataView === 'card' ? token.colorPrimary : 'transparent'}`,
                                  color: rawDataView === 'card' ? token.colorPrimary : token.colorTextSecondary,
                                  fontWeight: rawDataView === 'card' ? 600 : 500
                                }}
                              >
                                Card
                              </Button>
                            </div>
                            <Badge count={rawAppliedFilterCount} size="small">
                              <Button size="small" type="primary" onClick={() => setRawFilterOpen(true)}>
                                Filter
                              </Button>
                            </Badge>
                            <Tooltip
                              title={rawAppliedFilterCount > 0
                                ? '현재 Filter와 관계없이 전체 Raw data를 다운로드합니다.'
                                : undefined}
                            >
                              <Button
                                size="small"
                                icon={<Download size={14} />}
                                loading={downloadingExcelType === 'bioactivity'}
                                disabled={rawDataExcelRowCount === 0 || downloadingExcelType !== null}
                                title={rawDataExcelRowCount === 0 ? '다운로드할 Raw data가 없습니다.' : undefined}
                                onClick={() => void handleEmbodimentsExcelDownload('bioactivity')}
                              >
                                Excel
                              </Button>
                            </Tooltip>
                          </Space>
                        </div>
                        {rGroupFilter && (
                          <div style={{ marginBottom: 12, padding: '8px 12px', background: token.colorPrimaryBg, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Text style={{ fontSize: 12 }}>
                              필터: <Tag color="blue">{rGroupFilter.key}</Tag> = <Tag>{rGroupFilter.smiles}</Tag>
                            </Text>
                            <Button size="small" type="text" danger onClick={() => setRGroupFilter(null)}>해제</Button>
                          </div>
                        )}
                        {rawSearchState.error && (
                          <Alert
                            type="error"
                            showIcon
                            message="Raw data Filter 요청에 실패했습니다."
                            description={rawSearchState.error}
                            action={(
                              <Button size="small" onClick={() => setRawSearchRevision((value) => value + 1)}>
                                재시도
                              </Button>
                            )}
                            style={{ marginBottom: 12 }}
                          />
                        )}
                        {rawDataView === 'table' ? (
                          (() => {
                            const rawPc = rawSearchRows;
                            // 전체 r_group key 수집 (R1~R7 등 동적)
                            const allRGroupKeys = Array.from(
                              new Set(rawPc.flatMap((c: any) => Object.keys(c.r_groups ?? {})))
                            ).sort();

                            const rGroupColumns = allRGroupKeys.map((key) => ({
                              title: key,
                              key: `rg_${key}`,
                              width: 190,
                              className: 'table-center-column raw-data-rgroup-column',
                              align: 'center' as const,
                              render: (_: any, record: any) => {
                                const smiles = record.r_groups?.[key];
                                // frequency_analysis_result_json에서 SVG 찾기
                                const faRGroups = frequencyAnalysis?.r_groups ?? {};
                                const variants: any[] = faRGroups[key] ?? [];
                                const match = variants.find((v: any) => v.smiles === smiles);
                                const svg = match?._svg || record.r_group_svgs?.[key] || '';
                                return (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <div
                                      className="raw-data-svg-frame raw-data-rgroup-svg-frame"
                                      style={{ width: PATENT_DATA_STRUCTURE_SIZE, height: PATENT_DATA_STRUCTURE_SIZE, background: 'transparent', border: 0, borderRadius: 6, position: 'relative', cursor: svg ? 'pointer' : 'default', overflow: 'hidden', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      {svg ? (
                                        renderPatentStructureView({
                                          svg,
                                          title: `${key}: ${smiles}`,
                                          smiles,
                                          height: '100%',
                                          iconSize: 11,
                                          onClick: () => openSvgPreview(svg, `${key}: ${smiles}`, { smiles }),
                                        })
                                      ) : (
                                        <Text style={{ fontSize: 11, color: token.colorTextTertiary }}>no image</Text>
                                      )}
                                    </div>
                                  </div>
                                );
                              }
                            }));

                            const scaffoldColumn = {
                              title: 'Scaffold',
                              key: 'scaffold',
                              width: 210,
                              align: 'center' as const,
                              className: 'table-center-column raw-data-scaffold-column',
                              render: (_: any, record: any) => (
                                <div className="raw-data-scaffold-cell">
                                  <div
                                    className="raw-data-svg-frame raw-data-scaffold-svg-frame"
                                    style={{ width: PATENT_DATA_STRUCTURE_SIZE, height: PATENT_DATA_STRUCTURE_SIZE, background: 'transparent', border: 0, borderRadius: 8, cursor: record.scaffold_svg ? 'pointer' : 'default', position: 'relative', overflow: 'hidden', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  >
                                    {record.scaffold_svg ? renderPatentStructureView({
                                      svg: record.scaffold_svg,
                                      title: `Scaffold - ${record.compound_id}`,
                                      smiles: record.scaffold,
                                      height: '100%',
                                      iconSize: 11,
                                      onClick: () => openSvgPreview(record.scaffold_svg, `Scaffold - ${record.compound_id}`),
                                    }) : (
                                      <Text style={{ fontSize: 11, color: token.colorTextTertiary }}>no image</Text>
                                    )}
                                  </div>
                                </div>
                              ),
                            };

                            const columns = [
                              {
                                title: 'Pin',
                                key: 'pin',
                                width: 56,
                                align: 'center' as const,
                                className: 'table-center-column',
                                render: () => <Pin size={14} style={{ cursor: 'pointer', color: '#bfbfbf' }} />
                              },
                              { title: 'Rank', dataIndex: 'ranking', key: 'ranking', width: 90,
                                align: 'center' as const,
                                className: 'table-center-column',
                                sorter: (a: any, b: any) => (a.ranking ?? 999) - (b.ranking ?? 999),
                                render: (ranking: any) => {
                                  // 같은 ranking 값이 여러 개인지 확인 (동률)
                                  const sameCount = rawPc.filter((c: any) => c.ranking === ranking).length;
                                  return (
                                    <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                                      <Text style={{ fontSize: 11 }}>{ranking ?? '-'}</Text>
                                      {sameCount > 1 && (
                                        <Tag color="orange" style={{ fontSize: 9, padding: '0 4px', lineHeight: '16px', margin: 0 }}>동률</Tag>
                                      )}
                                    </div>
                                  );
                                }
                              },
                              {
                                title: 'Structure',
                                key: 'structure',
                                width: 240,
                                align: 'center' as const,
                                className: 'table-center-column',
                                render: (_: any, record: any) => {
                                  const compKey = String(record.id);
                                  const pageArr: number[] = Array.isArray(record.page) ? record.page : [];
                                  const bboxArr: any[] = Array.isArray(record.bbox) ? record.bbox : [];
                                  const curIdx = pageIndices[compKey] ?? 0;
                                  return (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                      <div
                                        className="raw-data-svg-frame"
                                        style={{ width: PATENT_DATA_STRUCTURE_SIZE, height: PATENT_DATA_STRUCTURE_SIZE, background: 'transparent', border: 0, borderRadius: 8, position: 'relative', cursor: 'pointer', overflow: 'hidden', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                      >
                                        {renderPatentStructureView({
                                          svg: record.compound_svg,
                                          title: `Compound ${record.compound_id}`,
                                          smiles: record.smiles,
                                          molblock: record.molblock,
                                          height: '100%',
                                          iconSize: 11,
                                          onClick: () => { setActiveCompId(compKey); handleGoToPdf(pageArr[curIdx], bboxArr[curIdx]); },
                                        })}
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Button size="small" type="text" icon={<ChevronLeft size={12} />}
                                          onClick={(event) => { event.stopPropagation(); handlePageChange(compKey, -1, pageArr, bboxArr); }} />
                                        <Text style={{ fontSize: 10 }}>
                                          {curIdx + 1} / {pageArr.length}
                                        </Text>
                                        <Button size="small" type="text" style={{ transform: 'scaleX(-1)' }} icon={<ChevronLeft size={12} />}
                                          onClick={(event) => { event.stopPropagation(); handlePageChange(compKey, 1, pageArr, bboxArr); }} />
                                      </div>
                                    </div>
                                  );
                                }
                              },
                              {
                                title: 'Example no.',
                                dataIndex: 'example_number',
                                key: 'example_number',
                                width: 130,
                                align: 'center' as const,
                                className: 'table-center-column',
                                render: (exampleNumber: unknown) => formatPatentExampleNumber(exampleNumber),
                              },
                              {
                                title: 'Scaffold rank',
                                dataIndex: 'scaffold_ranking',
                                key: 'scaffold_ranking',
                                width: 120,
                                align: 'center' as const,
                                className: 'table-center-column',
                                render: (rank: unknown) => <ScaffoldRankBadge rank={rank} />,
                              },
                              ...(rawShowFunctionalGroupColumns ? [scaffoldColumn, ...rGroupColumns] : []),
                            ];

                            return (
                              <div
                                ref={rawDataTableShellRef}
                                className="raw-data-table-shell"
                                style={{
                                  background: token.colorBgContainer,
                                  borderRadius: 12,
                                  border: `1px solid ${token.colorBorderSecondary}`,
                                  overflow: 'hidden',
                                  flex: 1,
                                  minWidth: 0,
                                  minHeight: 0,
                                }}
                              >
                                <Table
                                  ref={rawDataTableRef}
                                  className="raw-data-embodiment-table"
                                  dataSource={isRawTableDataReady ? rawPc : []}
                                  size="small"
                                  loading={isLoadingPatentDetail || rawSearchState.loading || (!isRawTableDataReady && rawPc.length > 0)}
                                  rowKey={(record: any) => record.__rowKey}
                                  scroll={rawTableScroll}
                                  columns={columns}
                                  rowClassName={(record: any) => activeCompId === String(record.id) ? 'raw-data-row-active' : ''}
                                  onRow={(record: any) => ({
                                    onClick: () => {
                                      const compKey = String(record.id);
                                      const pageArr: number[] = Array.isArray(record.page) ? record.page : [];
                                      const bboxArr: any[] = Array.isArray(record.bbox) ? record.bbox : [];
                                      const curIdx = pageIndices[compKey] ?? 0;
                                      setActiveCompId(compKey);
                                      if (pageArr.length > 0) {
                                        handleGoToPdf(pageArr[curIdx], bboxArr[curIdx]);
                                      }
                                    },
                                    style: { cursor: 'pointer' }
                                  })}
                                  pagination={rawDataTablePagination}
                                />
                              </div>
                            );
                          })()

                        ) : (
                          (() => {
                            const rawCardRows = rawSearchRows;

                            if (rawCardRows.length === 0) {
                              if (isLoadingPatentDetail || rawSearchState.loading) {
                                return <PatentDetailLoadingState description="Raw data를 불러오는 중입니다." />;
                              }
                              return shouldShowPatentDetailEmpty ? <Empty description="Raw data 데이터가 없습니다." /> : null;
                            }

                            return (
                              <div className="patent-analysis-card-view">
                                <div className="patent-analysis-fixed-card-list">
                                  {rawCardRows.map((comp: any) => {
                                    const compKey = String(comp.id);
                                    const pageArr: number[] = Array.isArray(comp.page) ? comp.page : [];
                                    const bboxArr: any[] = Array.isArray(comp.bbox) ? comp.bbox : [];
                                    const curIdx = pageIndices[compKey] ?? 0;
                                    return (
                                      <div className="patent-analysis-fixed-card-item" key={comp.__rowKey}>
                                        <DataCardItem
                                          title={formatPatentExampleNumber(comp.example_number)}
                                          tags={comp.ranking ? [{ label: `Rank ${comp.ranking}`, color: 'blue' }] : []}
                                          cornerIcon={
                                            comp.is_human_key_compound ? (
                                              <span style={{ fontSize: 15, cursor: 'pointer' }} title="Key compound">🔑</span>
                                            ) : undefined
                                          }
                                          imageUrl={comp.compound_svg}
                                          imageType="svg"
                                          imageHeight={130}
                                          squareImage
                                          transparentImageBackground
                                          isActive={activeCompId === compKey}
                                          onClick={() => {
                                            setActiveCompId(compKey);
                                            if (pageArr.length > 0) handleGoToPdf(pageArr[curIdx], bboxArr[curIdx]);
                                          }}
                                          onPreview={() => openSvgPreview(comp.compound_svg, comp.compound_id, {
                                            smiles: comp.smiles,
                                            molblock: comp.molblock,
                                          })}
                                          smiles={comp.smiles}
                                          molblock={comp.molblock}
                                          linkedImageCopy={getPatentDetailStructureLinkedImageCopy(
                                            comp.compound_id,
                                            `rawCompound:${comp.compound_id}`,
                                          )}
                                          pagination={
                                            pageArr.length > 0
                                              ? {
                                                  currentIndex: curIdx,
                                                  totalCount: pageArr.length,
                                                  onPrev: () => handlePageChange(compKey, -1, pageArr, bboxArr),
                                                  onNext: () => handlePageChange(compKey, 1, pageArr, bboxArr),
                                                }
                                              : undefined
                                          }
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                                <Pagination
                                  className="v-common-pagination"
                                  size="small"
                                  current={rawTableCurrentPage}
                                  pageSize={rawTablePageSize}
                                  total={rawSearchState.totalCount}
                                  showSizeChanger
                                  pageSizeOptions={RAW_DATA_PAGE_SIZE_OPTIONS}
                                  itemRender={paginationItemRender}
                                  onChange={(page, pageSize) => {
                                    setRawTableCurrentPage(page);
                                    setRawTablePageSize(pageSize);
                                  }}
                                />
                              </div>
                            );
                          })()
                        )}
                      </div>
                    ) : null
                  },
                  {
                    key: 'clean-data',
                    label: (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Activity size={16} /> Clean data
                      </span>
                    ),
                    children: activeTab === 'clean-data' ? (
                      <div
                        ref={cleanDataTabContentRef}
                        className="raw-data-tab-content"
                        style={{
                          padding: '24px 24px 16px',
                          flex: 1,
                          height: '100%',
                          minHeight: 0,
                          boxSizing: 'border-box',
                          display: 'flex',
                          flexDirection: 'column',
                          overflowY: cleanDataView === 'table' ? 'hidden' : 'auto',
                        }}
                      >
                        <div className="patent-analysis-tab-heading-row" style={{ justifyContent: 'space-between' }}>
                          <div className="patent-data-heading-controls">
                            <Title level={5} style={{ margin: 0 }}>Clean data 화합물 목록</Title>
                            <PatentScaffoldFilterControls
                              ranks={cleanScaffoldRanks}
                              value={cleanScaffoldRankFilter}
                              onChange={(value) => {
                                setCleanScaffoldRankFilter(value);
                                setCleanDataFilter((current) => ({
                                  ...current,
                                  scaffoldRanking: value === 'all' ? undefined : value,
                                }));
                              }}
                            />
                            {cleanDataView === 'table' && (
                              <Button
                                size="small"
                                type={cleanShowFunctionalGroupColumns ? 'primary' : 'default'}
                                className={`patent-functional-group-toggle${cleanShowFunctionalGroupColumns ? ' is-active' : ''}`}
                                onClick={() => setCleanShowFunctionalGroupColumns((current) => !current)}
                                aria-pressed={cleanShowFunctionalGroupColumns}
                              >
                                작용기 {cleanShowFunctionalGroupColumns ? 'On' : 'Off'}
                              </Button>
                            )}
                          </div>
                          <Space>
                            <div
                              className="patent-analysis-view-toggle"
                              style={{
                                background: token.colorBgLayout,
                                border: `1px solid ${token.colorBorderSecondary}`
                              }}
                            >
                              <Button
                                className="patent-analysis-view-toggle-button"
                                type="text"
                                size="small"
                                icon={<TableIcon size={14} />}
                                onClick={() => setCleanDataView('table')}
                                style={{
                                  background: cleanDataView === 'table' ? token.colorPrimaryBg : 'transparent',
                                  border: `1px solid ${cleanDataView === 'table' ? token.colorPrimary : 'transparent'}`,
                                  color: cleanDataView === 'table' ? token.colorPrimary : token.colorTextSecondary,
                                  fontWeight: cleanDataView === 'table' ? 600 : 500
                                }}
                              >
                                Table
                              </Button>
                              <Button
                                className="patent-analysis-view-toggle-button"
                                type="text"
                                size="small"
                                icon={<LayoutGrid size={14} />}
                                onClick={() => setCleanDataView('card')}
                                style={{
                                  background: cleanDataView === 'card' ? token.colorPrimaryBg : 'transparent',
                                  border: `1px solid ${cleanDataView === 'card' ? token.colorPrimary : 'transparent'}`,
                                  color: cleanDataView === 'card' ? token.colorPrimary : token.colorTextSecondary,
                                  fontWeight: cleanDataView === 'card' ? 600 : 500
                                }}
                              >
                                Card
                              </Button>
                            </div>
                            <Badge count={cleanAppliedFilterCount} size="small">
                              <Button size="small" type="primary" onClick={() => setCleanFilterOpen(true)}>
                                Filter
                              </Button>
                            </Badge>
                            <Tooltip
                              title={cleanAppliedFilterCount > 0
                                ? '현재 Filter와 관계없이 전체 Clean data를 다운로드합니다.'
                                : undefined}
                            >
                              <Button
                                size="small"
                                icon={<Download size={14} />}
                                loading={downloadingExcelType === 'modified_bioactivity'}
                                disabled={cleanDataExcelRowCount === 0 || downloadingExcelType !== null}
                                title={cleanDataExcelRowCount === 0 ? '다운로드할 Clean data가 없습니다.' : undefined}
                                onClick={() => void handleEmbodimentsExcelDownload('modified_bioactivity')}
                              >
                                Excel
                              </Button>
                            </Tooltip>
                            <Button
                              size="small"
                              type="default"
                              icon={<Sparkles size={14} />}
                              loading={cleanDataRequestLoading}
                              onClick={() => setCleanDataRequestOpen(true)}
                            >
                              Clean data 요청
                            </Button>
                          </Space>
                        </div>
                        {cleanSearchState.error && (
                          <Alert
                            type="error"
                            showIcon
                            message="Clean data Filter 요청에 실패했습니다."
                            description={cleanSearchState.error}
                            action={(
                              <Button size="small" onClick={() => setCleanSearchRevision((value) => value + 1)}>
                                재시도
                              </Button>
                            )}
                            style={{ marginBottom: 12 }}
                          />
                        )}
                        {cleanDataView === 'table' ? (
                          (() => {
                            const modifiedBioKeys: string[] = (patentResult.data?.[0]?.modified_bioactivity_list ?? []) as string[];
                            const cleanRows = cleanSearchRows;

                            const allRGroupKeys = Array.from(
                              new Set(cleanRows.flatMap((c: any) => Object.keys(c.r_groups ?? {})))
                            ).sort((a, b) => {
                              const numA = parseInt((a.match(/\d+/) || ['0'])[0], 10);
                              const numB = parseInt((b.match(/\d+/) || ['0'])[0], 10);
                              return numA - numB;
                            });

                            const rGroupColumns = allRGroupKeys.map((key) => ({
                              title: key,
                              key: `clean_rg_${key}`,
                              width: 210,
                              className: 'table-center-column raw-data-rgroup-column',
                              align: 'center' as const,
                              render: (_: any, record: any) => {
                                const smiles = record.r_groups?.[key];
                                const faRGroups = frequencyAnalysis?.r_groups ?? {};
                                const variants: any[] = faRGroups[key] ?? [];
                                const match = variants.find((v: any) => v.smiles === smiles);
                                const svg = match?._svg || '';
                                return (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <div
                                      className="raw-data-svg-frame raw-data-rgroup-svg-frame"
                                      style={{ width: PATENT_DATA_STRUCTURE_SIZE, height: PATENT_DATA_STRUCTURE_SIZE, background: 'transparent', border: 0, borderRadius: 6, position: 'relative', cursor: svg ? 'pointer' : 'default', overflow: 'hidden', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      {svg ? (
                                        renderPatentStructureView({
                                          svg,
                                          title: `${key}: ${smiles}`,
                                          smiles,
                                          height: '100%',
                                          iconSize: 11,
                                          onClick: () => openSvgPreview(svg, `${key}: ${smiles}`, { smiles }),
                                        })
                                      ) : (
                                        <Text style={{ fontSize: 11, color: token.colorTextTertiary }}>no image</Text>
                                      )}
                                    </div>
                                  </div>
                                );
                              }
                            }));

                            const bioColumns = modifiedBioKeys.map((bioKey) => ({
                              title: bioKey,
                              key: `clean_bio_${bioKey}`,
                              width: 180,
                              align: 'center' as const,
                              className: 'table-center-column',
                              render: (_: any, record: any) => {
                                const value = record.modified_bioactivity?.[bioKey];
                                const arr = Array.isArray(value) ? value : value != null ? [value] : [];
                                if (arr.length === 0) return <Text type="secondary">-</Text>;
                                return (
                                  <div style={{ fontSize: 11, lineHeight: 1.4 }}>
                                    {arr.map((item: any, idx: number) => (
                                      <div key={`${bioKey}-${idx}`}>{String(item)}</div>
                                    ))}
                                  </div>
                                );
                              }
                            }));

                            const scaffoldColumn = {
                              title: 'Scaffold',
                              key: 'scaffold',
                              width: 210,
                              align: 'center' as const,
                              className: 'table-center-column raw-data-scaffold-column',
                              render: (_: any, record: any) => (
                                <div className="raw-data-scaffold-cell">
                                  <div
                                    className="raw-data-svg-frame raw-data-scaffold-svg-frame"
                                    style={{ width: PATENT_DATA_STRUCTURE_SIZE, height: PATENT_DATA_STRUCTURE_SIZE, background: 'transparent', border: 0, borderRadius: 8, cursor: record.scaffold_svg ? 'pointer' : 'default', position: 'relative', overflow: 'hidden', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  >
                                    {record.scaffold_svg ? renderPatentStructureView({
                                      svg: record.scaffold_svg,
                                      title: `Scaffold - ${record.compound_id}`,
                                      smiles: record.scaffold,
                                      height: '100%',
                                      iconSize: 11,
                                      onClick: () => openSvgPreview(record.scaffold_svg, `Scaffold - ${record.compound_id}`),
                                    }) : (
                                      <Text style={{ fontSize: 11, color: token.colorTextTertiary }}>no image</Text>
                                    )}
                                  </div>
                                </div>
                              ),
                            };

                            const columns = [
                              {
                                title: 'Pin',
                                key: 'pin',
                                width: 44,
                                align: 'center' as const,
                                className: 'table-center-column',
                                render: () => <Pin size={14} style={{ cursor: 'pointer', color: '#bfbfbf' }} />
                              },
                              {
                                title: 'Rank',
                                dataIndex: 'ranking',
                                key: 'ranking',
                                width: 76,
                                align: 'center' as const,
                                className: 'table-center-column',
                                render: (ranking: any) => (
                                  <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ fontSize: 11 }}>{ranking ?? '-'}</Text>
                                  </div>
                                )
                              },
                              {
                                title: 'Structure',
                                key: 'structure',
                                width: 234,
                                align: 'center' as const,
                                className: 'table-center-column',
                                render: (_: any, record: any) => {
                                  const compKey = `clean-${record.__rowKey ?? record.id}`;
                                  const pageArr: number[] = Array.isArray(record.page) ? record.page : [];
                                  const bboxArr: any[] = Array.isArray(record.bbox) ? record.bbox : [];
                                  const curIdx = pageIndices[compKey] ?? 0;
                                  return (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                      <div
                                        className="raw-data-svg-frame"
                                        style={{ width: PATENT_DATA_STRUCTURE_SIZE, height: PATENT_DATA_STRUCTURE_SIZE, background: 'transparent', border: 0, borderRadius: 8, position: 'relative', cursor: 'pointer', overflow: 'hidden', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                      >
                                        {renderPatentStructureView({
                                          svg: record.compound_svg,
                                          title: `Compound ${record.compound_id}`,
                                          smiles: record.smiles,
                                          molblock: record.molblock,
                                          height: '100%',
                                          iconSize: 11,
                                          onClick: () => { setActiveCompId(compKey); handleGoToPdf(pageArr[curIdx], bboxArr[curIdx]); },
                                        })}
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Button size="small" type="text" icon={<ChevronLeft size={12} />}
                                          onClick={(event) => { event.stopPropagation(); handlePageChange(compKey, -1, pageArr, bboxArr); }} />
                                        <Text style={{ fontSize: 10 }}>
                                          {curIdx + 1} / {pageArr.length}
                                        </Text>
                                        <Button size="small" type="text" style={{ transform: 'scaleX(-1)' }} icon={<ChevronLeft size={12} />}
                                          onClick={(event) => { event.stopPropagation(); handlePageChange(compKey, 1, pageArr, bboxArr); }} />
                                      </div>
                                    </div>
                                  );
                                }
                              },
                              {
                                title: 'Example no.',
                                key: 'example_number',
                                width: 132,
                                align: 'center' as const,
                                className: 'table-center-column',
                                render: (_: any, record: any) => formatPatentExampleNumber(record.example_number),
                              },
                              {
                                title: 'Scaffold rank',
                                dataIndex: 'scaffold_ranking',
                                key: 'scaffold_ranking',
                                width: 118,
                                align: 'center' as const,
                                className: 'table-center-column',
                                render: (rank: unknown) => <ScaffoldRankBadge rank={rank} />,
                              },
                              ...(cleanShowFunctionalGroupColumns ? [scaffoldColumn, ...rGroupColumns] : []),
                              ...bioColumns,
                              {
                                title: '관리',
                                key: 'manage',
                                width: 72,
                                align: 'center' as const,
                                className: 'table-center-column',
                                render: () => (
                                  <Button type="link" size="small" style={{ padding: 0 }}>
                                    수정
                                  </Button>
                                )
                              }
                            ];

                            if (cleanRows.length === 0) {
                              if (isLoadingPatentDetail || cleanSearchState.loading) {
                                return <PatentDetailLoadingState description="Clean data를 불러오는 중입니다." />;
                              }
                              return shouldShowPatentDetailEmpty ? cleanDataEmptyState : null;
                            }

                            return (
                              <div
                                ref={cleanDataTableShellRef}
                                className="raw-data-table-shell"
                                style={{
                                  background: token.colorBgContainer,
                                  borderRadius: 12,
                                  border: `1px solid ${token.colorBorderSecondary}`,
                                  overflow: 'hidden',
                                  flex: 1,
                                  minWidth: 0,
                                  minHeight: 0,
                                }}
                              >
                                <Table
                                  ref={cleanDataTableRef}
                                  className="raw-data-embodiment-table"
                                  dataSource={isCleanTableDataReady ? cleanRows : []}
                                  size="small"
                                  loading={isLoadingPatentDetail || cleanSearchState.loading || (!isCleanTableDataReady && cleanRows.length > 0)}
                                  rowKey={(record: any) => record.__rowKey}
                                  scroll={cleanTableScroll}
                                  columns={columns as any}
                                  rowClassName={(record: any) => activeCompId === `clean-${record.__rowKey ?? record.id}` ? 'raw-data-row-active' : ''}
                                  onRow={(record: any) => ({
                                    onClick: () => {
                                      const compKey = `clean-${record.__rowKey ?? record.id}`;
                                      const pageArr: number[] = Array.isArray(record.page) ? record.page : [];
                                      const bboxArr: any[] = Array.isArray(record.bbox) ? record.bbox : [];
                                      const curIdx = pageIndices[compKey] ?? 0;
                                      setActiveCompId(compKey);
                                      if (pageArr.length > 0) {
                                        handleGoToPdf(pageArr[curIdx], bboxArr[curIdx]);
                                      }
                                    },
                                    style: { cursor: 'pointer' }
                                  })}
                                  pagination={cleanDataTablePagination}
                                />
                              </div>
                            );
                          })()
                        ) : (
                          (() => {
                            const modifiedRows = cleanSearchRows;
                            if (modifiedRows.length === 0) {
                              if (isLoadingPatentDetail || cleanSearchState.loading) {
                                return <PatentDetailLoadingState description="Clean data를 불러오는 중입니다." />;
                              }
                              return shouldShowPatentDetailEmpty ? cleanDataEmptyState : null;
                            }

                            return (
                              <div className="patent-analysis-card-view">
                                <div className="patent-analysis-fixed-card-list">
                                  {modifiedRows.map((comp: any) => {
                                    const compKey = `clean-card-${comp.__rowKey}`;
                                    const pageArr: number[] = Array.isArray(comp.page) ? comp.page : [];
                                    const bboxArr: any[] = Array.isArray(comp.bbox) ? comp.bbox : [];
                                    const curIdx = pageIndices[compKey] ?? 0;
                                    const bioEntries = Object.entries(comp.modified_bioactivity ?? {}) as [string, any][];
                                    return (
                                      <div className="patent-analysis-fixed-card-item" key={compKey}>
                                        <DataCardItem
                                          title={formatPatentExampleNumber(comp.example_number)}
                                          tags={comp.ranking ? [{ label: `Rank ${comp.ranking}`, color: 'blue' }] : []}
                                          imageUrl={comp.compound_svg}
                                          imageType="svg"
                                          imageHeight={130}
                                          squareImage
                                          transparentImageBackground
                                          isActive={activeCompId === compKey}
                                          onClick={() => {
                                            setActiveCompId(compKey);
                                            if (pageArr.length > 0) handleGoToPdf(pageArr[curIdx], bboxArr[curIdx]);
                                          }}
                                          onPreview={() => openSvgPreview(comp.compound_svg, comp.compound_id, {
                                            smiles: comp.smiles,
                                            molblock: comp.molblock,
                                          })}
                                          smiles={comp.smiles}
                                          molblock={comp.molblock}
                                          linkedImageCopy={getPatentDetailStructureLinkedImageCopy(
                                            comp.compound_id,
                                            `cleanCompound:${comp.compound_id}`,
                                          )}
                                          extraInfo={
                                            bioEntries.length > 0 && (
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                {bioEntries.map(([k, v]) => (
                                                  <Text key={k} style={{ fontSize: 10 }} ellipsis={{ tooltip: `${k}: ${Array.isArray(v) ? v.join(', ') : String(v ?? '-')}` }}>
                                                    {k}: {Array.isArray(v) ? v.join(', ') : String(v ?? '-')}
                                                  </Text>
                                                ))}
                                              </div>
                                            )
                                          }
                                          pagination={
                                            pageArr.length > 0
                                              ? {
                                                  currentIndex: curIdx,
                                                  totalCount: pageArr.length,
                                                  onPrev: () => handlePageChange(compKey, -1, pageArr, bboxArr),
                                                  onNext: () => handlePageChange(compKey, 1, pageArr, bboxArr),
                                                }
                                              : undefined
                                          }
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                                <Pagination
                                  className="v-common-pagination"
                                  size="small"
                                  current={cleanTableCurrentPage}
                                  pageSize={cleanTablePageSize}
                                  total={cleanSearchState.totalCount}
                                  showSizeChanger
                                  pageSizeOptions={RAW_DATA_PAGE_SIZE_OPTIONS}
                                  itemRender={paginationItemRender}
                                  onChange={(page, pageSize) => {
                                    setCleanTableCurrentPage(page);
                                    setCleanTablePageSize(pageSize);
                                  }}
                                />
                              </div>
                            );
                          })()
                        )}
                      </div>
                    ) : null
                  },
                  {
                    key: 'tables',
                    label: (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <LayoutGrid size={16} /> Tables
                      </span>
                    ),
                    children: activeTab === 'tables' ? (
                        <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
                          <div className="patent-analysis-tab-heading-row">
                            <Title level={5} style={{ margin: 0 }}>Result tables</Title>
                          </div>
                          {resultTables.length === 0 ? (
                              isLoadingPatentDetail ? (
                                <PatentDetailLoadingState />
                              ) : shouldShowPatentDetailEmpty ? (
                                <Empty description="result.tables 데이터가 없습니다." />
                              ) : null
                          ) : (
                              <div className="patent-analysis-fixed-card-list">
                                {resultTables.map((tableItem: any, i: number) => {
                                  const cardKey = `table-${tableItem?.table_num ?? i}-${i}`;
                                  const base64List = Array.isArray(tableItem?.table_base64) ? tableItem.table_base64 : [];
                                  const pageArray = Array.isArray(tableItem?.page) ? tableItem.page : [];
                                  const tableCurrentIndex = pageIndices[cardKey] ?? 0;
                                  const currentImageValue = base64List[tableCurrentIndex] ?? base64List[0];
                                  const currentImage =
                                    typeof currentImageValue === 'string'
                                      ? currentImageValue.startsWith('data:')
                                        ? currentImageValue
                                        : `data:image/png;base64,${currentImageValue}`
                                      : null;
                                  
                                  return (
                                    <div className="patent-analysis-fixed-card-item" key={cardKey}>
                                      <DataCardItem
                                        title={`Table ${tableItem?.table_group ?? tableItem?.table_num ?? '?'}`}
                                        tags={[
                                          {
                                            label: tableItem?.has_compound ? 'Compound 포함' : 'Compound 없음',
                                            color: tableItem?.has_compound ? 'green' : 'default',
                                          },
                                        ]}
                                        imageUrl={currentImage || ''}
                                        imageType="base64"
                                        imageHeight={150}
                                        isActive={activeCompId === cardKey}
                                        onClick={() => handleTableCardClick(tableItem, i)}
                                        onPreview={
                                          currentImage
                                            ? () => openImagePreview(currentImage, `Table ${tableItem?.table_num ?? '?'}`)
                                            : undefined
                                        }
                                        imageOverlayActions={
                                          <Tooltip title="현재 테이블 정보를 클립보드에 복사">
                                            <Button
                                              className="svg-action-btn"
                                              size="small"
                                              type="text"
                                              icon={<Copy size={12} />}
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                handleCopyTableInfo(tableItem, tableCurrentIndex);
                                              }}
                                              style={{ background: 'rgba(255,255,255,0.85)' }}
                                            />
                                          </Tooltip>
                                        }
                                        extraInfo={
                                          <div>
                                            <Tooltip title={pageArray.length > 0 ? `Pages: ${pageArray.join(', ')}` : undefined}>
                                              <Text className="patent-table-pages-list" style={{ fontSize: 11 }}>
                                                Pages: {pageArray.length > 0 ? pageArray.join(', ') : '-'}
                                              </Text>
                                            </Tooltip>
                                          </div>
                                        }
                                        pagination={
                                          pageArray.length > 0
                                            ? {
                                                currentIndex: tableCurrentIndex,
                                                totalCount: pageArray.length,
                                                onPrev: () => handleTablePageChange(tableItem, i, -1),
                                                onNext: () => handleTablePageChange(tableItem, i, 1),
                                              }
                                            : undefined
                                        }
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                          )}
                        </div>
                    ) : null
                  }
                ]}
              />
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .patent-pdf-main-viewer .pdfViewer .page {
          position: relative !important;
          margin: 1px auto 10px auto !important;
          display: block !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        .patent-pdf-main-viewer .pdfViewer .page .canvasWrapper,
        .patent-pdf-main-viewer .pdfViewer .page .textLayer,
        .patent-pdf-main-viewer .pdfViewer .page .Highlight__container,
        .patent-pdf-main-viewer .pdfViewer .page .PdfHighlighter__highlight-layer,
        .patent-pdf-main-viewer .pdfViewer .page .annotationLayer {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
        }
        .patent-pdf-main-viewer .pdfViewer .page .canvasWrapper {
          z-index: 1 !important;
        }
        .patent-pdf-main-viewer .pdfViewer .page .textLayer {
          z-index: 2 !important;
          opacity: 1 !important;
          mix-blend-mode: multiply;
        }
        .patent-pdf-main-viewer .pdfViewer .page .textLayer > span,
        .patent-pdf-main-viewer .pdfViewer .page .textLayer > div {
          position: absolute !important;
          white-space: pre !important;
          cursor: text !important;
          transform-origin: 0% 0% !important;
          color: transparent !important;
        }
        .patent-pdf-main-viewer .pdfViewer .page .Highlight__container,
        .patent-pdf-main-viewer .pdfViewer .page .PdfHighlighter__highlight-layer {
          z-index: 3 !important;
          pointer-events: none;
        }
        .patent-pdf-main-viewer .pdfViewer .page .annotationLayer {
          z-index: 4 !important;
        }
        .TextHighlight__part {
          background-color: rgba(var(--brand-primary-rgb), 0.3) !important;
          border-radius: 4px;
        }
        .Highlight__part {
          background-color: rgba(var(--brand-primary-rgb), 0.3);
        }
        .active_compound_highlight .TextHighlight__part {
          background-color: rgba(255, 0, 0, 0.2) !important;
          border: 3px solid red !important;
          border-radius: 0 !important;
        }
        .patent-pdf-main-viewer .pdfViewer .page::after {
          content: "";
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 0px; /* 하단 잘림 방지: 가림 제거 */
          background-color: white;
          z-index: 5;
          pointer-events: none;
        }
        .textLayer {
          overflow: hidden !important;
          width: 100% !important;
          max-width: 100% !important;
          opacity: 1 !important;
        }
        .textLayer span,
        .textLayer br {
          color: transparent;
        }
        .textLayer .highlight.end,
        .textLayer .highlight:not(.begin):not(.middle):not(.selected) {
          padding-right: 8px;
        }
        .patent-pdf-main-viewer .pdfViewer {
          overflow-x: hidden !important;
          padding-bottom: 0 !important;
        }
        .patent-pdf-main-viewer .pdfViewer .page {
          overflow: hidden !important;
          margin-bottom: 10px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .react-pdf-highlighter__pdf-container {
          overflow: hidden !important;
        }
        .cdd-clipboard-icon-container, .CDW_Logo, .cdd-logo { display: none !important; }
        .patent-analysis-detail-tabs > .ant-tabs-nav {
          min-height: 50px;
          padding: 6px 24px;
          box-sizing: border-box;
        }
        .patent-analysis-detail-tabs > .ant-tabs-nav .ant-tabs-extra-content {
          display: flex;
          align-items: center;
          padding-left: 12px;
        }
        .patent-analysis-tab-favorite {
          white-space: nowrap;
        }
        .patent-analysis-detail-tabs > .ant-tabs-nav .ant-tabs-nav-wrap,
        .patent-analysis-detail-tabs > .ant-tabs-nav .ant-tabs-nav-list {
          min-height: 36px;
          align-items: center;
        }
        .patent-analysis-detail-tabs > .ant-tabs-nav .ant-tabs-nav-list {
          gap: 6px;
        }
        .patent-analysis-detail-tabs > .ant-tabs-nav .ant-tabs-tab {
          height: 36px;
          min-height: 36px;
          margin: 0 !important;
          padding: 0 14px !important;
          border: 1px solid transparent;
          border-radius: 10px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          transition:
            color 0.2s ease,
            border-color 0.2s ease,
            background-color 0.2s ease;
        }
        .patent-analysis-detail-tabs > .ant-tabs-nav .ant-tabs-tab-btn,
        .patent-analysis-detail-tabs > .ant-tabs-nav .ant-tabs-tab-btn > span {
          height: 100%;
          display: flex;
          align-items: center;
        }
        .patent-analysis-detail-tabs > .ant-tabs-nav .ant-tabs-tab:hover {
          border-color: ${token.colorBorder};
          background: ${token.colorFillTertiary};
        }
        .patent-analysis-detail-tabs > .ant-tabs-nav .ant-tabs-tab-active {
          border-color: ${token.colorPrimary};
          background: ${token.colorPrimaryBg};
        }
        .patent-analysis-detail-tabs > .ant-tabs-nav .ant-tabs-ink-bar {
          display: none;
        }
        .patent-analysis-view-toggle {
          height: 34px;
          padding: 2px;
          border-radius: 10px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .patent-analysis-view-toggle .patent-analysis-view-toggle-button {
          width: 72px;
          min-width: 72px;
          height: 28px;
          min-height: 28px;
          padding: 0 10px;
          border-radius: 7px !important;
          box-sizing: border-box;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .patent-analysis-tab-heading-row {
          min-height: 34px;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px 16px;
        }
        .patent-data-heading-controls {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }
        .patent-scaffold-filter-controls {
          margin-left: 8px;
          display: inline-flex;
          align-items: center;
          flex-wrap: nowrap;
          height: 28px;
          padding: 3px 6px;
          border: 1px solid ${token.colorBorderSecondary};
          border-radius: 6px;
          background: ${token.colorBgLayout};
          box-sizing: border-box;
        }
        .patent-scaffold-filter-controls > .ant-space-item {
          height: 100%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .patent-scaffold-filter-label.ant-typography {
          margin-right: 15px;
          margin-bottom: 0;
          min-width: auto;
          height: 100%;
          display: inline-flex;
          align-items: center;
          color: ${token.colorText};
          font-size: 11px;
          font-weight: 700;
          line-height: 1;
          letter-spacing: 0.02em;
          white-space: nowrap;
          user-select: none;
        }
        .patent-scaffold-all-button,
        .patent-functional-group-toggle {
          height: 26px;
          min-height: 26px;
          padding: 0 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          line-height: 24px;
          box-shadow: none;
        }
        .patent-scaffold-all-button {
          min-width: 42px;
        }
        .patent-scaffold-filter-controls .patent-scaffold-all-button {
          height: 22px;
          min-height: 22px;
          padding-inline: 8px;
          font-size: 11px;
          line-height: 20px;
        }
        .patent-scaffold-all-button.ant-btn-primary,
        .patent-scaffold-all-button.ant-btn-primary:hover,
        .patent-scaffold-all-button.ant-btn-primary:focus-visible {
          background: ${token.colorInfo} !important;
          border-color: ${token.colorInfo} !important;
          color: #FFFFFF !important;
        }
        .patent-functional-group-toggle {
          min-width: 76px;
        }
        .patent-scaffold-all-button:not(.ant-btn-primary),
        .patent-functional-group-toggle:not(.is-active) {
          background: ${token.colorBgContainer};
          border-color: ${token.colorBorder};
          color: ${token.colorTextSecondary};
        }
        .patent-scaffold-rank-button {
          width: 18px;
          min-width: 18px;
          height: 18px;
          margin: 0;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          align-self: center;
          appearance: none;
          -webkit-appearance: none;
          border: 0;
          border-radius: 50%;
          box-shadow: none;
          box-sizing: border-box;
          font: inherit;
          font-size: 9px;
          font-weight: 700;
          line-height: 18px;
          text-align: center;
          vertical-align: middle;
          cursor: pointer;
          transition: background-color 0.16s ease, color 0.16s ease, transform 0.16s ease;
        }
        .patent-scaffold-rank-button:hover {
          transform: translateY(-1px);
        }
        .patent-scaffold-rank-button:focus-visible {
          outline: 2px solid ${token.colorPrimary};
          outline-offset: 2px;
        }
        .patent-key-compound-header {
          min-height: 24px;
          margin-bottom: 8px;
          padding: 6px 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          border-radius: 8px 8px 4px 4px;
          transition: background-color 0.16s ease;
        }
        .patent-summary-tab-content .patent-data-card-item-sar-header {
          position: relative;
          border-color: transparent !important;
          box-shadow: none !important;
          transform: none !important;
        }
        .patent-summary-tab-content .patent-data-card-item-sar-header::after {
          content: '';
          position: absolute;
          inset: 1px;
          z-index: 10;
          pointer-events: none;
          border: 1px solid transparent;
          border-radius: inherit;
          box-sizing: border-box;
        }
        .patent-summary-tab-content .patent-data-card-item-sar-header:hover {
          border-color: transparent !important;
          box-shadow: none !important;
          transform: none !important;
        }
        .patent-summary-tab-content .patent-data-card-item-sar-header:hover::after {
          border-color: ${token.colorBorder};
        }
        .patent-summary-tab-content .patent-data-card-item-sar-header:hover .patent-key-compound-header {
          background: ${token.colorFillTertiary};
        }
        .patent-summary-tab-content .patent-data-card-item-sar-header.is-active::after,
        .patent-summary-tab-content .patent-data-card-item-sar-header.is-active:hover::after {
          border-color: ${token.colorPrimary};
        }
        .patent-summary-tab-content .patent-data-card-item-sar-header.is-active .patent-key-compound-header,
        .patent-summary-tab-content .patent-data-card-item-sar-header.is-active:hover .patent-key-compound-header {
          background: ${token.colorPrimaryBg};
        }
        .patent-analysis-fixed-card-list {
          min-width: 0;
          display: flex;
          align-items: flex-start;
          align-content: flex-start;
          flex-wrap: wrap;
          gap: 16px;
          overflow-x: auto;
          padding-bottom: 8px;
        }
        .patent-analysis-fixed-card-item {
          width: 260px;
          min-width: 260px;
          max-width: 260px;
          flex: 0 0 260px;
        }
        .patent-analysis-fixed-card-item > .ant-card {
          width: 100%;
        }
        .ant-tabs-content-holder {
          flex: 1;
          min-height: 0;
          min-width: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .ant-tabs-content {
          height: 100%;
          min-height: 0;
          min-width: 0;
        }
        .ant-tabs-tabpane {
          height: 100%;
          min-height: 0;
          min-width: 0;
          overflow-y: auto;
          overflow-x: hidden;
        }
        .raw-data-tab-content .raw-data-svg-frame svg {
          max-width: 100% !important;
          max-height: 100% !important;
          width: 100% !important;
          height: 100% !important;
          display: block;
        }
        .patent-analysis-detail-page .raw-data-svg-frame,
        .patent-analysis-detail-page .compound-structure-view,
        .patent-analysis-detail-page .compound-structure-frame,
        .patent-analysis-detail-page .compound-structure-svg {
          background: transparent !important;
          background-color: transparent !important;
        }
        .raw-data-tab-content .svg-renderer-frame {
          padding: 0 !important;
          border: 0 !important;
          outline: 0 !important;
          box-shadow: none !important;
          background: transparent !important;
          line-height: 0 !important;
        }
        .raw-data-tab-content .svg-renderer-frame svg,
        .raw-data-tab-content .compound-structure-svg svg {
          max-width: 100% !important;
          max-height: 100% !important;
          width: 100% !important;
          height: 100% !important;
          display: block;
          transform: scale(1.14);
          transform-origin: center;
        }
        .raw-data-tab-content .patent-summary-structure-frame .compound-structure-svg svg {
          width: auto !important;
          height: auto !important;
          max-width: 90% !important;
          max-height: 90% !important;
          overflow: hidden !important;
          transform: none !important;
        }
        .patent-summary-tab-content .patent-summary-card > .ant-card-body {
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
          overflow: hidden !important;
        }
        .patent-summary-tab-content .patent-summary-scaffold-ranking-card > .ant-card-body {
          overflow: hidden !important;
          padding-bottom: 16px;
        }
        .patent-summary-tab-content .patent-summary-scaffold-scroll {
          display: flex;
          flex-wrap: nowrap;
          gap: 16px;
          width: 100%;
          overflow-x: auto;
          padding: 2px 2px 12px;
        }
        .patent-summary-tab-content .patent-summary-scaffold-item {
          flex: 0 0 260px;
          width: 260px;
        }
        .patent-summary-tab-content .patent-summary-scaffold-tile {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 10px;
          border: 1px solid transparent;
          border-radius: 12px;
          background: transparent;
          color: inherit;
          text-align: left;
          box-sizing: border-box;
        }
        .patent-summary-tab-content .patent-summary-parent-scaffold {
          border-color: ${token.colorBorderSecondary};
        }
        .patent-summary-tab-content .patent-summary-scaffold-tile-header {
          min-height: 28px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .patent-summary-tab-content .patent-summary-rank-label {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .patent-summary-tab-content .patent-summary-structure-card > .ant-card-body {
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
          overflow: hidden !important;
        }
        .patent-summary-tab-content .patent-summary-structure-frame {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          border: 0 !important;
          overflow: hidden !important;
          width: 100%;
          aspect-ratio: 1 / 1;
          border-radius: 8px;
          position: relative;
          background: transparent !important;
        }
        .patent-summary-tab-content .patent-functional-scaffold-frame {
          border: 1px solid ${token.colorBorderSecondary} !important;
        }
        .patent-summary-tab-content .patent-rgroup-variant-item {
          width: 152px;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 3px;
        }
        .patent-summary-tab-content .patent-functional-group-section {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid ${token.colorBorderSecondary};
        }
        .patent-summary-tab-content .patent-functional-group-title {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
        }
        .patent-summary-tab-content .patent-functional-group-list {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .patent-summary-tab-content .patent-rgroup-variant-card {
          width: 152px !important;
          height: 152px !important;
          overflow: hidden !important;
        }
        .patent-summary-tab-content .patent-rgroup-variant-card > .ant-card-body {
          width: 100% !important;
          height: 100% !important;
          padding: 4px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        .patent-summary-tab-content .patent-functional-rgroup-frame {
          width: 100% !important;
          height: 100% !important;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 6px !important;
          background: transparent !important;
          position: relative !important;
          overflow: hidden !important;
        }
        .patent-summary-tab-content .patent-functional-rgroup-frame .compound-structure-view,
        .patent-summary-tab-content .patent-functional-rgroup-frame .compound-structure-frame,
        .patent-summary-tab-content .patent-functional-rgroup-frame .compound-structure-svg {
          width: 100% !important;
          height: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        .patent-summary-tab-content .patent-functional-rgroup-frame .compound-structure-svg svg {
          width: auto !important;
          height: auto !important;
          max-width: 100% !important;
          max-height: 100% !important;
          transform: none !important;
        }
        .patent-summary-tab-content .patent-rgroup-frequency-button {
          width: 100%;
          height: 18px;
          padding: 0 !important;
          font-size: 11px;
          line-height: 18px;
          text-align: center;
        }
        .patent-summary-tab-content .patent-summary-structure-frame .compound-structure-view,
        .patent-summary-tab-content .patent-summary-structure-frame .compound-structure-frame,
        .patent-summary-tab-content .patent-summary-structure-frame .compound-structure-svg {
          width: 100% !important;
          height: 100% !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        .raw-data-tab-content .patent-summary-structure-frame .compound-structure-svg,
        .raw-data-tab-content .patent-summary-structure-frame .compound-structure-frame {
          overflow: hidden !important;
        }
        .raw-data-tab-content .raw-data-svg-frame {
          padding: 0 !important;
          border: 0 !important;
          line-height: 0 !important;
          aspect-ratio: 1 / 1;
          align-items: center !important;
          justify-content: center !important;
          overflow: hidden !important;
        }
        .raw-data-tab-content .raw-data-svg-frame .compound-structure-view,
        .raw-data-tab-content .raw-data-svg-frame .compound-structure-frame,
        .raw-data-tab-content .raw-data-svg-frame .compound-structure-svg {
          width: 100% !important;
          height: 100% !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          overflow: hidden !important;
        }
        .raw-data-tab-content .raw-data-svg-frame .compound-structure-svg svg {
          width: auto !important;
          height: auto !important;
          max-width: 97% !important;
          max-height: 97% !important;
          transform: none !important;
        }
        .raw-data-tab-content .patent-analysis-card-view .raw-data-svg-frame .compound-structure-svg svg {
          max-width: 100% !important;
          max-height: 100% !important;
        }
        .raw-data-tab-content .raw-data-embodiment-table .raw-data-scaffold-column {
          padding: 3px 6px !important;
          text-align: center !important;
          vertical-align: middle !important;
        }
        .raw-data-tab-content .raw-data-embodiment-table .raw-data-rgroup-column {
          padding: 3px 6px !important;
          text-align: center !important;
          vertical-align: middle !important;
        }
        .raw-data-tab-content .raw-data-scaffold-cell {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .raw-data-tab-content .raw-data-scaffold-svg-frame .compound-structure-svg svg,
        .raw-data-tab-content .raw-data-rgroup-svg-frame .compound-structure-svg svg {
          max-width: 100% !important;
          max-height: 100% !important;
        }
        .raw-data-tab-content .compound-structure-view,
        .raw-data-tab-content .compound-structure-frame,
        .raw-data-tab-content .compound-structure-svg {
          line-height: 0 !important;
        }
        .raw-data-tab-content .compound-structure-frame {
          border: 0 !important;
          outline: 0 !important;
          box-shadow: none !important;
          background: transparent !important;
        }
        .raw-data-tab-content .compound-structure-actions-overlay {
          top: auto;
          right: 4px;
          bottom: 4px;
        }
        .raw-data-tab-content .raw-data-embodiment-table .ant-table {
          background: transparent;
        }
        .raw-data-tab-content .raw-data-embodiment-table .ant-table-body {
          overflow-x: auto !important;
          overflow-y: auto !important;
          overscroll-behavior: contain;
        }
        .raw-data-tab-content .raw-data-embodiment-table .ant-table-thead > tr > th,
        .raw-data-tab-content .raw-data-embodiment-table .ant-table-tbody > tr > td {
          text-align: center;
        }
        .raw-data-tab-content .raw-data-embodiment-table .ant-table-tbody > tr > td {
          vertical-align: middle;
          padding: 3px 8px;
          transition: background-color 0.2s ease;
        }
        .raw-data-tab-content .raw-data-embodiment-table .ant-table-tbody > tr > td:not(.ant-table-cell-fix-left):not(.ant-table-cell-fix-left-last) {
          position: static;
          z-index: auto;
        }
        .raw-data-tab-content .raw-data-embodiment-table .ant-table-cell-fix-left,
        .raw-data-tab-content .raw-data-embodiment-table .ant-table-cell-fix-left-last {
          position: sticky !important;
          background: ${token.colorBgContainer} !important;
          background-color: ${token.colorBgContainer} !important;
          background-clip: padding-box !important;
          isolation: isolate;
          z-index: 40 !important;
        }
        .raw-data-tab-content .raw-data-embodiment-table .ant-table-thead .ant-table-cell-fix-left,
        .raw-data-tab-content .raw-data-embodiment-table .ant-table-thead .ant-table-cell-fix-left-last {
          position: sticky !important;
          background: ${token.colorBgContainer} !important;
          background-color: ${token.colorBgContainer} !important;
          background-clip: padding-box !important;
          z-index: 60 !important;
        }
        .raw-data-tab-content .raw-data-embodiment-table .ant-table-thead .ant-table-cell-fix-left-last,
        .raw-data-tab-content .raw-data-embodiment-table .ant-table-tbody .ant-table-cell-fix-left-last {
          box-shadow: 1px 0 0 ${token.colorBorderSecondary}, 8px 0 12px -12px rgba(15, 23, 42, 0.45) !important;
        }
        .raw-data-tab-content .raw-data-embodiment-table .ant-table-cell-fix-left::before,
        .raw-data-tab-content .raw-data-embodiment-table .ant-table-cell-fix-left-last::before {
          content: '';
          position: absolute;
          inset: 0;
          background: inherit;
          pointer-events: none;
          z-index: -1;
        }
        .raw-data-tab-content .raw-data-embodiment-table .raw-data-row-active > td {
          background: var(--table-row-selected-bg) !important;
        }
        .raw-data-tab-content .raw-data-embodiment-table .ant-table-row:hover > td {
          background: var(--table-row-hover-bg) !important;
        }
        .raw-data-tab-content .raw-data-embodiment-table .raw-data-row-active:hover > td {
          background: var(--table-row-selected-hover-bg) !important;
        }
        .raw-data-tab-content .raw-data-embodiment-table .raw-data-row-active > .ant-table-cell-fix-left,
        .raw-data-tab-content .raw-data-embodiment-table .raw-data-row-active > .ant-table-cell-fix-left-last {
          background: color-mix(in srgb, ${token.colorPrimary} 14%, ${token.colorBgContainer}) !important;
          background-color: color-mix(in srgb, ${token.colorPrimary} 14%, ${token.colorBgContainer}) !important;
          background-clip: padding-box !important;
          z-index: 45 !important;
        }
        .raw-data-tab-content .raw-data-embodiment-table .ant-table-row:hover > .ant-table-cell-fix-left,
        .raw-data-tab-content .raw-data-embodiment-table .ant-table-row:hover > .ant-table-cell-fix-left-last {
          background: color-mix(in srgb, ${token.colorPrimary} 12%, ${token.colorBgContainer}) !important;
          background-color: color-mix(in srgb, ${token.colorPrimary} 12%, ${token.colorBgContainer}) !important;
          background-clip: padding-box !important;
          z-index: 45 !important;
        }
        .raw-data-tab-content .raw-data-embodiment-table .raw-data-row-active:hover > .ant-table-cell-fix-left,
        .raw-data-tab-content .raw-data-embodiment-table .raw-data-row-active:hover > .ant-table-cell-fix-left-last {
          background: color-mix(in srgb, ${token.colorPrimary} 22%, ${token.colorBgContainer}) !important;
          background-color: color-mix(in srgb, ${token.colorPrimary} 22%, ${token.colorBgContainer}) !important;
          background-clip: padding-box !important;
          z-index: 46 !important;
        }
        .patent-table-pages-list {
          display: -webkit-box;
          max-height: 32px;
          overflow: hidden;
          line-height: 16px;
          overflow-wrap: anywhere;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }
        .patent-structure-preview .svg-renderer-frame svg {
          max-width: calc(100% / 1.5) !important;
          max-height: calc(100% / 1.5) !important;
          width: auto;
          height: auto;
          transform: scale(1.5);
          transform-origin: center;
        }
      `}</style>

      <PatentAnalysisDataFilter
        open={rawFilterOpen}
        dataset="raw"
        initialValue={rawDataFilter}
        bioactivityOptions={rawBioactivityOptions}
        scaffoldRanks={rawScaffoldRanks}
        onCancel={() => setRawFilterOpen(false)}
        onApply={(value) => {
          setRawDataFilter(value);
          setRawScaffoldRankFilter(value.scaffoldRanking ?? 'all');
          setRawTableCurrentPage(1);
          setRawFilterOpen(false);
        }}
      />

      <PatentAnalysisDataFilter
        open={cleanFilterOpen}
        dataset="clean"
        initialValue={cleanDataFilter}
        bioactivityOptions={cleanBioactivityOptions}
        scaffoldRanks={cleanScaffoldRanks}
        onCancel={() => setCleanFilterOpen(false)}
        onApply={(value) => {
          setCleanDataFilter(value);
          setCleanScaffoldRankFilter(value.scaffoldRanking ?? 'all');
          setCleanTableCurrentPage(1);
          setCleanFilterOpen(false);
        }}
      />

      <CleanDataRequestModal
        open={cleanDataRequestOpen}
        loading={cleanDataRequestLoading}
        onCancel={() => {
          if (!cleanDataRequestLoading) setCleanDataRequestOpen(false);
        }}
        onSubmit={(quality) => void handleCleanDataRequest(quality)}
      />

      <StructurePreviewModal
        title={previewTitle}
        open={!!previewSvg}
        onCancel={() => {
          setPreviewSvg(null);
          setPreviewStructureMeta(null);
        }}
        svg={previewSvg}
        smiles={previewStructureMeta?.smiles}
        molblock={previewStructureMeta?.molblock}
        cdxml={previewStructureMeta?.cdxml}
        enableLigand3d={false}
        className="patent-structure-preview"
        extraActions={canOpenPreviewChemDraw ? [{
          key: 'chemdraw',
          title: 'ChemDraw',
          icon: <BenzeneIcon size={14} />,
          onClick: handlePreviewOpenChemDraw,
        }] : []}
      />

      <Modal
        title={previewTitle}
        open={!!previewImageSrc}
        onCancel={() => {
          setPreviewImageSrc(null);
        }}
        footer={null}
        width="min(1200px, calc(100vw - 48px))"
        centered
      >
        {previewImageSrc ? (
          <div style={{ width: '100%', height: 'min(720px, calc(100vh - 180px))', background: token.colorBgContainer, borderRadius: 8, border: `1px solid ${token.colorBorderSecondary}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
            <img src={previewImageSrc} alt="table-preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </div>
        ) : null}
      </Modal>

      {/* ChemDraw Modal */}
      <ChemDrawModal
        open={chemDrawOpen}
        initialSmiles={chemDrawSmiles}
        initialMolblock={chemDrawMolblock}
        onCancel={() => setChemDrawOpen(false)}
        onConfirm={(data) => {
          message.success(`SMILES: ${data.smiles || '(empty)'}`);
          setChemDrawOpen(false);
        }}
        title={chemDrawTitle ? `구조 편집 — ${chemDrawTitle}` : undefined}
      />
    </div>
  );
};

export default PatentAnalysisDetail;
