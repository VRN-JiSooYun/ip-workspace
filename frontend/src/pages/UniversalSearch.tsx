import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Input,
  Modal,
  Pagination,
  Radio,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import {
  Beaker,
  BookOpen,
  Bookmark,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FlaskConical,
  Grid2X2,
  List,
  RotateCcw,
  Search,
} from 'lucide-react';
import CompoundStructureView from '../components/common/CompoundStructureView';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import { getPatentAnalysisLayoutPreset } from '../config/patentAnalysisLayout';
import { useUIStore } from '../store/useUIStore';
import { patentAnalysisApi } from '../services/patentAnalysisApi';
import {
  compoundSearchApi,
  CompoundSearchEngine,
  CompoundSearchInputType,
  CompoundSearchItem,
  CompoundPatentItem,
  CompoundSearchSortOrder,
  CompoundSearchType,
} from '../services/compoundSearchApi';
import { formatDisplayDate, formatNumberWithComma } from '../utils/displayFormat';
import BenzeneIcon from '../components/common/BenzeneIcon';
import ChemDrawModal from '../components/common/ChemDrawModal';

const { Text, Title } = Typography;
const { TextArea } = Input;

type ResultViewMode = 'card' | 'full';
type SourceFilter = 'all' | 'literature' | 'reaction' | 'reagent';

const PAGE_SIZE_OPTIONS = [10, 30, 50, 100];
const DEFAULT_PAGE_SIZE = 30;
const FAST_SEARCH_MAX_RESULT_WINDOW = 10000;

const SORT_FIELD_OPTIONS = [
  { label: '기본 정렬', value: '' },
  { label: 'Compound ID', value: 'id' },
  { label: 'Molecular Weight', value: 'molecular_weight' },
  { label: 'LogP', value: 'log_p' },
  { label: 'TPSA', value: 'tpsa' },
  { label: 'Heavy Atoms', value: 'heavy_atom_count' },
  { label: 'HBA', value: 'num_h_bond_acceptors' },
  { label: 'HBD', value: 'num_h_bond_donors' },
  { label: 'Rotatable Bonds', value: 'num_rotatable_bonds' },
  { label: 'Max Phase', value: 'max_phase' },
];

const SOURCE_FILTER_OPTIONS: { label: string; value: SourceFilter }[] = [
  { label: '전체', value: 'all' },
  { label: '책/문헌', value: 'literature' },
  { label: '반응', value: 'reaction' },
  { label: '시약', value: 'reagent' },
];

const PROPERTY_ROWS = [
  { label: 'Molecular Weight', key: 'molecular_weight' },
  { label: 'LogP', key: 'log_p' },
  { label: 'TPSA', key: 'tpsa' },
  { label: 'Heavy Atom Count', key: 'heavy_atom_count' },
  { label: 'H-Bond Acceptors', key: 'num_h_bond_acceptors' },
  { label: 'H-Bond Donors', key: 'num_h_bond_donors' },
  { label: 'Rotatable Bonds', key: 'num_rotatable_bonds' },
  { label: 'Max Phase', key: 'max_phase' },
];

const normalizeNumber = (value: unknown) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return '-';
  return formatNumberWithComma(numericValue, { fractionDigits: Number.isInteger(numericValue) ? 0 : 2 });
};

const getPaginationTotal = (
  total: number,
  size: number,
  searchEngine: CompoundSearchEngine,
) => {
  if (searchEngine !== 'fast') return total;
  const accessibleTotal = Math.floor(FAST_SEARCH_MAX_RESULT_WINDOW / size) * size;
  return Math.min(total, accessibleTotal);
};

const getMaxAccessiblePage = (
  total: number,
  size: number,
  searchEngine: CompoundSearchEngine,
) => Math.max(1, Math.ceil(getPaginationTotal(total, size, searchEngine) / size));

const getCompoundId = (item: CompoundSearchItem) =>
  String(item.id ?? item.compound_id ?? item._id ?? '-');

const getSources = (item: CompoundSearchItem) => {
  const value = item.source_list ?? item.sources;
  return Array.isArray(value) ? value : [];
};

const getSourceLinkValues = (link: CompoundSearchSource['source_link']) => {
  if (Array.isArray(link)) {
    return link.filter((value): value is string => typeof value === 'string' && value.trim()).map((value) => value.trim());
  }
  if (typeof link === 'string' && link.trim()) {
    return [link.trim()];
  }
  return [];
};

const renderSourceLinkValues = (links: string[]) => {
  if (links.length === 0) return <Text>-</Text>;

  return (
    <div className="compound-search-source-reference-links">
      {links.map((link, linkIndex) => {
        const isUrl = /^https?:\/\//i.test(link);
        return isUrl ? (
          <a
            key={`${link}-${linkIndex}`}
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="compound-search-source-reference-link"
          >
            <ExternalLink size={13} />
            <span>{link}</span>
          </a>
        ) : (
          <Text key={`${link}-${linkIndex}`} className="compound-search-source-reference-link-text">
            {link}
          </Text>
        );
      })}
    </div>
  );
};

