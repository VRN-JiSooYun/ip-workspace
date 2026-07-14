import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Row, Col, Card, Table, Button, Input,
  Space, Modal, Form, Select, DatePicker, Avatar, Divider, Segmented, Tooltip, theme, Spin, Popover, App as AntApp
} from 'antd';
import {
  Search, ChevronDown, ChevronUp,
  Settings, Download, Info, GripVertical, CheckCircle2, XCircle, ArrowLeft,
  PanelLeftClose, PanelLeftOpen, Minus, Plus, RotateCcw, RotateCw, Pin, Palette
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { mockCompounds, type Compound, type CompoundQuickViewerAssetType } from '../mocks/compounds';
import { useBoardStore } from '../store/useBoardStore';
import {
  DEFAULT_GROUP_STRUCTURE_VIEW_SETTINGS,
  type SarAbbreviationMode,
  type SarAtomColorMode,
  type SarHighlightMode,
} from '../store/useBoardStore';
import { getPatentAnalysisLayoutPreset } from '../config/patentAnalysisLayout';
import dayjs from 'dayjs';
import { useUIStore } from '../store/useUIStore';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import BenzeneIcon from '../components/common/BenzeneIcon';
import ChemDrawModal, { type ChemDrawStructureData } from '../components/common/ChemDrawModal';
import StructurePreviewModal from '../components/common/StructurePreviewModal';
import ToggleTag from '../components/common/ToggleTag';
import CompoundStructureView from '../components/common/CompoundStructureView';
import QuickViewerPanel from '../components/myboard/QuickViewerPanel';
import { formatNumberWithComma } from '../utils/displayFormat';
import {
  createRdkitSvgCacheKey,
  getRdkitStructureSourceKey,
  renderRdkitClusterSvgs,
  type RdkitAbbrevOption,
  type RdkitClusterRGroup,
  type RdkitClusterHighlightMode,
  type RdkitHighlightColor,
  type RdkitSubstructureColorInfo,
} from '../services/structureRendering';
import arrowDivideIcon from '../assets/svg/arrow-divide.svg';
import arrowMergeIcon from '../assets/svg/arrow-merge.svg';
import bookmarkIconRaw from '../assets/svg/bookmark.svg?raw';

const { Title, Text } = Typography;

const SAR_COMPOUND_CARD_GAP = 6;
const SAR_COMPOUND_CARD_GRID_COLUMN_GAP = 4;
const SAR_COMPOUND_CARD_GRID_ROW_GAP = 6;
const SAR_COMPOUND_CARD_BASE_WIDTH = 200;
const SAR_COMPOUND_CARD_BASE_STRUCTURE_HEIGHT = 148;
const SAR_COMPOUND_CARD_EXPANDED_WIDTH = SAR_COMPOUND_CARD_BASE_WIDTH * 2;
const SAR_COMPOUND_CARD_EXPANDED_STRUCTURE_HEIGHT = SAR_COMPOUND_CARD_BASE_STRUCTURE_HEIGHT * 2;
const SAR_COMPOUND_CARD_IMAGE_SCALE_MIN = 60;
const SAR_COMPOUND_CARD_IMAGE_SCALE_MAX = 130;
const SAR_COMPOUND_CARD_SETTING_STEP = 5;
const SAR_COMPOUND_CARD_SCALE_BASE_RATIO = 0.95;
const SAR_COMPOUND_MULTI_SELECT_MAX_HEIGHT = 380;
const SAR_COMPOUND_CARD_ROTATION_STEP = 30;
const SAR_RDKIT_CLUSTER_ERROR_NOTIFICATION_KEY = 'sar-rdkit-cluster-error';
const SAR_COMPOUND_CARD_OVERLAP_MIN = 0;
const SAR_COMPOUND_CARD_OVERLAP_MAX = 50;
const SAR_GROUP_STRUCTURE_WIDTH = 130;
const SAR_GROUP_STRUCTURE_HEIGHT = 97.5;
const SAR_GROUP_STRUCTURE_PANEL_WIDTH = 146;
const SAR_GROUP_STRUCTURE_COLUMN_WIDTH = 138;
const SAR_TABLE_ROW_HEIGHT = 34;
const SAR_TABLE_MIN_VISIBLE_ROWS = 10;
const SAR_TABLE_SCROLLBAR_GUTTER_HEIGHT = 18;
const SAR_TABLE_BODY_MIN_HEIGHT =
  SAR_TABLE_ROW_HEIGHT * SAR_TABLE_MIN_VISIBLE_ROWS + SAR_TABLE_SCROLLBAR_GUTTER_HEIGHT;
const SAR_DATA_LEFT_ASSET_TYPES = new Set<CompoundQuickViewerAssetType>(['kp']);
const isChemDrawModalEventTarget = (target: EventTarget | null) => (
  target instanceof HTMLElement && Boolean(target.closest('.chemdraw-modal'))
);
const SAR_DATA_RIGHT_ASSET_ORDER: CompoundQuickViewerAssetType[] = ['pdb', 'docking', 'md'];
const SAR_DATA_RIGHT_ASSET_ORDER_INDEX = new Map(
  SAR_DATA_RIGHT_ASSET_ORDER.map((assetType, index) => [assetType, index])
);
const SAR_QUICK_VIEWER_MIN_WIDTH = 360;
const SAR_QUICK_VIEWER_MAX_WIDTH = 868;
const SAR_QUICK_VIEWER_DEFAULT_WIDTH = 460;
const SAR_SCAFFOLD_HIGHLIGHT_COLOR = 'red';
const SAR_SCAFFOLD_COLOR_OPTIONS: Array<{ key: RdkitHighlightColor; color: string }> = [
  { key: 'red', color: '#ffa6a6' },
  { key: 'orange', color: '#ed9164' },
  { key: 'yellow', color: '#ebeb0a' },
  { key: 'green', color: '#a6ffa6' },
  { key: 'blue', color: '#a6a6ff' },
  { key: 'naby', color: '#a6a6d3' },
  { key: 'purple', color: '#dba6ed' },
];
type SvgIntrinsicSize = { width: number; height: number };
type SarApiCellValue = string | number | null | undefined;
type SarApiRow = Record<string, string | number | null>;
type SarTableRow = Compound & {
  sarTableRowKey: string;
  sarApiRow?: SarApiRow;
  children?: SarTableRow[];
};
const isSarCompoundSelectionSurface = (target: Element) => (
  Boolean(target.closest('.sar-table-card, .sar-compound-card-list, .quick-viewer-panel'))
);
const insertCompoundsAfterGroupTail = (rows: Compound[], compoundsToInsert: Compound[]) => (
  compoundsToInsert.reduce<Compound[]>((currentRows, compound) => {
    const rowsWithoutCompound = currentRows.filter((row) => row.id !== compound.id);
    const lastGroupIndex = rowsWithoutCompound.reduce((lastIndex, row, index) => (
      row.groupId === compound.groupId ? index : lastIndex
    ), -1);
    const insertIndex = lastGroupIndex >= 0 ? lastGroupIndex + 1 : rowsWithoutCompound.length;

    return [
      ...rowsWithoutCompound.slice(0, insertIndex),
      compound,
      ...rowsWithoutCompound.slice(insertIndex),
    ];
  }, rows)
);
const createSvgMaskUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
const bookmarkIconMaskUrl = createSvgMaskUrl(bookmarkIconRaw);

const getSarAbbrevOption = (mode: SarAbbreviationMode): RdkitAbbrevOption => {
  if (mode === 'all') return 2;
  if (mode === 'off') return 0;
  return 1;
};

const getSvgIntrinsicSize = (svg?: string | null): SvgIntrinsicSize | null => {
  if (!svg?.trim() || typeof DOMParser === 'undefined') return null;

  try {
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const root = doc.documentElement;
    if (!root || root.nodeName.toLowerCase() !== 'svg') return null;

    const width = Number.parseFloat(root.getAttribute('width') || '');
    const height = Number.parseFloat(root.getAttribute('height') || '');
    if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
      return { width: Math.ceil(width), height: Math.ceil(height) };
    }

    const viewBox = root.getAttribute('viewBox')?.trim().split(/\s+/).map(Number);
    if (viewBox && viewBox.length === 4) {
      const [, , viewBoxWidth, viewBoxHeight] = viewBox;
      if (Number.isFinite(viewBoxWidth) && viewBoxWidth > 0 && Number.isFinite(viewBoxHeight) && viewBoxHeight > 0) {
        return { width: Math.ceil(viewBoxWidth), height: Math.ceil(viewBoxHeight) };
      }
    }
  } catch {
    return null;
  }

  return null;
};

function getRangeSelectionIds<T extends { id: string }>(rows: T[], anchorId: string | null, targetId: string) {
  if (!anchorId) return [targetId];

  const anchorIndex = rows.findIndex((row) => row.id === anchorId);
  const targetIndex = rows.findIndex((row) => row.id === targetId);

  if (anchorIndex < 0 || targetIndex < 0) return [targetId];

  const startIndex = Math.min(anchorIndex, targetIndex);
  const endIndex = Math.max(anchorIndex, targetIndex);
  return rows.slice(startIndex, endIndex + 1).map((row) => row.id);
}

