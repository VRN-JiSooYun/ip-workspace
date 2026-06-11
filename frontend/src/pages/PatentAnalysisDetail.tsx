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
  Badge,
  App,
  Alert,
  Pagination,
  Spin
} from 'antd';
import { 
  Plus, 
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
  Image as ImageIcon,
} from 'lucide-react';
import { Patent } from '../mocks/patents';
import { mergeEmbodimentPayload } from '../mocks/patentAnalysisMockApi';
import { getPatentAnalysisLayoutPreset } from '../config/patentAnalysisLayout';
import { useUIStore } from '../store/useUIStore';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import DataCardItem from '../components/patent-analysis/DataCardItem';
import ChemDrawModal from '../components/common/ChemDrawModal';
import BenzeneIcon from '../components/common/BenzeneIcon';
import CompoundStructureView, {
  copySvgImageToClipboard,
  getCompoundStructureCopyText,
} from '../components/common/CompoundStructureView';
import PatentPdfToolbar from '../components/patent-analysis/pdf/PatentPdfToolbar';
import PatentPdfViewer from '../components/patent-analysis/pdf/PatentPdfViewer';
import { usePatentPdfViewer } from '../hooks/usePatentPdfViewer';
import { mapPatentListItem, patentAnalysisApi } from '../services/patentAnalysisApi';
import { formatDisplayDate, formatNumberWithComma } from '../utils/displayFormat';

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
const RAW_DATA_DEFAULT_PAGE_SIZE = 30;
const RAW_DATA_PAGE_SIZE_OPTIONS = [10, 30, 50, 100];