const toTitleCaseLabel = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return 'Unknown';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const getCompoundSourceType = (source: CompoundSearchSource) => {
  const sourceType = source.source_type ? String(source.source_type).trim() : '';
  if (sourceType.toLowerCase() === 'substance' || sourceType.toLowerCase() === 'patent') return 'Patent';
  return toTitleCaseLabel(sourceType);
};

const isPatentSource = (source: CompoundSearchSource) =>
  getCompoundSourceType(source) === 'Patent';

const getSourceCategory = (sourceType?: string | null): Exclude<SourceFilter, 'all'> | 'literature' => {
  const normalized = String(sourceType ?? '').toLowerCase();
  if (normalized.includes('reaction')) return 'reaction';
  if (normalized.includes('reagent')) return 'reagent';
  return 'literature';
};

const getSourceCounts = (item: CompoundSearchItem) => {
  const counts = {
    literature: 0,
    reaction: 0,
    reagent: 0,
  };

  getSources(item).forEach((source) => {
    const category = getSourceCategory(source.source_type);
    const count = Number(source.count);
    counts[category] += Number.isFinite(count) && count > 0 ? count : 1;
  });

  return counts;
};

const getSynonymsText = (value: CompoundSearchItem['synonyms']) => {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  if (typeof value === 'string') return value;
  return '';
};

const getPatentSourceType = (patent: CompoundPatentItem) => {
  const value = patent.source_type ?? 'Patent';
  const sourceType = String(value || 'Patent').trim() || 'Patent';
  return sourceType.toLowerCase() === 'substance' || sourceType.toLowerCase() === 'patent'
    ? 'Patent'
    : toTitleCaseLabel(sourceType);
};

const decodeSvgEntities = (value: string) =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&');

const getScaffoldImageSrc = (value?: string | null) => {
  if (!value) return '';
  let text = String(value).trim();
  if (!text) return '';

  if (/^https?:\/\//i.test(text) || text.startsWith('data:image')) return text;
  if (text.startsWith('/')) return text;

  if (/%3C(?:svg|%3Fxml)/i.test(text)) {
    try {
      text = decodeURIComponent(text);
    } catch {
      // Keep the original value and continue with the remaining checks.
    }
  }

  text = decodeSvgEntities(text);

  const svgStartIndex = text.search(/<svg[\s>]/i);
  if (svgStartIndex >= 0) {
    const svgText = text.slice(svgStartIndex);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
  }

  return '';
};

const normalizePublicationNumber = (value: string) => value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

const getBrowserPdfUrl = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/raid/')) return null;
  if (trimmed.startsWith('/')) return trimmed;
  return null;
};

const getPatentPdfDownloadUrl = (patent: CompoundPatentItem) => {
  const directUrl = getBrowserPdfUrl(patent.ocr_pdf_path);
  if (directUrl) return directUrl;

  const publicationNumber = typeof patent.publication_number === 'string'
    ? normalizePublicationNumber(patent.publication_number)
    : '';
  if (!publicationNumber || !patent.ocr_pdf_path) return null;
  return patentAnalysisApi.getPatentPdfUrl(publicationNumber);
};

