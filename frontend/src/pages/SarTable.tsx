import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Row, Col, Card, Table, Button, Input,
  Space, Modal, Form, Tag, Select, DatePicker, Avatar, Divider, Segmented, Tooltip, theme
} from 'antd';
import {
  Search, ChevronDown, ChevronUp,
  Settings, Download, Info, GripVertical, CheckCircle2, XCircle, ArrowLeft,
  PanelLeftClose, PanelLeftOpen, Minus, Plus, RotateCcw, RotateCw, Pin
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { mockCompounds } from '../mocks/compounds';
import { useBoardStore } from '../store/useBoardStore';
import { DEFAULT_GROUP_STRUCTURE_VIEW_SETTINGS, type SarHighlightMode } from '../store/useBoardStore';
import { getPatentAnalysisLayoutPreset } from '../config/patentAnalysisLayout';
import dayjs from 'dayjs';
import { useUIStore } from '../store/useUIStore';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import BenzeneIcon from '../components/common/BenzeneIcon';
import ChemDrawModal from '../components/common/ChemDrawModal';
import ToggleTag from '../components/common/ToggleTag';
import CompoundStructureView from '../components/common/CompoundStructureView';
import arrowDivideIcon from '../assets/svg/arrow-divide.svg';
import arrowMergeIcon from '../assets/svg/arrow-merge.svg';

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
const SAR_COMPOUND_CARD_ROTATION_STEP = 30;
const SAR_COMPOUND_CARD_OVERLAP_MIN = 0;
const SAR_COMPOUND_CARD_OVERLAP_MAX = 50;
const SAR_GROUP_STRUCTURE_WIDTH = 130;
const SAR_GROUP_STRUCTURE_HEIGHT = 97.5;
const SAR_GROUP_STRUCTURE_PANEL_WIDTH = 146;
const SAR_GROUP_STRUCTURE_COLUMN_WIDTH = 138;

const SarTable: React.FC = () => {
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const { isDarkMode } = useTheme();
  const {
    selectedGroupIds,
    selectedSarCompoundIds,
    hiddenCompoundIds,
    groups,
    groupStructureViewSettings,
    toggleGroupSelection,
    setSelectedGroupIds,
    setSelectedSarCompoundIds,
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
  const [structureRenderVersion, setStructureRenderVersion] = useState(0);
  const firstCompoundByGroupId = useMemo(() => {
    return mockCompounds
      .filter((compound) => !hiddenCompoundIds.includes(compound.id))
      .reduce<Record<string, typeof mockCompounds[number]>>((acc, compound) => {
      if (!acc[compound.groupId]) {
        acc[compound.groupId] = compound;
      }
      return acc;
    }, {});
  }, [hiddenCompoundIds, structureRenderVersion]);
  const handleCompoundStructureGenerated = React.useCallback((
    compoundId: string,
    data: { molBlock: string; svg: string; cacheKey: string }
  ) => {
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
      ? mockCompounds.filter((compound) => selectedGroupIds.includes(compound.groupId))
      : selectedSarCompoundIds.length > 0
        ? mockCompounds.filter((compound) => selectedSarCompoundIds.includes(compound.id))
        : [];
    base = base.filter((compound) => !hiddenCompoundIds.includes(compound.id));
    
    if (keyword) {
      base = base.filter(c => 
        c.id.toLowerCase().includes(keyword.toLowerCase()) ||
        c.name.toLowerCase().includes(keyword.toLowerCase()) ||
        c.smiles?.toLowerCase().includes(keyword.toLowerCase())
      );
    }
    return base;
  }, [hiddenCompoundIds, selectedGroupIds, selectedSarCompoundIds, keyword, structureRenderVersion]);

  const [isColorActive, setIsColorActive] = useState(false);
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [selectedCompoundIds, setSelectedCompoundIds] = useState<string[]>([]);
  const [hoveredRowKey, setHoveredRowKey] = useState<string | null>(null);
  const [pinnedCompoundIds, setPinnedCompoundIds] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isStructureModalOpen, setIsStructureModalOpen] = useState(false);
  const [searchedSvg, setSearchedSvg] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<number>(1);
  const [compoundCardViewMode, setCompoundCardViewMode] = useState<'single' | 'twoRows'>('single');
  const [hasUserClearedSelection, setHasUserClearedSelection] = useState(false);
  const [isCompoundStructureCollapsed, setIsCompoundStructureCollapsed] = useState(false);
  const [isGroupStructureCollapsed, setIsGroupStructureCollapsed] = useState(false);
  const [viewportWidth, setViewportWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 1920;
    return window.innerWidth;
  });
  const layoutPreset = useMemo(() => getPatentAnalysisLayoutPreset(viewportWidth), [viewportWidth]);
  const isResponsiveToolbar = viewportWidth <= 1100;
  const pinnedCompoundIdSet = useMemo(() => new Set(pinnedCompoundIds), [pinnedCompoundIds]);
  const displaySarCompounds = useMemo(() => {
    return [...sarCompounds].sort((a, b) => {
      const aPinned = pinnedCompoundIdSet.has(a.id);
      const bPinned = pinnedCompoundIdSet.has(b.id);
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      return sarCompounds.indexOf(a) - sarCompounds.indexOf(b);
    });
  }, [pinnedCompoundIdSet, sarCompounds]);
  const pinnedCompoundOrderMap = useMemo(() => (
    displaySarCompounds.reduce<Record<string, number>>((acc, compound) => {
      if (pinnedCompoundIdSet.has(compound.id)) {
        acc[compound.id] = Object.keys(acc).length;
      }
      return acc;
    }, {})
  ), [displaySarCompounds, pinnedCompoundIdSet]);
  const sarCompoundIdSignature = useMemo(
    () => sarCompounds.map((compound) => compound.id).join('|'),
    [sarCompounds]
  );
  const activeStructureSettingsGroupId = selectedGroupIds.length === 1 ? selectedGroupIds[0] : null;
  const activeStructureSettings = activeStructureSettingsGroupId
    ? {
        ...DEFAULT_GROUP_STRUCTURE_VIEW_SETTINGS,
        ...groupStructureViewSettings[activeStructureSettingsGroupId],
      }
    : null;
  const isStructureSettingsDisabled = !activeStructureSettingsGroupId;
  const updateActiveStructureSettings = (settings: Partial<typeof DEFAULT_GROUP_STRUCTURE_VIEW_SETTINGS>) => {
    if (!activeStructureSettingsGroupId) return;
    updateGroupStructureViewSettings(activeStructureSettingsGroupId, settings);
  };
  const getGroupStructureSettings = React.useCallback((groupId: string) => ({
    ...DEFAULT_GROUP_STRUCTURE_VIEW_SETTINGS,
    ...groupStructureViewSettings[groupId],
  }), [groupStructureViewSettings]);

  useEffect(() => {
    setHasUserClearedSelection(false);
  }, [sarCompoundIdSignature]);

  useEffect(() => {
    if (sarCompounds.length === 0) {
      setSelectedRowKey(null);
      setSelectedCompoundIds([]);
      return;
    }

    const hasSelectedRow = displaySarCompounds.some((compound) => compound.id === selectedRowKey);
    if (!hasSelectedRow && !hasUserClearedSelection) {
      setSelectedRowKey(displaySarCompounds[0].id);
      setSelectedCompoundIds([displaySarCompounds[0].id]);
    }
  }, [displaySarCompounds, hasUserClearedSelection, sarCompounds.length, selectedRowKey]);

  const handleCompoundSelection = React.useCallback((compoundId: string, event?: React.MouseEvent) => {
    if (!event?.ctrlKey && !event?.metaKey) {
      setSelectedCompoundIds([compoundId]);
      setSelectedRowKey(compoundId);
      setHasUserClearedSelection(false);
      return;
    }

    setSelectedCompoundIds((current) => {
      const next = current.includes(compoundId)
        ? current.filter((id) => id !== compoundId)
        : [...current, compoundId];

      setSelectedRowKey(next.includes(compoundId) ? compoundId : next[next.length - 1] ?? null);
      setHasUserClearedSelection(next.length === 0);
      return next;
    });
  }, []);

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
      setHasUserClearedSelection(false);
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
  const defaultOrder = ['Compound', 'Enzyme', 'Cell', 'MS', 'PPB', 'CYP', 'hERG', 'PK'];
  const defaultActive = ['Compound', 'Enzyme', 'Cell', 'MS', 'PPB', 'CYP', 'hERG', 'PK'];
  const defaultSubConfig = {
    'Enzyme': [
      { key: 'wt', title: 'WT', visible: true },
      { key: 'd1228n', title: 'D1228N', visible: true },
      { key: 'f1250k', title: 'F1250K', visible: true },
      { key: 'wtf1250k', title: 'WT/F1250K', visible: true }
    ],
    'Cell': [
      { key: 'naive', title: 'Ba/F3 Naive', visible: true },
      { key: 'fgfr3', title: 'Ba/F3 FGFR3', visible: true },
      { key: 'v555m', title: 'FGFR3 V555M', visible: true },
      { key: 'rt112', title: 'RT-112', visible: true },
      { key: 'mkn45', title: 'MKN45', visible: true }
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
      { key: '3a4', title: '3A4', visible: true }
    ],
    'PK': [
      { key: 'dose', title: 'Dose', visible: true },
      { key: 'plasma', title: 'Plasma (1h, 4h)', visible: true },
      { key: 'lung', title: 'Lung (1h, 4h)', visible: true },
      { key: 'brain', title: 'Brain (1h, 4h)', visible: true }
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

  const handleGroupStructureSelection = (groupId: string, event: React.MouseEvent) => {
    const nextSelectedGroupIds = event.ctrlKey || event.metaKey
      ? selectedGroupIds.includes(groupId)
        ? selectedGroupIds.filter((id) => id !== groupId)
        : [...selectedGroupIds, groupId]
      : [groupId];

    if (event.ctrlKey || event.metaKey) {
      toggleGroupSelection(groupId);
    } else {
      setSelectedGroupIds([groupId]);
    }
    setSelectedSarCompoundIds(
      nextSelectedGroupIds.length > 0
        ? mockCompounds
          .filter((compound) => nextSelectedGroupIds.includes(compound.groupId))
          .map((compound) => compound.id)
        : []
    );
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
    const structureSettings = getGroupStructureSettings(record.id);

    return (
      <div
        className="sar-group-representative-structure"
        style={{
          margin: '0 auto',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: SAR_GROUP_STRUCTURE_WIDTH,
          minHeight: SAR_GROUP_STRUCTURE_HEIGHT,
          lineHeight: 0,
        }}
      >
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
          showPreviewAction={false}
          showCopyAction={false}
          preferRdkitSvg
          rdkitAngleDeg={structureSettings.sarRotationDeg}
          rdkitScalePercent={structureSettings.sarImageScalePercent}
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
    'Compound', 'Enzyme', 'Cell', 'MS', 'PPB', 'CYP', 'hERG', 'PK'
  ]);
  const [activeColumns, setActiveColumns] = useState<string[]>([
    'Compound', 'Enzyme', 'Cell', 'MS', 'PPB', 'CYP', 'hERG', 'PK'
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
    'Enzyme': [
      { key: 'wt', title: 'WT', visible: true },
      { key: 'd1228n', title: 'D1228N', visible: true },
      { key: 'f1250k', title: 'F1250K', visible: true },
      { key: 'wtf1250k', title: 'WT/F1250K', visible: true }
    ],
    'Cell': [
      { key: 'naive', title: 'Ba/F3 Naive', visible: true },
      { key: 'fgfr3', title: 'Ba/F3 FGFR3', visible: true },
      { key: 'v555m', title: 'FGFR3 V555M', visible: true },
      { key: 'rt112', title: 'RT-112', visible: true },
      { key: 'mkn45', title: 'MKN45', visible: true }
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
      { key: '3a4', title: '3A4', visible: true }
    ],
    'PK': [
      { key: 'dose', title: 'Dose', visible: true },
      { key: 'plasma', title: 'Plasma (1h, 4h)', visible: true },
      { key: 'lung', title: 'Lung (1h, 4h)', visible: true },
      { key: 'brain', title: 'Brain (1h, 4h)', visible: true }
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
  const renderValue = (val: number | undefined, group: string) => {
    if (val === undefined) return '-';

    let bgColor = 'transparent';
    let textColor = 'inherit';

    if (isColorActive) {
      if (val < 0.1) { bgColor = isDarkMode ? '#065f46' : '#10b981'; textColor = isDarkMode ? '#6ee7b7' : token.colorBgContainer; }
      else if (val < 0.5) { bgColor = isDarkMode ? '#064e3b' : '#d1fae5'; textColor = isDarkMode ? '#a7f3d0' : '#065f46'; }
      else if (val < 1.0) { bgColor = isDarkMode ? '#78350f' : '#fef3c7'; textColor = isDarkMode ? '#fde68a' : '#92400e'; }
      else if (val < 10) { bgColor = isDarkMode ? '#713f12' : '#fffbeb'; textColor = isDarkMode ? '#fcd34d' : '#92400e'; }
      else if (val >= 10) { bgColor = isDarkMode ? '#7f1d1d' : '#fee2e2'; textColor = isDarkMode ? '#fca5a5' : '#991b1b'; }
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
        fontWeight: isColorActive && val < 0.5 ? 600 : 400
      }}>
        {val}
      </div>
    );
  };

  const allColumnsMap: Record<string, any> = {
    'Compound': {
      title: 'Compound',
      dataIndex: 'compoundId',
      key: 'compoundId',
      fixed: 'left' as const,
      width: 120,
      render: (text: string) => <Text strong style={{ color: token.colorPrimary }}>{text}</Text>
    },
    'Enzyme': {
      title: 'Enzyme IC50 (µM)',
      children: [
        { title: 'WT', dataIndex: ['sar', 'enzyme', 'wt'], key: 'wt', width: 70, render: (v: any) => renderValue(v, 'e') },
        { title: 'D1228N', dataIndex: ['sar', 'enzyme', 'd1228n'], key: 'd1228n', width: 80, render: (v: any) => renderValue(v, 'e') },
        { title: 'F1250K', dataIndex: ['sar', 'enzyme', 'f1250k'], key: 'f1250k', width: 80, render: (v: any) => renderValue(v, 'e') },
        { title: 'WT/F1250K', dataIndex: ['sar', 'enzyme', 'wt_f1250k'], key: 'wtf1250k', width: 100, render: (v: any) => renderValue(v, 'e') },
      ]
    },
    'Cell': {
      title: 'Cell GI50 (µM)',
      children: [
        { title: 'Ba/F3 Naive', dataIndex: ['sar', 'cell', 'naive'], key: 'naive', width: 90, render: (v: any) => renderValue(v, 'c') },
        { title: 'Ba/F3 FGFR3', dataIndex: ['sar', 'cell', 'fgfr3'], key: 'fgfr3', width: 90, render: (v: any) => renderValue(v, 'c') },
        { title: 'FGFR3 V555M', dataIndex: ['sar', 'cell', 'fgfr3_v555m'], key: 'v555m', width: 100, render: (v: any) => renderValue(v, 'c') },
        { title: 'RT-112', dataIndex: ['sar', 'cell', 'rt112'], key: 'rt112', width: 80, render: (v: any) => renderValue(v, 'c') },
        { title: 'MKN45', dataIndex: ['sar', 'cell', 'mkn45'], key: 'mkn45', width: 80, render: (v: any) => renderValue(v, 'c') },
      ]
    },
    'MS': {
      title: 'MS (rem.%)',
      children: [
        { title: 'H', dataIndex: ['sar', 'ms', 'h'], key: 'ms_h', width: 60, render: (v: any) => renderValue(v, 'm') },
        { title: 'Target', dataIndex: 'target', key: 'target', width: 80, render: (text: string) => <Tag color="blue" style={{ fontSize: 10 }}>{text}</Tag> },
        { title: 'M', dataIndex: ['sar', 'ms', 'm'], key: 'ms_m', width: 60, render: (v: any) => renderValue(v, 'm') },
      ]
    },
    'PPB': {
      title: 'PPB (bound %)',
      children: [
        { title: 'H', dataIndex: ['sar', 'ppb', 'h'], key: 'ppb_h', width: 60, render: (v: any) => renderValue(v, 'p') },
        { title: 'M', dataIndex: ['sar', 'ppb', 'm'], key: 'ppb_m', width: 60, render: (v: any) => renderValue(v, 'p') },
      ]
    },
    'CYP': {
      title: 'CYP inhibition (10µM, % of control)',
      children: [
        { title: '1A2', dataIndex: ['sar', 'cyp', '1a2'], key: '1a2', width: 60 },
        { title: '2C9', dataIndex: ['sar', 'cyp', '2c9'], key: '2c9', width: 60 },
        { title: '2C19', dataIndex: ['sar', 'cyp', '2c19'], key: '2c19', width: 60 },
        { title: '2D6', dataIndex: ['sar', 'cyp', '2d6'], key: '2d6', width: 60 },
        { title: '3A4', dataIndex: ['sar', 'cyp', '3a4'], key: '3a4', width: 60 },
      ]
    },
    'hERG': { title: 'hERG (IC50, µM)', dataIndex: ['sar', 'herg'], key: 'herg', width: 80 },
    'PK': {
      title: 'PK (ng/mL)',
      children: [
        { title: 'Dose', dataIndex: ['sar', 'pk', 'dose'], key: 'dose', width: 60 },
        {
          title: 'Plasma',
          key: 'plasma',
          children: [
            { title: '1h', dataIndex: ['sar', 'pk', 'plasma_1h'], key: 'p1h', width: 70 },
            { title: '4h', dataIndex: ['sar', 'pk', 'plasma_4h'], key: 'p4h', width: 70 },
          ]
        },
        {
          title: 'Lung',
          key: 'lung',
          children: [
            { title: '1h', dataIndex: ['sar', 'pk', 'lung_1h'], key: 'l1h', width: 70 },
            { title: '4h', dataIndex: ['sar', 'pk', 'lung_4h'], key: 'l4h', width: 70 },
          ]
        },
        {
          title: 'Brain',
          key: 'brain',
          children: [
            { title: '1h', dataIndex: ['sar', 'pk', 'brain_1h'], key: 'b1h', width: 70 },
            { title: '4h', dataIndex: ['sar', 'pk', 'brain_4h'], key: 'b4h', width: 70 },
          ]
        }
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
  const compoundCardWidth = compoundCardViewMode === 'twoRows'
    ? Math.round(SAR_COMPOUND_CARD_BASE_WIDTH * compoundCardImageScale)
    : Math.round(SAR_COMPOUND_CARD_EXPANDED_WIDTH * compoundCardImageScale);
  const compoundCardStructureHeight = compoundCardViewMode === 'twoRows'
    ? Math.round(SAR_COMPOUND_CARD_BASE_STRUCTURE_HEIGHT * compoundCardImageScale)
    : Math.round(SAR_COMPOUND_CARD_EXPANDED_STRUCTURE_HEIGHT * compoundCardImageScale);
  const compoundCardStructureFrameSize = Math.max(compoundCardWidth, compoundCardStructureHeight);
  const compoundCardPinnedStep = compoundCardViewMode === 'twoRows'
    ? compoundCardWidth + SAR_COMPOUND_CARD_GRID_COLUMN_GAP
    : compoundCardWidth - (compoundCardWidth * compoundCardOverlapPercent / 100) + (compoundCardOverlapPercent > 0 ? 0 : SAR_COMPOUND_CARD_GAP);
  const sarScrollbarThumb = isDarkMode ? '#4b5563' : '#c4cbd3';
  const sarScrollbarThumbHover = isDarkMode ? '#6b7280' : '#9aa3aa';
  const sarScrollbarTrack = isDarkMode ? '#1f1f1f' : '#f8f9fa';

  return (
    <div
      className="gx-main-content sar-page"
      style={{
        maxWidth: layoutPreset.maxWidth,
        margin: '0 auto',
        padding: `0 ${layoutPreset.sidePadding}px 24px`,
        width: '100%',
        height: '100%',
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        boxSizing: 'border-box'
      }}
    >
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
            dataSource={groups}
            columns={groupStructureColumns}
            rowKey="id"
            size="small"
            pagination={false}
            scroll={undefined}
            tableLayout="fixed"
            onRow={(record) => ({
              onClick: (event) => handleGroupStructureSelection(record.id, event),
              style: { cursor: 'pointer' },
            })}
            rowClassName={(record) => selectedGroupIds.includes(record.id) ? 'row-selected sar-group-row-selected' : ''}
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
              <Space size={8}>
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
                <BenzeneIcon size={16} color={token.colorPrimary} />
                <Text strong>화합물</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>{sarCompounds.length} compounds</Text>
                <Segmented
                  className="sar-compound-highlight-toggle"
                  size="small"
                  value={activeStructureSettings?.sarHighlightMode}
                  disabled={isStructureSettingsDisabled}
                  onChange={(value) => updateActiveStructureSettings({ sarHighlightMode: value as SarHighlightMode })}
                  options={[
                    { label: <Tooltip title="동일 골격에 하이라이팅 표시">Com</Tooltip>, value: 'com' },
                    { label: <Tooltip title="차이나는 부분만 하이라이팅 표시">Diff</Tooltip>, value: 'diff' },
                    { label: <Tooltip title="끄기">Off</Tooltip>, value: 'off' },
                  ]}
                />
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
                  const pinnedOrder = pinnedCompoundOrderMap[item.id] ?? 0;

                  return (
                    <div
                      id={`sar-compound-card-${item.id}`}
                      key={item.id}
                      onClick={(event) => handleCompoundSelection(item.id, event)}
                      role="option"
                      aria-selected={selectedCompoundIds.includes(item.id)}
                      aria-label={`${item.name}${isPinnedCompound ? ', pin fixed' : ''}`}
                      className={`v-item-card sar-compound-card ${selectedCompoundIds.includes(item.id) ? 'selected' : ''} ${hoveredRowKey === item.id ? 'hovered' : ''} ${isPinnedCompound ? 'pinned' : ''}`}
                      onMouseEnter={() => setHoveredRowKey(item.id)}
                      onMouseLeave={() => setHoveredRowKey(null)}
                      style={{
                        width: compoundCardWidth,
                        padding: 0,
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: isPinnedCompound
                          ? token.colorBgContainer
                          : isCompoundCardOverlapped
                            ? 'transparent'
                            : selectedCompoundIds.includes(item.id) || hoveredRowKey === item.id
                            ? (isDarkMode ? 'rgba(248, 124, 99, 0.12)' : 'rgba(248, 124, 99, 0.08)')
                            : token.colorBgContainer,
                        boxSizing: 'border-box',
                        borderColor: 'transparent',
                        position: isPinnedCompound ? 'sticky' : 'relative',
                        left: isPinnedCompound ? pinnedOrder * compoundCardPinnedStep : undefined,
                        marginRight: compoundCardViewMode === 'single' && index < displaySarCompounds.length - 1
                          ? -(compoundCardWidth * compoundCardOverlapPercent / 100)
                          : 0,
                        zIndex: isPinnedCompound
                          ? displaySarCompounds.length + 20 - pinnedOrder
                          : selectedCompoundIds.includes(item.id) || hoveredRowKey === item.id
                            ? displaySarCompounds.length + 1
                            : index + 1,
                      }}
                    >
                      <div style={{
                        height: compoundCardStructureFrameSize,
                        background: isPinnedCompound || !isCompoundCardOverlapped ? token.colorBgContainer : 'transparent',
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
                          <CompoundStructureView
                            svg={item.structureSvg}
                            rdkitSvg={(item as any).rdkitSvg}
                            rdkitSvgCache={(item as any).rdkitSvgCache}
                            title={item.name}
                            smiles={item.smiles}
                            molBlock={(item as any).molBlock ?? (item as any).mol_block ?? (item as any).molblock}
                            width={compoundCardStructureFrameSize}
                            height={compoundCardStructureFrameSize}
                            iconSize={48}
                            className="sar-compound-structure-view"
                            svgClassName="sar-structure-svg"
                            structureFitMode="contain"
                            showPreviewAction={false}
                            showCopyAction={false}
                            preferRdkitSvg
                            rdkitAngleDeg={itemStructureSettings.sarRotationDeg}
                            rdkitScalePercent={itemStructureSettings.sarImageScalePercent}
                            rdkitMinSize={[compoundCardStructureFrameSize, compoundCardStructureFrameSize]}
                            onStructureGenerated={(data) => handleCompoundStructureGenerated(item.id, data)}
                            structureStyle={{ transformOrigin: 'center center' }}
                            frameStyle={{ border: 0, background: isPinnedCompound || !isCompoundCardOverlapped ? token.colorBgContainer : 'transparent', boxShadow: 'none', overflow: 'visible' }}
                          />
                        </div>
                      </div>
                      <Text strong className="sar-compound-card-name" style={{ fontSize: 11, lineHeight: '16px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingBottom: 4, boxSizing: 'border-box' }} title={item.name}>
                        {item.name}
                      </Text>
                    </div>
                  );
                })}
              </div>
              </div>
            )}
          </div>

          {/* Main SAR Table (Multi-level Header) */}
          <div className={`v-table-card sar-table-card ${isColorActive ? 'sar-table-card-color-active' : ''}`}>
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
              dataSource={displaySarCompounds}
              columns={dynamicColumns}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: 1800, y: displaySarCompounds.length > 10 ? 500 : undefined }}
              onRow={(record) => ({
                id: `sar-table-row-${record.id}`,
                onClick: (event) => handleCompoundSelection(record.id, event),
                onMouseEnter: () => setHoveredRowKey(record.id),
                onMouseLeave: () => setHoveredRowKey(null)
              })}
              rowClassName={(record) => {
                let classes = [];
                if (pinnedCompoundIdSet.has(record.id)) classes.push('sar-row-pinned');
                if (selectedCompoundIds.includes(record.id)) classes.push('sar-row-selected');
                if (record.id === hoveredRowKey) classes.push('sar-row-hovered');
                return classes.join(' ');
              }}
            />
          </div>
        </div>
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

      <style>{`
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
          overflow: visible;
        }
        .sar-group-structure-card .ant-table-wrapper {
          margin: 0;
        }
        .sar-board-content {
          flex: 1 1 auto;
          min-width: 0;
          width: 100%;
          max-width: 100%;
          padding-right: 12px;
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
          background-color: var(--table-row-hover-bg) !important;
        }
        .sar-row-pinned.sar-row-hovered td,
        .sar-row-pinned.sar-row-selected td,
        .sar-row-pinned.sar-row-selected.sar-row-hovered td {
          background-color: var(--table-row-hover-bg) !important;
        }
        .sar-row-pinned > td:first-child {
          box-shadow: inset 3px 0 0 ${token.colorPrimary};
        }
        .sar-table .ant-table-thead > tr > th,
        .sar-table .ant-table-thead > tr > td {
          border-bottom: 0 !important;
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
        .sar-table .ant-table-tbody > tr.sar-row-pinned > .ant-table-cell-fix-left-last,
        .sar-table .ant-table-tbody > tr.sar-row-pinned.sar-row-hovered > .ant-table-cell-fix-left,
        .sar-table .ant-table-tbody > tr.sar-row-pinned.sar-row-hovered > .ant-table-cell-fix-left-last,
        .sar-table .ant-table-tbody > tr.sar-row-pinned.sar-row-selected > .ant-table-cell-fix-left,
        .sar-table .ant-table-tbody > tr.sar-row-pinned.sar-row-selected > .ant-table-cell-fix-left-last {
          background: color-mix(in srgb, ${token.colorPrimary} ${isDarkMode ? 18 : 12}%, ${token.colorBgContainer}) !important;
          background-clip: padding-box !important;
          box-shadow: inset 3px 0 0 ${token.colorPrimary};
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
          width: 16px;
          height: 16px;
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
          background-color: ${token.colorBgContainer} !important;
          box-shadow: ${isDarkMode ? '8px 0 14px rgba(0, 0, 0, 0.34)' : '8px 0 14px rgba(15, 23, 42, 0.12)'} !important;
        }
        .sar-compound-card.pinned::before {
          content: '';
          position: absolute;
          top: 0;
          right: -${Math.max(SAR_COMPOUND_CARD_GAP, SAR_COMPOUND_CARD_GRID_COLUMN_GAP)}px;
          bottom: 0;
          width: ${Math.max(SAR_COMPOUND_CARD_GAP, SAR_COMPOUND_CARD_GRID_COLUMN_GAP)}px;
          z-index: 10;
          background: ${token.colorBgContainer};
          pointer-events: none;
        }
        .sar-compound-card.pinned .sar-compound-card-name {
          position: relative;
          z-index: 25;
          background: ${token.colorBgContainer};
          border-radius: 0 0 8px 8px;
          margin: 0 2px 2px;
        }
        .sar-compound-card.pinned.hovered,
        .sar-compound-card.pinned:hover {
          background-color: ${isDarkMode ? 'color-mix(in srgb, #F87C63 12%, #1f1f1f)' : 'color-mix(in srgb, #F87C63 8%, #ffffff)'} !important;
        }
        .sar-compound-card.pinned.hovered .sar-compound-card-name,
        .sar-compound-card.pinned:hover .sar-compound-card-name {
          background: ${isDarkMode ? 'color-mix(in srgb, #F87C63 12%, #1f1f1f)' : 'color-mix(in srgb, #F87C63 8%, #ffffff)'};
        }
        .sar-compound-card:hover::after,
        .sar-compound-card.selected::after,
        .sar-compound-card.hovered::after,
        .sar-compound-card.pinned::after {
          border-color: ${token.colorPrimary};
        }
        .sar-compound-pin-badge {
          position: absolute;
          top: 6px;
          left: 6px;
          z-index: 30;
          width: 20px;
          height: 20px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: ${token.colorBgContainer};
          background: ${token.colorPrimary};
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
        .sar-table-card {
          margin-bottom: 24px;
        }
        .sar-table-card .ant-table-body {
          padding-bottom: 18px;
          box-sizing: border-box;
          scrollbar-gutter: stable;
        }
      `}</style>
    </div>
  );
};

export default SarTable;