// SVG 렌더링 컴포넌트
const SvgRenderer: React.FC<{ svg: string; height?: number | string }> = ({ svg, height = '100%' }) => (
  <div 
    className="svg-renderer-frame"
    style={{ height, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxSizing: 'border-box', padding: 0 }}
    dangerouslySetInnerHTML={{ __html: svg }}
  />
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

const getBrowserPdfUrl = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/raid/')) return null;
  if (trimmed.startsWith('/')) return trimmed;
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
    const metadata = apiPatentResult?.data?.[0];
    if (metadata) {
      return mapPatentListItem(metadata, 0);
    }
    return selectedPatent;
  }, [apiPatentResult, selectedPatent]);
  const detailMetadata = apiPatentResult?.data?.[0] ?? null;
  const browserPdfDocument = React.useMemo(() => {
    const hasApiPdfPath = Boolean(detailMetadata?.ocr_pdf_path ?? detailMetadata?.pdf_path ?? detailMetadata?.pdf_url);
    const apiPdfUrl = getBrowserPdfUrl(detailMetadata?.ocr_pdf_path)
      ?? getBrowserPdfUrl(detailMetadata?.pdf_path)
      ?? getBrowserPdfUrl(detailMetadata?.pdf_url);
    if (apiPdfUrl) {
      return apiPdfUrl;
    }
    if (hasApiPdfPath && displayedPatent?.patentNumber) {
      return patentAnalysisApi.getPatentPdfUrl(normalizePublicationNumber(displayedPatent.patentNumber));
    }
    return null;
  }, [detailMetadata, displayedPatent]);
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

  const { setHeaderContent } = useUIStore();

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

  useEffect(() => {
    if (!selectedPatent?.patentNumber) return;
    let ignore = false;

    const loadPatentDetail = async () => {
      const publicationNumber = normalizePublicationNumber(selectedPatent.patentNumber);
      setIsLoadingPatentDetail(true);
      setHasPatentDetailLoaded(false);
      setApiPatentResult(null);
      setPatentDetailError(null);
      try {
        const [detail, embodiments] = await Promise.all([
          patentAnalysisApi.getPatentDetail(publicationNumber),
          patentAnalysisApi.getEmbodiments(publicationNumber, { page: 1, pageSize: 100 }),
        ]);
        if (!ignore) {
          setApiPatentResult(mergeEmbodimentPayload(detail.raw, embodiments.raw));
        }
      } catch (error) {
        if (!ignore) {
          setApiPatentResult(null);
          setPatentDetailError(error instanceof Error ? error.message : '특허 상세 API 요청에 실패했습니다.');
        }
      } finally {
        if (!ignore) {
          setIsLoadingPatentDetail(false);
          setHasPatentDetailLoaded(true);
        }
      }
    };

    void loadPatentDetail();

    return () => {
      ignore = true;
    };
  }, [selectedPatent?.patentNumber]);

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
  const [rawCardCurrentPage, setRawCardCurrentPage] = React.useState(1);
  const [rawCardPageSize, setRawCardPageSize] = React.useState(RAW_DATA_DEFAULT_PAGE_SIZE);
  const [rawTableCurrentPage, setRawTableCurrentPage] = React.useState(1);
  const [rawTablePageSize, setRawTablePageSize] = React.useState(RAW_DATA_DEFAULT_PAGE_SIZE);
  const [cleanCardCurrentPage, setCleanCardCurrentPage] = React.useState(1);
  const [cleanCardPageSize, setCleanCardPageSize] = React.useState(RAW_DATA_DEFAULT_PAGE_SIZE);
  const [cleanTableCurrentPage, setCleanTableCurrentPage] = React.useState(1);
  const [cleanTablePageSize, setCleanTablePageSize] = React.useState(RAW_DATA_DEFAULT_PAGE_SIZE);
  const [activeTab, setActiveTab] = React.useState<string>('summary');
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
  const [viewportHeight, setViewportHeight] = React.useState<number>(() => {
    if (typeof window === 'undefined') return 1080;
    return window.innerHeight;
  });
  const [splitContainerWidth, setSplitContainerWidth] = React.useState<number>(() => {
    if (typeof window === 'undefined') return 1920;
    return window.innerWidth;
  });
  const splitContainerRef = React.useRef<HTMLDivElement | null>(null);
  const splitRafRef = React.useRef<number | null>(null);
  const lastSplitUpdateAtRef = React.useRef(0);
  const lastSplitRatioRef = React.useRef(SPLIT_DEFAULT_PERCENT);
  const autoCompoundHighlightRef = React.useRef('');
  const rawDataTableRef = React.useRef<any>(null);
  const cleanDataTableRef = React.useRef<any>(null);
  const layoutPreset = React.useMemo(() => getPatentAnalysisLayoutPreset(viewportWidth), [viewportWidth]);
  const effectiveSplitWidth = splitContainerWidth || viewportWidth;
  const isStackedSplitLayout = effectiveSplitWidth <= DETAIL_STACK_BREAKPOINT;
  const rawDataTableScrollY = React.useMemo(() => {
    return Math.max(300, viewportHeight - 470);
  }, [viewportHeight]);
  const getRawDataTableScroll = React.useCallback((rowCount: number) => {
    const estimatedRowHeight = 160;
    const needsVerticalScroll = rowCount * estimatedRowHeight > rawDataTableScrollY;
    return needsVerticalScroll
      ? { x: 'max-content' as const, y: rawDataTableScrollY }
      : { x: 'max-content' as const };
  }, [rawDataTableScrollY]);
  const paginationItemRender = React.useCallback((page: number, type: string, originalElement: React.ReactNode) => (
    type === 'page' ? <span>{formatNumberWithComma(page)}</span> : originalElement
  ), []);
  const rawDataTablePagination = React.useMemo(() => ({
    current: rawTableCurrentPage,
    pageSize: rawTablePageSize,
    showSizeChanger: true,
    pageSizeOptions: RAW_DATA_PAGE_SIZE_OPTIONS,
    position: ['bottomRight' as const],
    itemRender: paginationItemRender,
    onChange: (page: number, pageSize: number) => {
      setRawTableCurrentPage(page);
      setRawTablePageSize(pageSize);
    },
  }), [paginationItemRender, rawTableCurrentPage, rawTablePageSize]);
  const cleanDataTablePagination = React.useMemo(() => ({
    current: cleanTableCurrentPage,
    pageSize: cleanTablePageSize,
    showSizeChanger: true,
    pageSizeOptions: RAW_DATA_PAGE_SIZE_OPTIONS,
    position: ['bottomRight' as const],
    itemRender: paginationItemRender,
    onChange: (page: number, pageSize: number) => {
      setCleanTableCurrentPage(page);
      setCleanTablePageSize(pageSize);
    },
  }), [cleanTableCurrentPage, cleanTablePageSize, paginationItemRender]);
  const resultTables = React.useMemo(() => {
    const tables = patentResult?.tables;
    return Array.isArray(tables) ? tables : [];
  }, [patentResult]);
  const compoundHighlightTarget = React.useMemo(
    () => findCompoundHighlightTarget(patentResult, requestedCompoundId),
    [patentResult, requestedCompoundId],
  );

  useEffect(() => {
    setRawCardCurrentPage(1);
  }, [rGroupFilter]);

  useEffect(() => {
    const onResize = () => {
      setViewportWidth(window.innerWidth);
      setViewportHeight(window.innerHeight);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const container = splitContainerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const resizeObserver = new ResizeObserver(([entry]) => {
      setSplitContainerWidth(entry.contentRect.width);
    });
    resizeObserver.observe(container);
    setSplitContainerWidth(container.getBoundingClientRect().width);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    lastSplitRatioRef.current = splitRatio;
  }, [splitRatio]);

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

  const updateSplitRatioFromClientX = React.useCallback((clientX: number) => {
    const container = splitContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return;
    const nextRatio = ((clientX - rect.left) / rect.width) * 100;
    const clampedRatio = clampSplitRatio(nextRatio);
    const now = window.performance.now();
    const isMeaningfulChange = Math.abs(clampedRatio - lastSplitRatioRef.current) >= 0.4;
    const canUpdate = now - lastSplitUpdateAtRef.current >= 32;
    if (!isMeaningfulChange || !canUpdate) return;

    lastSplitUpdateAtRef.current = now;
    lastSplitRatioRef.current = clampedRatio;
    setSplitRatio(clampedRatio);
  }, [clampSplitRatio]);

  const stopSplitResize = React.useCallback(() => {
    setIsResizingSplit(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    if (!isResizingSplit) return;

    const onMouseMove = (event: MouseEvent) => {
      if (splitRafRef.current) {
        window.cancelAnimationFrame(splitRafRef.current);
      }
      splitRafRef.current = window.requestAnimationFrame(() => {
        updateSplitRatioFromClientX(event.clientX);
      });
    };

    const onMouseUp = () => {
      stopSplitResize();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (splitRafRef.current) {
        window.cancelAnimationFrame(splitRafRef.current);
        splitRafRef.current = null;
      }
    };
  }, [isResizingSplit, stopSplitResize, updateSplitRatioFromClientX]);

  const handleSplitMouseDown = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsResizingSplit(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

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

  const handlePdfDownload = React.useCallback(() => {
    const pdfUrl = browserPdfDocument;
    if (!pdfUrl) {
      message.error('다운로드할 PDF 파일이 없습니다.');
      return;
    }

    const filenameBase = displayedPatent?.patentNumber || 'patent-document';
    const filename = `${filenameBase.replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`;
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [browserPdfDocument, displayedPatent?.patentNumber, message]);

  useEffect(() => {
    if (displayedPatent) {
      setHeaderContent(
        <PageHeaderBreadcrumb 
          items={[
            { label: 'Documents' },
            { label: 'Patents' },
            { label: 'My 특허 분석', onClick: () => navigate('/patents/analysis') },
            { label: displayedPatent.patentNumber }
          ]}
        />
      );
    }
    return () => setHeaderContent(null);
  }, [displayedPatent, setHeaderContent, navigate]);

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
    setActiveCompId(compId);
    const pageArray = Array.isArray(pages) ? pages : [pages];
    const bboxArray = Array.isArray(bboxes) ? bboxes : [];
    
    if (pageArray.length === 0) return;
    
    const currentIndex = pageIndices[compId] ?? 0;
    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) nextIndex = pageArray.length - 1;
    if (nextIndex >= pageArray.length) nextIndex = 0;
    
    setPageIndices(prev => ({ ...prev, [compId]: nextIndex }));
    handleGoToPdf(pageArray[nextIndex], bboxArray[nextIndex]);
  };

  const handleCompoundCardClick = (comp: any, rank: number) => {
    const compId = comp.id.toString();
    const pageArray = Array.isArray(comp.page) ? comp.page : [comp.page];
    const bboxArray = Array.isArray((comp as any).bbox) ? (comp as any).bbox : [];
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
    setActiveCompId(compId);
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
    let nextIndex = currentIndex + direction;
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

  const getTableCopyText = (tableItem: any, tableIndex: number) => {
    const tsvList = Array.isArray(tableItem?.table_tsv) ? tableItem.table_tsv : [];
    const csvList = Array.isArray(tableItem?.table_csv) ? tableItem.table_csv : [];
    const currentTableText = tsvList[tableIndex] ?? csvList[tableIndex];

    if (typeof currentTableText === 'string' && currentTableText.trim()) {
      return currentTableText.trimEnd();
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
      ?? String(highlight?.id ?? '').replace(/__selected$/, '');
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

    message.warning('선택한 PDF 하이라이트에 연결된 Raw Data row를 찾을 수 없습니다.');
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

  const openImagePreview = (src: string, title: string) => {
    setPreviewSvg(null);
    setPreviewStructureMeta(null);
    setPreviewImageSrc(src);
    setPreviewTitle(title);
  };

  const previewCopyText = getCompoundStructureCopyText({
    smiles: previewStructureMeta?.smiles,
    molBlock: previewStructureMeta?.molblock,
    cdxml: previewStructureMeta?.cdxml,
    svg: previewSvg,
  });
  const canOpenPreviewChemDraw = Boolean(previewStructureMeta?.smiles || previewStructureMeta?.molblock);

  const handlePreviewCopyData = () => {
    if (!previewCopyText) return;

    const writePromise = navigator.clipboard?.writeText(previewCopyText);
    if (!writePromise) {
      void message.error('클립보드를 지원하지 않는 브라우저입니다.');
      return;
    }

    void writePromise
      .then(() => {
        void message.success('구조 데이터 복사 완료');
      })
      .catch(() => {
        void message.error('복사 실패');
      });
  };

  const handlePreviewCopyImage = () => {
    if (!previewSvg) return;

    void copySvgImageToClipboard(previewSvg, { scale: 4 })
      .then(() => {
        void message.success('구조 이미지 복사 완료');
      })
      .catch((error) => {
        const errorMessage = error instanceof Error ? error.message : '이미지 복사 실패';
        void message.error(errorMessage);
      });
  };

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

  return (
    <div className="patent-analysis-detail-page" style={{ maxWidth: layoutPreset.maxWidth, margin: '0 auto', padding: `0 ${layoutPreset.sidePadding}px`, flex: 1, width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflow: isStackedSplitLayout ? 'auto' : 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: isStackedSplitLayout ? 'visible' : 'hidden', animation: 'fadeIn 0.3s ease-out', paddingBottom: isStackedSplitLayout ? 24 : 8 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16, padding: '0 4px', flexShrink: 0 }}>
          <Space size={16} style={{ minWidth: 0 }}>
            <Button 
              icon={<ChevronLeft size={20} />} 
              onClick={() => navigate('/patents/analysis')}
              style={{ borderRadius: '10px' }}
            />
            <div style={{ minWidth: 0 }}>
              <Title level={4} style={{ margin: 0, lineHeight: '1.2', wordBreak: 'keep-all' }}>{displayedPatent.title}</Title>
              <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>{displayedPatent.patentNumber} | {displayedPatent.applicant} | {formatDisplayDate(displayedPatent.publicationDate)}</Text>
            </div>
          </Space>
        </div>
        {patentDetailError && (
          <Alert
            type="warning"
            showIcon
            message="특허 상세 API 연결 실패"
            description="현재 화면은 mock 데이터로 표시됩니다."
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
              onToggleFit={fitPageToScreen}
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
                viewerContainerRef={pdfViewer.pdfViewerContainerRef}
                currentPage={pdfViewer.pdfCurrentPage}
                onGoToPage={(page) => handleGoToPdf(page)}
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
                background: isResizingSplit ? token.colorPrimary : token.colorBorder,
                transition: 'background-color 0.2s ease'
              }}
            />
          </div>

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
                activeKey={activeTab}
                onChange={(key) => {
                  React.startTransition(() => {
                    setActiveTab(key);
                    if (key !== 'raw-data') setRGroupFilter(null);
                  });
                }}
                destroyOnHidden={false}
                animated={false}
                style={{ height: isStackedSplitLayout ? 'auto' : '100%', display: 'flex', flexDirection: 'column' }}
                tabBarStyle={{ padding: '0 24px', margin: 0, height: 50, flexShrink: 0 }}
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
                        <Title level={5}>Patent Analysis Summary</Title>
                        
                        <Row gutter={[16, 16]}>
                          {hasSummaryAnalysis && summaryAnalysis ? (
                            <>
                          <Col span={24}>
                            <Card size="small" title="Scaffold Ranking" className="patent-summary-card patent-summary-scaffold-ranking-card">
                              <div className="patent-summary-scaffold-scroll">
                                <div className="patent-summary-scaffold-item">
                                  <Card size="small" type="inner" title="Parent Scaffold" className="patent-summary-structure-card">
                                    <div className="patent-summary-structure-frame" style={{ width: '100%', aspectRatio: '1 / 1', background: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 8, position: 'relative', overflow: 'hidden' }}>
                                      {renderPatentStructureView({
                                        svg: summaryAnalysis.parentScaffold.svg,
                                        title: 'Parent Scaffold',
                                        smiles: (summaryAnalysis.parentScaffold as any).smiles ?? (summaryAnalysis.scaffoldRanks?.[0] as any)?.smiles,
                                        molblock: (summaryAnalysis.parentScaffold as any).molblock,
                                      })}
                                    </div>
                                  </Card>
                                </div>
                                {summaryAnalysis.scaffoldRanks && summaryAnalysis.scaffoldRanks.map(rankData => (
                                  <div className="patent-summary-scaffold-item" key={rankData.rank}>
                                    <Card size="small" type="inner" className="patent-summary-structure-card" title={<><Badge count={rankData.rank} style={{ backgroundColor: rankData.rank === 1 ? '#f5222d' : rankData.rank === 2 ? '#fa8c16' : '#d9d9d9' }} /> Rank {rankData.rank}</>}>
                                      <div className="patent-summary-structure-frame" style={{ width: '100%', aspectRatio: '1 / 1', background: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: '8px', position: 'relative', overflow: 'hidden' }}>
                                        {renderPatentStructureView({
                                          svg: rankData.svg,
                                          title: `Scaffold Rank ${rankData.rank}`,
                                          smiles: (rankData as any).smiles,
                                        })}
                                      </div>
                                      <div style={{ marginTop: 8, textAlign: 'center' }}>
                                        <Text type="secondary">Frequency: {rankData.frequency}</Text>
                                      </div>
                                    </Card>
                                  </div>
                                ))}
                              </div>
                            </Card>
                          </Col>

                          <Col span={24}>
                            <Card size="small" title="Functional Group Analysis" className="patent-summary-card">
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                {/* Scaffold Rank 1 Image for Functional Group Context */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                  <Title level={5} style={{ marginTop: 0, marginBottom: 8, color: token.colorPrimary }}>Scaffold Rank 1</Title>
                                  <div className="patent-summary-structure-frame patent-functional-scaffold-frame" style={{ width: 220, height: 220, background: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: '8px', padding: 0, position: 'relative', overflow: 'hidden' }}>
                                    {renderPatentStructureView({
                                      svg: summaryAnalysis.scaffoldRanks?.[0]?.svg ?? summaryAnalysis.parentScaffold.svg,
                                      title: 'Functional Group - Scaffold Rank 1',
                                      smiles: (summaryAnalysis.scaffoldRanks?.[0] as any)?.smiles ?? (summaryAnalysis.parentScaffold as any)?.smiles,
                                    })}
                                  </div>
                                </div>
                                
                                {/* R-Groups List */}
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
                                  {summaryAnalysis.rGroups.map(group => (
                                    <div key={group.id}>
                                      <Title level={5} style={{ marginTop: 0, marginBottom: 8, color: token.colorPrimary }}>{group.id}</Title>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                                        {group.variants.map((v: any, idx: number) => (
                                          <div key={idx} className="patent-rgroup-variant-item">
                                            <Card size="small" type="inner" className="patent-rgroup-variant-card">
                                              <div className="patent-summary-structure-frame patent-functional-rgroup-frame">
                                                {renderPatentStructureView({
                                                  svg: v.svg,
                                                  title: `${group.id} Variant ${idx + 1}`,
                                                  smiles: v.smiles,
                                                  iconSize: 10,
                                                })}
                                              </div>
                                            </Card>
                                            <Button
                                              type="link"
                                              size="small"
                                              className="patent-rgroup-frequency-button"
                                              onClick={() => {
                                                setRGroupFilter({ key: group.id, smiles: v.smiles });
                                                React.startTransition(() => setActiveTab('raw-data'));
                                              }}
                                            >
                                              Freq: {v.frequency}
                                            </Button>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </Card>
                          </Col>
                            </>
                          ) : (
                            <Col span={24}>
                              <Card size="small">
                                {isLoadingPatentDetail ? (
                                  <PatentDetailLoadingState />
                                ) : shouldShowPatentDetailEmpty ? (
                                  <Empty description="Patent Analysis Summary 데이터가 없습니다." />
                                ) : null}
                              </Card>
                            </Col>
                          )}

                          <Col span={24}>
                            <Card size="small" title="추천 Key Compound (빈도수/중요도 기반)">
                              {recommendedKeyCompounds.length > 0 ? (
                                <div style={{ display: 'flex', overflowX: 'auto', gap: 16, paddingBottom: 8 }}>
                                  {recommendedKeyCompounds.map((comp: any, idx: number) => {
                                    const compKey = String(comp.id);
                                    const pageArr: number[] = Array.isArray(comp.page) ? comp.page : [];
                                    const bboxArr: any[] = Array.isArray(comp.bbox) ? comp.bbox : [];
                                    const curIdx = pageIndices[compKey] ?? 0;

                                    return (
                                      <div key={`${comp.id}-${idx}`} style={{ width: 260, minWidth: 260, flexShrink: 0 }}>
                                        <DataCardItem
                                          title={comp.compound_id}
                                          tags={comp.ranking ? [{ label: `Rank ${comp.ranking}`, color: 'blue' }] : []}
                                          cornerIcon={
                                            comp.is_human_key_compound ? (
                                              <span style={{ fontSize: 15, cursor: 'pointer' }} title="Key Compound">🔑</span>
                                            ) : undefined
                                          }
                                          imageUrl={comp.compound_svg}
                                          imageType="svg"
                                          imageHeight={220}
                                          squareImage
                                          isActive={activeCompId === compKey}
                                          onClick={() => handleCompoundCardClick(comp, comp.ranking)}
                                          onPreview={() => openSvgPreview(comp.compound_svg, `추천 Key Compound - ${comp.compound_id}`, {
                                            smiles: comp.smiles,
                                            molblock: comp.molblock,
                                          })}
                                          smiles={comp.smiles}
                                          molblock={comp.molblock}
                                          pagination={
                                            pageArr.length > 0
                                              ? {
                                                  currentIndex: curIdx,
                                                  totalCount: pageArr.length,
                                                  onPrev: () => handlePageChange(compKey, -1, pageArr, bboxArr),
                                                  onNext: () => handlePageChange(compKey, 1, pageArr, bboxArr),
                                                  pageLabel: () => `p.${pageArr[curIdx] ?? '-'}`,
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
                                  <Empty description="추천 Key Compound 데이터가 없습니다." />
                                ) : null
                              )}
                            </Card>
                          </Col>
                        </Row>
                      </div>
                    ) : null
                  },
                  {
                    key: 'raw-data',
                    label: (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FileSpreadsheet size={16} /> Raw Data
                      </span>
                    ),
                    children: activeTab === 'raw-data' ? (
                      <div className="raw-data-tab-content" style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                          <Title level={5} style={{ margin: 0 }}>Embodiment 화합물 목록</Title>
                          <Space>
                            <div
                              style={{
                                background: token.colorBgLayout,
                                padding: '2px',
                                borderRadius: 8,
                                display: 'flex',
                                border: `1px solid ${token.colorBorderSecondary}`
                              }}
                            >
                              <Button
                                type="text"
                                size="small"
                                icon={<TableIcon size={14} />}
                                onClick={() => setRawDataView('table')}
                                style={{
                                  background: rawDataView === 'table' ? token.colorPrimaryBg : 'transparent',
                                  border: `1px solid ${rawDataView === 'table' ? token.colorPrimary : 'transparent'}`,
                                  color: rawDataView === 'table' ? token.colorPrimary : token.colorTextSecondary,
                                  borderRadius: 6,
                                  fontWeight: rawDataView === 'table' ? 600 : 500
                                }}
                              >
                                Table
                              </Button>
                              <Button
                                type="text"
                                size="small"
                                icon={<LayoutGrid size={14} />}
                                onClick={() => setRawDataView('card')}
                                style={{
                                  background: rawDataView === 'card' ? token.colorPrimaryBg : 'transparent',
                                  border: `1px solid ${rawDataView === 'card' ? token.colorPrimary : 'transparent'}`,
                                  color: rawDataView === 'card' ? token.colorPrimary : token.colorTextSecondary,
                                  borderRadius: 6,
                                  fontWeight: rawDataView === 'card' ? 600 : 500
                                }}
                              >
                                Card
                              </Button>
                            </div>
                            <Button size="small">Export CSV</Button>
                            <Button size="small" type="primary">Filter</Button>
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
                        {rawDataView === 'table' ? (
                          (() => {
                            // patentResultRaw에서 실제 patent_compound 데이터 사용
                            const rawPcAll: any[] = patentResult.patent_compound ?? [];
                            const rawPc = (rGroupFilter
                              ? rawPcAll.filter((c: any) => c.r_groups?.[rGroupFilter.key] === rGroupFilter.smiles)
                              : rawPcAll
                            ).map((c: any, idx: number) => ({ ...c, __rowIdx: idx }));
                            // 전체 r_group key 수집 (R1~R7 등 동적)
                            const allRGroupKeys = Array.from(
                              new Set(rawPc.flatMap((c: any) => Object.keys(c.r_groups ?? {})))
                            ).sort();

                            const rGroupColumns = allRGroupKeys.map((key) => ({
                              title: key,
                              key: `rg_${key}`,
                              width: 190,
                              className: 'table-center-column raw-data-rgroup-column',
                              render: (_: any, record: any) => {
                                const smiles = record.r_groups?.[key];
                                // frequency_analysis_result_json에서 SVG 찾기
                                const faRGroups = frequencyAnalysis?.r_groups ?? {};
                                const variants: any[] = faRGroups[key] ?? [];
                                const match = variants.find((v: any) => v.smiles === smiles);
                                const svg = match?._svg || record.r_group_svgs?.[key] || '';
                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                    <div
                                      className="raw-data-svg-frame raw-data-rgroup-svg-frame"
                                      style={{ width: 156, height: 156, background: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 6, position: 'relative', cursor: svg ? 'pointer' : 'default', overflow: 'hidden', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                                    <Text style={{ fontSize: 10, color: token.colorTextSecondary, maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={smiles}>
                                      {smiles || '-'}
                                    </Text>
                                  </div>
                                );
                              }
                            }));

                            const columns = [
                              {
                                title: 'pin',
                                key: 'pin',
                                width: 56,
                                fixed: 'left' as const,
                                align: 'center' as const,
                                className: 'table-center-column',
                                render: () => <Pin size={14} style={{ cursor: 'pointer', color: '#bfbfbf' }} />
                              },
                              { title: 'Rank', dataIndex: 'ranking', key: 'ranking', width: 90, fixed: 'left' as const,
                                align: 'center' as const,
                                className: 'table-center-column',
                                sorter: (a: any, b: any) => (a.ranking ?? 999) - (b.ranking ?? 999),
                                render: (ranking: any, _: any, index: number) => {
                                  // 같은 ranking 값이 여러 개인지 확인 (동률)
                                  const sameCount = rawPc.filter((c: any) => c.ranking === ranking).length;
                                  return (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                      <Text style={{ fontSize: 11 }}>{ranking ?? '-'}</Text>
                                      {sameCount > 1 && (
                                        <Tag color="orange" style={{ fontSize: 9, padding: '0 4px', lineHeight: '16px', margin: 0 }}>동률</Tag>
                                      )}
                                    </div>
                                  );
                                }
                              },
                              { title: 'Example No.', dataIndex: 'compound_id', key: 'compound_id', width: 130, fixed: 'left' as const, align: 'center' as const, className: 'table-center-column' },
                              { title: 'Scaffold Rank', dataIndex: 'scaffold_ranking', key: 'scaffold_ranking', width: 120, align: 'center' as const, className: 'table-center-column', render: (v: any) => v ?? '-' },
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
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                      <div
                                        className="raw-data-svg-frame"
                                        style={{ width: 160, height: 160, background: token.colorBgContainer, border: `1px solid ${activeCompId === compKey ? 'red' : token.colorBorderSecondary}`, borderRadius: 8, position: 'relative', cursor: 'pointer', overflow: 'hidden', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
                                          onClick={() => { setActiveCompId(compKey); handlePageChange(compKey, -1, pageArr, bboxArr); }} />
                                        <Text style={{ fontSize: 10 }}>p.{pageArr[curIdx] ?? '-'}</Text>
                                        <Button size="small" type="text" style={{ transform: 'scaleX(-1)' }} icon={<ChevronLeft size={12} />}
                                          onClick={() => { setActiveCompId(compKey); handlePageChange(compKey, 1, pageArr, bboxArr); }} />
                                      </div>
                                    </div>
                                  );
                                }
                              },
                              {
                                title: 'Scaffold',
                                key: 'scaffold',
                                width: 220,
                                align: 'center' as const,
                                className: 'table-center-column raw-data-scaffold-column',
                                render: (_: any, record: any) => record.scaffold_svg ? (
                                  <div className="raw-data-scaffold-cell">
                                    <div
                                      className="raw-data-svg-frame raw-data-scaffold-svg-frame"
                                      style={{ width: 184, height: 184, background: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 8, cursor: 'pointer', position: 'relative', overflow: 'hidden', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                      {renderPatentStructureView({
                                        svg: record.scaffold_svg,
                                        title: `Scaffold - ${record.compound_id}`,
                                        smiles: record.scaffold,
                                        height: '100%',
                                        iconSize: 11,
                                        onClick: () => openSvgPreview(record.scaffold_svg, `Scaffold - ${record.compound_id}`),
                                      })}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="raw-data-scaffold-cell">
                                    <div
                                      className="raw-data-svg-frame raw-data-scaffold-svg-frame"
                                      style={{ width: 184, height: 184, background: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 8, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                      <Text style={{ fontSize: 11, color: token.colorTextTertiary }}>no image</Text>
                                    </div>
                                  </div>
                                )
                              },
                              ...rGroupColumns,
                              {
                                title: 'SMILES',
                                dataIndex: 'scaffold',
                                key: 'smiles',
                                ellipsis: true,
                                width: 300,
                                render: (_v: any, record: any) => {
                                  const smilesText = typeof record.scaffold === 'string' ? record.scaffold.trim() : '';
                                  if (!smilesText) {
                                    return <Text type="secondary" style={{ fontSize: 10 }}>-</Text>;
                                  }
                                  return (
                                    <Text style={{ fontSize: 10 }} copyable={{ text: smilesText }}>
                                      {smilesText}
                                    </Text>
                                  );
                                }
                              },
                            ];

                            return (
                              <div
                                className="raw-data-table-shell"
                                style={{
                                  background: token.colorBgContainer,
                                  borderRadius: 20,
                                  border: `1px solid ${token.colorBorderSecondary}`,
                                  overflow: 'hidden'
                                }}
                              >
                                <Table
                                  ref={rawDataTableRef}
                                  className="raw-data-embodiment-table"
                                  dataSource={rawPc}
                                  size="small"
                                  rowKey={(record: any) => `${record.id}-${record.__rowIdx}`}
                                  scroll={getRawDataTableScroll(rawPc.length)}
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
                            const rawCardRows = (rGroupFilter
                              ? (patentResult.patent_compound ?? []).filter((c: any) => c.r_groups?.[rGroupFilter.key] === rGroupFilter.smiles)
                              : (patentResult.patent_compound ?? [])
                            );
                            const currentPage = Math.min(rawCardCurrentPage, Math.max(1, Math.ceil(rawCardRows.length / rawCardPageSize)));
                            const pagedRawCardRows = rawCardRows.slice((currentPage - 1) * rawCardPageSize, currentPage * rawCardPageSize);

                            if (rawCardRows.length === 0) {
                              if (isLoadingPatentDetail) return <PatentDetailLoadingState />;
                              return shouldShowPatentDetailEmpty ? <Empty description="Raw Data 데이터가 없습니다." /> : null;
                            }

                            return (
                              <div className="patent-analysis-card-view" style={{ minHeight: rawDataTableScrollY }}>
                                <Row className="patent-analysis-card-grid" gutter={[16, 16]}>
                                  {pagedRawCardRows.map((comp: any, idx: number) => {
                                    const compKey = String(comp.id);
                                    const pageArr: number[] = Array.isArray(comp.page) ? comp.page : [];
                                    const bboxArr: any[] = Array.isArray(comp.bbox) ? comp.bbox : [];
                                    const curIdx = pageIndices[compKey] ?? 0;
                                    const rEntries = Object.entries(comp.r_groups ?? {}) as [string, string][];

                                    return (
                                      <Col span={24} md={12} lg={8} key={`${comp.id}-${idx}`}>
                                        <DataCardItem
                                          title={comp.compound_id}
                                          tags={comp.ranking ? [{ label: `Rank ${comp.ranking}`, color: 'blue' }] : []}
                                          cornerIcon={
                                            comp.is_human_key_compound ? (
                                              <span style={{ fontSize: 15, cursor: 'pointer' }} title="Key Compound">🔑</span>
                                            ) : undefined
                                          }
                                          imageUrl={comp.compound_svg}
                                          imageType="svg"
                                          imageHeight={130}
                                          squareImage
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
                                          extraInfo={
                                            rEntries.length > 0 && (
                                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                {rEntries.map(([k, v]) => (
                                                  <Tooltip key={k} title={`${k}: ${String(v ?? '')}`}>
                                                    <Tag
                                                      style={{
                                                        fontSize: 9,
                                                        maxWidth: 170,
                                                        cursor: 'copy',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 2
                                                      }}
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        const copiedText = `${k}: ${String(v ?? '')}`;
                                                        navigator.clipboard.writeText(copiedText)
                                                          .then(() => message.success(`${k} 값이 복사되었습니다.`))
                                                          .catch(() => message.error('복사에 실패했습니다.'));
                                                      }}
                                                    >
                                                      <Text strong style={{ fontSize: 9 }}>{k}:</Text>
                                                      <span
                                                        style={{
                                                          maxWidth: 110,
                                                          overflow: 'hidden',
                                                          textOverflow: 'ellipsis',
                                                          whiteSpace: 'nowrap'
                                                        }}
                                                      >
                                                        {String(v ?? '')}
                                                      </span>
                                                    </Tag>
                                                  </Tooltip>
                                                ))}
                                              </div>
                                            )
                                          }
                                          footerText={comp.scaffold}
                                          pagination={
                                            pageArr.length > 0
                                              ? {
                                                  currentIndex: curIdx,
                                                  totalCount: pageArr.length,
                                                  onPrev: () => handlePageChange(compKey, -1, pageArr, bboxArr),
                                                  onNext: () => handlePageChange(compKey, 1, pageArr, bboxArr),
                                                  pageLabel: () => `p.${pageArr[curIdx] ?? '-'}`,
                                                }
                                              : undefined
                                          }
                                        />
                                      </Col>
                                    );
                                  })}
                                </Row>
                                <Pagination
                                  className="v-common-pagination"
                                  size="small"
                                  current={currentPage}
                                  pageSize={rawCardPageSize}
                                  total={rawCardRows.length}
                                  showSizeChanger
                                  pageSizeOptions={RAW_DATA_PAGE_SIZE_OPTIONS}
                                  itemRender={paginationItemRender}
                                  onChange={(page, pageSize) => {
                                    setRawCardCurrentPage(page);
                                    setRawCardPageSize(pageSize);
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
                        <Activity size={16} /> Clean Data
                      </span>
                    ),
                    children: activeTab === 'clean-data' ? (
                      <div className="raw-data-tab-content" style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                          <Title level={5} style={{ margin: 0 }}>Clean Data 화합물 목록</Title>
                          <Space>
                            <div
                              style={{
                                background: token.colorBgLayout,
                                padding: '2px',
                                borderRadius: 8,
                                display: 'flex',
                                border: `1px solid ${token.colorBorderSecondary}`
                              }}
                            >
                              <Button
                                type="text"
                                size="small"
                                icon={<TableIcon size={14} />}
                                onClick={() => setCleanDataView('table')}
                                style={{
                                  background: cleanDataView === 'table' ? token.colorPrimaryBg : 'transparent',
                                  border: `1px solid ${cleanDataView === 'table' ? token.colorPrimary : 'transparent'}`,
                                  color: cleanDataView === 'table' ? token.colorPrimary : token.colorTextSecondary,
                                  borderRadius: 6,
                                  fontWeight: cleanDataView === 'table' ? 600 : 500
                                }}
                              >
                                Table
                              </Button>
                              <Button
                                type="text"
                                size="small"
                                icon={<LayoutGrid size={14} />}
                                onClick={() => setCleanDataView('card')}
                                style={{
                                  background: cleanDataView === 'card' ? token.colorPrimaryBg : 'transparent',
                                  border: `1px solid ${cleanDataView === 'card' ? token.colorPrimary : 'transparent'}`,
                                  color: cleanDataView === 'card' ? token.colorPrimary : token.colorTextSecondary,
                                  borderRadius: 6,
                                  fontWeight: cleanDataView === 'card' ? 600 : 500
                                }}
                              >
                                Card
                              </Button>
                            </div>
                            <Button size="small">Export CSV</Button>
                            <Button size="small" type="primary">Filter</Button>
                            <Button size="small" type="default">Clean Data 요청</Button>
                          </Space>
                        </div>
                        {cleanDataView === 'table' ? (
                          (() => {
                            const modifiedBioKeys: string[] = (patentResult.data?.[0]?.modified_bioactivity_list ?? []) as string[];
                            const cleanRows = buildCleanRows();

                            const allRGroupKeys = Array.from(
                              new Set(cleanRows.flatMap((c: any) => Object.keys(c.r_groups ?? {})))
                            ).sort((a, b) => {
                              const numA = parseInt((a.match(/\d+/) || ['0'])[0], 10);
                              const numB = parseInt((b.match(/\d+/) || ['0'])[0], 10);
                              return numA - numB;
                            });

                            const formatExampleNumber = (exampleNumber: any) => {
                              if (!Array.isArray(exampleNumber) || exampleNumber.length === 0) return 'N/A';
                              if (exampleNumber.includes('NaN') && exampleNumber.length === 1) return 'Intermediate';
                              const filtered = exampleNumber.filter((item: any) => item !== 'NaN');
                              return filtered.length > 0 ? filtered.join(', ') : 'N/A';
                            };

                            const rGroupColumns = allRGroupKeys.map((key) => ({
                              title: key,
                              key: `clean_rg_${key}`,
                              width: 190,
                              className: 'table-center-column raw-data-rgroup-column',
                              render: (_: any, record: any) => {
                                const smiles = record.r_groups?.[key];
                                const faRGroups = frequencyAnalysis?.r_groups ?? {};
                                const variants: any[] = faRGroups[key] ?? [];
                                const match = variants.find((v: any) => v.smiles === smiles);
                                const svg = match?._svg || '';
                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                    <div
                                      className="raw-data-svg-frame raw-data-rgroup-svg-frame"
                                      style={{ width: 156, height: 156, background: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 6, position: 'relative', cursor: svg ? 'pointer' : 'default', overflow: 'hidden', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                                    <Text style={{ fontSize: 10, color: token.colorTextSecondary, maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={smiles}>
                                      {smiles || '-'}
                                    </Text>
                                  </div>
                                );
                              }
                            }));

                            const bioColumns = modifiedBioKeys.map((bioKey) => ({
                              title: bioKey,
                              key: `clean_bio_${bioKey}`,
                              width: 220,
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

                            const columns = [
                              {
                                title: '',
                                key: 'select',
                                width: 56,
                                fixed: 'left' as const,
                                align: 'center' as const,
                                className: 'table-center-column',
                                render: () => <input type="checkbox" />
                              },
                              {
                                title: 'pin',
                                key: 'pin',
                                width: 56,
                                fixed: 'left' as const,
                                align: 'center' as const,
                                className: 'table-center-column',
                                render: () => <Pin size={14} style={{ cursor: 'pointer', color: '#bfbfbf' }} />
                              },
                              {
                                title: 'Rank',
                                dataIndex: 'ranking',
                                key: 'ranking',
                                width: 90,
                                fixed: 'left' as const,
                                align: 'center' as const,
                                className: 'table-center-column',
                                render: (ranking: any) => <Text style={{ fontSize: 11 }}>{ranking ?? '-'}</Text>
                              },
                              { title: 'Scaffold Group', dataIndex: 'scaffold_ranking', key: 'scaffold_ranking', width: 140, align: 'center' as const, className: 'table-center-column', render: (v: any) => v ?? '-' },
                              { title: 'Example Number', key: 'example_number', width: 150, align: 'center' as const, className: 'table-center-column', render: (_: any, record: any) => formatExampleNumber(record.example_number) },
                              {
                                title: 'Structure',
                                key: 'structure',
                                width: 240,
                                align: 'center' as const,
                                className: 'table-center-column',
                                render: (_: any, record: any) => {
                                  const compKey = `clean-${record.__rowKey ?? record.id}`;
                                  const pageArr: number[] = Array.isArray(record.page) ? record.page : [];
                                  const bboxArr: any[] = Array.isArray(record.bbox) ? record.bbox : [];
                                  const curIdx = pageIndices[compKey] ?? 0;
                                  return (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                      <div
                                        className="raw-data-svg-frame"
                                        style={{ width: 160, height: 160, background: token.colorBgContainer, border: `1px solid ${activeCompId === compKey ? 'red' : token.colorBorderSecondary}`, borderRadius: 8, position: 'relative', cursor: 'pointer', overflow: 'hidden', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
                                          onClick={() => { setActiveCompId(compKey); handlePageChange(compKey, -1, pageArr, bboxArr); }} />
                                        <Text style={{ fontSize: 10 }}>p.{pageArr[curIdx] ?? '-'}</Text>
                                        <Button size="small" type="text" style={{ transform: 'scaleX(-1)' }} icon={<ChevronLeft size={12} />}
                                          onClick={() => { setActiveCompId(compKey); handlePageChange(compKey, 1, pageArr, bboxArr); }} />
                                      </div>
                                    </div>
                                  );
                                }
                              },
                              {
                                title: 'Scaffold',
                                key: 'scaffold',
                                width: 220,
                                align: 'center' as const,
                                className: 'table-center-column raw-data-scaffold-column',
                                render: (_: any, record: any) => record.scaffold_svg ? (
                                  <div className="raw-data-scaffold-cell">
                                    <div
                                      className="raw-data-svg-frame raw-data-scaffold-svg-frame"
                                      style={{ width: 184, height: 184, background: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 8, cursor: 'pointer', position: 'relative', overflow: 'hidden', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                      {renderPatentStructureView({
                                        svg: record.scaffold_svg,
                                        title: `Scaffold - ${record.compound_id}`,
                                        smiles: record.scaffold,
                                        height: '100%',
                                        iconSize: 11,
                                        onClick: () => openSvgPreview(record.scaffold_svg, `Scaffold - ${record.compound_id}`),
                                      })}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="raw-data-scaffold-cell">
                                    <div
                                      className="raw-data-svg-frame raw-data-scaffold-svg-frame"
                                      style={{ width: 184, height: 184, background: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 8, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                      <Text style={{ fontSize: 11, color: token.colorTextTertiary }}>no image</Text>
                                    </div>
                                  </div>
                                )
                              },
                              ...bioColumns,
                              {
                                title: '관리',
                                key: 'manage',
                                width: 90,
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
                              if (isLoadingPatentDetail) return <PatentDetailLoadingState />;
                              return shouldShowPatentDetailEmpty ? <Empty description="Clean Data 데이터가 없습니다." /> : null;
                            }

                            return (
                              <div
                                className="raw-data-table-shell"
                                style={{
                                  background: token.colorBgContainer,
                                  borderRadius: 20,
                                  border: `1px solid ${token.colorBorderSecondary}`,
                                  overflow: 'hidden'
                                }}
                              >
                                <Table
                                  ref={cleanDataTableRef}
                                  className="raw-data-embodiment-table"
                                  dataSource={cleanRows}
                                  size="small"
                                  rowKey={(record: any) => record.__rowKey}
                                  scroll={getRawDataTableScroll(cleanRows.length)}
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
                            const modifiedRows: any[] = patentResult.modified_patent_compound ?? [];
                            if (modifiedRows.length === 0) {
                              if (isLoadingPatentDetail) return <PatentDetailLoadingState />;
                              return shouldShowPatentDetailEmpty ? <Empty description="Clean Data 데이터가 없습니다." /> : null;
                            }
                            const currentPage = Math.min(cleanCardCurrentPage, Math.max(1, Math.ceil(modifiedRows.length / cleanCardPageSize)));
                            const pagedModifiedRows = modifiedRows.slice((currentPage - 1) * cleanCardPageSize, currentPage * cleanCardPageSize);

                            return (
                              <div className="patent-analysis-card-view" style={{ minHeight: rawDataTableScrollY }}>
                                <Row className="patent-analysis-card-grid" gutter={[16, 16]}>
                                  {pagedModifiedRows.map((comp: any, idx: number) => {
                                    const compKey = `clean-card-${comp.id}-${((currentPage - 1) * cleanCardPageSize) + idx}`;
                                    const pageArr: number[] = Array.isArray(comp.page) ? comp.page : [];
                                    const bboxArr: any[] = Array.isArray(comp.bbox) ? comp.bbox : [];
                                    const curIdx = pageIndices[compKey] ?? 0;
                                    const bioEntries = Object.entries(comp.modified_bioactivity ?? {}) as [string, any][];
                                    return (
                                      <Col span={24} md={12} lg={8} key={compKey}>
                                        <DataCardItem
                                          title={comp.compound_id}
                                          tags={comp.ranking ? [{ label: `Rank ${comp.ranking}`, color: 'blue' }] : []}
                                          imageUrl={comp.compound_svg}
                                          imageType="svg"
                                          imageHeight={130}
                                          squareImage
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
                                          footerText={comp.scaffold}
                                          pagination={
                                            pageArr.length > 0
                                              ? {
                                                  currentIndex: curIdx,
                                                  totalCount: pageArr.length,
                                                  onPrev: () => handlePageChange(compKey, -1, pageArr, bboxArr),
                                                  onNext: () => handlePageChange(compKey, 1, pageArr, bboxArr),
                                                  pageLabel: () => `p.${pageArr[curIdx] ?? '-'}`,
                                                }
                                              : undefined
                                          }
                                        />
                                      </Col>
                                    );
                                  })}
                                </Row>
                                <Pagination
                                  className="v-common-pagination"
                                  size="small"
                                  current={currentPage}
                                  pageSize={cleanCardPageSize}
                                  total={modifiedRows.length}
                                  showSizeChanger
                                  pageSizeOptions={RAW_DATA_PAGE_SIZE_OPTIONS}
                                  itemRender={paginationItemRender}
                                  onChange={(page, pageSize) => {
                                    setCleanCardCurrentPage(page);
                                    setCleanCardPageSize(pageSize);
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
                          <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>Result Tables</Title>
                          {resultTables.length === 0 ? (
                              isLoadingPatentDetail ? (
                                <PatentDetailLoadingState />
                              ) : shouldShowPatentDetailEmpty ? (
                                <Empty description="result.tables 데이터가 없습니다." />
                              ) : null
                          ) : (
                              <Row gutter={[16, 16]}>
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
                                    <Col span={24} md={12} lg={8} key={cardKey}>
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
                                            <Text style={{ fontSize: 11 }}>
                                              Pages: {pageArray.length > 0 ? pageArray.join(', ') : '-'}
                                            </Text>
                                            <br />
                                            <Text style={{ fontSize: 11 }}>Images: {base64List.length}</Text>
                                          </div>
                                        }
                                        pagination={
                                          pageArray.length > 0
                                            ? {
                                                currentIndex: tableCurrentIndex,
                                                totalCount: pageArray.length,
                                                onPrev: () => handleTablePageChange(tableItem, i, -1),
                                                onNext: () => handleTablePageChange(tableItem, i, 1),
                                                pageLabel: () => `p.${pageArray[tableCurrentIndex] ?? '-'}`,
                                              }
                                            : undefined
                                        }
                                      />
                                    </Col>
                                  );
                                })}
                              </Row>
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
          background-color: rgba(248, 124, 99, 0.3) !important;
          border-radius: 4px;
        }
        .Highlight__part {
          background-color: rgba(248, 124, 99, 0.3);
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
        .ant-tabs-content-holder {
          flex: 1;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .ant-tabs-content {
          height: 100%;
        }
        .ant-tabs-tabpane {
          height: 100%;
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
          overflow-x: auto !important;
          overflow-y: hidden !important;
          padding-bottom: 16px;
        }
        .patent-summary-tab-content .patent-summary-scaffold-scroll {
          display: flex;
          flex-wrap: nowrap;
          gap: 16px;
          min-width: max-content;
        }
        .patent-summary-tab-content .patent-summary-scaffold-item {
          flex: 0 0 260px;
          width: 260px;
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
          background: ${token.colorBgContainer} !important;
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
          max-width: 92% !important;
          max-height: 92% !important;
          transform: none !important;
        }
        .raw-data-tab-content .patent-analysis-card-view .raw-data-svg-frame .compound-structure-svg svg {
          max-width: 100% !important;
          max-height: 100% !important;
        }
        .raw-data-tab-content .raw-data-embodiment-table .raw-data-scaffold-column {
          padding: 8px 8px !important;
          text-align: center !important;
          vertical-align: middle !important;
        }
        .raw-data-tab-content .raw-data-embodiment-table .raw-data-rgroup-column {
          padding: 6px 6px !important;
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
        .raw-data-tab-content .raw-data-embodiment-table .ant-table-tbody > tr > td {
          vertical-align: middle;
          padding: 14px 12px;
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
        .patent-structure-preview .svg-renderer-frame svg {
          max-width: calc(100% / 1.5) !important;
          max-height: calc(100% / 1.5) !important;
          width: auto;
          height: auto;
          transform: scale(1.5);
          transform-origin: center;
        }
      `}</style>

      <Modal
        title={previewTitle}
        open={!!previewSvg || !!previewImageSrc}
        onCancel={() => {
          setPreviewSvg(null);
          setPreviewStructureMeta(null);
          setPreviewImageSrc(null);
        }}
        footer={null}
        width="min(1200px, calc(100vw - 48px))"
        centered
      >
        {previewSvg || previewImageSrc ? (
          <div className={previewSvg ? 'patent-structure-preview' : undefined} style={{ width: '100%', height: 'min(720px, calc(100vh - 180px))', background: token.colorBgContainer, borderRadius: 8, border: `1px solid ${token.colorBorderSecondary}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
            {previewImageSrc ? (
              <img src={previewImageSrc} alt="table-preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            ) : null}
            {previewSvg ? (
            <SvgRenderer svg={previewSvg} />
            ) : null}
            {previewSvg ? (
              <Space
                className="patent-structure-preview-actions"
                size={6}
                style={{
                  position: 'absolute',
                  right: 16,
                  bottom: 16,
                  zIndex: 5,
                  padding: 6,
                  borderRadius: 999,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  background: token.colorBgElevated,
                  boxShadow: token.boxShadowSecondary,
                }}
              >
                <Tooltip title="이미지 복사">
                  <Button
                    className="svg-action-btn compound-structure-action-button"
                    size="small"
                    type="text"
                    icon={<ImageIcon size={13} />}
                    onClick={handlePreviewCopyImage}
                  />
                </Tooltip>
                {previewCopyText ? (
                  <Tooltip title="구조 데이터 복사">
                    <Button
                      className="svg-action-btn compound-structure-action-button"
                      size="small"
                      type="text"
                      icon={<Copy size={13} />}
                      onClick={handlePreviewCopyData}
                    />
                  </Tooltip>
                ) : null}
                {canOpenPreviewChemDraw ? (
                  <Tooltip title="ChemDraw">
                    <Button
                      className="svg-action-btn compound-structure-action-button"
                      size="small"
                      type="text"
                      icon={<BenzeneIcon size={14} />}
                      onClick={handlePreviewOpenChemDraw}
                    />
                  </Tooltip>
                ) : null}
              </Space>
            ) : null}
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