const SarTable: React.FC = () => {
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const { notification } = AntApp.useApp();
  const { isDarkMode } = useTheme();
  const {
    selectedGroupIds,
    selectedSarCompoundIds,
    hiddenCompoundIds,
    bookmarkedGroupIds,
    externalCompoundRows,
    groupedCompoundSarData,
    groups,
    groupStructureViewSettings,
    setSelectedGroupIds,
    setSelectedSarCompoundIds,
    toggleBookmarkedGroup,
    updateGroupStructureViewSettings,
  } = useBoardStore();
  const { setHeaderContent } = useUIStore();

  useEffect(() => {
    setHeaderContent(
      <PageHeaderBreadcrumb
        items={[
          { label: 'Design', onClick: () => navigate('/design') },
          { label: 'SAR Table' }
        ]}
      />
    );
    return () => setHeaderContent(null);
  }, [setHeaderContent, navigate]);

  const [keyword, setKeyword] = useState<string>('');
  const [structurePreview, setStructurePreview] = useState<{
    title: string;
    svg: string;
    smiles?: string | null;
    molblock?: string | null;
    cdxml?: string | null;
  } | null>(null);
  const [structureRenderVersion, setStructureRenderVersion] = useState(0);
  const [compoundStructureSvgSizes, setCompoundStructureSvgSizes] = useState<Record<string, SvgIntrinsicSize>>({});
  const [compoundStructureBaselineSvgSizes, setCompoundStructureBaselineSvgSizes] = useState<Record<string, SvgIntrinsicSize>>({});
  const allCompoundRows = useMemo(() => {
    return insertCompoundsAfterGroupTail(
      mockCompounds.filter((compound) => !externalCompoundRows.some((external) => external.id === compound.id)),
      externalCompoundRows
    );
  }, [externalCompoundRows, structureRenderVersion]);
  const compoundBaseOrderMap = useMemo(() => (
    allCompoundRows.reduce<Record<string, number>>((acc, compound, index) => {
      acc[compound.id] = index;
      return acc;
    }, {})
  ), [allCompoundRows]);
  const selectedGroupOrderMap = useMemo(() => (
    selectedGroupIds.reduce<Record<string, number>>((acc, groupId, index) => {
      acc[groupId] = index + 1;
      return acc;
    }, {})
  ), [selectedGroupIds]);
  const selectedSarCompoundOrderMap = useMemo(() => (
    selectedSarCompoundIds.reduce<Record<string, number>>((acc, compoundId, index) => {
      acc[compoundId] = index;
      return acc;
    }, {})
  ), [selectedSarCompoundIds]);
  const sarApiRowsByCompoundCode = useMemo(() => (
    groupedCompoundSarData.reduce<Record<string, typeof groupedCompoundSarData[number]['rows']>>((acc, group) => {
      acc[group.compound_code] = group.rows;
      return acc;
    }, {})
  ), [groupedCompoundSarData]);
  const firstCompoundByGroupId = useMemo(() => {
    return allCompoundRows
      .filter((compound) => !hiddenCompoundIds.includes(compound.id))
      .reduce<Record<string, Compound>>((acc, compound) => {
      if (!acc[compound.groupId]) {
        acc[compound.groupId] = compound;
      }
      return acc;
    }, {});
  }, [allCompoundRows, hiddenCompoundIds]);
  const handleCompoundStructureGenerated = React.useCallback((
    compoundId: string,
    data: { molBlock: string; svg: string; cacheKey: string },
    displayBaselineKey?: string,
  ) => {
    const svgSize = getSvgIntrinsicSize(data.svg);
    if (svgSize) {
      setCompoundStructureSvgSizes((prev) => {
        const current = prev[compoundId];
        const cacheSizeKey = `${compoundId}:${data.cacheKey}`;
        const currentCacheSize = prev[cacheSizeKey];
        if (
          current?.width === svgSize.width
          && current?.height === svgSize.height
          && currentCacheSize?.width === svgSize.width
          && currentCacheSize?.height === svgSize.height
        ) return prev;
        return {
          ...prev,
          [compoundId]: svgSize,
          [cacheSizeKey]: svgSize,
        };
      });
      if (displayBaselineKey) {
        setCompoundStructureBaselineSvgSizes((prev) => (
          prev[displayBaselineKey]
            ? prev
            : { ...prev, [displayBaselineKey]: svgSize }
        ));
      }
    }

    const mockCompound = mockCompounds.find((compound) => compound.id === compoundId);
    if (!mockCompound) return;

    if (!mockCompound.molBlock && data.molBlock) {
      mockCompound.molBlock = data.molBlock;
    }
    mockCompound.rdkitSvg = mockCompound.rdkitSvg || data.svg;
    mockCompound.rdkitSvgCache = {
      ...(mockCompound.rdkitSvgCache ?? {}),
      [data.cacheKey]: data.svg,
    };
    setStructureRenderVersion((version) => version + 1);
  }, []);

  const sarCompounds = useMemo(() => {
    let base = selectedGroupIds.length > 0
      ? allCompoundRows.filter((compound) => selectedGroupIds.includes(compound.groupId))
      : selectedSarCompoundIds.length > 0
        ? allCompoundRows.filter((compound) => selectedSarCompoundIds.includes(compound.id))
        : [];
    base = base.filter((compound) => !hiddenCompoundIds.includes(compound.id));
    base = base.map((compound) => ({
      ...compound,
      sarApiRows: sarApiRowsByCompoundCode[compound.compoundId],
    }));

    if (keyword) {
      base = base.filter(c =>
        c.id.toLowerCase().includes(keyword.toLowerCase()) ||
        c.compoundId.toLowerCase().includes(keyword.toLowerCase()) ||
        c.name.toLowerCase().includes(keyword.toLowerCase()) ||
        c.smiles?.toLowerCase().includes(keyword.toLowerCase())
      );
    }
    return base.sort((a, b) => {
      if (selectedGroupIds.length > 0) {
        const aGroupOrder = selectedGroupOrderMap[a.groupId] ?? Number.MAX_SAFE_INTEGER;
        const bGroupOrder = selectedGroupOrderMap[b.groupId] ?? Number.MAX_SAFE_INTEGER;
        if (aGroupOrder !== bGroupOrder) return aGroupOrder - bGroupOrder;
      } else if (selectedSarCompoundIds.length > 0) {
        const aSelectedOrder = selectedSarCompoundOrderMap[a.id] ?? Number.MAX_SAFE_INTEGER;
        const bSelectedOrder = selectedSarCompoundOrderMap[b.id] ?? Number.MAX_SAFE_INTEGER;
        if (aSelectedOrder !== bSelectedOrder) return aSelectedOrder - bSelectedOrder;
      }

      return (compoundBaseOrderMap[a.id] ?? Number.MAX_SAFE_INTEGER) - (compoundBaseOrderMap[b.id] ?? Number.MAX_SAFE_INTEGER);
    });
  }, [
    allCompoundRows,
    compoundBaseOrderMap,
    hiddenCompoundIds,
    keyword,
    sarApiRowsByCompoundCode,
    selectedGroupIds,
    selectedGroupOrderMap,
    selectedSarCompoundIds,
    selectedSarCompoundOrderMap,
  ]);

  const [isColorActive, setIsColorActive] = useState(false);
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [selectedCompoundIds, setSelectedCompoundIds] = useState<string[]>([]);
  const [hoveredRowKey, setHoveredRowKey] = useState<string | null>(null);
  const [pinnedCompoundIds, setPinnedCompoundIds] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isStructureModalOpen, setIsStructureModalOpen] = useState(false);
  const [isScaffoldModalOpen, setIsScaffoldModalOpen] = useState(false);
  const [isScaffoldColorPickerOpen, setIsScaffoldColorPickerOpen] = useState(false);
  const [searchedSvg, setSearchedSvg] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<number>(1);
  const [compoundCardViewMode, setCompoundCardViewMode] = useState<'single' | 'twoRows'>('single');
  const [sarCompoundTypeFilter, setSarCompoundTypeFilter] = useState<'all' | 'compound' | 'design'>('all');
  const [isCompoundStructureCollapsed, setIsCompoundStructureCollapsed] = useState(false);
  const [isGroupStructureCollapsed, setIsGroupStructureCollapsed] = useState(false);
  const [viewportWidth, setViewportWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 1920;
    return window.innerWidth;
  });
  const [sarTableBodyHeight, setSarTableBodyHeight] = useState(SAR_TABLE_BODY_MIN_HEIGHT);
  const [clusterSvgByCompoundId, setClusterSvgByCompoundId] = useState<Record<string, string>>({});
  const [clusterRGroupsByCompoundId, setClusterRGroupsByCompoundId] = useState<Record<string, Record<string, RdkitClusterRGroup>>>({});
  const [isClusterLoading, setIsClusterLoading] = useState(false);
  const [quickViewer, setQuickViewer] = useState<{
    compound: Compound;
    activeType: CompoundQuickViewerAssetType;
  } | null>(null);
  const [quickViewerWidth, setQuickViewerWidth] = useState(SAR_QUICK_VIEWER_DEFAULT_WIDTH);
  const [isResizingQuickViewer, setIsResizingQuickViewer] = useState(false);
  const sarTableCardRef = React.useRef<HTMLDivElement | null>(null);
  const clusterRequestSeqRef = React.useRef(0);
  const quickViewerPaneRef = React.useRef<HTMLDivElement | null>(null);
  const quickViewerResizeRafRef = React.useRef<number | null>(null);
  const groupStructureSelectionAnchorRef = React.useRef<string | null>(null);
  const compoundSelectionAnchorRef = React.useRef<string | null>(null);
  const scaffoldEditBaselineRef = React.useRef<{ smiles?: string; molBlock?: string } | null>(null);
  const scaffoldEditDirtyRef = React.useRef(false);
  const quickViewerStorageKey = 'sar-table-split:quick-viewer';
  const layoutPreset = useMemo(() => getPatentAnalysisLayoutPreset(viewportWidth), [viewportWidth]);
  const isResponsiveToolbar = viewportWidth <= 1100;
  const bookmarkedGroupIdSet = useMemo(() => new Set(bookmarkedGroupIds), [bookmarkedGroupIds]);
  const pinnedCompoundIdSet = useMemo(() => new Set(pinnedCompoundIds), [pinnedCompoundIds]);
  const sortedGroupStructureRows = useMemo(
    () => [...groups].sort((a, b) => {
      const aPinned = bookmarkedGroupIdSet.has(a.id);
      const bPinned = bookmarkedGroupIdSet.has(b.id);
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      if (aPinned && bPinned) {
        return bookmarkedGroupIds.indexOf(a.id) - bookmarkedGroupIds.indexOf(b.id);
      }
      return groups.indexOf(a) - groups.indexOf(b);
    }),
    [bookmarkedGroupIdSet, bookmarkedGroupIds, groups]
  );
  useEffect(() => {
    const visibleIds = new Set(sortedGroupStructureRows.map((group) => group.id));
    if (groupStructureSelectionAnchorRef.current && !visibleIds.has(groupStructureSelectionAnchorRef.current)) {
      groupStructureSelectionAnchorRef.current = null;
    }
  }, [sortedGroupStructureRows]);
  const displaySarCompounds = useMemo(() => {
    const filteredCompounds = sarCompounds.filter((compound) => {
      const hasCompoundId = compound.compoundId.trim().length > 0;
      const isAcceptedOrLater = compound.synthesisRequestStatus === 'accepted'
        || compound.synthesisRequestStatus === 'synthesizing'
        || compound.synthesisRequestStatus === 'vnaIssued';
      const isCompoundType = hasCompoundId || isAcceptedOrLater;
      if (sarCompoundTypeFilter === 'compound') return isCompoundType;
      if (sarCompoundTypeFilter === 'design') return !isCompoundType;
      return true;
    });

    return filteredCompounds.sort((a, b) => {
      const aPinned = pinnedCompoundIdSet.has(a.id);
      const bPinned = pinnedCompoundIdSet.has(b.id);
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      return sarCompounds.indexOf(a) - sarCompounds.indexOf(b);
    });
  }, [pinnedCompoundIdSet, sarCompoundTypeFilter, sarCompounds]);
  const sarTableRows = useMemo<SarTableRow[]>(() => (
    displaySarCompounds.map((compound) => {
      const sarApiRows = compound.sarApiRows ?? [];
      const children = sarApiRows.length > 1 ? sarApiRows.map((sarApiRow, index) => ({
        ...compound,
        sarApiRow,
        sarTableRowKey: `compound-${compound.id}-sar-${index}`,
        sarApiRows: undefined,
      })) : undefined;

      return {
        ...compound,
        sarApiRow: sarApiRows.length === 1 ? sarApiRows[0] : undefined,
        sarTableRowKey: `compound-${compound.id}`,
        children,
      };
    })
  ), [displaySarCompounds]);
  useEffect(() => {
    const visibleIds = new Set(displaySarCompounds.map((compound) => compound.id));
    if (compoundSelectionAnchorRef.current && !visibleIds.has(compoundSelectionAnchorRef.current)) {
      compoundSelectionAnchorRef.current = null;
    }
  }, [displaySarCompounds]);
  const pinnedCompoundOrderMap = useMemo(() => (
    displaySarCompounds.reduce<Record<string, number>>((acc, compound) => {
      if (pinnedCompoundIdSet.has(compound.id)) {
        acc[compound.id] = Object.keys(acc).length;
      }
      return acc;
    }, {})
  ), [displaySarCompounds, pinnedCompoundIdSet]);
  const activeStructureSettingsGroupId = selectedGroupIds.length === 1 ? selectedGroupIds[0] : null;
  const activeStructureSettings = activeStructureSettingsGroupId
    ? {
        ...DEFAULT_GROUP_STRUCTURE_VIEW_SETTINGS,
        ...groupStructureViewSettings[activeStructureSettingsGroupId],
      }
    : null;
  const sarPinnedRowColor = isDarkMode ? '#4ADE80' : '#16A34A';
  const sarPinnedRowBg = isDarkMode ? 'rgba(74, 222, 128, 0.16)' : 'rgba(22, 163, 74, 0.08)';
  const sarPinnedRowHoverBg = isDarkMode ? 'rgba(74, 222, 128, 0.24)' : 'rgba(22, 163, 74, 0.14)';
  const sarPinnedSelectedCardBg = isDarkMode
    ? `color-mix(in srgb, ${sarPinnedRowColor} 18%, ${token.colorBgContainer})`
    : `color-mix(in srgb, ${sarPinnedRowColor} 10%, ${token.colorBgContainer})`;
  const sarPinnedSelectedCardHoverBg = isDarkMode
    ? `color-mix(in srgb, ${sarPinnedRowColor} 24%, ${token.colorBgContainer})`
    : `color-mix(in srgb, ${sarPinnedRowColor} 15%, ${token.colorBgContainer})`;
  const isStructureSettingsDisabled = !activeStructureSettingsGroupId;
  const updateActiveStructureSettings = (settings: Partial<typeof DEFAULT_GROUP_STRUCTURE_VIEW_SETTINGS>) => {
    if (!activeStructureSettingsGroupId) return;
    updateGroupStructureViewSettings(activeStructureSettingsGroupId, settings);
  };
  const renderSarDataButtons = React.useCallback((compound: Compound) => {
    const assets = compound.quickViewerAssets ?? [];

    if (assets.length === 0) {
      return null;
    }

    const orderedAssets = [
      ...assets.filter(asset => SAR_DATA_LEFT_ASSET_TYPES.has(asset.type)),
      ...assets
        .filter(asset => !SAR_DATA_LEFT_ASSET_TYPES.has(asset.type))
        .sort((first, second) => (
          (SAR_DATA_RIGHT_ASSET_ORDER_INDEX.get(first.type) ?? Number.MAX_SAFE_INTEGER)
          - (SAR_DATA_RIGHT_ASSET_ORDER_INDEX.get(second.type) ?? Number.MAX_SAFE_INTEGER)
        )),
    ];
    const renderAssetButton = (asset: NonNullable<Compound['quickViewerAssets']>[number]) => (
      <button
        key={asset.type}
        type="button"
        className={`sar-compound-data-tag sar-compound-data-tag-${asset.type}`}
        onClick={(event) => {
          event.stopPropagation();
          setQuickViewer({
            compound,
            activeType: asset.type,
          });
        }}
      >
        {asset.label}
      </button>
    );

    return (
      <div className="sar-compound-data-tags">
        {orderedAssets.map(renderAssetButton)}
      </div>
    );
  }, []);
  const getGroupStructureSettings = React.useCallback((groupId: string) => ({
    ...DEFAULT_GROUP_STRUCTURE_VIEW_SETTINGS,
    ...groupStructureViewSettings[groupId],
  }), [groupStructureViewSettings]);

  useEffect(() => {
    if (sarCompounds.length === 0) {
      setSelectedRowKey(null);
      setSelectedCompoundIds([]);
      compoundSelectionAnchorRef.current = null;
      return;
    }

    const visibleCompoundIds = new Set(displaySarCompounds.map((compound) => compound.id));
    setSelectedCompoundIds((current) => {
      const next = current.filter((compoundId) => visibleCompoundIds.has(compoundId));
      return next.length === current.length ? current : next;
    });

    if (selectedRowKey && !visibleCompoundIds.has(selectedRowKey)) {
      setSelectedRowKey(null);
      compoundSelectionAnchorRef.current = null;
    }
  }, [displaySarCompounds, sarCompounds.length, selectedRowKey]);

  const handleCompoundSelection = React.useCallback((compoundId: string, event?: React.MouseEvent) => {
    if (isChemDrawModalEventTarget(event?.target ?? null)) return;

    if (event?.shiftKey) {
      event.preventDefault();
      const rangeIds = getRangeSelectionIds(displaySarCompounds, compoundSelectionAnchorRef.current, compoundId);
      const next = event.ctrlKey || event.metaKey
        ? Array.from(new Set([...selectedCompoundIds, ...rangeIds]))
        : rangeIds;

      setSelectedCompoundIds(next);
      setSelectedRowKey(compoundId);
      compoundSelectionAnchorRef.current = compoundSelectionAnchorRef.current ?? compoundId;
      return;
    }

    if (!event?.ctrlKey && !event?.metaKey) {
      setSelectedCompoundIds([compoundId]);
      setSelectedRowKey(compoundId);
      compoundSelectionAnchorRef.current = compoundId;
      return;
    }

    event.preventDefault();
    setSelectedCompoundIds((current) => {
      const next = current.includes(compoundId)
        ? current.filter((id) => id !== compoundId)
        : [...current, compoundId];

      setSelectedRowKey(next.includes(compoundId) ? compoundId : next[next.length - 1] ?? null);
      compoundSelectionAnchorRef.current = compoundId;
      return next;
    });
  }, [displaySarCompounds, selectedCompoundIds]);

  const togglePinnedCompound = React.useCallback((compoundId: string) => {
    setPinnedCompoundIds((current) => (
      current.includes(compoundId)
        ? current.filter((id) => id !== compoundId)
        : [...current, compoundId]
    ));
  }, []);

  useEffect(() => {
    if (!selectedRowKey) return;

    const frameId = window.requestAnimationFrame(() => {
      document.getElementById(`sar-compound-card-${selectedRowKey}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
      document.getElementById(`sar-table-row-${selectedRowKey}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [selectedRowKey, compoundCardViewMode, displaySarCompounds.length, pinnedCompoundIds]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const clearTableRowSelection = React.useCallback(() => {
    setSelectedRowKey(null);
    setSelectedCompoundIds([]);
    setHoveredRowKey(null);
    compoundSelectionAnchorRef.current = null;
  }, []);

  const handlePageMouseDown = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (isSarCompoundSelectionSurface(target)) return;
    if (!selectedRowKey && selectedCompoundIds.length === 0) return;

    clearTableRowSelection();
  }, [clearTableRowSelection, selectedCompoundIds.length, selectedRowKey]);

  useEffect(() => {
    if (!selectedRowKey && selectedCompoundIds.length === 0) return;

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (isSarCompoundSelectionSurface(target)) return;

      clearTableRowSelection();
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);
    return () => document.removeEventListener('mousedown', handleDocumentMouseDown);
  }, [clearTableRowSelection, selectedCompoundIds.length, selectedRowKey]);

  useEffect(() => {
    const raw = window.localStorage.getItem(quickViewerStorageKey);
    if (!raw) return;

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;

    setQuickViewerWidth(Math.min(
      Math.max(parsed, SAR_QUICK_VIEWER_MIN_WIDTH),
      SAR_QUICK_VIEWER_MAX_WIDTH
    ));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(quickViewerStorageKey, String(quickViewerWidth));
  }, [quickViewerWidth]);

  const stopQuickViewerResize = React.useCallback(() => {
    setIsResizingQuickViewer(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  const updateQuickViewerWidthFromClientX = React.useCallback((clientX: number) => {
    const availableWidth = Math.max(viewportWidth - layoutPreset.sidePadding * 2, 320);
    const maxWidth = Math.min(SAR_QUICK_VIEWER_MAX_WIDTH, Math.max(availableWidth - 360, SAR_QUICK_VIEWER_MIN_WIDTH));
    const paneRight = quickViewerPaneRef.current?.getBoundingClientRect().right ?? window.innerWidth - layoutPreset.sidePadding;
    const nextWidth = Math.min(
      Math.max(paneRight - clientX, SAR_QUICK_VIEWER_MIN_WIDTH),
      maxWidth
    );

    setQuickViewerWidth(nextWidth);
  }, [layoutPreset.sidePadding, viewportWidth]);

  useEffect(() => {
    if (!isResizingQuickViewer) return;

    const onMouseMove = (event: MouseEvent) => {
      if (quickViewerResizeRafRef.current) {
        window.cancelAnimationFrame(quickViewerResizeRafRef.current);
      }
      quickViewerResizeRafRef.current = window.requestAnimationFrame(() => {
        updateQuickViewerWidthFromClientX(event.clientX);
      });
    };
    const onMouseUp = () => {
      stopQuickViewerResize();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (quickViewerResizeRafRef.current) {
        window.cancelAnimationFrame(quickViewerResizeRafRef.current);
        quickViewerResizeRafRef.current = null;
      }
    };
  }, [isResizingQuickViewer, stopQuickViewerResize, updateQuickViewerWidthFromClientX]);

  const handleQuickViewerResizeMouseDown = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsResizingQuickViewer(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleQuickViewerResizeKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = 24;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setQuickViewerWidth((width) => Math.min(width + step, SAR_QUICK_VIEWER_MAX_WIDTH));
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setQuickViewerWidth((width) => Math.max(width - step, SAR_QUICK_VIEWER_MIN_WIDTH));
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setQuickViewerWidth(SAR_QUICK_VIEWER_MIN_WIDTH);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setQuickViewerWidth(SAR_QUICK_VIEWER_MAX_WIDTH);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let frameId = 0;
    const updateSarTableBodyHeight = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const tableCard = sarTableCardRef.current;
        if (!tableCard) return;

        const pageElement = tableCard.closest<HTMLElement>('.sar-page');
        const pageRect = pageElement?.getBoundingClientRect();
        const pageStyle = pageElement ? window.getComputedStyle(pageElement) : null;
        const pagePaddingBottom = pageStyle ? Number.parseFloat(pageStyle.paddingBottom) || 0 : 0;
        const tableBodyRect = tableCard
          .querySelector<HTMLElement>('.ant-table-body')
          ?.getBoundingClientRect();
        const tableContentBottom = (pageRect?.bottom ?? window.innerHeight) - pagePaddingBottom - 1;
        const tableBodyTop = tableBodyRect?.top ?? tableCard.getBoundingClientRect().top;
        const availableHeight = tableContentBottom - tableBodyTop;
        const nextHeight = Math.max(SAR_TABLE_BODY_MIN_HEIGHT, Math.floor(availableHeight));

        setSarTableBodyHeight((currentHeight) => (
          currentHeight === nextHeight ? currentHeight : nextHeight
        ));
      });
    };

    updateSarTableBodyHeight();
    window.addEventListener('resize', updateSarTableBodyHeight);

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateSarTableBodyHeight);

    if (resizeObserver) {
      resizeObserver.observe(document.body);
      if (sarTableCardRef.current?.parentElement) {
        resizeObserver.observe(sarTableCardRef.current.parentElement);
      }
    }

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', updateSarTableBodyHeight);
      resizeObserver?.disconnect();
    };
  }, [
    compoundCardViewMode,
    displaySarCompounds.length,
    isCompoundStructureCollapsed,
    isGroupStructureCollapsed,
    showFilters,
    viewportWidth,
  ]);

  const selectCompoundByKeyboard = (key: string) => {
    if (displaySarCompounds.length === 0) return false;

    const currentIndex = Math.max(0, displaySarCompounds.findIndex((compound) => compound.id === selectedRowKey));
    let nextIndex = currentIndex;

    if (compoundCardViewMode === 'twoRows') {
      const columnCount = Math.ceil(displaySarCompounds.length / 2);

      if (key === 'ArrowRight') {
        nextIndex = Math.min(displaySarCompounds.length - 1, currentIndex + 1);
      } else if (key === 'ArrowLeft') {
        nextIndex = Math.max(0, currentIndex - 1);
      } else if (key === 'ArrowDown') {
        nextIndex = currentIndex + columnCount < displaySarCompounds.length ? currentIndex + columnCount : currentIndex;
      } else if (key === 'ArrowUp') {
        nextIndex = currentIndex - columnCount >= 0 ? currentIndex - columnCount : currentIndex;
      } else if (key === 'Home') {
        nextIndex = 0;
      } else if (key === 'End') {
        nextIndex = displaySarCompounds.length - 1;
      } else {
        return false;
      }
    } else if (key === 'ArrowRight' || key === 'ArrowDown') {
      nextIndex = Math.min(displaySarCompounds.length - 1, currentIndex + 1);
    } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
      nextIndex = Math.max(0, currentIndex - 1);
    } else if (key === 'Home') {
      nextIndex = 0;
    } else if (key === 'End') {
      nextIndex = displaySarCompounds.length - 1;
    } else {
      return false;
    }

    const nextCompound = displaySarCompounds[nextIndex];
    if (nextCompound) {
      setSelectedRowKey(nextCompound.id);
      setSelectedCompoundIds([nextCompound.id]);
      compoundSelectionAnchorRef.current = nextCompound.id;
      setHoveredRowKey(nextCompound.id);
      document.getElementById(`sar-compound-card-${nextCompound.id}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
    return true;
  };

  const handleCompoundCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (selectCompoundByKeyboard(event.key)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!selectedRowKey || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isSettingsModalOpen || isStructureModalOpen) return;

      const activeElement = document.activeElement as HTMLElement | null;
      const activeTag = activeElement?.tagName.toLowerCase();
      const isCompoundCardListFocused = !!activeElement?.closest('.sar-compound-card-list');
      const isEditing =
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        activeElement?.isContentEditable ||
        !!activeElement?.closest('.ant-select, .ant-picker, .ant-segmented');

      if (isCompoundCardListFocused) return;
      if (isEditing) return;

      if (selectCompoundByKeyboard(event.key)) {
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    compoundCardViewMode,
    displaySarCompounds,
    isSettingsModalOpen,
    isStructureModalOpen,
    selectedRowKey,
  ]);

  // Default states for columns
  const defaultOrder = ['Compound', 'TSA', 'CYP', 'Cell', 'MS', 'PPB', 'PK'];
  const defaultActive = ['Compound', 'TSA', 'CYP', 'Cell', 'MS', 'PPB', 'PK'];
  const defaultSubConfig = {
    'Cell': [
      { key: 'ebc1', title: 'EBC1', visible: true },
      { key: 'hs746t', title: 'Hs746T', visible: true },
      { key: 'snu16', title: 'SNU16', visible: true }
    ],
    'MS': [
      { key: 'ms_h', title: 'H', visible: true },
      { key: 'ms_m', title: 'M', visible: true }
    ],
    'PPB': [
      { key: 'ppb_h', title: 'H', visible: true },
      { key: 'ppb_m', title: 'M', visible: true }
    ],
    'CYP': [
      { key: '1a2', title: '1A2', visible: true },
      { key: '2c9', title: '2C9', visible: true },
      { key: '2c19', title: '2C19', visible: true },
      { key: '2d6', title: '2D6', visible: true },
      { key: '3a_m', title: '3A(M)', visible: true },
      { key: '3a_t', title: '3A(T)', visible: true }
    ],
    'PK': [
      { key: 'pe', title: 'Pe', visible: true },
      { key: 'salt_form', title: 'salt form', visible: true },
      { key: 'dose', title: 'Dose', visible: true },
      { key: 'plasma_4h', title: 'Plasma 4 h', visible: true },
      { key: 'brain_4h', title: 'Brain 4 h', visible: true }
    ]
  };

  // Preset State: stores order, active columns, and sub-config for each preset index (1-5)
  const [presets, setPresets] = useState<Record<number, any>>({
    1: { order: [...defaultOrder], active: [...defaultActive], sub: { ...defaultSubConfig } },
    2: { order: [...defaultOrder], active: [...defaultActive], sub: { ...defaultSubConfig } },
    3: { order: [...defaultOrder], active: [...defaultActive], sub: { ...defaultSubConfig } },
    4: { order: [...defaultOrder], active: [...defaultActive], sub: { ...defaultSubConfig } },
    5: { order: [...defaultOrder], active: [...defaultActive], sub: { ...defaultSubConfig } },
  });

  // Filter States
  const projectList = ['FGFR', 'C797S DM', 'cMET', 'VRK1', 'HER2', 'WRN', 'WEE1'];
  const shareList = ['내 물질', '공유함', '공유받음'];
  const sourceList = ['내 머리', '동료 머리', 'Patent', 'Paper', 'FBDD', 'ELN'];

  const [selectedProjects, setSelectedProjects] = useState<string[]>(['ALL', ...projectList]);
  const [selectedShares, setSelectedShares] = useState<string[]>(['ALL', ...shareList]);
  const [selectedSources, setSelectedSources] = useState<string[]>(['ALL', ...sourceList]);
  const [period, setPeriod] = useState<string>('전체');

  const handleStructureSearchConfirm = (data: { smiles: string; svg: string | null }) => {
    const { smiles, svg } = data;
    if (svg) setSearchedSvg(svg);
    if (smiles && smiles.trim() !== '') {
      setKeyword(smiles);
    } else {
      setKeyword('');
    }
    setIsStructureModalOpen(false);
  };

  const openScaffoldModal = () => {
    scaffoldEditDirtyRef.current = false;
    scaffoldEditBaselineRef.current = activeSarScaffold.source === 'custom'
      ? {
          smiles: activeSarScaffold.smiles?.trim() || undefined,
          molBlock: activeSarScaffold.molBlock?.trim() || undefined,
        }
      : null;
    setIsScaffoldModalOpen(true);
  };

  const handleScaffoldConfirm = (data: ChemDrawStructureData) => {
    const exportedMolBlock = (data.molV2000 || data.molfile || data.molV3000 || '').trim();
    const smiles = data.smiles.trim();
    const baseline = scaffoldEditBaselineRef.current;
    const shouldKeepBaselineMolBlock = Boolean(baseline?.molBlock && !scaffoldEditDirtyRef.current);
    const molBlock = shouldKeepBaselineMolBlock ? baseline?.molBlock || '' : exportedMolBlock;

    updateActiveStructureSettings({
      sarScaffold: {
        mode: 'custom',
        source: 'custom',
        smiles: smiles || undefined,
        molBlock: molBlock || undefined,
        cdxml: data.cdxml?.trim() || undefined,
        color: activeSarScaffold.color || SAR_SCAFFOLD_HIGHLIGHT_COLOR,
        svg: data.svg,
        updatedAt: Date.now(),
      },
    });
    scaffoldEditBaselineRef.current = null;
    scaffoldEditDirtyRef.current = false;
    setIsScaffoldModalOpen(false);
  };

  const resetScaffoldToAuto = () => {
    updateActiveStructureSettings({
      sarScaffold: {
        mode: 'auto',
        source: 'none',
      },
    });
    setIsScaffoldColorPickerOpen(false);
  };

  const changeScaffoldColor = (color: string) => {
    updateActiveStructureSettings({
      sarScaffold: {
        ...activeSarScaffold,
        color,
      },
    });
    setIsScaffoldColorPickerOpen(false);
  };

  const handleGroupStructureSelection = (groupId: string, event: React.MouseEvent) => {
    if (isChemDrawModalEventTarget(event.target)) return;

    const isToggleModifier = event.altKey || event.ctrlKey || event.metaKey;
    let nextSelectedGroupIds: string[];

    if (event.shiftKey) {
      event.preventDefault();
      const rangeIds = getRangeSelectionIds(sortedGroupStructureRows, groupStructureSelectionAnchorRef.current, groupId);
      nextSelectedGroupIds = isToggleModifier
        ? Array.from(new Set([...selectedGroupIds, ...rangeIds]))
        : rangeIds;
      groupStructureSelectionAnchorRef.current = groupStructureSelectionAnchorRef.current ?? groupId;
    } else if (isToggleModifier) {
      event.preventDefault();
      nextSelectedGroupIds = selectedGroupIds.includes(groupId)
        ? selectedGroupIds.filter((id) => id !== groupId)
        : [...selectedGroupIds, groupId];
      groupStructureSelectionAnchorRef.current = groupId;
    } else {
      nextSelectedGroupIds = [groupId];
      groupStructureSelectionAnchorRef.current = groupId;
    }

    const nextGroupCompounds = nextSelectedGroupIds.length > 0
      ? allCompoundRows
        .filter((compound) => nextSelectedGroupIds.includes(compound.groupId) && !hiddenCompoundIds.includes(compound.id))
      : [];
    const normalizedKeyword = keyword.trim().toLowerCase();
    const nextVisibleCompounds = normalizedKeyword
      ? nextGroupCompounds.filter((compound) => (
          compound.id.toLowerCase().includes(normalizedKeyword) ||
          compound.compoundId.toLowerCase().includes(normalizedKeyword) ||
          compound.name.toLowerCase().includes(normalizedKeyword) ||
          compound.smiles?.toLowerCase().includes(normalizedKeyword)
        ))
      : nextGroupCompounds;
    const shouldClearKeywordForGroupLoad = Boolean(normalizedKeyword && nextGroupCompounds.length > 0 && nextVisibleCompounds.length === 0);
    const nextCompoundIds = (shouldClearKeywordForGroupLoad ? nextGroupCompounds : nextVisibleCompounds)
      .map((compound) => compound.id);

    setSelectedGroupIds(nextSelectedGroupIds);
    if (shouldClearKeywordForGroupLoad) {
      setKeyword('');
    }
    setSelectedSarCompoundIds(nextCompoundIds);
    setSelectedRowKey(null);
    setSelectedCompoundIds([]);
    compoundSelectionAnchorRef.current = null;
    setHoveredRowKey(null);
    setIsScaffoldColorPickerOpen(false);
  };

  const clampSteppedPercent = (value: number, min: number, max: number) => {
    const steppedValue = Math.round(value / SAR_COMPOUND_CARD_SETTING_STEP) * SAR_COMPOUND_CARD_SETTING_STEP;
    return Math.min(max, Math.max(min, steppedValue));
  };

  const changeSarImageScale = (delta: number) => {
    const currentValue = activeStructureSettings?.sarImageScalePercent ?? DEFAULT_GROUP_STRUCTURE_VIEW_SETTINGS.sarImageScalePercent;
    updateActiveStructureSettings({
      sarImageScalePercent: clampSteppedPercent(
        currentValue + delta,
        SAR_COMPOUND_CARD_IMAGE_SCALE_MIN,
        SAR_COMPOUND_CARD_IMAGE_SCALE_MAX
      ),
    });
  };

  const changeSarRotation = (delta: number) => {
    const currentValue = activeStructureSettings?.sarRotationDeg ?? DEFAULT_GROUP_STRUCTURE_VIEW_SETTINGS.sarRotationDeg;
    updateActiveStructureSettings({
      sarRotationDeg: (currentValue + delta + 360) % 360,
    });
  };

  const changeSarOverlap = (delta: number) => {
    const currentValue = activeStructureSettings?.sarOverlapPercent ?? DEFAULT_GROUP_STRUCTURE_VIEW_SETTINGS.sarOverlapPercent;
    updateActiveStructureSettings({
      sarOverlapPercent: clampSteppedPercent(
        currentValue + delta,
        SAR_COMPOUND_CARD_OVERLAP_MIN,
        SAR_COMPOUND_CARD_OVERLAP_MAX
      ),
    });
  };

  const renderGroupStructure = (_: unknown, record: any) => {
    const representativeCompound = firstCompoundByGroupId[record.id];
    const structureSvg = representativeCompound?.structureSvg;
    const isBookmarked = bookmarkedGroupIdSet.has(record.id);
    const groupStructureSettings = getGroupStructureSettings(record.id);

    return (
      <div
        className={`sar-group-representative-structure${isBookmarked ? ' is-bookmarked' : ''}`}
        style={{
          margin: '0 auto',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: SAR_GROUP_STRUCTURE_WIDTH,
          minHeight: SAR_GROUP_STRUCTURE_HEIGHT,
          lineHeight: 0,
          position: 'relative',
        }}
      >
        <div className="sar-group-structure-bookmark">
          <Tooltip title={isBookmarked ? '상단 고정 해제' : '상단 고정'}>
            <Button
              size="small"
              type="text"
              aria-label={isBookmarked ? '상단 고정 해제' : '상단 고정'}
              className={`sar-group-structure-pin-button${isBookmarked ? ' active' : ''}`}
              onClick={(event) => {
                event.stopPropagation();
                toggleBookmarkedGroup(record.id);
              }}
            >
              <span className="sar-group-structure-pin-icon" />
            </Button>
          </Tooltip>
        </div>
        <CompoundStructureView
          svg={structureSvg}
          rdkitSvg={(representativeCompound as any)?.rdkitSvg}
          rdkitSvgCache={(representativeCompound as any)?.rdkitSvgCache}
          title={representativeCompound?.compoundId || representativeCompound?.name || record.name || 'Structure'}
          smiles={representativeCompound?.smiles}
          molBlock={(representativeCompound as any)?.molBlock ?? (representativeCompound as any)?.mol_block ?? (representativeCompound as any)?.molblock}
          width={SAR_GROUP_STRUCTURE_WIDTH}
          height={SAR_GROUP_STRUCTURE_HEIGHT}
          iconSize={40}
          gap={0}
          svgClassName="sar-structure-svg"
          structureFitMode="contain"
          actionPlacement="overlay"
          actionOverlayAnchor="container"
          actionOverlayPlacement="bottom-right"
          showPreviewAction
          showCopyAction
          showLinkedImageCopyAction
          onPreview={(svg) => {
            if (svg) {
              setStructurePreview({
                title: representativeCompound?.compoundId || representativeCompound?.name || record.name || 'Structure',
                svg,
                smiles: representativeCompound?.smiles,
                molblock: (representativeCompound as any)?.molBlock ?? (representativeCompound as any)?.mol_block ?? (representativeCompound as any)?.molblock,
                cdxml: (representativeCompound as any)?.draw,
              });
            }
          }}
          preferRdkitSvg
          rdkitAngleDeg={groupStructureSettings.sarRotationDeg}
          rdkitScalePercent={DEFAULT_GROUP_STRUCTURE_VIEW_SETTINGS.sarImageScalePercent}
          rdkitMinSize={[SAR_GROUP_STRUCTURE_WIDTH, SAR_GROUP_STRUCTURE_HEIGHT]}
          onStructureGenerated={(data) => {
            if (representativeCompound?.id) handleCompoundStructureGenerated(representativeCompound.id, data);
          }}
          frameStyle={{ border: 0, background: 'transparent', boxShadow: 'none', overflow: 'visible' }}
        />
      </div>
    );
  };

  const groupStructureColumns = [
    {
      title: '화합물 구조',
      key: 'representativeStructure',
      width: SAR_GROUP_STRUCTURE_COLUMN_WIDTH,
      align: 'center' as const,
      render: renderGroupStructure,
    },
  ];

  // COLUMN STATES (Order & Visibility)
  const [columnOrder, setColumnOrder] = useState<string[]>([
    'Compound', 'TSA', 'CYP', 'Cell', 'MS', 'PPB', 'PK'
  ]);
  const [activeColumns, setActiveColumns] = useState<string[]>([
    'Compound', 'TSA', 'CYP', 'Cell', 'MS', 'PPB', 'PK'
  ]);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [expandedColumns, setExpandedColumns] = useState<string[]>([]);

  const toggleExpand = (key: string) => {
    setExpandedColumns(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Sub-column config: { parentKey: [ { key: 'wt', visible: true, ... } ] }
  const [subColumnConfig, setSubColumnConfig] = useState<Record<string, { key: string, title: string, visible: boolean }[]>>({
    'Cell': [
      { key: 'ebc1', title: 'EBC1', visible: true },
      { key: 'hs746t', title: 'Hs746T', visible: true },
      { key: 'snu16', title: 'SNU16', visible: true }
    ],
    'MS': [
      { key: 'ms_h', title: 'H', visible: true },
      { key: 'ms_m', title: 'M', visible: true }
    ],
    'PPB': [
      { key: 'ppb_h', title: 'H', visible: true },
      { key: 'ppb_m', title: 'M', visible: true }
    ],
    'CYP': [
      { key: '1a2', title: '1A2', visible: true },
      { key: '2c9', title: '2C9', visible: true },
      { key: '2c19', title: '2C19', visible: true },
      { key: '2d6', title: '2D6', visible: true },
      { key: '3a_m', title: '3A(M)', visible: true },
      { key: '3a_t', title: '3A(T)', visible: true }
    ],
    'PK': [
      { key: 'pe', title: 'Pe', visible: true },
      { key: 'salt_form', title: 'salt form', visible: true },
      { key: 'dose', title: 'Dose', visible: true },
      { key: 'plasma_4h', title: 'Plasma 4 h', visible: true },
      { key: 'brain_4h', title: 'Brain 4 h', visible: true }
    ]
  });

  const toggleColumn = (key: string) => {
    setActiveColumns(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const toggleSubColumn = (parentKey: string, subKey: string) => {
    setSubColumnConfig(prev => ({
      ...prev,
      [parentKey]: prev[parentKey].map(col =>
        col.key === subKey ? { ...col, visible: !col.visible } : col
      )
    }));
  };

  const reorderSubColumns = (parentKey: string, fromIdx: number, toIdx: number) => {
    setSubColumnConfig(prev => {
      const newList = [...prev[parentKey]];
      const [movedItem] = newList.splice(fromIdx, 1);
      newList.splice(toIdx, 0, movedItem);
      return { ...prev, [parentKey]: newList };
    });
  };

  // DND Handlers
  const onDragStart = (index: number) => {
    setDraggedItemIndex(index);
  };

  const onDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;

    const newOrder = [...columnOrder];
    const draggedItem = newOrder[draggedItemIndex];
    newOrder.splice(draggedItemIndex, 1);
    newOrder.splice(index, 0, draggedItem);

    setColumnOrder(newOrder);
    setDraggedItemIndex(index);
  };

  const onDragEnd = () => {
    setDraggedItemIndex(null);
  };

  const handleSavePreset = () => {
    setPresets(prev => ({
      ...prev,
      [activePreset]: {
        order: [...columnOrder],
        active: [...activeColumns],
        sub: JSON.parse(JSON.stringify(subColumnConfig))
      }
    }));
    setIsSettingsModalOpen(false);
  };

  const applyPreset = (n: number) => {
    const preset = presets[n];
    if (preset) {
      setActivePreset(n);
      setColumnOrder([...preset.order]);
      setActiveColumns([...preset.active]);
      setSubColumnConfig(JSON.parse(JSON.stringify(preset.sub)));
    }
  };

  const handleToggleChange = (checked: boolean, val: string, setFn: (v: string[]) => void, current: string[], originalOptions: string[]) => {
    let next: string[];
    if (val === 'ALL') {
      next = checked ? ['ALL', ...originalOptions] : [];
    } else {
      if (checked) {
        const filtered = [...current.filter(v => v !== 'ALL'), val];
        next = filtered.length === originalOptions.length ? ['ALL', ...originalOptions] : filtered;
      } else {
        next = current.filter(v => v !== 'ALL' && v !== val);
      }
    }
    setFn(next);
  };

  // Heatmap rendering logic (relative scaling)
  const isPresentSarValue = (value: SarApiCellValue) => (
    value !== null && value !== undefined && value !== ''
  );

  const getSarApiRowsForValue = (record: SarTableRow) => (
    record.sarApiRow ? [record.sarApiRow] : record.sarApiRows ?? []
  );

  const getFirstSarApiValue = (record: SarTableRow, keys: string[]) => {
    for (const row of getSarApiRowsForValue(record)) {
      for (const key of keys) {
        const value = row[key];
        if (isPresentSarValue(value)) return value;
      }
    }
    return undefined;
  };

  const getThermalShiftValue = (record: SarTableRow) => {
    for (const row of getSarApiRowsForValue(record)) {
      const projectName = String(row.project_name ?? '').trim().toUpperCase();
      const thermalEntries = Object.entries(row)
        .filter(([key, value]) => key.startsWith('Thermal Shift#_#') && isPresentSarValue(value));
      if (thermalEntries.length === 0) continue;

      const projectMatch = thermalEntries.find(([key]) => (
        projectName && key.toUpperCase().includes(projectName)
      ));
      return (projectMatch ?? thermalEntries[0])[1];
    }

    return record.sar?.tsa_tm;
  };

  const getPkPeValue = (record: SarTableRow) => {
    const explicitPe = getFirstSarApiValue(record, ['PK#_#pe', 'PK#_#Pe', 'PK#_#PE']);
    if (isPresentSarValue(explicitPe)) return explicitPe;

    const plasma4h = getFirstSarApiValue(record, ['PK#_#plasma_4hr']);
    const brain4h = getFirstSarApiValue(record, ['PK#_#brain_4hr']);
    const plasmaNumber = Number(plasma4h);
    const brainNumber = Number(brain4h);
    if (Number.isFinite(plasmaNumber) && plasmaNumber > 0 && Number.isFinite(brainNumber)) {
      return Number((brainNumber / plasmaNumber).toFixed(2));
    }

    return record.sar?.pk?.pe;
  };

  const getSarCellValue = (record: SarTableRow, apiKeys: string[], mockValue: SarApiCellValue) => {
    const apiValue = getFirstSarApiValue(record, apiKeys);
    return isPresentSarValue(apiValue) ? apiValue : mockValue;
  };

  const renderValue = (val: SarApiCellValue, group?: string) => {
    if (!isPresentSarValue(val)) return '-';
    const numericValue = typeof val === 'number' ? val : Number(val);
    const isNumeric = Number.isFinite(numericValue);

    let bgColor = 'transparent';
    let textColor = 'inherit';

    if (isColorActive && isNumeric) {
      if (numericValue < 0.1) { bgColor = isDarkMode ? '#065f46' : '#10b981'; textColor = isDarkMode ? '#6ee7b7' : token.colorBgContainer; }
      else if (numericValue < 0.5) { bgColor = isDarkMode ? '#064e3b' : '#d1fae5'; textColor = isDarkMode ? '#a7f3d0' : '#065f46'; }
      else if (numericValue < 1.0) { bgColor = isDarkMode ? '#78350f' : '#fef3c7'; textColor = isDarkMode ? '#fde68a' : '#92400e'; }
      else if (numericValue < 10) { bgColor = isDarkMode ? '#713f12' : '#fffbeb'; textColor = isDarkMode ? '#fcd34d' : '#92400e'; }
      else if (numericValue >= 10) { bgColor = isDarkMode ? '#7f1d1d' : '#fee2e2'; textColor = isDarkMode ? '#fca5a5' : '#991b1b'; }
    }

    return (
      <div style={{
        backgroundColor: bgColor,
        color: textColor,
        padding: '0 4px',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: isColorActive && isNumeric && numericValue < 0.5 ? 600 : 400
      }}>
        {isNumeric && Number.isInteger(numericValue) ? formatNumberWithComma(numericValue) : String(val)}
      </div>
    );
  };

  const getSarDisplayCode = React.useCallback((record: Pick<SarTableRow, 'compoundId' | 'designNo' | 'sarApiRow'>) => {
    const apiCode = getFirstSarApiValue(record as SarTableRow, ['compound_code']);
    const hasVnaCode = Boolean(apiCode ?? record.compoundId);
    const displayCode = apiCode ?? (record.compoundId || record.designNo || '-');

    return {
      displayCode: String(displayCode),
      color: hasVnaCode ? token.colorPrimary : token.colorTextTertiary,
      fontWeight: hasVnaCode ? 600 : 400,
    };
  }, [getFirstSarApiValue, token.colorPrimary, token.colorTextTertiary]);

  const allColumnsMap: Record<string, any> = {
    'Compound': {
      title: 'VNA Code',
      dataIndex: 'compoundId',
      key: 'compoundId',
      minWidth: 140,
      render: (_text: string, record: SarTableRow) => {
        const { displayCode, color, fontWeight } = getSarDisplayCode(record);
        return <Text style={{ color, fontWeight }}>{displayCode}</Text>;
      }
    },
    'TSA': {
      title: 'TSA (Tm)',
      key: 'tsa_tm',
      minWidth: 90,
      render: (_: unknown, record: SarTableRow) => renderValue(getThermalShiftValue(record), 'tsa')
    },
    'Cell': {
      title: 'Cell (GI50uM)',
      children: [
        { title: 'EBC1', key: 'ebc1', minWidth: 80, render: (_: unknown, record: SarTableRow) => renderValue(getSarCellValue(record, ['Cell#_#EBC-1CEL0034'], record.sar?.cell?.ebc1), 'c') },
        { title: 'Hs746T', key: 'hs746t', minWidth: 80, render: (_: unknown, record: SarTableRow) => renderValue(getSarCellValue(record, ['Cell#_#Hs746TCEL0043'], record.sar?.cell?.hs746t), 'c') },
        { title: 'SNU16', key: 'snu16', minWidth: 80, render: (_: unknown, record: SarTableRow) => renderValue(getSarCellValue(record, ['Cell#_#SNU-16CEL0060'], record.sar?.cell?.snu16), 'c') },
      ]
    },
    'MS': {
      title: 'MS (remain %)',
      children: [
        { title: 'H', key: 'ms_h', minWidth: 80, render: (_: unknown, record: SarTableRow) => renderValue(getSarCellValue(record, ['MS#_#human'], record.sar?.ms?.h), 'm') },
        { title: 'M', key: 'ms_m', minWidth: 80, render: (_: unknown, record: SarTableRow) => renderValue(getSarCellValue(record, ['MS#_#mouse'], record.sar?.ms?.m), 'm') },
      ]
    },
    'PPB': {
      title: 'PPB (bound %)',
      children: [
        { title: 'H', key: 'ppb_h', minWidth: 80, render: (_: unknown, record: SarTableRow) => renderValue(getSarCellValue(record, ['PPB#_#human'], record.sar?.ppb?.h), 'p') },
        { title: 'M', key: 'ppb_m', minWidth: 80, render: (_: unknown, record: SarTableRow) => renderValue(getSarCellValue(record, ['PPB#_#mouse'], record.sar?.ppb?.m), 'p') },
      ]
    },
    'CYP': {
      title: 'CYP',
      children: [
        { title: '1A2', key: '1a2', minWidth: 80, render: (_: unknown, record: SarTableRow) => renderValue(getSarCellValue(record, ['CYP#_#Inhibition#_#CYP1A2'], record.sar?.cyp?.['1a2']), 'cyp') },
        { title: '2C9', key: '2c9', minWidth: 80, render: (_: unknown, record: SarTableRow) => renderValue(getSarCellValue(record, ['CYP#_#Inhibition#_#CYP2C9'], record.sar?.cyp?.['2c9']), 'cyp') },
        { title: '2C19', key: '2c19', minWidth: 80, render: (_: unknown, record: SarTableRow) => renderValue(getSarCellValue(record, ['CYP#_#Inhibition#_#CYP2C19'], record.sar?.cyp?.['2c19']), 'cyp') },
        { title: '2D6', key: '2d6', minWidth: 80, render: (_: unknown, record: SarTableRow) => renderValue(getSarCellValue(record, ['CYP#_#Inhibition#_#CYP2D6'], record.sar?.cyp?.['2d6']), 'cyp') },
        { title: '3A(M)', key: '3a_m', minWidth: 80, render: (_: unknown, record: SarTableRow) => renderValue(getSarCellValue(record, ['CYP#_#Inhibition#_#CYP3A4'], record.sar?.cyp?.['3a_m'] ?? record.sar?.cyp?.['3a4']), 'cyp') },
        { title: '3A(T)', key: '3a_t', minWidth: 80, render: (_: unknown, record: SarTableRow) => renderValue(getSarCellValue(record, ['CYP#_#Inhibition#_#CYP3A_T'], record.sar?.cyp?.['3a_t']), 'cyp') },
      ]
    },
    'PK': {
      title: 'PK ng/ml (T/P ratio)',
      children: [
        { title: 'Pe', key: 'pe', minWidth: 80, render: (_: unknown, record: SarTableRow) => renderValue(getPkPeValue(record), 'pk') },
        { title: 'salt form', key: 'salt_form', minWidth: 100, render: (_: unknown, record: SarTableRow) => renderValue(getSarCellValue(record, ['PK#_#salt_form'], record.sar?.pk?.salt_form), 'pk') },
        { title: 'Dose', key: 'dose', minWidth: 80, render: (_: unknown, record: SarTableRow) => renderValue(getSarCellValue(record, ['PK#_#dose'], record.sar?.pk?.dose), 'pk') },
        { title: 'Plasma[4 h]', key: 'plasma_4h', minWidth: 120, render: (_: unknown, record: SarTableRow) => renderValue(getSarCellValue(record, ['PK#_#plasma_4hr'], record.sar?.pk?.plasma_4h), 'pk') },
        { title: 'Brain[4 h]', key: 'brain_4h', minWidth: 120, render: (_: unknown, record: SarTableRow) => renderValue(getSarCellValue(record, ['PK#_#brain_4hr'], record.sar?.pk?.brain_4h), 'pk') },
      ]
    }
  };

  const dynamicColumns = useMemo(() => {
    const appendColumnClass = (column: any, className: string): any => ({
      ...column,
      className: [column.className, className].filter(Boolean).join(' '),
    });

    const centerColumn = (column: any): any => ({
      ...column,
      align: 'center' as const,
      className: [column.className, 'table-center-column'].filter(Boolean).join(' '),
      children: column.children?.map(centerColumn),
    });

    const markGroupBoundaryPath = (column: any): any => {
      const nextColumn = appendColumnClass(column, 'sar-table-group-boundary');
      if (!nextColumn.children?.length) {
        return nextColumn;
      }

      return {
        ...nextColumn,
        children: nextColumn.children.map((child: any, index: number) => (
          index === nextColumn.children.length - 1 ? markGroupBoundaryPath(child) : child
        )),
      };
    };

    const visibleColumnKeys = columnOrder
      .filter(key => activeColumns.includes(key))
      .filter(key => allColumnsMap[key]);

    return visibleColumnKeys
      .map((key, index) => {
        const col = centerColumn({ ...allColumnsMap[key] });
        // If it has children, filter and reorder them based on subColumnConfig
        if (col.children && subColumnConfig[key]) {
          const config = subColumnConfig[key];
          const visibleSubKeys = config.filter(c => c.visible).map(c => c.key);

          // Rebuild children based on config order
          const orderedChildren: any[] = [];
          config.forEach(cfg => {
            if (cfg.visible) {
              // Find the original child definition
              const findChild = (children: any[]): any => {
                for (const child of children) {
                  if (child.key === cfg.key) return child;
                  if (child.children) {
                    const found = findChild(child.children);
                    if (found) return found;
                  }
                }
              };
              const childDef = findChild(col.children);
              if (childDef) orderedChildren.push(centerColumn(childDef));
            }
          });
          col.children = orderedChildren;
        }
        return index === visibleColumnKeys.length - 1 ? col : markGroupBoundaryPath(col);
      });
  }, [columnOrder, activeColumns, subColumnConfig, isColorActive, isDarkMode, token]);

  const compoundCardImageScale = ((activeStructureSettings?.sarImageScalePercent ?? DEFAULT_GROUP_STRUCTURE_VIEW_SETTINGS.sarImageScalePercent) / 100) * SAR_COMPOUND_CARD_SCALE_BASE_RATIO;
  const compoundCardOverlapPercent = compoundCardViewMode === 'single'
    ? activeStructureSettings?.sarOverlapPercent ?? DEFAULT_GROUP_STRUCTURE_VIEW_SETTINGS.sarOverlapPercent
    : 0;
  const isCompoundCardOverlapped = compoundCardOverlapPercent > 0;
  const compoundCardWidth = Math.round(SAR_COMPOUND_CARD_EXPANDED_WIDTH * compoundCardImageScale);
  const compoundCardStructureHeight = Math.round(SAR_COMPOUND_CARD_EXPANDED_STRUCTURE_HEIGHT * compoundCardImageScale);
  const compoundCardStructureFrameSize = Math.max(compoundCardWidth, compoundCardStructureHeight);
  const selectedCompoundIdSet = useMemo(() => new Set(selectedCompoundIds), [selectedCompoundIds]);
  const getCompoundCardNoMinSizeCacheKey = React.useCallback((compound: Compound, angleDeg?: number) => {
    const smiles = compound.smiles?.trim();
    const molBlock = ((compound as any).molBlock ?? (compound as any).mol_block ?? (compound as any).molblock)?.trim();
    const sourceKey = getRdkitStructureSourceKey({ molBlock, smiles });
    if (!sourceKey) return '';

    const settings = getGroupStructureSettings(compound.groupId);
    return createRdkitSvgCacheKey({
      molBlock: sourceKey,
      angleDeg: angleDeg ?? settings.sarRotationDeg,
      scalePercent: DEFAULT_GROUP_STRUCTURE_VIEW_SETTINGS.sarImageScalePercent,
      atomLabelBlock: settings.sarAtomColorMode === 'black',
      abbrevOption: getSarAbbrevOption(settings.sarAbbreviationMode),
      useGlobalDrawOptions: false,
    });
  }, [getGroupStructureSettings]);
  const getCompoundCardNoMinSizeSvg = React.useCallback((compound: Compound) => {
    const cacheKey = getCompoundCardNoMinSizeCacheKey(compound);
    if (!cacheKey) return null;
    return (compound as any).rdkitSvgCache?.[cacheKey] ?? null;
  }, [getCompoundCardNoMinSizeCacheKey]);
  const getCompoundCardBaselineSizeKey = React.useCallback((compound: Compound) => (
    `${compound.id}:${getCompoundCardNoMinSizeCacheKey(compound, 0)}`
  ), [getCompoundCardNoMinSizeCacheKey]);
  const getCompoundCardBaselineSvgSize = React.useCallback((compound: Compound): SvgIntrinsicSize | null => {
    const zeroDegreeCacheKey = getCompoundCardNoMinSizeCacheKey(compound, 0);
    const zeroDegreeSvg = zeroDegreeCacheKey
      ? (compound as any).rdkitSvgCache?.[zeroDegreeCacheKey]
      : null;

    return compoundStructureSvgSizes[`${compound.id}:${zeroDegreeCacheKey}`]
      ?? getSvgIntrinsicSize(zeroDegreeSvg)
      ?? compoundStructureBaselineSvgSizes[getCompoundCardBaselineSizeKey(compound)]
      ?? null;
  }, [
    compoundStructureBaselineSvgSizes,
    compoundStructureSvgSizes,
    getCompoundCardBaselineSizeKey,
    getCompoundCardNoMinSizeCacheKey,
  ]);
  const getCompoundCardCurrentRdkitSvgSize = React.useCallback((compound: Compound): SvgIntrinsicSize | null => (
    getSvgIntrinsicSize(clusterSvgByCompoundId[compound.id])
      ?? compoundStructureSvgSizes[`${compound.id}:${getCompoundCardNoMinSizeCacheKey(compound)}`]
      ?? getSvgIntrinsicSize(getCompoundCardNoMinSizeSvg(compound))
      ?? null
  ), [
    clusterSvgByCompoundId,
    compoundStructureSvgSizes,
    getCompoundCardNoMinSizeCacheKey,
    getCompoundCardNoMinSizeSvg,
  ]);
  useEffect(() => {
    setCompoundStructureBaselineSvgSizes((prev) => {
      let next = prev;

      displaySarCompounds.forEach((compound) => {
        const baselineSizeKey = getCompoundCardBaselineSizeKey(compound);
        if (next[baselineSizeKey]) return;
        const svgSize = getCompoundCardCurrentRdkitSvgSize(compound);
        if (!svgSize) return;
        if (next === prev) next = { ...prev };
        next[baselineSizeKey] = svgSize;
      });

      return next;
    });
  }, [displaySarCompounds, getCompoundCardBaselineSizeKey, getCompoundCardCurrentRdkitSvgSize]);
  const getCompoundCardSourceSvgSize = React.useCallback((compound: Compound): SvgIntrinsicSize => (
    getCompoundCardCurrentRdkitSvgSize(compound)
      ?? getSvgIntrinsicSize(compound.structureSvg)
      ?? {
        width: compoundCardStructureFrameSize,
        height: compoundCardStructureFrameSize,
      }
  ), [
    compoundCardStructureFrameSize,
    getCompoundCardCurrentRdkitSvgSize,
  ]);
  const compoundStructureDisplayScale = useMemo(() => {
    const maxBaselineDiagonal = displaySarCompounds.reduce((maxDiagonal, compound) => {
      const svgSize = getCompoundCardBaselineSvgSize(compound) ?? getCompoundCardSourceSvgSize(compound);
      return Math.max(maxDiagonal, Math.hypot(svgSize.width, svgSize.height));
    }, 0);
    const availableFrameSize = Math.min(
      SAR_COMPOUND_MULTI_SELECT_MAX_HEIGHT,
      compoundCardStructureFrameSize,
    );
    const fitScale = maxBaselineDiagonal > 0
      ? availableFrameSize / maxBaselineDiagonal
      : 1;
    const activeScale = (activeStructureSettings?.sarImageScalePercent ?? DEFAULT_GROUP_STRUCTURE_VIEW_SETTINGS.sarImageScalePercent) / 100;

    return fitScale * activeScale;
  }, [
    activeStructureSettings?.sarImageScalePercent,
    compoundCardStructureFrameSize,
    displaySarCompounds,
    getCompoundCardBaselineSvgSize,
    getCompoundCardSourceSvgSize,
  ]);
  const getCompoundCardStructureDisplaySize = React.useCallback((compound: Compound): SvgIntrinsicSize => {
    const svgSize = getCompoundCardSourceSvgSize(compound);

    return {
      width: Math.ceil(svgSize.width * compoundStructureDisplayScale),
      height: Math.ceil(svgSize.height * compoundStructureDisplayScale),
    };
  }, [
    compoundStructureDisplayScale,
    getCompoundCardSourceSvgSize,
  ]);
  const compoundCardPinnedStep = compoundCardViewMode === 'twoRows'
    ? compoundCardWidth + SAR_COMPOUND_CARD_GRID_COLUMN_GAP
    : compoundCardWidth - (compoundCardWidth * compoundCardOverlapPercent / 100) + (compoundCardOverlapPercent > 0 ? 0 : SAR_COMPOUND_CARD_GAP);
  const sarScrollbarThumb = isDarkMode ? '#4b5563' : '#c4cbd3';
  const sarScrollbarThumbHover = isDarkMode ? '#6b7280' : '#9aa3aa';
  const sarScrollbarTrack = isDarkMode ? '#1f1f1f' : '#f8f9fa';
  const activeSarHighlightMode = activeStructureSettings?.sarHighlightMode ?? DEFAULT_GROUP_STRUCTURE_VIEW_SETTINGS.sarHighlightMode;
  const activeSarAtomColorMode = activeStructureSettings?.sarAtomColorMode ?? DEFAULT_GROUP_STRUCTURE_VIEW_SETTINGS.sarAtomColorMode;
  const activeSarAbbreviationMode = activeStructureSettings?.sarAbbreviationMode ?? DEFAULT_GROUP_STRUCTURE_VIEW_SETTINGS.sarAbbreviationMode;
  const activeSarScaffold = activeStructureSettings?.sarScaffold ?? DEFAULT_GROUP_STRUCTURE_VIEW_SETTINGS.sarScaffold;
  const activeScaffoldColorKey = activeSarScaffold.color || SAR_SCAFFOLD_HIGHLIGHT_COLOR;
  const activeScaffoldColorOption = SAR_SCAFFOLD_COLOR_OPTIONS.find((option) => option.key === activeScaffoldColorKey)
    ?? SAR_SCAFFOLD_COLOR_OPTIONS.find((option) => option.key === SAR_SCAFFOLD_HIGHLIGHT_COLOR)
    ?? SAR_SCAFFOLD_COLOR_OPTIONS[0];
  const clusterHighlightMode = activeSarHighlightMode === 'com' || activeSarHighlightMode === 'diff'
    ? activeSarHighlightMode
    : null;
  const clusterAbbrevOption = getSarAbbrevOption(activeSarAbbreviationMode);
  const scaffoldSubstructureMolBlock = activeSarScaffold.source === 'custom'
    ? activeSarScaffold.molBlock?.trim() || ''
    : '';
  const scaffoldSubstructureSmiles = activeSarScaffold.source === 'custom'
    ? activeSarScaffold.smiles?.trim() || ''
    : '';
  const scaffoldSubstructureColorDict = useMemo<Record<string, RdkitSubstructureColorInfo> | undefined>(() => (
    scaffoldSubstructureSmiles && scaffoldSubstructureMolBlock
      ? {
          [scaffoldSubstructureSmiles]: {
            color: activeScaffoldColorOption.key,
            molblock: scaffoldSubstructureMolBlock,
          },
        }
      : undefined
  ), [activeScaffoldColorOption.key, scaffoldSubstructureMolBlock, scaffoldSubstructureSmiles]);

  useEffect(() => {
    const requestSeq = clusterRequestSeqRef.current + 1;
    clusterRequestSeqRef.current = requestSeq;

    if (!clusterHighlightMode || isStructureSettingsDisabled || displaySarCompounds.length === 0) {
      setClusterSvgByCompoundId({});
      setClusterRGroupsByCompoundId({});
      setIsClusterLoading(false);
      notification.destroy(SAR_RDKIT_CLUSTER_ERROR_NOTIFICATION_KEY);
      return;
    }

    setIsClusterLoading(true);
    notification.destroy(SAR_RDKIT_CLUSTER_ERROR_NOTIFICATION_KEY);
    setClusterSvgByCompoundId({});
    setClusterRGroupsByCompoundId({});

    void renderRdkitClusterSvgs({
      compounds: displaySarCompounds.map((compound) => ({
        id: compound.id,
        compoundId: compound.compoundId,
        name: compound.name,
        smiles: compound.smiles,
        molBlock: (compound as any).molBlock ?? (compound as any).mol_block ?? (compound as any).molblock,
      })),
      mode: clusterHighlightMode as RdkitClusterHighlightMode,
      angleDeg: activeStructureSettings?.sarRotationDeg ?? DEFAULT_GROUP_STRUCTURE_VIEW_SETTINGS.sarRotationDeg,
      scalePercent: DEFAULT_GROUP_STRUCTURE_VIEW_SETTINGS.sarImageScalePercent,
      minSize: undefined,
      atomLabelBlock: activeSarAtomColorMode === 'black',
      abbrevOption: clusterAbbrevOption,
      substructureColorDict: scaffoldSubstructureColorDict,
      useGlobalDrawOptions: false,
    })
      .then((result) => {
        if (clusterRequestSeqRef.current !== requestSeq) return;

        setClusterSvgByCompoundId(
          result.compounds.reduce<Record<string, string>>((acc, compound) => {
            acc[compound.id] = compound.svg;
            return acc;
          }, {})
        );
        setClusterRGroupsByCompoundId(
          result.compounds.reduce<Record<string, Record<string, RdkitClusterRGroup>>>((acc, compound) => {
            if (compound.rGroups) acc[compound.id] = compound.rGroups;
            return acc;
          }, {})
        );
        setIsClusterLoading(false);
      })
      .catch((error) => {
        if (clusterRequestSeqRef.current !== requestSeq) return;

        setClusterSvgByCompoundId({});
        setClusterRGroupsByCompoundId({});
        setIsClusterLoading(false);
        notification.error({
          key: SAR_RDKIT_CLUSTER_ERROR_NOTIFICATION_KEY,
          message: 'RDKit API 호출 실패',
          description: error instanceof Error ? error.message : 'RDKit cluster 요청에 실패했습니다.',
          duration: 10,
          placement: 'topRight',
        });
      });
  }, [
    activeStructureSettings?.sarRotationDeg,
    activeSarAtomColorMode,
    clusterAbbrevOption,
    clusterHighlightMode,
    displaySarCompounds,
    isStructureSettingsDisabled,
    notification,
    scaffoldSubstructureColorDict,
  ]);

  return (
    <div
      className="gx-main-content sar-page"
      onMouseDown={handlePageMouseDown}
      style={{
        maxWidth: layoutPreset.maxWidth,
        margin: '0 auto',
        padding: `0 ${layoutPreset.sidePadding}px`,
        width: '100%',
        height: '100%',
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        boxSizing: 'border-box'
      }}
    >
      <div className={`sar-workspace ${quickViewer ? 'sar-workspace-with-viewer' : ''}`}>
        <div className="sar-workspace-main">
      {/* Search & Filter Header (MyBoard Layout) */}
      <Card variant="borderless" className="c-card compact-filter-card" style={{ marginBottom: 12 }}>
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
              <Input
                prefix={<Search size={18} color={token.colorTextTertiary} />}
                placeholder="검색어 입력 (이름, SMILES 등)"
                className="v-search-input"
                style={{
                  flex: '1 1 260px',
                  minWidth: 180,
                  maxWidth: isResponsiveToolbar ? '100%' : 350,
                }}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
              <Button
                icon={showFilters ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                onClick={() => setShowFilters(!showFilters)}
                className="v-action-btn"
              >
                상세 필터 {showFilters ? '닫기' : '열기'}
              </Button>
              <Button
                icon={<BenzeneIcon size={18} />}
                className="v-action-btn"
                onClick={() => setIsStructureModalOpen(true)}
              >
                구조 검색
              </Button>
              <Button icon={<Download size={18} />} className="v-action-btn">Export</Button>
            </div>
          </Col>
          <Col flex={isResponsiveToolbar ? '1 1 100%' : 'none'}>
            <Button
              type="primary"
              icon={<ArrowLeft size={18} />}
              onClick={() => navigate(-1)}
              style={{
                background: token.colorPrimary,
                borderColor: token.colorPrimary,
                color: token.colorBgContainer,
                minWidth: 117,
                width: isResponsiveToolbar ? '100%' : undefined,
              }}
            >
              돌아가기
            </Button>
          </Col>
        </Row>
        {showFilters && (
          <div className="compact-filter-panel">
            <Row gutter={[24, 12]}>
              <Col span={10}>
                <Text strong>Projects</Text><br />
                <Space wrap style={{ marginTop: 4 }}>
                  {['ALL', ...projectList].map(opt => (
                    <ToggleTag
                      key={opt}
                      checked={selectedProjects.includes(opt)}
                      onChange={(checked) => handleToggleChange(checked, opt, setSelectedProjects, selectedProjects, projectList)}
                    >
                      {opt}
                    </ToggleTag>
                  ))}
                </Space>
              </Col>
              <Col span={6}>
                <Text strong>Share</Text><br />
                <Space wrap style={{ marginTop: 4 }}>
                  {['ALL', ...shareList].map(opt => (
                    <ToggleTag
                      key={opt}
                      checked={selectedShares.includes(opt)}
                      onChange={(checked) => handleToggleChange(checked, opt, setSelectedShares, selectedShares, shareList)}
                    >
                      {opt}
                    </ToggleTag>
                  ))}
                </Space>
              </Col>
              <Col span={8}>
                <Text strong>Design Source</Text><br />
                <Space wrap style={{ marginTop: 4 }}>
                  {['ALL', ...sourceList].map(opt => (
                    <ToggleTag
                      key={opt}
                      checked={selectedSources.includes(opt)}
                      onChange={(checked) => handleToggleChange(checked, opt, setSelectedSources, selectedSources, sourceList)}
                    >
                      {opt}
                    </ToggleTag>
                  ))}
                </Space>
              </Col>
              <Col span={24}>
                <Space size="large">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Text strong>기간:</Text>
                    <Segmented
                      options={['3개월', '6개월', '12개월', '전체']}
                      value={period}
                      onChange={(v) => setPeriod(v as string)}
                    />
                    <DatePicker.RangePicker
                      format="YYYY.MM.DD"
                      className="v-action-btn"
                      style={{ borderRadius: 12 }}
                      disabled={period !== '전체'}
                    />
                  </div>
                </Space>
              </Col>
            </Row>
          </div>
        )}
      </Card>

      <div className="sar-board-layout">
        {!isGroupStructureCollapsed && (
        <div className="v-table-card sar-group-structure-card">
          <div className="v-table-header" style={{ minHeight: 40, justifyContent: 'center' }}>
            <Tooltip title="그룹 영역 접기">
              <Button
                size="small"
                type="text"
                icon={<PanelLeftClose size={14} />}
                onClick={() => setIsGroupStructureCollapsed(true)}
                aria-label="그룹 영역 접기"
              />
            </Tooltip>
          </div>
          <Table
            className="sar-group-structure-table"
            dataSource={sortedGroupStructureRows}
            columns={groupStructureColumns}
            rowKey="id"
            size="small"
            pagination={false}
            scroll={undefined}
            tableLayout="fixed"
            onRow={(record) => ({
              onMouseDown: (event) => {
                if (!event.shiftKey) return;
                const target = event.target as HTMLElement;
                if (target.closest('button, a, input, textarea, .ant-checkbox-wrapper, .ant-select, .ant-dropdown')) return;
                event.preventDefault();
              },
              onClick: (event) => handleGroupStructureSelection(record.id, event),
              style: { cursor: 'pointer' },
            })}
            rowClassName={(record) => [
              selectedGroupIds.includes(record.id) ? 'row-selected sar-group-row-selected' : '',
            ].filter(Boolean).join(' ')}
          />
        </div>
        )}

        <div className="sar-board-content">
          {/* Compound Cards Controls */}
          <div className="sar-compound-panel" style={{
            padding: '16px',
            background: token.colorBgContainer,
            borderRadius: 12,
            marginBottom: 20,
            overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
              <Space wrap size={8} className="sar-compound-panel-title">
                {isGroupStructureCollapsed && (
                  <Tooltip title="그룹 영역 펼치기">
                    <Button
                      size="small"
                      type="text"
                      icon={<PanelLeftOpen size={14} />}
                      onClick={() => setIsGroupStructureCollapsed(false)}
                      aria-label="그룹 영역 펼치기"
                    />
                  </Tooltip>
                )}
                <BenzeneIcon size={16} color={token.colorPrimary} className="sar-compound-panel-title-icon" />
                <Text strong className="sar-compound-panel-title-text">화합물</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>{displaySarCompounds.length} compounds</Text>
                <div className="sar-compound-setting-group sar-rdkit-control-group">
                  <span className="sar-compound-setting-label sar-rdkit-control-label">Atom</span>
                  <Segmented
                    className="sar-compound-highlight-toggle"
                    size="small"
                    value={activeSarAtomColorMode}
                    disabled={isStructureSettingsDisabled}
                    onChange={(value) => updateActiveStructureSettings({ sarAtomColorMode: value as SarAtomColorMode })}
                    options={[
                      { label: <Tooltip title="원자 라벨을 검정색으로 표시합니다">Black</Tooltip>, value: 'black' },
                      { label: <Tooltip title="원자 라벨 색상을 RDKit 기본 색상으로 표시합니다">Color</Tooltip>, value: 'color' },
                    ]}
                  />
                </div>
                <div className="sar-compound-setting-group sar-rdkit-control-group">
                  <span className="sar-compound-setting-label sar-rdkit-control-label">Abbreviation</span>
                  <Segmented
                    className="sar-compound-highlight-toggle"
                    size="small"
                    value={activeSarAbbreviationMode}
                    disabled={isStructureSettingsDisabled}
                    onChange={(value) => updateActiveStructureSettings({ sarAbbreviationMode: value as SarAbbreviationMode })}
                    options={[
                      { label: <Tooltip title="RDKit 약어 표기를 기본 규칙대로 유지합니다">Keep</Tooltip>, value: 'keep' },
                      { label: <Tooltip title="가능한 약어 표기를 모두 적용합니다">All</Tooltip>, value: 'all' },
                      { label: <Tooltip title="약어 표기를 끄고 원자 구조로 표시합니다">Off</Tooltip>, value: 'off' },
                    ]}
                  />
                </div>
                <div className="sar-compound-setting-group sar-rdkit-control-group">
                  <span className="sar-compound-setting-label sar-rdkit-control-label">Highlight</span>
                  <Segmented
                    className="sar-compound-highlight-toggle"
                    size="small"
                    value={activeSarHighlightMode}
                    disabled={isStructureSettingsDisabled}
                    onChange={(value) => updateActiveStructureSettings({ sarHighlightMode: value as SarHighlightMode })}
                    options={[
                      { label: <Tooltip title="동일 골격에 하이라이팅 표시">Comm</Tooltip>, value: 'com' },
                      { label: <Tooltip title="차이나는 부분만 하이라이팅 표시">Diff</Tooltip>, value: 'diff' },
                      { label: <Tooltip title="끄기">Off</Tooltip>, value: 'off' },
                    ]}
                  />
                  <Tooltip
                    title={
                      activeSarScaffold.source === 'custom'
                        ? '사용자 지정 scaffold 적용 중'
                        : 'ChemDraw로 사용자 지정 scaffold를 그립니다'
                    }
                  >
                    <Button
                      size="small"
                      className={`sar-scaffold-button ${activeSarScaffold.source === 'custom' ? 'sar-scaffold-button-active' : ''}`}
                      disabled={isStructureSettingsDisabled}
                      onClick={openScaffoldModal}
                    >
                      Scaffold
                    </Button>
                  </Tooltip>
                  {activeSarScaffold.source === 'custom' && (
                    <Tooltip title={`Scaffold 하이라이트 색상: ${activeScaffoldColorOption.key}`}>
                      <span className="sar-scaffold-color-trigger-wrap">
                        <Popover
                          trigger="click"
                          placement="bottomLeft"
                          open={isScaffoldColorPickerOpen}
                          onOpenChange={(open) => setIsScaffoldColorPickerOpen(open)}
                          content={(
                            <div className="sar-scaffold-color-panel" aria-label="Scaffold highlight color">
                              <Text strong className="sar-scaffold-color-title">Scaffold color</Text>
                              <div className="sar-scaffold-color-palette">
                                {SAR_SCAFFOLD_COLOR_OPTIONS.map((option) => {
                                  const isSelected = activeScaffoldColorKey === option.key;

                                  return (
                                    <Tooltip key={option.key} title={option.key}>
                                      <button
                                        type="button"
                                        className={`sar-scaffold-color-swatch ${isSelected ? 'sar-scaffold-color-swatch-selected' : ''}`}
                                        style={{ backgroundColor: option.color }}
                                        aria-label={`Scaffold color ${option.key}`}
                                        aria-pressed={isSelected}
                                        onClick={() => changeScaffoldColor(option.key)}
                                      />
                                    </Tooltip>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        >
                          <Button
                            size="small"
                            className="sar-scaffold-color-trigger"
                            disabled={isStructureSettingsDisabled}
                            icon={<Palette size={12} />}
                            aria-label="Scaffold 색상 선택"
                          >
                            <span
                              className="sar-scaffold-color-trigger-swatch"
                              style={{ backgroundColor: activeScaffoldColorOption.color }}
                            />
                          </Button>
                        </Popover>
                      </span>
                    </Tooltip>
                  )}
                  {activeSarScaffold.source === 'custom' && (
                    <Tooltip title="사용자 지정 scaffold 해제">
                      <Button
                        size="small"
                        type="text"
                        icon={<RotateCcw size={12} />}
                        disabled={isStructureSettingsDisabled}
                        onClick={resetScaffoldToAuto}
                        aria-label="사용자 지정 scaffold 해제"
                      />
                    </Tooltip>
                  )}
                </div>
                <div className="sar-compound-setting-group sar-rdkit-control-group sar-compound-show-filter">
                  <span className="sar-compound-setting-label sar-rdkit-control-label">Show</span>
                  <Segmented
                    className="sar-compound-highlight-toggle"
                    size="small"
                    value={sarCompoundTypeFilter}
                    onChange={(value) => setSarCompoundTypeFilter(value as 'all' | 'compound' | 'design')}
                    options={[
                      { label: 'All', value: 'all' },
                      { label: 'Compound', value: 'compound' },
                      { label: 'Design', value: 'design' },
                    ]}
                  />
                </div>
                {isClusterLoading ? <Spin size="small" /> : null}
              </Space>
              <Space size={8}>
                {!isCompoundStructureCollapsed && (
                  <>
                    <div className="sar-compound-setting-stack" aria-label="화합물 구조 표시 설정">
                      <div className="sar-compound-setting-group">
                        <span className="sar-compound-setting-label">Scale</span>
                        <div className="sar-compound-setting-row">
                          <Tooltip title="구조 이미지 축소">
                            <Button
                              size="small"
                              icon={<Minus size={12} />}
                              disabled={isStructureSettingsDisabled}
                              onClick={() => changeSarImageScale(-SAR_COMPOUND_CARD_SETTING_STEP)}
                            />
                          </Tooltip>
                          <div className="sar-compound-setting-value">
                            {activeStructureSettings ? `${activeStructureSettings.sarImageScalePercent}%` : ''}
                          </div>
                          <Tooltip title="구조 이미지 확대">
                            <Button
                              size="small"
                              icon={<Plus size={12} />}
                              disabled={isStructureSettingsDisabled}
                              onClick={() => changeSarImageScale(SAR_COMPOUND_CARD_SETTING_STEP)}
                            />
                          </Tooltip>
                        </div>
                      </div>
                      <div className="sar-compound-setting-group">
                        <span className="sar-compound-setting-label">Rotate</span>
                        <div className="sar-compound-setting-row">
                          <Tooltip title="왼쪽으로 30도 회전">
                            <Button
                              size="small"
                              icon={<RotateCcw size={12} />}
                              disabled={isStructureSettingsDisabled}
                              onClick={() => changeSarRotation(-SAR_COMPOUND_CARD_ROTATION_STEP)}
                            />
                          </Tooltip>
                          <div className="sar-compound-setting-value">
                            {activeStructureSettings ? `${activeStructureSettings.sarRotationDeg}°` : ''}
                          </div>
                          <Tooltip title="오른쪽으로 30도 회전">
                            <Button
                              size="small"
                              icon={<RotateCw size={12} />}
                              disabled={isStructureSettingsDisabled}
                              onClick={() => changeSarRotation(SAR_COMPOUND_CARD_ROTATION_STEP)}
                            />
                          </Tooltip>
                        </div>
                      </div>
                      <div className="sar-compound-setting-group">
                        <span className="sar-compound-setting-label">Overlap</span>
                        <div className="sar-compound-setting-row">
                          <Tooltip title="구조 겹침 증가">
                            <Button
                              size="small"
                              icon={<img src={arrowMergeIcon} alt="" className="sar-compound-setting-icon" />}
                              disabled={isStructureSettingsDisabled || compoundCardViewMode === 'twoRows'}
                              onClick={() => changeSarOverlap(SAR_COMPOUND_CARD_SETTING_STEP)}
                            />
                          </Tooltip>
                          <div className="sar-compound-setting-value">
                            {activeStructureSettings && compoundCardViewMode !== 'twoRows' ? activeStructureSettings.sarOverlapPercent : ''}
                          </div>
                          <Tooltip title="구조 겹침 감소">
                            <Button
                              size="small"
                              icon={<img src={arrowDivideIcon} alt="" className="sar-compound-setting-icon" />}
                              disabled={isStructureSettingsDisabled || compoundCardViewMode === 'twoRows'}
                              onClick={() => changeSarOverlap(-SAR_COMPOUND_CARD_SETTING_STEP)}
                            />
                          </Tooltip>
                        </div>
                      </div>
                    </div>
                    <Segmented
                      style={{ marginLeft: 7 }}
                      size="small"
                      value={compoundCardViewMode}
                      onChange={(value) => setCompoundCardViewMode(value as 'single' | 'twoRows')}
                      options={[
                        { label: '기본', value: 'single' },
                        { label: '2줄', value: 'twoRows' },
                      ]}
                    />
                  </>
                )}
                <Button
                  size="small"
                  type="text"
                  icon={isCompoundStructureCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                  onClick={() => setIsCompoundStructureCollapsed((prev) => !prev)}
                  aria-label={isCompoundStructureCollapsed ? '화합물 구조 영역 펼치기' : '화합물 구조 영역 접기'}
                />
              </Space>
            </div>
            {isCompoundStructureCollapsed ? null : (
              <div
                className="sar-compound-card-list"
                style={{
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  padding: '2px 0 8px',
                }}
                tabIndex={0}
                onKeyDown={handleCompoundCardKeyDown}
                aria-label="SAR compound card list"
              >
              <div className="sar-compound-card-track" style={compoundCardViewMode === 'twoRows' ? {
                display: 'grid',
                gridAutoFlow: 'row',
                gridTemplateColumns: `repeat(${Math.ceil(displaySarCompounds.length / 2)}, ${compoundCardWidth}px)`,
                gridTemplateRows: 'repeat(2, minmax(0, 1fr))',
                gridAutoRows: 'auto',
                columnGap: SAR_COMPOUND_CARD_GRID_COLUMN_GAP,
                rowGap: SAR_COMPOUND_CARD_GRID_ROW_GAP,
                width: 'max-content',
                padding: '0 3px',
                boxSizing: 'content-box',
              } : {
                display: 'inline-flex',
                gap: compoundCardOverlapPercent > 0 ? 0 : SAR_COMPOUND_CARD_GAP,
                width: 'max-content',
                padding: '0 3px',
                boxSizing: 'content-box',
              }}>
                {displaySarCompounds.map((item, index) => {
                  const itemStructureSettings = getGroupStructureSettings(item.groupId);
                  const isPinnedCompound = pinnedCompoundIdSet.has(item.id);
                  const isSelectedCompound = selectedCompoundIdSet.has(item.id);
                  const compoundStructureDisplaySize = getCompoundCardStructureDisplaySize(item);
                  const pinnedOrder = pinnedCompoundOrderMap[item.id] ?? 0;
                  const clusterSvg = clusterHighlightMode ? clusterSvgByCompoundId[item.id] : null;
                  const clusterRGroups = clusterHighlightMode ? clusterRGroupsByCompoundId[item.id] : undefined;
                  const isClusterStructureLoading = Boolean(clusterHighlightMode && isClusterLoading && !clusterSvg);
                  const { displayCode, color: displayCodeColor, fontWeight: displayCodeFontWeight } = getSarDisplayCode(item as SarTableRow);

                  return (
                    <div
                      id={`sar-compound-card-${item.id}`}
                      key={item.id}
                      onMouseDown={(event) => {
                        if (!event.shiftKey) return;
                        const target = event.target as HTMLElement;
                        if (target.closest('button, a, input, textarea, .ant-checkbox-wrapper, .ant-select, .ant-dropdown')) return;
                        event.preventDefault();
                      }}
                      onClick={(event) => handleCompoundSelection(item.id, event)}
                      role="option"
                      aria-selected={isSelectedCompound}
                      aria-label={`${item.name}${isPinnedCompound ? ', pin fixed' : ''}`}
                      className={`v-item-card sar-compound-card ${isSelectedCompound ? 'selected' : ''} ${hoveredRowKey === item.id ? 'hovered' : ''} ${isPinnedCompound ? 'pinned' : ''}`}
                      onMouseEnter={() => setHoveredRowKey(item.id)}
                      onMouseLeave={() => setHoveredRowKey(null)}
                      style={{
                        width: compoundCardWidth,
                        padding: 0,
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: isCompoundCardOverlapped
                            ? 'transparent'
                            : isPinnedCompound && (isSelectedCompound || hoveredRowKey === item.id)
                            ? sarPinnedSelectedCardBg
                            : isSelectedCompound || hoveredRowKey === item.id
                            ? (isDarkMode ? 'rgba(248, 124, 99, 0.12)' : 'rgba(248, 124, 99, 0.08)')
                            : token.colorBgContainer,
                        boxSizing: 'border-box',
                        borderColor: 'transparent',
                        overflow: isPinnedCompound && !isCompoundCardOverlapped ? 'hidden' : 'visible',
                        position: isPinnedCompound ? 'sticky' : 'relative',
                        left: isPinnedCompound ? pinnedOrder * compoundCardPinnedStep : undefined,
                        marginRight: compoundCardViewMode === 'single' && index < displaySarCompounds.length - 1
                          ? -(compoundCardWidth * compoundCardOverlapPercent / 100)
                          : 0,
                        zIndex: isPinnedCompound
                          ? displaySarCompounds.length + 20 - pinnedOrder
                          : isSelectedCompound || hoveredRowKey === item.id
                            ? displaySarCompounds.length + 1
                            : index + 1,
                      }}
                    >
                      <div style={{
                        height: compoundCardStructureFrameSize,
                        background: !isCompoundCardOverlapped ? token.colorBgContainer : 'transparent',
                        borderRadius: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        marginBottom: compoundCardViewMode === 'twoRows' ? 4 : 6,
                        overflow: 'visible',
                      }}
                        onDoubleClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          togglePinnedCompound(item.id);
                        }}
                        title={isPinnedCompound ? '더블클릭하여 핀 고정 해제' : '더블클릭하여 핀 고정'}
                      >
                        {isPinnedCompound && (
                          <span className="sar-compound-pin-badge" aria-hidden="true">
                            <Pin size={11} fill="currentColor" />
                          </span>
                        )}
                        <div
                          className="sar-compound-structure-square-frame"
                          style={{
                            width: compoundCardStructureFrameSize,
                            height: compoundCardStructureFrameSize,
                          }}
                        >
                          {isClusterStructureLoading ? (
                            <div className="sar-compound-cluster-placeholder">
                              <Spin size="small" />
                            </div>
                          ) : (
                            <CompoundStructureView
                              svg={item.structureSvg}
                              renderedSvgOverride={clusterSvg}
                              rdkitSvg={(item as any).rdkitSvg}
                              rdkitSvgCache={(item as any).rdkitSvgCache}
                              title={item.name}
                              smiles={item.smiles}
                              molBlock={(item as any).molBlock ?? (item as any).mol_block ?? (item as any).molblock}
                              width={compoundStructureDisplaySize.width}
                              height={compoundStructureDisplaySize.height}
                              iconSize={48}
                              className="sar-compound-structure-view"
                              svgClassName="sar-structure-svg"
                              actionPlacement="overlay"
                              actionOverlayAnchor="container"
                              actionOverlayPlacement="bottom-right"
                              showPreviewAction
                              showCopyAction
                              showLinkedImageCopyAction
                              onPreview={(svg) => {
                                if (svg) {
                                  setStructurePreview({
                                    title: item.name || item.compoundId || 'Structure',
                                    svg,
                                    smiles: item.smiles,
                                    molblock: (item as any).molBlock ?? (item as any).mol_block ?? (item as any).molblock,
                                    cdxml: (item as any).draw,
                                  });
                                }
                              }}
                              preferRdkitSvg
                              rdkitAngleDeg={itemStructureSettings.sarRotationDeg}
                              rdkitScalePercent={DEFAULT_GROUP_STRUCTURE_VIEW_SETTINGS.sarImageScalePercent}
                              rdkitMinSize={undefined}
                              rdkitAtomLabelBlock={itemStructureSettings.sarAtomColorMode === 'black'}
                              rdkitAbbrevOption={getSarAbbrevOption(itemStructureSettings.sarAbbreviationMode)}
                              rdkitUseGlobalDrawOptions={false}
                              onStructureGenerated={(data) => handleCompoundStructureGenerated(
                                item.id,
                                data,
                                getCompoundCardBaselineSizeKey(item),
                              )}
                              structureStyle={{ transformOrigin: 'center center' }}
                              frameStyle={{ border: 0, background: !isCompoundCardOverlapped ? token.colorBgContainer : 'transparent', boxShadow: 'none', overflow: 'visible' }}
                            />
                          )}
                        </div>
                        {renderSarDataButtons(item)}
                      </div>
                      <Text className="sar-compound-card-name" style={{ color: displayCodeColor, fontSize: 12, fontWeight: displayCodeFontWeight, lineHeight: '16px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingBottom: 4, boxSizing: 'border-box' }} title={displayCode}>
                        {displayCode}
                      </Text>
                      {clusterRGroups ? (
                        <div className="sar-compound-rgroup-list" aria-label={`${displayCode} R-group 결과`}>
                          {Object.entries(clusterRGroups).map(([key, rGroup]) => (
                            <button
                              key={key}
                              type="button"
                              className="sar-compound-rgroup-item"
                              title={`${key}${rGroup.smiles ? `: ${rGroup.smiles}` : ''}`}
                              disabled={!rGroup.svg}
                              onClick={(event) => {
                                event.stopPropagation();
                                if (!rGroup.svg) return;
                                setStructurePreview({
                                  title: `${displayCode} ${key}`,
                                  svg: rGroup.svg,
                                  smiles: rGroup.smiles,
                                });
                              }}
                            >
                              <span className="sar-compound-rgroup-label">{key}</span>
                              {rGroup.svg ? (
                                <span
                                  className="sar-compound-rgroup-svg"
                                  dangerouslySetInnerHTML={{ __html: rGroup.svg }}
                                />
                              ) : null}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              </div>
            )}
          </div>

          {/* Main SAR Table (Multi-level Header) */}
          <div
            ref={sarTableCardRef}
            className={`v-table-card sar-table-card ${isColorActive ? 'sar-table-card-color-active' : ''}`}
          >
            <div className="v-table-header">
              <Space>
                <Tooltip title={isColorActive ? 'Color scale 끄기' : 'Color scale 켜기'}>
                  <Button
                    size="small"
                    type={isColorActive ? 'primary' : 'default'}
                    className={`sar-color-toggle ${isColorActive ? 'sar-color-toggle-active' : ''}`}
                    icon={isColorActive ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    aria-pressed={isColorActive}
                    aria-label={isColorActive ? 'Color scale 켜짐' : 'Color scale 꺼짐'}
                    onClick={() => setIsColorActive(!isColorActive)}
                  >
                    C
                  </Button>
                </Tooltip>
              </Space>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <div
                      key={n}
                      onClick={() => applyPreset(n)}
                      style={{
                        width: 24, height: 24,
                        background: activePreset === n ? token.colorPrimary : token.colorBorderSecondary,
                        borderRadius: 4,
                        fontSize: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: activePreset === n ? token.colorBgContainer : token.colorTextSecondary,
                        cursor: 'pointer',
                        fontWeight: activePreset === n ? 'bold' : 'normal',
                        transition: 'all 0.2s'
                      }}
                    >
                      {n}
                    </div>
                  ))}
                </div>
                <Settings
                  size={18}
                  color={token.colorTextTertiary}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setIsSettingsModalOpen(true)}
                />
              </div>
            </div>
            <Table
              className="sar-table"
              dataSource={sarTableRows}
              columns={dynamicColumns}
              rowKey="sarTableRowKey"
              size="small"
              pagination={false}
              tableLayout="auto"
              scroll={{ x: 'max-content', y: sarTableBodyHeight }}
              expandable={{
                rowExpandable: (record) => Boolean(record.children?.length),
              }}
              onRow={(record) => ({
                id: `sar-table-row-${record.sarTableRowKey}`,
                onMouseDown: (event) => {
                  if (!event.shiftKey) return;
                  const target = event.target as HTMLElement;
                  if (target.closest('button, a, input, textarea, .ant-checkbox-wrapper, .ant-select, .ant-dropdown')) return;
                  event.preventDefault();
                },
                onClick: (event) => handleCompoundSelection(record.id, event),
                onMouseEnter: () => setHoveredRowKey(record.id),
                onMouseLeave: () => setHoveredRowKey(null)
              })}
              rowClassName={(record) => {
                let classes = [];
                if (record.sarApiRow) classes.push('sar-row-response');
                if (pinnedCompoundIdSet.has(record.id)) classes.push('sar-row-pinned');
                if (selectedCompoundIds.includes(record.id)) classes.push('sar-row-selected');
                if (record.id === hoveredRowKey) classes.push('sar-row-hovered');
                return classes.join(' ');
              }}
            />
          </div>
        </div>
      </div>
        </div>
        {quickViewer && (
          <>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Quick viewer 너비 조절"
              aria-valuemin={SAR_QUICK_VIEWER_MIN_WIDTH}
              aria-valuemax={SAR_QUICK_VIEWER_MAX_WIDTH}
              aria-valuenow={Math.round(quickViewerWidth)}
              tabIndex={0}
              className="sar-quick-viewer-resizer"
              onMouseDown={handleQuickViewerResizeMouseDown}
              onKeyDown={handleQuickViewerResizeKeyDown}
            >
              <div className="sar-quick-viewer-resizer-bar" />
            </div>
            <div
              ref={quickViewerPaneRef}
              className="sar-quick-viewer-pane"
              style={{
                flexBasis: isResponsiveToolbar ? undefined : quickViewerWidth,
                width: isResponsiveToolbar ? '100%' : quickViewerWidth,
              }}
            >
              <QuickViewerPanel
                compound={quickViewer.compound}
                activeType={quickViewer.activeType}
                onActiveTypeChange={(activeType) => {
                  setQuickViewer(prev => prev ? { ...prev, activeType } : prev);
                }}
                onClose={() => setQuickViewer(null)}
              />
            </div>
          </>
        )}
      </div>

      {/* Table Settings Modal */}
      <Modal
        title="테이블 컬럼 설정 (드래그하여 순서 변경)"
        open={isSettingsModalOpen}
        onCancel={() => setIsSettingsModalOpen(false)}
        footer={[
          <Button key="save" type="primary" onClick={handleSavePreset} style={{ background: token.colorPrimary, borderColor: token.colorPrimary }}>
            {activePreset}번 프리셋에 저장
          </Button>
        ]}
        width={700}
      >
        <div style={{ padding: '20px' }}>
          <div style={{ marginBottom: 24 }}>
            <Text strong style={{ display: 'block', marginBottom: 12 }}>설정 프리셋 선택</Text>
            <div style={{ display: 'flex', gap: 12 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <Button
                  key={n}
                  type={activePreset === n ? 'primary' : 'default'}
                  onClick={() => applyPreset(n)}
                  style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: activePreset === n ? token.colorPrimary : token.colorBgContainer,
                    borderColor: activePreset === n ? token.colorPrimary : token.colorBorder
                  }}
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>

          <div style={{ paddingBottom: 16, borderTop: `1px solid ${token.colorBorderSecondary}`, paddingTop: 20 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              <Info size={12} style={{ marginRight: 4 }} />
              현재 설정된 컬럼 가시성 및 순서를 선택된 번호({activePreset}번)에 저장할 수 있습니다.
            </Text>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: token.colorBgLayout, padding: 20, borderRadius: 12 }}>
            {columnOrder.map((item, index) => (
              <div key={item} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div
                  draggable
                  onDragStart={() => onDragStart(index)}
                  onDragOver={(e) => onDragOver(e, index)}
                  onDragEnd={onDragEnd}
                  style={{
                    padding: '12px 16px',
                    background: draggedItemIndex === index ? token.colorPrimaryBg : token.colorBgContainer,
                    color: token.colorText,
                    borderRadius: 12,
                    border: draggedItemIndex === index ? `1px dashed ${token.colorBorderSecondary}` : `1px solid ${token.colorBorderSecondary}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'grab',
                    opacity: draggedItemIndex === index ? 0.6 : 1,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                  }}
                >
                  <Space size="middle">
                    <div
                      onClick={(e) => { e.stopPropagation(); toggleExpand(item); }}
                      style={{
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        visibility: subColumnConfig[item] ? 'visible' : 'hidden'
                      }}
                    >
                      {expandedColumns.includes(item) ? <ChevronUp size={16} color={token.colorTextTertiary} /> : <ChevronDown size={16} color={token.colorTextTertiary} />}
                    </div>
                    <GripVertical size={16} color={token.colorTextTertiary} />
                    <Text
                      strong={activeColumns.includes(item)}
                      style={{
                        color: activeColumns.includes(item) ? token.colorPrimary : token.colorTextTertiary,
                        cursor: 'pointer',
                        userSelect: 'none'
                      }}
                      onClick={() => toggleColumn(item)}
                    >
                      {item}
                    </Text>
                  </Space>
                  <ToggleTag
                    checked={activeColumns.includes(item)}
                    onChange={() => toggleColumn(item)}
                    style={{ marginInlineEnd: 0 }}
                  >
                    {activeColumns.includes(item) ? 'ON' : 'OFF'}
                  </ToggleTag>
                </div>

                {/* Sub-columns (2depth) with Accordion Logic */}
                {activeColumns.includes(item) && subColumnConfig[item] && expandedColumns.includes(item) && (
                  <div style={{ paddingLeft: 48, display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4, marginBottom: 8 }}>
                    {subColumnConfig[item].map((sub, subIdx) => (
                      <div
                        key={sub.key}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.setData('parentKey', item);
                          e.dataTransfer.setData('fromIdx', subIdx.toString());
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const parentKey = e.dataTransfer.getData('parentKey');
                          if (parentKey !== item) return;
                          const fromIdx = parseInt(e.dataTransfer.getData('fromIdx'));
                          reorderSubColumns(item, fromIdx, subIdx);
                        }}
                        style={{
                          padding: '6px 12px',
                          background: token.colorBgContainer,
                          borderRadius: 12,
                          border: `1px solid ${token.colorBorderSecondary}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: 11
                        }}
                      >
                        <Space>
                          <GripVertical size={12} color={token.colorBorder} />
                          <Text
                            style={{
                              fontSize: 11,
                              color: sub.visible ? token.colorText : token.colorTextTertiary,
                              cursor: 'pointer',
                              userSelect: 'none'
                            }}
                            onClick={() => toggleSubColumn(item, sub.key)}
                          >
                            {sub.title}
                          </Text>
                        </Space>
                        <ToggleTag
                          checked={sub.visible}
                          onChange={() => toggleSubColumn(item, sub.key)}
                          style={{ marginInlineEnd: 0 }}
                        >
                          {sub.visible ? 'ON' : 'OFF'}
                        </ToggleTag>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <ChemDrawModal
        open={isStructureModalOpen}
        onCancel={() => setIsStructureModalOpen(false)}
        onConfirm={handleStructureSearchConfirm}
      />

      <ChemDrawModal
        open={isScaffoldModalOpen}
        title="Scaffold 사용자 지정"
        confirmText="적용"
        initialCdxml={activeSarScaffold.source === 'custom' ? activeSarScaffold.cdxml : undefined}
        initialSmiles={activeSarScaffold.source === 'custom' && !activeSarScaffold.cdxml ? activeSarScaffold.smiles : undefined}
        onEditorInteraction={() => {
          scaffoldEditDirtyRef.current = true;
        }}
        onCancel={() => {
          scaffoldEditBaselineRef.current = null;
          scaffoldEditDirtyRef.current = false;
          setIsScaffoldModalOpen(false);
        }}
        onConfirm={handleScaffoldConfirm}
      />

      <StructurePreviewModal
        open={Boolean(structurePreview)}
        title={structurePreview?.title}
        svg={structurePreview?.svg}
        smiles={structurePreview?.smiles}
        molblock={structurePreview?.molblock}
        cdxml={structurePreview?.cdxml}
        onCancel={() => setStructurePreview(null)}
      />

      <style>{`
        .sar-page {
          --table-row-hover-bg: rgba(248, 124, 99, 0.06);
          --table-row-selected-hover-bg: rgba(248, 124, 99, 0.16);
        }
        [data-theme='dark'] .sar-page {
          --table-row-hover-bg: rgba(248, 124, 99, 0.10);
          --table-row-selected-hover-bg: rgba(248, 124, 99, 0.24);
        }
        .sar-board-layout {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          min-width: 0;
          width: 100%;
          max-width: 100%;
        }
        .sar-group-structure-card {
          width: ${SAR_GROUP_STRUCTURE_PANEL_WIDTH}px;
          flex: 0 0 ${SAR_GROUP_STRUCTURE_PANEL_WIDTH}px;
          overflow: hidden;
          box-shadow: inset 0 0 0 1px ${token.colorBorderSecondary};
        }
        .sar-group-structure-card .ant-table-wrapper {
          margin: 0;
          padding-bottom: 1px;
          box-sizing: border-box;
        }
        .sar-group-structure-card .ant-table,
        .sar-group-structure-card .ant-table-container {
          border-radius: 0 0 8px 8px;
        }
        .sar-group-structure-bookmark {
          position: absolute;
          top: 2px;
          left: 2px;
          z-index: 12;
          line-height: 1;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.16s ease;
        }
        .sar-group-representative-structure:hover .sar-group-structure-bookmark,
        .sar-group-representative-structure.is-bookmarked .sar-group-structure-bookmark {
          opacity: 1;
          pointer-events: auto;
        }
        .sar-group-structure-pin-button {
          width: 16px;
          min-width: 16px;
          height: 16px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: ${token.colorTextQuaternary};
          background: color-mix(in srgb, ${token.colorBgContainer} 88%, transparent) !important;
          border: 1px solid transparent;
          border-radius: 4px;
          backdrop-filter: blur(2px);
          transition: background-color 0.16s ease, color 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
        }
        .sar-group-structure-pin-icon {
          width: 12px;
          height: 12px;
          display: inline-block;
          background-color: currentColor;
          -webkit-mask: url("${bookmarkIconMaskUrl}") center / contain no-repeat;
          mask: url("${bookmarkIconMaskUrl}") center / contain no-repeat;
        }
        .sar-group-structure-pin-button:hover .sar-group-structure-pin-icon,
        .sar-group-structure-pin-button:focus .sar-group-structure-pin-icon,
        .sar-group-structure-pin-button:focus-visible .sar-group-structure-pin-icon,
        .sar-group-structure-pin-button:active .sar-group-structure-pin-icon {
          color: inherit !important;
          background-color: currentColor !important;
        }
        .sar-group-structure-pin-button:not(.active):hover .sar-group-structure-pin-icon,
        .sar-group-structure-pin-button:not(.active):focus .sar-group-structure-pin-icon,
        .sar-group-structure-pin-button:not(.active):focus-visible .sar-group-structure-pin-icon,
        .sar-group-structure-pin-button:not(.active):active .sar-group-structure-pin-icon {
          color: ${token.colorTextQuaternary} !important;
          background-color: ${token.colorTextQuaternary} !important;
        }
        .sar-group-structure-pin-button.active,
        .sar-group-structure-pin-button.active:hover,
        .sar-group-structure-pin-button.active:focus-visible {
          color: ${token.colorPrimary};
          background: color-mix(in srgb, ${token.colorBgContainer} 88%, transparent) !important;
          border-color: transparent;
          box-shadow: none;
          outline: 0;
        }
        .sar-group-structure-pin-button.active:hover .sar-group-structure-pin-icon,
        .sar-group-structure-pin-button.active:focus .sar-group-structure-pin-icon,
        .sar-group-structure-pin-button.active:focus-visible .sar-group-structure-pin-icon,
        .sar-group-structure-pin-button.active:active .sar-group-structure-pin-icon {
          color: ${token.colorPrimary} !important;
          background-color: ${token.colorPrimary} !important;
        }
        .sar-group-structure-pin-button:hover {
          color: ${token.colorTextQuaternary};
          background: color-mix(in srgb, ${token.colorBgContainer} 88%, transparent) !important;
        }
        .sar-group-structure-pin-button:focus,
        .sar-group-structure-pin-button:focus-visible,
        .sar-group-structure-pin-button:active {
          background: color-mix(in srgb, ${token.colorBgContainer} 88%, transparent) !important;
          box-shadow: none !important;
          outline: 0 !important;
        }
        .sar-board-content {
          flex: 1 1 auto;
          min-width: 0;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
        }
        .sar-compound-panel,
        .sar-table-card {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          overflow: hidden;
          box-sizing: border-box;
        }
        .sar-compound-card-list {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          display: block;
          overflow-x: auto !important;
          overflow-y: hidden;
          overscroll-behavior-x: contain;
          -webkit-overflow-scrolling: touch;
        }
        .sar-compound-card-track {
          min-width: max-content;
        }
        .sar-table-card .ant-table-wrapper,
        .sar-table-card .ant-spin-nested-loading,
        .sar-table-card .ant-spin-container,
        .sar-table-card .ant-table,
        .sar-table-card .ant-table-container {
          width: 100%;
          max-width: 100%;
          min-width: 0;
        }
        .sar-table-card .ant-table-content {
          overflow-x: auto !important;
          overflow-y: hidden;
          overscroll-behavior-x: contain;
          -webkit-overflow-scrolling: touch;
        }
        .sar-table-card .ant-table-body {
          overflow-x: auto !important;
          overflow-y: auto;
          overscroll-behavior-x: contain;
          -webkit-overflow-scrolling: touch;
        }
        .sar-group-structure-table .ant-table {
          width: 100%;
          margin: 0;
        }
        .sar-group-structure-table .ant-table-container {
          margin: 0;
        }
        .sar-group-structure-table .ant-table-content,
        .sar-group-structure-table .ant-table-body {
          overflow-x: visible !important;
        }
        .sar-group-structure-table .ant-table-tbody > tr > td {
          padding: 1px 4px !important;
          line-height: 0 !important;
          vertical-align: middle !important;
        }
        .sar-group-row-selected > td {
          background-color: var(--table-row-selected-bg) !important;
        }
        .sar-group-row-selected:hover > td {
          background-color: var(--table-row-selected-hover-bg) !important;
        }
        @media (max-width: 900px) {
          .sar-board-layout {
            flex-direction: column;
            align-items: stretch;
          }
          .sar-group-structure-card {
            width: 100%;
            flex-basis: auto;
          }
          .sar-group-structure-table .ant-table {
            width: 100%;
          }
          .sar-board-content {
            flex: 0 0 auto;
            width: 100%;
            max-width: 100%;
            padding-right: 0;
          }
        }
        .sar-structure-svg {
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          width: 100%;
          height: 100%;
          max-width: 100%;
          max-height: 100%;
        }
        .sar-structure-svg > div {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
        }
        .sar-structure-svg svg {
          display: block;
          max-width: 100%;
          max-height: 100%;
          width: auto !important;
          height: auto !important;
          object-fit: contain;
        }
        .sar-compound-structure-view .sar-structure-svg svg {
          width: 100% !important;
          height: 100% !important;
        }
        .sar-row-selected {
          background-color: var(--table-row-selected-bg) !important;
        }
        .sar-row-selected td {
          background-color: var(--table-row-selected-bg) !important;
          border-bottom: 1px solid ${isDarkMode ? '#F87C6333' : '#F87C6322'} !important;
        }
        .sar-row-hovered td {
          background-color: var(--table-row-hover-bg) !important;
          cursor: pointer;
        }
        .sar-row-selected.sar-row-hovered td {
          background-color: var(--table-row-selected-hover-bg) !important;
        }
        .sar-row-pinned td {
          background-color: ${sarPinnedRowBg} !important;
        }
        .sar-row-pinned.sar-row-hovered td,
        .sar-row-pinned.sar-row-selected td,
        .sar-row-pinned.sar-row-selected.sar-row-hovered td {
          background-color: ${sarPinnedRowHoverBg} !important;
        }
        .sar-row-pinned > td:first-child {
          box-shadow: inset 3px 0 0 ${sarPinnedRowColor};
        }
        .sar-table .ant-table-thead > tr > th,
        .sar-table .ant-table-thead > tr > td {
          border-bottom: 0 !important;
          white-space: nowrap !important;
        }
        .sar-table .ant-table-cell {
          white-space: nowrap !important;
        }
        .sar-table .ant-table-cell .ant-typography {
          white-space: nowrap !important;
        }
        .sar-table .ant-table-cell-with-append {
          position: relative;
          vertical-align: middle !important;
          padding-left: 28px !important;
        }
        .sar-table .ant-table-cell-with-append > .ant-table-row-expand-icon {
          position: absolute;
          top: 50%;
          left: 8px;
          display: inline-flex !important;
          align-items: center;
          justify-content: center;
          width: 17px;
          height: 17px;
          margin: 0 !important;
          line-height: 15px;
          transform: translateY(-50%);
        }
        .sar-table .ant-table-cell-with-append > .ant-table-row-indent {
          display: inline-block;
          height: 17px;
          vertical-align: middle;
        }
        .sar-table .ant-table-tbody > tr.sar-row-response > td {
          background: ${isDarkMode ? '#171717' : '#fbfcfe'} !important;
        }
        .sar-table .ant-table-tbody > tr.sar-row-response:hover > td {
          background: ${isDarkMode ? '#1f1f1f' : '#f3f6fb'} !important;
        }
        .sar-table .ant-table-thead > tr:last-child > th,
        .sar-table .ant-table-thead > tr:last-child > td,
        .sar-table .ant-table-thead > tr > th[rowspan],
        .sar-table .ant-table-thead > tr > td[rowspan] {
          border-bottom: 1px solid ${isDarkMode ? '#303030' : '#f0f0f0'} !important;
        }
        .sar-table .ant-table-thead > tr > th.sar-table-group-boundary,
        .sar-table .ant-table-thead > tr > td.sar-table-group-boundary {
          border-right: 1px solid ${isDarkMode ? '#3a3a3a' : '#d8dbe0'} !important;
          border-inline-end: 1px solid ${isDarkMode ? '#3a3a3a' : '#d8dbe0'} !important;
        }
        .sar-table .ant-table-cell-fix-left,
        .sar-table .ant-table-cell-fix-left-last {
          background: ${token.colorBgContainer} !important;
          background-clip: padding-box !important;
          z-index: 4 !important;
        }
        .sar-table .ant-table-thead .ant-table-cell-fix-left,
        .sar-table .ant-table-thead .ant-table-cell-fix-left-last {
          background: ${token.colorBgContainer} !important;
          background-clip: padding-box !important;
          z-index: 8 !important;
        }
        .sar-table .ant-table-tbody > tr.sar-row-selected > .ant-table-cell-fix-left,
        .sar-table .ant-table-tbody > tr.sar-row-selected > .ant-table-cell-fix-left-last {
          background: color-mix(in srgb, ${token.colorPrimary} ${isDarkMode ? 22 : 14}%, ${token.colorBgContainer}) !important;
          background-clip: padding-box !important;
          z-index: 6 !important;
        }
        .sar-table .ant-table-tbody > tr.sar-row-hovered > .ant-table-cell-fix-left,
        .sar-table .ant-table-tbody > tr.sar-row-hovered > .ant-table-cell-fix-left-last {
          background: color-mix(in srgb, ${token.colorPrimary} ${isDarkMode ? 18 : 12}%, ${token.colorBgContainer}) !important;
          background-clip: padding-box !important;
          z-index: 6 !important;
        }
        .sar-table .ant-table-tbody > tr.sar-row-selected.sar-row-hovered > .ant-table-cell-fix-left,
        .sar-table .ant-table-tbody > tr.sar-row-selected.sar-row-hovered > .ant-table-cell-fix-left-last {
          background: color-mix(in srgb, ${token.colorPrimary} ${isDarkMode ? 32 : 22}%, ${token.colorBgContainer}) !important;
        }
        .sar-table .ant-table-tbody > tr.sar-row-pinned > .ant-table-cell-fix-left,
        .sar-table .ant-table-tbody > tr.sar-row-pinned > .ant-table-cell-fix-left-last {
          background: ${sarPinnedRowBg} !important;
          background-clip: padding-box !important;
          box-shadow: inset 3px 0 0 ${sarPinnedRowColor};
          z-index: 7 !important;
        }
        .sar-table .ant-table-tbody > tr.sar-row-pinned.sar-row-hovered > .ant-table-cell-fix-left,
        .sar-table .ant-table-tbody > tr.sar-row-pinned.sar-row-hovered > .ant-table-cell-fix-left-last,
        .sar-table .ant-table-tbody > tr.sar-row-pinned.sar-row-selected > .ant-table-cell-fix-left,
        .sar-table .ant-table-tbody > tr.sar-row-pinned.sar-row-selected > .ant-table-cell-fix-left-last {
          background: ${sarPinnedRowHoverBg} !important;
          background-clip: padding-box !important;
          box-shadow: inset 3px 0 0 ${sarPinnedRowColor};
          z-index: 7 !important;
        }
        .sar-table .ant-table-thead .ant-table-cell-fix-left-last {
          box-shadow: 1px 0 0 ${isDarkMode ? '#303030' : '#e5e7eb'} !important;
        }
        .sar-group-structure-card .ant-table-tbody .compound-structure-view {
          width: 100% !important;
          margin: 0 !important;
          line-height: 0 !important;
        }
        .sar-group-structure-card .ant-table-tbody .compound-structure-frame {
          width: ${SAR_GROUP_STRUCTURE_WIDTH}px !important;
          height: ${SAR_GROUP_STRUCTURE_HEIGHT}px !important;
          border: 0 !important;
          outline: 0 !important;
          box-shadow: none !important;
          overflow: visible !important;
          line-height: 0 !important;
        }
        .sar-compound-card .compound-structure-frame {
          border: 0 !important;
          outline: 0 !important;
          box-shadow: none !important;
          overflow: visible !important;
        }
        .sar-compound-card .compound-structure-view {
          overflow: visible !important;
        }
        .sar-compound-structure-square-frame {
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: visible;
        }
        .sar-compound-rgroup-list {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 4px;
          width: 100%;
          min-height: 0;
          padding: 2px 4px 4px;
          overflow: visible;
          box-sizing: border-box;
        }
        .sar-compound-rgroup-item {
          position: relative;
          width: 100%;
          min-width: 0;
          height: 44px;
          padding: 12px 2px 2px;
          border: 1px solid ${token.colorBorderSecondary};
          border-radius: 4px;
          background: ${token.colorBgContainer};
          cursor: pointer;
          overflow: hidden;
        }
        .sar-compound-rgroup-item:disabled {
          cursor: default;
          opacity: 0.55;
        }
        .sar-compound-rgroup-label {
          position: absolute;
          top: 2px;
          left: 0;
          right: 0;
          color: ${token.colorTextSecondary};
          font-size: 9px;
          font-weight: 700;
          line-height: 10px;
          text-align: center;
        }
        .sar-compound-rgroup-svg,
        .sar-compound-rgroup-svg svg {
          display: block;
          width: 100%;
          height: 100%;
        }
        .sar-compound-data-tags {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 2px;
          z-index: 3;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 4px;
          height: 22px;
          width: 100%;
          min-width: 0;
          pointer-events: none;
        }
        .sar-compound-data-tag {
          height: 20px;
          min-width: 24px;
          padding: 0 7px;
          flex: 0 0 auto;
          pointer-events: auto;
          border: 1px solid ${token.colorBorderSecondary};
          border-radius: 999px;
          background: color-mix(in srgb, ${token.colorBgContainer} 92%, transparent);
          color: ${token.colorTextSecondary};
          font-size: 10px;
          font-weight: 700;
          line-height: 18px;
          white-space: nowrap;
          cursor: pointer;
          transition: color 0.16s ease, background-color 0.16s ease, border-color 0.16s ease;
        }
        .sar-compound-data-tag:hover {
          color: ${token.colorPrimary};
          border-color: ${token.colorPrimary};
          background: ${token.colorPrimaryBg};
        }
        .sar-compound-data-tag-kp {
          min-width: 28px;
        }
        .sar-compound-cluster-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: ${isDarkMode ? 'rgba(255, 255, 255, 0.04)' : 'rgba(15, 23, 42, 0.03)'};
        }
        .sar-workspace {
          display: flex;
          align-items: flex-start;
          gap: 0;
          width: 100%;
          min-width: 0;
        }
        .sar-workspace-main {
          flex: 1 1 auto;
          min-width: 0;
          transition: flex-basis 0.18s ease, width 0.18s ease;
        }
        .sar-quick-viewer-resizer {
          width: 14px;
          flex: 0 0 14px;
          align-self: stretch;
          min-height: calc(100vh - 132px);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: col-resize;
          outline: none;
        }
        .sar-quick-viewer-resizer-bar {
          width: 4px;
          height: 88px;
          border-radius: 999px;
          background: ${isResizingQuickViewer ? token.colorPrimary : token.colorBorder};
          transition: background-color 0.16s ease, height 0.16s ease;
        }
        .sar-quick-viewer-resizer:hover .sar-quick-viewer-resizer-bar,
        .sar-quick-viewer-resizer:focus-visible .sar-quick-viewer-resizer-bar {
          background: ${token.colorPrimary};
          height: 112px;
        }
        .sar-quick-viewer-pane {
          flex: 0 0 auto;
          min-width: ${SAR_QUICK_VIEWER_MIN_WIDTH}px;
          max-width: ${SAR_QUICK_VIEWER_MAX_WIDTH}px;
          height: calc(100vh - 132px);
          min-height: 520px;
          position: sticky;
          top: 0;
          overflow: hidden;
          box-sizing: border-box;
        }
        .sar-quick-viewer-pane .quick-viewer-panel {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          background: var(--card-bg);
          border: 1px solid var(--c-card-border);
          border-radius: 12px;
          box-shadow: none;
          overflow: hidden;
        }
        .sar-quick-viewer-pane .quick-viewer-header {
          height: 56px;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--c-card-border);
          box-sizing: border-box;
        }
        .sar-quick-viewer-pane .quick-viewer-title {
          display: block;
          color: ${token.colorText};
          font-size: 15px;
          font-weight: 800;
          line-height: 18px;
        }
        .sar-quick-viewer-pane .quick-viewer-subtitle {
          display: block;
          color: ${token.colorTextSecondary};
          font-size: 11px;
          line-height: 14px;
        }
        .sar-quick-viewer-pane .quick-viewer-tabs {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 6px;
          padding: 10px 14px;
          border-bottom: 1px solid var(--c-card-border);
          background: var(--bg-color);
        }
        .sar-quick-viewer-pane .quick-viewer-tab {
          height: 28px;
          border: 1px solid ${token.colorBorderSecondary};
          border-radius: 999px;
          background: ${token.colorBgContainer};
          color: ${token.colorTextSecondary};
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }
        .sar-quick-viewer-pane .quick-viewer-tab:disabled {
          opacity: 0.42;
          cursor: not-allowed;
        }
        .sar-quick-viewer-pane .quick-viewer-tab-active {
          border-color: #F87C63;
          background: #F87C63;
          color: #FFFFFF;
        }
        .sar-quick-viewer-pane .quick-viewer-body {
          min-height: 0;
          flex: 1;
          overflow: auto;
          padding: 10px;
          background: var(--card-bg);
        }
        .sar-quick-viewer-pane .quick-viewer-result-row {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 6px;
        }
        .sar-quick-viewer-pane .quick-viewer-result-select {
          width: min(100%, 260px);
        }
        .sar-quick-viewer-pane .quick-viewer-kinome-stage,
        .sar-quick-viewer-pane .quick-viewer-placeholder-stage,
        .sar-quick-viewer-pane .quick-viewer-molstar-stage {
          position: relative;
          width: 100%;
          min-height: 320px;
          border: 1px solid ${token.colorBorderSecondary};
          border-radius: 8px;
          background: #FFFFFF;
          overflow: hidden;
        }
        .sar-quick-viewer-pane .quick-viewer-molstar-stage {
          height: clamp(320px, 52vh, 560px);
          background: #05070A;
        }
        .sar-quick-viewer-pane .quick-viewer-molstar-canvas {
          position: absolute;
          inset: 0;
          display: block;
          width: 100%;
          height: 100%;
          outline: none;
        }
        .sar-quick-viewer-pane .quick-viewer-molstar-overlay {
          position: absolute;
          inset: 0;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: color-mix(in srgb, ${token.colorBgContainer} 76%, transparent);
        }
        .sar-quick-viewer-pane .quick-viewer-molstar-loading {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          color: ${token.colorTextSecondary};
          font-size: 12px;
          font-weight: 500;
        }
        .sar-quick-viewer-pane .quick-viewer-molstar-tooltip {
          position: absolute;
          z-index: 3;
          max-width: min(280px, calc(100% - 24px));
          padding: 7px 9px;
          border: 1px solid ${token.colorBorderSecondary};
          border-radius: 6px;
          background: color-mix(in srgb, ${token.colorBgContainer} 94%, transparent);
          box-shadow: 0 8px 22px rgba(15, 23, 42, 0.18);
          color: ${token.colorText};
          font-size: 11px;
          font-weight: 500;
          line-height: 1.35;
          white-space: pre-line;
          pointer-events: none;
        }
        .sar-quick-viewer-pane .quick-viewer-kinome-svg,
        .sar-quick-viewer-pane .quick-viewer-pdb-svg {
          display: block;
          width: 100%;
          height: auto;
        }
        .sar-quick-viewer-pane .quick-viewer-placeholder-stage {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sar-quick-viewer-pane .quick-viewer-zoom-button {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 28px;
          height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          border-color: ${token.colorBorderSecondary};
          background: ${token.colorBgContainer};
          color: ${token.colorTextSecondary};
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.14);
        }
        .sar-quick-viewer-pane .quick-viewer-zoom-button:hover {
          border-color: ${token.colorPrimary};
          color: ${token.colorPrimary};
        }
        .sar-quick-viewer-pane .quick-viewer-cta {
          margin-top: 10px;
          height: 34px;
          font-weight: 700;
        }
        .sar-quick-viewer-pane .quick-viewer-info-table {
          margin-top: 8px;
          border: 1px solid ${token.colorBorderSecondary};
          border-radius: 8px;
          overflow: hidden;
        }
        .sar-quick-viewer-pane .quick-viewer-info-row {
          min-height: 30px;
          padding: 7px 10px;
          display: grid;
          grid-template-columns: minmax(90px, 0.45fr) minmax(0, 1fr);
          gap: 8px;
          align-items: center;
          border-bottom: 1px solid ${token.colorBorderSecondary};
          font-size: 11px;
        }
        .sar-quick-viewer-pane .quick-viewer-info-row:last-child {
          border-bottom: 0;
        }
        .sar-quick-viewer-pane .quick-viewer-info-row span {
          color: ${token.colorTextSecondary};
        }
        .sar-quick-viewer-pane .quick-viewer-info-row strong {
          color: ${token.colorText};
          font-weight: 800;
          text-align: right;
          overflow-wrap: anywhere;
        }
        @media (max-width: 1100px) {
          .sar-workspace {
            display: block;
          }
          .sar-quick-viewer-resizer {
            display: none;
          }
          .sar-quick-viewer-pane {
            position: fixed;
            inset: 0;
            width: 100vw;
            height: 100vh;
            max-width: none;
            min-width: 0;
            min-height: 0;
            z-index: 1200;
            background: ${token.colorBgContainer};
          }
          .sar-quick-viewer-pane .quick-viewer-panel {
            border: 0;
            border-radius: 0;
          }
        }
        .ant-table-tbody > tr > td {
          padding: 10px 4px !important;
          text-align: center !important;
          font-size: var(--table-cell-font-size);
          border-color: ${isDarkMode ? '#303030' : '#f0f0f0'} !important;
        }
        .sar-table .ant-table-tbody > tr > td {
          height: 34px !important;
          padding: 0 4px !important;
          line-height: 16px !important;
          box-sizing: border-box;
        }
        .ant-table-bordered .ant-table-container {
          border-color: ${isDarkMode ? '#303030' : '#f0f0f0'} !important;
        }
        .ant-table-tbody > tr:hover > td {
          background-color: var(--table-row-hover-bg) !important;
          cursor: pointer;
        }
        .ant-table-tbody > tr.sar-row-selected:hover > td {
          background-color: var(--table-row-selected-hover-bg) !important;
        }
        .sar-table .ant-table-tbody > tr.sar-row-pinned > td {
          background-color: ${sarPinnedRowBg} !important;
          border-bottom: 1px solid color-mix(in srgb, ${sarPinnedRowColor} ${isDarkMode ? 36 : 24}%, transparent) !important;
        }
        .sar-table .ant-table-tbody > tr.sar-row-pinned.sar-row-hovered > td,
        .sar-table .ant-table-tbody > tr.sar-row-pinned.sar-row-selected > td,
        .sar-table .ant-table-tbody > tr.sar-row-pinned.sar-row-selected:hover > td,
        .sar-table .ant-table-tbody > tr.sar-row-pinned.sar-row-selected.sar-row-hovered > td {
          background-color: ${sarPinnedRowHoverBg} !important;
          border-bottom: 1px solid color-mix(in srgb, ${sarPinnedRowColor} ${isDarkMode ? 48 : 32}%, transparent) !important;
        }
        .sar-table .ant-table-tbody > tr.sar-row-pinned > td:first-child {
          box-shadow: inset 3px 0 0 ${sarPinnedRowColor};
        }
        .sar-table .ant-table-tbody > tr.sar-row-pinned > .ant-table-cell-fix-left,
        .sar-table .ant-table-tbody > tr.sar-row-pinned > .ant-table-cell-fix-left-last {
          background: ${sarPinnedRowBg} !important;
          background-clip: padding-box !important;
          box-shadow: inset 3px 0 0 ${sarPinnedRowColor};
        }
        .sar-table .ant-table-tbody > tr.sar-row-pinned.sar-row-hovered > .ant-table-cell-fix-left,
        .sar-table .ant-table-tbody > tr.sar-row-pinned.sar-row-hovered > .ant-table-cell-fix-left-last,
        .sar-table .ant-table-tbody > tr.sar-row-pinned.sar-row-selected > .ant-table-cell-fix-left,
        .sar-table .ant-table-tbody > tr.sar-row-pinned.sar-row-selected > .ant-table-cell-fix-left-last,
        .sar-table .ant-table-tbody > tr.sar-row-pinned.sar-row-selected:hover > .ant-table-cell-fix-left,
        .sar-table .ant-table-tbody > tr.sar-row-pinned.sar-row-selected:hover > .ant-table-cell-fix-left-last {
          background: ${sarPinnedRowHoverBg} !important;
          background-clip: padding-box !important;
          box-shadow: inset 3px 0 0 ${sarPinnedRowColor};
        }
        .sar-color-toggle {
          min-width: 46px;
          height: 26px;
          padding: 0 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          line-height: 24px;
          box-shadow: none;
          transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, box-shadow 0.16s ease;
        }
        .sar-color-toggle:not(.sar-color-toggle-active) {
          background: ${token.colorBgContainer};
          border-color: ${token.colorBorderSecondary};
          color: ${token.colorTextSecondary};
        }
        .sar-color-toggle-active,
        .sar-color-toggle-active:hover,
        .sar-color-toggle-active:focus-visible {
          background: ${token.colorPrimary} !important;
          border-color: ${token.colorPrimary} !important;
          color: ${token.colorBgContainer} !important;
          box-shadow: 0 0 0 2px ${isDarkMode ? 'rgba(248, 124, 99, 0.24)' : 'rgba(248, 124, 99, 0.18)'} !important;
        }
        .sar-color-toggle .ant-btn-icon {
          display: inline-flex;
          align-items: center;
        }
        .sar-table-card-color-active {
          border-color: ${isDarkMode ? 'rgba(248, 124, 99, 0.42)' : 'rgba(248, 124, 99, 0.36)'};
          box-shadow: inset 0 2px 0 ${token.colorPrimary};
        }
        .sar-compound-panel-title {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
        }
        .sar-compound-panel-title .ant-space-item {
          display: inline-flex;
          align-items: center;
        }
        .sar-compound-panel-title-icon {
          display: block;
          flex: 0 0 auto;
        }
        .sar-compound-panel-title-text {
          display: inline-flex;
          align-items: center;
          line-height: 20px;
        }
        .sar-rdkit-control-group {
          gap: 4px;
        }
        .sar-rdkit-control-label {
          min-width: auto;
          white-space: nowrap;
        }
        .sar-rdkit-control-group .ant-segmented {
          height: 22px;
          padding: 1px;
        }
        .sar-rdkit-control-group .ant-segmented-item {
          min-height: 20px;
        }
        .sar-rdkit-control-group .ant-segmented-item-label {
          min-height: 20px;
          line-height: 20px;
          padding-inline: 7px;
          font-size: 11px;
          white-space: nowrap;
        }
        .sar-rdkit-control-group .ant-btn {
          height: 22px;
          padding-inline: 8px;
          font-size: 11px;
          line-height: 20px;
        }
        .sar-compound-show-filter {
          position: relative;
          margin-left: 12px;
        }
        .sar-compound-show-filter::before {
          content: '';
          position: absolute;
          top: 50%;
          left: -11px;
          width: 1px;
          height: 18px;
          background: ${token.colorBorderSecondary};
          transform: translateY(-50%);
          pointer-events: none;
        }
        .sar-scaffold-color-trigger-wrap {
          display: inline-flex;
          align-items: center;
        }
        .sar-scaffold-color-trigger {
          margin-left: 0;
          width: 38px;
          padding-inline: 6px !important;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }
        .sar-scaffold-color-trigger-swatch {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          border: 1px solid ${token.colorBorderSecondary};
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.28);
        }
        .sar-scaffold-button {
          margin-left: 8px;
        }
        .sar-scaffold-button-active,
        .sar-scaffold-button-active:hover,
        .sar-scaffold-button-active:focus-visible {
          color: ${token.colorPrimary} !important;
          border-color: ${token.colorPrimary} !important;
          background: ${isDarkMode ? 'rgba(248, 124, 99, 0.16)' : 'rgba(248, 124, 99, 0.1)'} !important;
        }
        .sar-scaffold-color-panel {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
          width: 142px;
          padding: 2px;
        }
        .sar-scaffold-color-title {
          font-size: 11px;
          line-height: 14px;
        }
        .sar-scaffold-color-palette {
          display: grid;
          grid-template-columns: repeat(5, 20px);
          gap: 6px;
        }
        .sar-scaffold-color-swatch {
          width: 20px;
          height: 20px;
          padding: 0;
          border: 1px solid ${token.colorBorderSecondary};
          border-radius: 4px;
          cursor: pointer;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.24);
        }
        .sar-scaffold-color-swatch:hover,
        .sar-scaffold-color-swatch:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px ${isDarkMode ? 'rgba(248, 124, 99, 0.26)' : 'rgba(248, 124, 99, 0.22)'};
        }
        .sar-scaffold-color-swatch-selected {
          border-color: ${token.colorPrimary};
          box-shadow: 0 0 0 2px ${token.colorPrimary};
        }
        .sar-compound-setting-stack {
          display: inline-flex;
          flex-direction: row;
          gap: 10px;
          flex-wrap: wrap;
          align-items: stretch;
        }
        .sar-compound-highlight-toggle {
          margin-left: 2px;
        }
        .sar-compound-highlight-toggle .ant-segmented-item-label {
          min-height: 22px;
          line-height: 22px;
          padding-inline: 8px;
          font-size: 11px;
        }
        .sar-compound-setting-row {
          display: grid;
          grid-template-columns: 24px 42px 24px;
          align-items: center;
          gap: 4px;
        }
        .sar-compound-setting-group {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 28px;
          padding: 3px 6px;
          border: 1px solid ${token.colorBorderSecondary};
          border-radius: 6px;
          background: ${isDarkMode ? 'rgba(255, 255, 255, 0.03)' : token.colorBgLayout};
          box-sizing: border-box;
        }
        .sar-compound-setting-label {
          min-width: 42px;
          color: ${token.colorTextSecondary};
          font-size: 10px;
          font-weight: 600;
          line-height: 18px;
          text-align: left;
          user-select: none;
        }
        .sar-compound-setting-row .ant-btn {
          width: 24px;
          height: 20px;
          min-width: 24px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 2px;
        }
        .sar-compound-setting-icon {
          display: block;
          width: 18px;
          height: 13px;
          filter: ${isDarkMode ? 'invert(1)' : 'none'};
          pointer-events: none;
        }
        .sar-compound-setting-row .ant-btn[disabled] .sar-compound-setting-icon {
          opacity: 0.35;
        }
        .sar-compound-setting-value {
          height: 20px;
          min-width: 42px;
          padding: 0 4px;
          border: 1px solid ${token.colorBorderSecondary};
          border-radius: 2px;
          background: ${token.colorBgContainer};
          color: ${token.colorText};
          font-size: 10px;
          line-height: 18px;
          text-align: center;
          box-sizing: border-box;
          user-select: none;
        }
        .sar-compound-card {
          position: relative;
          border-color: transparent !important;
          box-shadow: none !important;
        }
        .sar-compound-card::after {
          content: '';
          position: absolute;
          inset: 1px;
          z-index: 40;
          pointer-events: none;
          border: 1px solid transparent;
          border-radius: inherit;
          box-sizing: border-box;
        }
        .sar-compound-card:hover {
          border-color: transparent !important;
          background-color: ${isCompoundCardOverlapped ? 'transparent' : isDarkMode ? '#1a1a1a' : '#f9f9f9'} !important;
          transform: none;
        }
        .sar-compound-card.selected {
          border-color: transparent !important;
          box-shadow: none !important;
        }
        .sar-compound-card.selected:hover {
          background-color: ${isCompoundCardOverlapped ? 'transparent' : isDarkMode ? 'rgba(248, 124, 99, 0.16)' : 'rgba(248, 124, 99, 0.12)'} !important;
        }
        .sar-compound-card.hovered {
          border-color: transparent !important;
          background-color: ${isCompoundCardOverlapped ? 'transparent' : isDarkMode ? 'rgba(248, 124, 99, 0.12)' : 'rgba(248, 124, 99, 0.08)'} !important;
          transform: none;
        }
        .sar-compound-card.pinned {
          box-shadow: none !important;
        }
        .sar-compound-card.pinned.selected,
        .sar-compound-card.pinned.hovered {
          background-color: ${isCompoundCardOverlapped ? 'transparent' : sarPinnedSelectedCardBg} !important;
        }
        .sar-compound-card.pinned.selected:hover,
        .sar-compound-card.pinned.hovered:hover {
          background-color: ${isCompoundCardOverlapped ? 'transparent' : sarPinnedSelectedCardHoverBg} !important;
        }
        .sar-compound-card.pinned::after {
          inset: ${isCompoundCardOverlapped ? '1px' : '0'};
        }
        .sar-compound-card.pinned .sar-compound-card-name {
          position: relative;
          z-index: 25;
        }
        .sar-compound-card:hover::after,
        .sar-compound-card.selected::after,
        .sar-compound-card.hovered::after {
          border-color: ${token.colorPrimary};
        }
        .sar-compound-card.pinned.selected::after,
        .sar-compound-card.pinned.hovered::after,
        .sar-compound-card.pinned.selected:hover::after,
        .sar-compound-card.pinned.hovered:hover::after {
          border-color: ${sarPinnedRowColor};
        }
        .sar-compound-pin-badge {
          position: absolute;
          top: 6px;
          left: 6px;
          z-index: 60;
          width: 20px;
          height: 20px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: ${token.colorBgContainer};
          background: ${sarPinnedRowColor};
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.16);
          pointer-events: none;
        }
        .sar-compound-card-list:focus,
        .sar-compound-card-list:focus-visible,
        .sar-compound-card:focus,
        .sar-compound-card:focus-visible {
          outline: none !important;
          box-shadow: none;
        }
        .sar-page,
        .sar-compound-card-list,
        .sar-table-card .ant-table-body,
        .sar-table-card .ant-table-content {
          scrollbar-width: thin;
          scrollbar-color: ${sarScrollbarThumb} ${sarScrollbarTrack};
        }
        .sar-page::-webkit-scrollbar,
        .sar-compound-card-list::-webkit-scrollbar,
        .sar-table-card .ant-table-body::-webkit-scrollbar,
        .sar-table-card .ant-table-content::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .sar-page::-webkit-scrollbar-track,
        .sar-compound-card-list::-webkit-scrollbar-track,
        .sar-table-card .ant-table-body::-webkit-scrollbar-track,
        .sar-table-card .ant-table-content::-webkit-scrollbar-track {
          background: ${sarScrollbarTrack};
        }
        .sar-page::-webkit-scrollbar-thumb,
        .sar-compound-card-list::-webkit-scrollbar-thumb,
        .sar-table-card .ant-table-body::-webkit-scrollbar-thumb,
        .sar-table-card .ant-table-content::-webkit-scrollbar-thumb {
          background-color: ${sarScrollbarThumb};
          border: 3px solid transparent;
          border-radius: 999px;
          background-clip: content-box;
        }
        .sar-page::-webkit-scrollbar-thumb:hover,
        .sar-compound-card-list::-webkit-scrollbar-thumb:hover,
        .sar-table-card .ant-table-body::-webkit-scrollbar-thumb:hover,
        .sar-table-card .ant-table-content::-webkit-scrollbar-thumb:hover {
          background-color: ${sarScrollbarThumbHover};
        }
        .sar-table-card .ant-table-body {
          height: ${sarTableBodyHeight}px;
          padding-bottom: 18px;
          box-sizing: border-box;
          scrollbar-gutter: stable;
        }
      `}</style>
    </div>
  );
};

export default SarTable;