const downloadPatentPdf = (patent: CompoundPatentItem) => {
  const pdfUrl = getPatentPdfDownloadUrl(patent);
  if (!pdfUrl) return;

  const publicationNumber = typeof patent.publication_number === 'string'
    ? normalizePublicationNumber(patent.publication_number)
    : 'patent-document';
  const filename = `${publicationNumber || 'patent-document'}.pdf`;
  const link = document.createElement('a');
  link.href = pdfUrl;
  link.download = filename;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const SourceCountButton: React.FC<{
  type: Exclude<SourceFilter, 'all'>;
  count: number;
  compact?: boolean;
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
}> = ({ type, count, compact = false, onClick }) => {
  const iconMap = {
    literature: <BookOpen size={compact ? 12 : 14} />,
    reaction: <FlaskConical size={compact ? 12 : 14} />,
    reagent: <Beaker size={compact ? 12 : 14} />,
  };
  const labelMap = {
    literature: '책/문헌',
    reaction: '반응',
    reagent: '시약',
  };

  return (
    <Tooltip title={`${labelMap[type]}: ${formatNumberWithComma(count)}`}>
      <Button
        className="compound-search-source-button"
        size="small"
        icon={iconMap[type]}
        disabled={count === 0}
        onClick={onClick}
      >
        {compact ? formatNumberWithComma(count) : `${labelMap[type]}: ${formatNumberWithComma(count)}`}
      </Button>
    </Tooltip>
  );
};

const CompoundSearchCard: React.FC<{
  item: CompoundSearchItem;
  index: number;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onPreview: (svg?: string) => void;
  onOpenDetail: () => void;
}> = ({ item, index, selected, onSelect, onPreview, onOpenDetail }) => {
  const counts = getSourceCounts(item);
  const compoundId = getCompoundId(item);

  return (
    <Card
      className={`compound-search-card v-item-card${selected ? ' selected' : ''}`}
      styles={{ body: { padding: 0 } }}
    >
      <div className="compound-search-card-toolbar">
        <Checkbox checked={selected} onChange={(event) => onSelect(event.target.checked)} />
        <Text type="secondary" className="compound-search-card-index">{formatNumberWithComma(index + 1)}</Text>
      </div>
      <div className="compound-search-card-body">
        <div className="compound-search-card-title-row">
          <Text strong className="compound-search-id-text">{compoundId}</Text>
          <Tooltip title="내 보드에 저장">
            <Button type="text" size="small" icon={<Bookmark size={15} />} />
          </Tooltip>
        </div>
        <CompoundStructureView
          smiles={item.canonical_smiles}
          title={compoundId}
          width="100%"
          height={116}
          fullWidth
          preferRdkitSvg
          rdkitMinSize={[220, 140]}
          structureFitMode="contain"
          frameClassName="compound-search-structure-frame"
          actionPlacement="overlay"
          showCopyAction
          showPreviewAction
          onPreview={onPreview}
        />
        <div className="compound-search-formula-line">
          <Text>{item.common_name || getSynonymsText(item.synonyms) || item.canonical_smiles || '-'}</Text>
        </div>
        <div className="compound-search-source-actions">
          <SourceCountButton type="literature" count={counts.literature} compact onClick={(event) => { event.stopPropagation(); onOpenDetail(); }} />
          <SourceCountButton type="reaction" count={counts.reaction} compact onClick={(event) => { event.stopPropagation(); onOpenDetail(); }} />
          <SourceCountButton type="reagent" count={counts.reagent} compact onClick={(event) => { event.stopPropagation(); onOpenDetail(); }} />
        </div>
      </div>
    </Card>
  );
};

const CompoundSearchFullRow: React.FC<{
  item: CompoundSearchItem;
  index: number;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onPreview: (svg?: string) => void;
  onOpenDetail: () => void;
}> = ({ item, index, selected, onSelect, onPreview, onOpenDetail }) => {
  const counts = getSourceCounts(item);
  const compoundId = getCompoundId(item);

  return (
    <Card
      className={`compound-search-full-row v-item-card${selected ? ' selected' : ''}`}
      styles={{ body: { padding: 0 } }}
    >
      <div className="compound-search-full-toolbar">
        <Checkbox checked={selected} onChange={(event) => onSelect(event.target.checked)} />
        <Text type="secondary">{formatNumberWithComma(index + 1)}</Text>
        <div className="compound-search-full-toolbar-actions">
          <Tooltip title="내 보드에 저장">
            <Button type="text" size="small" icon={<Bookmark size={15} />} />
          </Tooltip>
        </div>
      </div>
      <div className="compound-search-full-content">
        <div className="compound-search-full-structure">
          <CompoundStructureView
            smiles={item.canonical_smiles}
            title={compoundId}
            width="100%"
            height={164}
            fullWidth
            preferRdkitSvg
            rdkitMinSize={[260, 180]}
            structureFitMode="contain"
            frameClassName="compound-search-structure-frame"
            actionPlacement="overlay"
            showPreviewAction
            showCopyAction
            onPreview={onPreview}
          />
          <div className="compound-search-source-actions">
            <SourceCountButton type="literature" count={counts.literature} compact onClick={(event) => { event.stopPropagation(); onOpenDetail(); }} />
            <SourceCountButton type="reaction" count={counts.reaction} compact onClick={(event) => { event.stopPropagation(); onOpenDetail(); }} />
            <SourceCountButton type="reagent" count={counts.reagent} compact onClick={(event) => { event.stopPropagation(); onOpenDetail(); }} />
          </div>
        </div>
        <div className="compound-search-full-detail">
          <Title level={5} className="compound-search-full-title">{compoundId}</Title>
          <Text className="compound-search-full-subtitle">{item.common_name || getSynonymsText(item.synonyms) || item.canonical_smiles || '-'}</Text>
          <div className="compound-search-property-form">
            {PROPERTY_ROWS.map((row) => ({
              label: row.label,
              value: normalizeNumber(item[row.key]),
            }))
              .filter(row => row.value !== '-')
              .map((row) => (
                <div className="compound-search-property-form-row" key={row.label}>
                  <Text type="secondary" className="compound-search-property-label">{row.label}</Text>
                  <Text className="compound-search-property-value">{row.value}</Text>
                </div>
              ))}
          </div>
        </div>
      </div>
    </Card>
  );
};

const CompoundPatentReferenceCard: React.FC<{
  patent: CompoundPatentItem;
  index: number;
  onOpenPatentDetail: (publicationNumber: string, compoundId?: string | number | null) => void;
}> = ({ patent, index, onOpenPatentDetail }) => {
  const publicationNumber = String(patent.publication_number ?? '-');
  const scaffoldImages = [
    { label: 'Genus Markush', src: getScaffoldImageSrc(patent.genus_markush_img) },
    { label: 'Scaffold', src: getScaffoldImageSrc(patent.key_scaffold_img) },
  ].filter((image) => image.src);
  const pdfUrl = getPatentPdfDownloadUrl(patent);
  const normalizedPublicationNumber = publicationNumber !== '-'
    ? normalizePublicationNumber(publicationNumber)
    : '';

  return (
    <div className="compound-search-reference-card">
      <div className="compound-search-reference-index">{formatNumberWithComma(index + 1)}</div>
      <div className="compound-search-reference-body">
        <div className="compound-search-reference-main">
          <Button
            type="link"
            className="compound-search-reference-number"
            disabled={!normalizedPublicationNumber}
            onClick={() => onOpenPatentDetail(normalizedPublicationNumber, patent.compound_id)}
          >
            {publicationNumber}
          </Button>
          <Title
            level={5}
            className="compound-search-reference-title"
            onClick={() => {
              if (normalizedPublicationNumber) {
                onOpenPatentDetail(normalizedPublicationNumber, patent.compound_id);
              }
            }}
          >
            {patent.title || '-'}
          </Title>
          <div className="compound-search-reference-meta">
            {patent.target ? <Text><strong>Targets:</strong> {String(patent.target)}</Text> : null}
            {patent.applicant ? <Text><strong>Applicants:</strong> {String(patent.applicant)}</Text> : null}
            {patent.filling_language ? <Text><strong>Language:</strong> {String(patent.filling_language)}</Text> : null}
            {patent.patent_type ? <Tag>{String(patent.patent_type)}</Tag> : null}
          </div>
          <Text className="compound-search-reference-abstract">
            {patent.abstract || '-'}
          </Text>
          {scaffoldImages.length > 0 ? (
            <div className="compound-search-reference-images">
              {scaffoldImages.map((image) => (
                <div className="compound-search-reference-image-block" key={image.label}>
                  <Text strong>{image.label}</Text>
                  <div className="compound-search-reference-scaffold">
                    <img src={image.src} alt={image.label} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="compound-search-reference-side">
          <div className="compound-search-reference-dates">
            <Text><CalendarDays size={13} /> Publication: {formatDisplayDate(patent.publication_date)}</Text>
            <Text><CalendarDays size={13} /> Filing: {formatDisplayDate(patent.filling_date)}</Text>
          </div>
          <div className="compound-search-reference-actions">
            <Button
              size="small"
              icon={<ExternalLink size={13} />}
              disabled={!pdfUrl}
              onClick={() => downloadPatentPdf(patent)}
            >
              OCR PDF 다운로드
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const CompoundSourceReferenceList: React.FC<{
  sources: CompoundSearchSource[];
}> = ({ sources }) => {
  return (
    <div className="compound-search-source-reference-list">
      {sources.map((source, index) => {
        const links = getSourceLinkValues(source.source_link);
        const voraLinks = getSourceLinkValues(source.vora_link);
        const sourceName = source.source_name ? String(source.source_name) : '-';

        return (
          <div className="compound-search-source-reference-row" key={`${source.compound_source_id ?? source.source_id ?? index}-${index}`}>
            <div className="compound-search-source-reference-index">{formatNumberWithComma(index + 1)}</div>
            <div className="compound-search-source-reference-fields">
              <div className="compound-search-source-reference-field">
                <Text type="secondary">source_name</Text>
                <Text>{sourceName}</Text>
              </div>
              <div className="compound-search-source-reference-field compound-search-source-reference-link-field">
                <Text type="secondary">source_link</Text>
                {renderSourceLinkValues(links)}
              </div>
              {voraLinks.length > 0 ? (
                <div className="compound-search-source-reference-field compound-search-source-reference-link-field">
                  <Text type="secondary">vora_link</Text>
                  {renderSourceLinkValues(voraLinks)}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const UniversalSearch: React.FC = () => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { setHeaderContent } = useUIStore();

  const [query, setQuery] = useState('');
  const [engine, setEngine] = useState<CompoundSearchEngine>('fast');
  const [inputType, setInputType] = useState<CompoundSearchInputType>('smiles');
  const [searchType, setSearchType] = useState<CompoundSearchType>('substructure');
  const [sortField, setSortField] = useState('');
  const [sortOrder, setSortOrder] = useState<CompoundSearchSortOrder>('desc');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [viewMode, setViewMode] = useState<ResultViewMode>('card');
  const [showFilters, setShowFilters] = useState(false);
  const [items, setItems] = useState<CompoundSearchItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isChemDrawVisible, setIsChemDrawVisible] = useState(false);
  const [previewSvg, setPreviewSvg] = useState<string | null>(null);
  const [detailCompound, setDetailCompound] = useState<CompoundSearchItem | null>(null);
  const [patentItems, setPatentItems] = useState<CompoundPatentItem[]>([]);
  const [selectedPatentSourceTypes, setSelectedPatentSourceTypes] = useState<string[]>([]);
  const [isLoadingPatents, setIsLoadingPatents] = useState(false);
  const [patentDetailError, setPatentDetailError] = useState<string | null>(null);
  const [viewportWidth, setViewportWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 1920;
    return window.innerWidth;
  });
  const layoutPreset = useMemo(() => getPatentAnalysisLayoutPreset(viewportWidth), [viewportWidth]);
  const isResponsiveToolbar = viewportWidth <= 1100;

  useEffect(() => {
    setHeaderContent(<PageHeaderBreadcrumb items={[{ label: '통합검색' }]} />);
    return () => setHeaderContent(null);
  }, [setHeaderContent]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const filteredItems = useMemo(() => {
    if (sourceFilter === 'all') return items;
    return items.filter((item) => getSourceCounts(item)[sourceFilter] > 0);
  }, [items, sourceFilter]);

  const selectedAll = filteredItems.length > 0
    && filteredItems.every(item => selectedIds.includes(getCompoundId(item)));
  const selectedIndeterminate = filteredItems.some(item => selectedIds.includes(getCompoundId(item))) && !selectedAll;
  const paginationTotal = getPaginationTotal(totalCount, pageSize, engine);
  const maxAccessiblePage = getMaxAccessiblePage(totalCount, pageSize, engine);
  const isFastSearchWindowLimited =
    engine === 'fast' && totalCount > paginationTotal && currentPage >= maxAccessiblePage;
  const isCurrentPageHiddenBySourceFilter = hasSearched && items.length > 0 && filteredItems.length === 0;
  const detailSources = useMemo(() => (
    detailCompound ? getSources(detailCompound) : []
  ), [detailCompound]);
  const displayDetailSources = useMemo(() => (
    detailSources.filter((source) => !isPatentSource(source))
  ), [detailSources]);
  const detailSourceTypes = useMemo(() => (
    Array.from(new Set(displayDetailSources.map(getCompoundSourceType))).sort((a, b) => a.localeCompare(b))
  ), [displayDetailSources]);
  const patentSourceTypes = useMemo(() => (
    Array.from(new Set(patentItems.map(getPatentSourceType))).sort((a, b) => a.localeCompare(b))
  ), [patentItems]);
  const referenceSourceTypes = useMemo(() => (
    Array.from(new Set([...patentSourceTypes, ...detailSourceTypes])).sort((a, b) => a.localeCompare(b))
  ), [detailSourceTypes, patentSourceTypes]);
  const filteredPatentItems = useMemo(() => {
    if (selectedPatentSourceTypes.length === 0) return [];
    return patentItems.filter((patent) => selectedPatentSourceTypes.includes(getPatentSourceType(patent)));
  }, [patentItems, selectedPatentSourceTypes]);
  const filteredDetailSources = useMemo(() => {
    if (selectedPatentSourceTypes.length === 0) return [];
    return displayDetailSources.filter((source) => selectedPatentSourceTypes.includes(getCompoundSourceType(source)));
  }, [displayDetailSources, selectedPatentSourceTypes]);
  const filteredReferenceCount = filteredPatentItems.length + filteredDetailSources.length;
  const totalReferenceCount = patentItems.length + displayDetailSources.length;
  const isAllReferenceSourceTypesSelected = referenceSourceTypes.length > 0
    && referenceSourceTypes.every((sourceType) => selectedPatentSourceTypes.includes(sourceType));

  useEffect(() => {
    if (currentPage > maxAccessiblePage) {
      setCurrentPage(maxAccessiblePage);
    }
  }, [currentPage, maxAccessiblePage]);

  const runSearch = React.useCallback(async (page = currentPage, size = pageSize) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      void message.warning('검색할 SMILES 또는 Molblock을 입력해 주세요.');
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const response = await compoundSearchApi.search({
        engine,
        input_type: inputType,
        search_type: searchType,
        query: trimmedQuery,
        page,
        size,
        sort_field: sortField || null,
        sort_order: sortOrder,
      }, controller.signal);

      setItems(response.items ?? []);
      setTotalCount(Number(response.total_count) || 0);
      setCurrentPage(response.page || page);
      setPageSize(response.size || size);
      setSelectedIds([]);
    } catch (searchError) {
      const messageText = searchError instanceof Error ? searchError.message : '검색 요청에 실패했습니다.';
      setError(messageText);
      setItems([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, engine, inputType, message, pageSize, query, searchType, sortField, sortOrder]);

  const handleSubmit = () => {
    setCurrentPage(1);
    void runSearch(1, pageSize);
  };

  const handlePaginationChange = (page: number, size: number) => {
    const maxPage = getMaxAccessiblePage(totalCount, size, engine);
    const nextPage = Math.min(page, maxPage);
    setCurrentPage(nextPage);
    setPageSize(size);
    void runSearch(nextPage, size);
  };

  const handleToggleSelectAll = (checked: boolean) => {
    const pageIds = filteredItems.map(getCompoundId);
    setSelectedIds((prevIds) => {
      if (checked) {
        return Array.from(new Set([...prevIds, ...pageIds]));
      }
      return prevIds.filter(id => !pageIds.includes(id));
    });
  };

  const handleToggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prevIds) => {
      if (checked) return Array.from(new Set([...prevIds, id]));
      return prevIds.filter(prevId => prevId !== id);
    });
  };

  const openCompoundDetail = React.useCallback((item: CompoundSearchItem) => {
    const canonicalSmiles = item.canonical_smiles?.trim();
    if (!canonicalSmiles) {
      void message.warning('canonical SMILES가 없어 특허 목록을 조회할 수 없습니다.');
      return;
    }

    setDetailCompound(item);
    setPatentItems([]);
    const rowSourceTypes = Array.from(new Set(
      getSources(item).filter((source) => !isPatentSource(source)).map(getCompoundSourceType)
    )).sort((a, b) => a.localeCompare(b));
    setSelectedPatentSourceTypes(rowSourceTypes);
    setPatentDetailError(null);
    setIsLoadingPatents(true);

    const controller = new AbortController();
    void compoundSearchApi.getPatents(canonicalSmiles, controller.signal)
      .then((response) => {
        const nextItems = response.items ?? [];
        const nextPatentSourceTypes = Array.from(new Set(nextItems.map(getPatentSourceType))).sort((a, b) => a.localeCompare(b));
        setPatentItems(nextItems);
        setSelectedPatentSourceTypes(Array.from(new Set([...nextPatentSourceTypes, ...rowSourceTypes])).sort((a, b) => a.localeCompare(b)));
      })
      .catch((detailError) => {
        const messageText = detailError instanceof Error ? detailError.message : '특허 목록 조회에 실패했습니다.';
        setPatentDetailError(messageText);
        setPatentItems([]);
        setSelectedPatentSourceTypes(rowSourceTypes);
      })
      .finally(() => {
        setIsLoadingPatents(false);
      });
  }, [message]);

  const closeCompoundDetail = React.useCallback(() => {
    setDetailCompound(null);
    setPatentItems([]);
    setSelectedPatentSourceTypes([]);
    setPatentDetailError(null);
    setIsLoadingPatents(false);
  }, []);

  const openPatentAnalysisDetail = React.useCallback((publicationNumber: string, compoundId?: string | number | null) => {
    const detailUrl = new URL(`/patents/analysis/${publicationNumber}`, window.location.origin);
    if (compoundId !== undefined && compoundId !== null && String(compoundId).trim()) {
      detailUrl.searchParams.set('compound_id', String(compoundId).trim());
    }
    window.open(`${detailUrl.pathname}${detailUrl.search}`, '_blank', 'noopener,noreferrer');
  }, []);

  return (
    <div
      className="compound-search-page"
      style={{
        maxWidth: layoutPreset.maxWidth,
        margin: '0 auto',
        padding: `0 ${layoutPreset.sidePadding}px`,
        height: '100%',
        width: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'fadeIn 0.3s ease-out' }}>
        <Card variant="borderless" className="c-card compact-filter-card compound-search-filter-card" style={{ marginBottom: 12, flexShrink: 0 }}>
          <Row gutter={[12, 8]} align="middle">
            <Col flex="auto" style={{ minWidth: 0 }}>
              <div
                className="compound-search-primary-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                  minWidth: 0,
                }}
              >
                <Segmented
                  className="compound-search-engine-toggle"
                  options={[
                    { label: 'Advanced', value: 'advanced' },
                    { label: 'Fast', value: 'fast' },
                  ]}
                  value={engine}
                  onChange={(value) => setEngine(value as CompoundSearchEngine)}
                />
                {inputType === 'molblock' ? (
                  <TextArea
                    className="v-search-input compound-search-query-input"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Molblock을 입력하세요"
                    autoSize={{ minRows: 1, maxRows: 5 }}
                    style={{
                      flex: '1 1 260px',
                      minWidth: 180,
                      maxWidth: isResponsiveToolbar ? '100%' : 350,
                    }}
                    onPressEnter={(event) => {
                      if (!event.shiftKey) {
                        event.preventDefault();
                        handleSubmit();
                      }
                    }}
                  />
                ) : (
                  <Input
                    className="v-search-input compound-search-query-input"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="SMILES를 입력하세요. 예: c1ccccc1"
                    prefix={<Search size={18} color={token.colorTextTertiary} />}
                    allowClear
                    onPressEnter={handleSubmit}
                    style={{
                      flex: '1 1 260px',
                      minWidth: 180,
                      maxWidth: isResponsiveToolbar ? '100%' : 350,
                    }}
                  />
                )}
                <Button
                  icon={<BenzeneIcon size={18} />}
                  onClick={() => setIsChemDrawVisible(true)}
                  className="v-action-btn"
                >
                  구조 검색
                </Button>
                <Button
                  icon={showFilters ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  onClick={() => setShowFilters(!showFilters)}
                  className="v-action-btn"
                >
                  상세 필터 {showFilters ? '닫기' : '열기'}
                </Button>
                <Button type="primary" icon={<Search size={16} />} loading={isLoading} onClick={handleSubmit} className="v-action-btn">
                  검색
                </Button>
              </div>
            </Col>
          </Row>

        {showFilters ? (
          <div className="compact-filter-panel compound-search-filter-grid">
            <div className="compound-search-filter-item">
              <Text strong>입력 형식</Text>
              <Radio.Group
                optionType="button"
                buttonStyle="solid"
                value={inputType}
                onChange={(event) => setInputType(event.target.value)}
                options={[
                  { label: 'SMILES', value: 'smiles' },
                  { label: 'Molblock', value: 'molblock' },
                ]}
              />
            </div>
            <div className="compound-search-filter-item">
              <Text strong>검색 방식</Text>
              <Radio.Group
                optionType="button"
                buttonStyle="solid"
                value={searchType}
                onChange={(event) => setSearchType(event.target.value)}
                options={[
                  { label: 'Substructure', value: 'substructure' },
                  { label: 'Identical', value: 'identical' },
                ]}
              />
            </div>
            <div className="compound-search-filter-item">
              <Text strong>Source filter</Text>
              <Select
                value={sourceFilter}
                options={SOURCE_FILTER_OPTIONS}
                onChange={setSourceFilter}
                style={{ width: 132 }}
              />
            </div>
            <div className="compound-search-filter-item">
              <Text strong>정렬</Text>
              <Space.Compact>
                <Select
                  value={sortField}
                  options={SORT_FIELD_OPTIONS}
                  onChange={setSortField}
                  style={{ width: 164 }}
                />
                <Select
                  value={sortOrder}
                  options={[
                    { label: 'DESC', value: 'desc' },
                    { label: 'ASC', value: 'asc' },
                  ]}
                  onChange={setSortOrder}
                  style={{ width: 88 }}
                />
              </Space.Compact>
            </div>
            <div className="compound-search-filter-item compound-search-reset-item">
              <Text strong>초기화</Text>
              <Button icon={<RotateCcw size={15} />} onClick={() => {
                setQuery('');
                setEngine('fast');
                setInputType('smiles');
                setSearchType('substructure');
                setSortField('');
                setSortOrder('desc');
                setSourceFilter('all');
                setItems([]);
                setTotalCount(0);
                setHasSearched(false);
                setError(null);
                setSelectedIds([]);
              }}>
                초기화
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <Card className="c-card compound-search-result-card" styles={{ body: { padding: 0 } }} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="v-table-header compound-search-result-header">
          <Space wrap>
            <Checkbox
              checked={selectedAll}
              indeterminate={selectedIndeterminate}
              onChange={(event) => handleToggleSelectAll(event.target.checked)}
            />
            <Text strong>검색 결과</Text>
            <Text type="secondary">
              {hasSearched ? `${formatNumberWithComma(totalCount)} compounds` : '검색 대기'}
            </Text>
            {selectedIds.length > 0 ? <Tag color="orange">{formatNumberWithComma(selectedIds.length)} selected</Tag> : null}
          </Space>
          <Space wrap>
            <Radio.Group
              className="compound-search-view-toggle"
              value={viewMode}
              onChange={(event) => setViewMode(event.target.value)}
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="card">
                <Grid2X2 size={14} />
              </Radio.Button>
              <Radio.Button value="full">
                <List size={14} />
              </Radio.Button>
            </Radio.Group>
          </Space>
        </div>

        {error ? (
          <div className="compound-search-alert-wrap">
            <Alert type="error" showIcon message="검색 실패" description={error} />
          </div>
        ) : null}
        {isFastSearchWindowLimited ? (
          <div className="compound-search-alert-wrap">
            <Alert
              type="info"
              showIcon
              message="Fast 검색 결과는 상위 10,000건까지만 페이지 이동할 수 있습니다."
              description={`전체 ${formatNumberWithComma(totalCount)}건 중 현재 page size 기준 ${formatNumberWithComma(paginationTotal)}건까지 탐색 가능합니다.`}
            />
          </div>
        ) : null}

        <Spin spinning={isLoading}>
          {!hasSearched ? (
            <div className="compound-search-empty">
              <Empty description="SMILES 또는 Molblock을 입력하고 검색을 실행하세요." />
            </div>
          ) : filteredItems.length === 0 && !isLoading ? (
            <div className="compound-search-empty">
              <Empty
                description={
                  isCurrentPageHiddenBySourceFilter
                    ? '현재 페이지에 선택한 Source filter와 일치하는 결과가 없습니다.'
                    : '검색 결과가 없습니다.'
                }
              />
              {isCurrentPageHiddenBySourceFilter ? (
                <Button size="small" onClick={() => setSourceFilter('all')}>
                  Source filter 전체로 보기
                </Button>
              ) : null}
            </div>
          ) : viewMode === 'card' ? (
            <div className="compound-search-card-view">
              <div className="compound-search-card-grid">
                {filteredItems.map((item, index) => {
                  const compoundId = getCompoundId(item);
                  return (
                    <CompoundSearchCard
                      key={compoundId}
                      item={item}
                      index={(currentPage - 1) * pageSize + index}
                      selected={selectedIds.includes(compoundId)}
                      onSelect={(checked) => handleToggleSelect(compoundId, checked)}
                      onPreview={(svg) => setPreviewSvg(svg ?? null)}
                      onOpenDetail={() => openCompoundDetail(item)}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="compound-search-full-view">
              {filteredItems.map((item, index) => {
                const compoundId = getCompoundId(item);
                return (
                  <CompoundSearchFullRow
                    key={compoundId}
                    item={item}
                    index={(currentPage - 1) * pageSize + index}
                    selected={selectedIds.includes(compoundId)}
                    onSelect={(checked) => handleToggleSelect(compoundId, checked)}
                    onPreview={(svg) => setPreviewSvg(svg ?? null)}
                    onOpenDetail={() => openCompoundDetail(item)}
                  />
                );
              })}
            </div>
          )}
        </Spin>

        {hasSearched && totalCount > 0 ? (
          <Pagination
            className="v-common-pagination"
            current={currentPage}
            pageSize={pageSize}
            total={paginationTotal}
            pageSizeOptions={PAGE_SIZE_OPTIONS.map(String)}
            showSizeChanger
            itemRender={(page, type, originalElement) => {
              if (type !== 'page') return originalElement;
              return <span>{formatNumberWithComma(page)}</span>;
            }}
            onChange={handlePaginationChange}
          />
        ) : null}
      </Card>

      <Modal
        open={Boolean(previewSvg)}
        title="Structure Preview"
        footer={null}
        width={720}
        onCancel={() => setPreviewSvg(null)}
      >
        <div
          className="compound-search-preview"
          style={{ borderColor: token.colorBorderSecondary }}
          dangerouslySetInnerHTML={{ __html: previewSvg ?? '' }}
        />
      </Modal>
      <ChemDrawModal
        open={isChemDrawVisible}
        onCancel={() => setIsChemDrawVisible(false)}
        onConfirm={(data) => {
          const smiles = data.smiles?.trim();
          const molblock = data.molfile?.trim() || data.molV2000?.trim() || data.molV3000?.trim() || '';
          setQuery(smiles || molblock);
          setInputType(smiles ? 'smiles' : 'molblock');
          setSearchType('substructure');
          setIsChemDrawVisible(false);
        }}
        title="구조 검색"
        confirmText="이 구조로 검색"
        initialSmiles={inputType === 'smiles' ? query : undefined}
        initialMolblock={inputType === 'molblock' ? query : undefined}
      />
      <Modal
        open={Boolean(detailCompound)}
        title={`References for ${getCompoundId(detailCompound ?? {})}`}
        footer={null}
        width={1120}
        onCancel={closeCompoundDetail}
        className="compound-search-reference-modal"
      >
        <Spin
          spinning={isLoadingPatents}
          wrapperClassName="compound-search-reference-spin"
        >
          <div className="compound-search-reference-layout">
            <aside className="compound-search-reference-filter">
              <div className="compound-search-reference-filter-head">
                <Text strong>Filter Results</Text>
                <Text type="secondary">{formatNumberWithComma(filteredReferenceCount)} / {formatNumberWithComma(totalReferenceCount)}</Text>
              </div>
              <div className="compound-search-reference-filter-section">
                <Text strong>Source Type</Text>
                <Checkbox.Group
                  className="compound-search-reference-checkboxes"
                  value={selectedPatentSourceTypes}
                  onChange={(values) => setSelectedPatentSourceTypes(values.map(String))}
                >
                  {referenceSourceTypes.map((sourceType) => (
                    <Checkbox key={sourceType} value={sourceType}>
                      {sourceType} ({formatNumberWithComma(
                        patentItems.filter((patent) => getPatentSourceType(patent) === sourceType).length
                        + displayDetailSources.filter((source) => getCompoundSourceType(source) === sourceType).length
                      )})
                    </Checkbox>
                  ))}
                </Checkbox.Group>
                <Button
                  size="small"
                  onClick={() => setSelectedPatentSourceTypes(isAllReferenceSourceTypesSelected ? [] : referenceSourceTypes)}
                >
                  {isAllReferenceSourceTypesSelected ? '전체 해제' : '전체 선택'}
                </Button>
              </div>
            </aside>
            <section className="compound-search-reference-results">
              {patentDetailError ? (
                <Alert type="error" showIcon message="특허 목록 조회 실패" description={patentDetailError} />
              ) : null}
              {referenceSourceTypes.filter((sourceType) => selectedPatentSourceTypes.includes(sourceType)).length === 0 ? (
                <Empty description={totalReferenceCount > 0 ? '선택한 Source Type에 해당하는 결과가 없습니다.' : 'Source 데이터가 없습니다.'} />
              ) : (
                referenceSourceTypes
                  .filter((sourceType) => selectedPatentSourceTypes.includes(sourceType))
                  .map((sourceType) => {
                    const patentsForType = patentItems.filter((patent) => getPatentSourceType(patent) === sourceType);
                    const sourcesForType = displayDetailSources.filter((source) => getCompoundSourceType(source) === sourceType);
                    const sectionCount = patentsForType.length + sourcesForType.length;

                    if (sectionCount === 0) return null;

                    return (
                      <div className="compound-search-reference-section" key={sourceType}>
                        <div className="compound-search-reference-section-head">
                          <Text strong>{sourceType}</Text>
                          <Text type="secondary">{formatNumberWithComma(sectionCount)} items</Text>
                        </div>
                        {patentsForType.length > 0 ? (
                          <div className="compound-search-reference-list">
                            {patentsForType.map((patent, index) => (
                              <CompoundPatentReferenceCard
                                key={`${patent.publication_number ?? 'patent'}-${index}`}
                                patent={patent}
                                index={index}
                                onOpenPatentDetail={openPatentAnalysisDetail}
                              />
                            ))}
                          </div>
                        ) : null}
                        {sourcesForType.length > 0 ? (
                          <CompoundSourceReferenceList sources={sourcesForType} />
                        ) : null}
                      </div>
                    );
                  })
              )}
            </section>
          </div>
        </Spin>
      </Modal>
      </div>
    </div>
  );
};

export default UniversalSearch;
