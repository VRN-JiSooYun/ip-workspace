import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Row, Col, Card, Table, Button, Input,
  Space, Typography, Modal, Form, Tag, List, Select, DatePicker, Avatar, Divider, Upload, Segmented, theme, Tooltip, Dropdown
} from 'antd';
import type { MenuProps } from 'antd';
import {
  Search, Plus, Filter, Settings, List as ListIcon,
  Image as ImageIcon, GitBranch, Info, ChevronDown, ChevronUp, Beaker,
  Activity, Share2, GripVertical, Upload as UploadIcon, FileText,
  PanelLeftClose, PanelLeftOpen, Copy, Trash2, Combine, Edit3, MoveRight, Minus
} from 'lucide-react';
import { DEFAULT_GROUP_STRUCTURE_VIEW_SETTINGS, useBoardStore } from '../store/useBoardStore';
import { mockCompounds, type Compound } from '../mocks/compounds';
import { useUserStore } from '../store/useUserStore';
import RadarChart from '../components/charts/RadarChart';
import dayjs from 'dayjs';
import { getPatentAnalysisLayoutPreset } from '../config/patentAnalysisLayout';
import { useUIStore } from '../store/useUIStore';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import WhiteboardEditor from '../components/board/WhiteboardEditor';
import ChemDrawModal from '../components/common/ChemDrawModal';
import ChemDrawEditor from '../components/common/ChemDrawEditor';
import BenzeneIcon from '../components/common/BenzeneIcon';
import CompoundStructureView, { getRotatedStructureBounds } from '../components/common/CompoundStructureView';
import ToggleTag from '../components/common/ToggleTag';
import shareForwardIconRaw from '../assets/svg/share-forward-fill.svg?raw';
import shareIconRaw from '../assets/svg/share.svg?raw';
import bookmarkIconRaw from '../assets/svg/bookmark.svg?raw';
import { formatDisplayDate } from '../utils/displayFormat';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;
const MYBOARD_SPLIT_MIN_PERCENT = 20;
const MYBOARD_SPLIT_MAX_PERCENT = 80;
const MYBOARD_SPLIT_DEFAULT_PERCENT = 30;
const MYBOARD_SHARE_STATUS_COLORS = {
  '공유 하는중': '#F87C63',
  '공유 받는중': '#1677ff',
} as const;
const createSvgMaskUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
const shareForwardIconMaskUrl = createSvgMaskUrl(shareForwardIconRaw);
const shareIconMaskUrl = createSvgMaskUrl(shareIconRaw);
const bookmarkIconMaskUrl = createSvgMaskUrl(bookmarkIconRaw);
const MYBOARD_RESPONSIVE_TEXT_COLUMN_KEYS = new Set([
  'designMemo',
  'assayPurpose',
  'expectedEffect',
  'requestMemo',
  'progressMemo',
  'reportData',
  'synthesisEndReason',
]);
const MYBOARD_MULTILINE_TEXT_COLUMN_KEYS = new Set([
  'name',
  ...MYBOARD_RESPONSIVE_TEXT_COLUMN_KEYS,
]);
const MYBOARD_RESPONSIVE_TEXT_COLUMN_MIN_WIDTH = 220;
const MYBOARD_RESPONSIVE_TEXT_COLUMN_MAX_WIDTH = 420;
const MYBOARD_GROUP_TITLE_MIN_WIDTH = 120;
const MYBOARD_GROUP_COLUMN_WIDTHS = {
  bookmark: 40,
  creDate: 100,
  target: 80,
  representativeStructure: 135,
  count: 60,
  groupOrder: 72,
  shareStatus: 56,
} as const;
const createFixedGroupColumnStyle = (width: number): React.CSSProperties => ({
  width,
  minWidth: width,
  maxWidth: width,
});
const createFixedGroupColumnProps = (width: number) => ({
  style: createFixedGroupColumnStyle(width),
});
const MYBOARD_GROUP_FIXED_COLUMN_WIDTH = Object.values(MYBOARD_GROUP_COLUMN_WIDTHS).reduce((sum, width) => sum + width, 0);
const MYBOARD_STRUCTURE_BASE_WIDTH = 168;
const MYBOARD_STRUCTURE_BASE_HEIGHT = 108;
const MYBOARD_STRUCTURE_BASE_PERCENT = 120;
const MYBOARD_STRUCTURE_SCALE_BASE_RATIO = 0.9975;
const MYBOARD_GROUP_STRUCTURE_WIDTH = 130;
const MYBOARD_GROUP_STRUCTURE_HEIGHT = 97.5;
const MYBOARD_GROUP_STRUCTURE_MAX_WIDTH = 130;
const MYBOARD_GROUP_STRUCTURE_MAX_HEIGHT = 97.5;
const MYBOARD_GROUP_STRUCTURE_ONLY_COLUMN_WIDTH = 138;
const MYBOARD_GROUP_STRUCTURE_ONLY_PANEL_WIDTH = 146;
const MYBOARD_STRUCTURE_IMAGE_SCALE_MIN = 70;
const MYBOARD_STRUCTURE_IMAGE_SCALE_MAX = 120;
const MYBOARD_STRUCTURE_IMAGE_SCALE_STEP = 5;
const estimateGroupTitleTextWidth = (text: string) => {
  const textWidth = Array.from(text).reduce((sum, char) => {
    if (char === ' ') return sum + 4;
    if (/[\u3131-\uD79D]/.test(char)) return sum + 13;
    return sum + 7.5;
  }, 0);
  return Math.ceil(textWidth + 28);
};
const MYBOARD_CENTER_COLUMN_KEYS = new Set([
  'creDate',
  'target',
  'representativeStructure',
  'count',
  'shareStatus',
  'num',
  'groupOrder',
  'project',
  'compoundId',
  'structure',
  'experimentStage',
  'designSource',
  'props1',
  'props2',
  'designNo',
  'requestDate',
  'synthesisExpansionLevel',
  'synthesisOwner',
  'synthesisAcceptedDate',
  'synthesisTargetDate',
  'isCompleted',
  'registeredDate',
  'researchNote',
]);

const MyBoard: React.FC = () => {
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const { setHeaderContent } = useUIStore();
  const {
    selectedGroupIds,
    toggleGroupSelection,
    setSelectedGroupIds,
    setSelectedSarCompoundIds,
    groups,
    groupStructureViewSettings,
    updateGroupStructureViewSettings,
    mergeGroups,
    copyGroup,
    deleteGroups,
  } = useBoardStore();
  const { currentUser } = useUserStore();
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isDesignModalOpen, setIsDesignModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isStructureModalOpen, setIsStructureModalOpen] = useState(false);
  const [isMergeGroupModalOpen, setIsMergeGroupModalOpen] = useState(false);
  const [isCompoundGroupSelectModalOpen, setIsCompoundGroupSelectModalOpen] = useState(false);
  const [isCompoundEditModalOpen, setIsCompoundEditModalOpen] = useState(false);
  const [mergeGroupName, setMergeGroupName] = useState('');
  const [cdjsInstance, setCdjsInstance] = useState<any>(null);
  const [designSmiles, setDesignSmiles] = useState('');
  const [searchedSvg, setSearchedSvg] = useState<string | null>(null);
  const [structurePreview, setStructurePreview] = useState<{ title: string; svg: string } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'draw' | 'tree'>('table');
  const [assignedGroupIds, setAssignedGroupIds] = useState<string[]>([]);
  const [compoundRows, setCompoundRows] = useState<Compound[]>(mockCompounds);
  const [selectedDetailCompoundIds, setSelectedDetailCompoundIds] = useState<React.Key[]>([]);
  const [compoundGroupAction, setCompoundGroupAction] = useState<'move' | 'copy'>('move');
  const [selectedCompoundTargetGroupId, setSelectedCompoundTargetGroupId] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [groupContextMenu, setGroupContextMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    groupId: string;
  } | null>(null);
  const [compoundContextMenu, setCompoundContextMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    compoundId: string;
  } | null>(null);
  const detailTableWrapperRef = React.useRef<HTMLDivElement | null>(null);
  const [detailUniformRowHeight, setDetailUniformRowHeight] = useState<number | null>(null);
  const [groupListMode, setGroupListMode] = useState<'full' | 'structure' | 'hidden'>('full');
  const [bookmarkedGroupIds, setBookmarkedGroupIds] = useState<string[]>([]);
  const [viewportWidth, setViewportWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 1920;
    return window.innerWidth;
  });
  const layoutPreset = React.useMemo(() => getPatentAnalysisLayoutPreset(viewportWidth), [viewportWidth]);
  const isStackedSplitLayout = viewportWidth <= 1100;
  const isGroupListFull = groupListMode === 'full';
  const isGroupListStructureOnly = groupListMode === 'structure';
  const isGroupListHidden = groupListMode === 'hidden';
  const [splitRatio, setSplitRatio] = useState<number>(MYBOARD_SPLIT_DEFAULT_PERCENT);
  const [isResizingSplit, setIsResizingSplit] = useState(false);
  const splitContainerRef = React.useRef<HTMLDivElement | null>(null);
  const groupListTableCardRef = React.useRef<HTMLDivElement | null>(null);
  const splitRafRef = React.useRef<number | null>(null);
  const splitStorageKey = 'my-board-split:group-detail';
  const [groupListTableWidth, setGroupListTableWidth] = useState(0);
  const visibleGroupRows = React.useMemo(
    () => [...groups]
      .sort((a, b) => {
        const aBookmarked = bookmarkedGroupIds.includes(a.id);
        const bBookmarked = bookmarkedGroupIds.includes(b.id);
        if (aBookmarked !== bBookmarked) return aBookmarked ? -1 : 1;
        return groups.indexOf(a) - groups.indexOf(b);
      }),
    [bookmarkedGroupIds, groups]
  );
  const contentFitGroupTitleWidth = React.useMemo(() => {
    const longestTitleWidth = visibleGroupRows.reduce(
      (max, group) => Math.max(max, estimateGroupTitleTextWidth(group.name)),
      0
    );
    return Math.max(longestTitleWidth, MYBOARD_GROUP_TITLE_MIN_WIDTH);
  }, [visibleGroupRows]);
  const detailTableEstimatedWidth = React.useMemo(() => {
    if (isStackedSplitLayout || isGroupListHidden) {
      return Math.max(viewportWidth - layoutPreset.sidePadding * 2 - 24, 320);
    }

    const availableWidth = Math.max(viewportWidth - layoutPreset.sidePadding * 2 - 12, 320);
    return Math.max(availableWidth * ((100 - splitRatio) / 100), 320);
  }, [isGroupListHidden, isStackedSplitLayout, layoutPreset.sidePadding, splitRatio, viewportWidth]);
  const groupTableTitleWidth = React.useMemo(() => {
    const estimatedContainerWidth = isStackedSplitLayout
      ? Math.max(viewportWidth - layoutPreset.sidePadding * 2 - 24, 320)
      : Math.max((viewportWidth - layoutPreset.sidePadding * 2 - 12) * (splitRatio / 100), 260);
    const containerWidth = groupListTableWidth > 0 ? Math.max(groupListTableWidth - 2, 260) : estimatedContainerWidth;
    const availableTitleWidth = Math.max(containerWidth - MYBOARD_GROUP_FIXED_COLUMN_WIDTH, MYBOARD_GROUP_TITLE_MIN_WIDTH);

    return Math.round(availableTitleWidth);
  }, [groupListTableWidth, isStackedSplitLayout, layoutPreset.sidePadding, splitRatio, viewportWidth]);

  const clampSplitRatio = React.useCallback((value: number) => {
    return Math.min(Math.max(value, MYBOARD_SPLIT_MIN_PERCENT), MYBOARD_SPLIT_MAX_PERCENT);
  }, []);

  const getViewToggleButtonStyle = (mode: 'table' | 'draw' | 'tree'): React.CSSProperties => {
    const isActive = viewMode === mode;

    return {
      background: isActive ? token.colorPrimaryBg : 'transparent',
      border: `1px solid ${isActive ? token.colorPrimary : 'transparent'}`,
      color: isActive ? token.colorPrimary : token.colorTextSecondary,
      borderRadius: 6,
      fontSize: 10,
      fontWeight: isActive ? 600 : 500,
      boxShadow: isActive ? '0 0 0 1px rgba(248, 124, 99, 0.15)' : 'none'
    };
  };

  // Sync selectedGroupIds to local state when modal opens
  React.useEffect(() => {
    if (isDesignModalOpen) {
      setAssignedGroupIds(selectedGroupIds);
    }
  }, [isDesignModalOpen, selectedGroupIds]);

  useEffect(() => {
    setHeaderContent(
      <PageHeaderBreadcrumb 
        items={[
          { label: 'Compounds' },
          { label: 'My Board' }
        ]} 
      />
    );
    return () => setHeaderContent(null);
  }, [setHeaderContent]);

  React.useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  React.useEffect(() => {
    const raw = window.localStorage.getItem(splitStorageKey);
    if (!raw) {
      setSplitRatio(MYBOARD_SPLIT_DEFAULT_PERCENT);
      return;
    }
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      setSplitRatio(clampSplitRatio(parsed));
    }
  }, [clampSplitRatio]);

  React.useEffect(() => {
    window.localStorage.setItem(splitStorageKey, String(splitRatio));
  }, [splitRatio]);

  React.useEffect(() => {
    const element = groupListTableCardRef.current;
    if (!element || isGroupListHidden) return;

    const updateWidth = () => {
      setGroupListTableWidth(Math.floor(element.getBoundingClientRect().width));
    };

    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);

    return () => observer.disconnect();
  }, [isGroupListHidden, isGroupListStructureOnly]);

  const updateSplitRatioFromClientX = React.useCallback((clientX: number) => {
    const container = splitContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return;
    const nextRatio = ((clientX - rect.left) / rect.width) * 100;
    setSplitRatio(clampSplitRatio(nextRatio));
  }, [clampSplitRatio]);

  const stopSplitResize = React.useCallback(() => {
    setIsResizingSplit(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  React.useEffect(() => {
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
      setSplitRatio(MYBOARD_SPLIT_MIN_PERCENT);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setSplitRatio(MYBOARD_SPLIT_MAX_PERCENT);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSplitRatio(MYBOARD_SPLIT_DEFAULT_PERCENT);
    }
  }, [clampSplitRatio]);

  const autoFitGroupTableWidth = React.useMemo(() => {
    return MYBOARD_GROUP_FIXED_COLUMN_WIDTH + contentFitGroupTitleWidth + 24;
  }, [contentFitGroupTitleWidth]);

  const fitGroupListToTableData = React.useCallback((event?: React.MouseEvent<HTMLDivElement>) => {
    event?.preventDefault();
    event?.stopPropagation();
    stopSplitResize();

    const container = splitContainerRef.current;
    if (!container || isStackedSplitLayout || !isGroupListFull) return;

    const containerWidth = container.getBoundingClientRect().width;
    if (containerWidth <= 0) return;

    const nextRatio = ((autoFitGroupTableWidth + 6) / containerWidth) * 100;
    setSplitRatio(clampSplitRatio(nextRatio));
  }, [autoFitGroupTableWidth, clampSplitRatio, isGroupListFull, isStackedSplitLayout, stopSplitResize]);

  const alwaysColumnKeys = React.useMemo(() => [
    '순번', '그룹 번호', '프로젝트', '물질 번호 (VRN)', '화합물 구조', '단계', '출처', '디자인 비고', 'MolProp1', 'MolProp2'
  ], []);
  const designColumnKeys = React.useMemo(() => [
    '디자인 번호', '필요량 (mg)', '목적 (개선하고자 하는 assay)', '기대 개선 효과', '의뢰일자', '합성 확장 필요 정도', '의뢰 비고'
  ], []);
  const synthesisColumnKeys = React.useMemo(() => [
    '합성 담당자', '합성 스터디 그룹 수락일자', '합성 목표일', '진행사항 비고', '완료 여부', '등록일', '연구노트', '리포트 자료', '합성 종료 이유'
  ], []);
  const permissionColumnKeys = currentUser.role === 'design' ? designColumnKeys : synthesisColumnKeys;
  const defaultOrder = React.useMemo(
    () => [...alwaysColumnKeys, ...permissionColumnKeys],
    [alwaysColumnKeys, permissionColumnKeys]
  );
  const defaultActive = React.useMemo(
    () => [...alwaysColumnKeys, ...permissionColumnKeys],
    [alwaysColumnKeys, permissionColumnKeys]
  );

  // COLUMN STATES (Order & Visibility)
  const [columnOrder, setColumnOrder] = useState<string[]>(defaultOrder);
  const [activeColumns, setActiveColumns] = useState<string[]>(defaultActive);

  // Preset State: stores order and active columns for each preset index (1-5)
  const [activePreset, setActivePreset] = useState<number>(1);
  const [presets, setPresets] = useState<Record<number, any>>({
    1: { order: [...defaultOrder], active: [...defaultActive] },
    2: { order: [...defaultOrder], active: [...defaultActive] },
    3: { order: [...defaultOrder], active: [...defaultActive] },
    4: { order: [...defaultOrder], active: [...defaultActive] },
    5: { order: [...defaultOrder], active: [...defaultActive] }
  });

  React.useEffect(() => {
    const nextPresets = {
      1: { order: [...defaultOrder], active: [...defaultActive] },
      2: { order: [...defaultOrder], active: [...defaultActive] },
      3: { order: [...defaultOrder], active: [...defaultActive] },
      4: { order: [...defaultOrder], active: [...defaultActive] },
      5: { order: [...defaultOrder], active: [...defaultActive] }
    };

    setColumnOrder([...defaultOrder]);
    setActiveColumns([...defaultActive]);
    setPresets(nextPresets);
    setActivePreset(1);
  }, [currentUser.role, defaultOrder, defaultActive]);

  const handleSavePreset = () => {
    setPresets({
      ...presets,
      [activePreset]: { order: [...columnOrder], active: [...activeColumns] }
    });
    setIsSettingsModalOpen(false);
  };

  const applyPreset = (n: number) => {
    setActivePreset(n);
    const preset = presets[n];
    if (preset) {
      setColumnOrder([...preset.order]);
      setActiveColumns([...preset.active]);
    }
  };

  const toggleColumn = (key: string) => {
    setActiveColumns(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Filter States
  const projectList = ['FGFR', 'C797S DM', 'cMET', 'VRK1', 'HER2', 'WRN', 'WEE1'];
  const shareList = ['내 물질', '공유함', '공유받음'];
  const sourceList = ['내 머리', '동료 머리', 'Patent', 'Paper', 'FBDD', 'ELN'];
  const calculationOptions = [
    '3D TPSA QM', 'Solubility QM', 'Solubility DL', 'E-Sol QM',
    'Permeability MD', '특허성', '합성기능성'
  ];
  const [selectedProjects, setSelectedProjects] = useState<string[]>(['ALL', ...projectList]);
  const [selectedShares, setSelectedShares] = useState<string[]>(['ALL', ...shareList]);
  const [selectedSources, setSelectedSources] = useState<string[]>(['ALL', ...sourceList]);
  const [period, setPeriod] = useState<string>('전체');
  const [keyword, setKeyword] = useState<string>('');
  const [selectedCalculations, setSelectedCalculations] = useState<string[]>([]);
  const areAllCalculationsSelected = selectedCalculations.length === calculationOptions.length;

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

  const selectedGroupOrderMap = React.useMemo(() => {
    return selectedGroupIds.reduce<Record<string, number>>((acc, groupId, index) => {
      acc[groupId] = index + 1;
      return acc;
    }, {});
  }, [selectedGroupIds]);
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
  const clampMyBoardStructureScale = (value: number) => {
    const steppedValue = Math.round(value / MYBOARD_STRUCTURE_IMAGE_SCALE_STEP) * MYBOARD_STRUCTURE_IMAGE_SCALE_STEP;
    return Math.min(MYBOARD_STRUCTURE_IMAGE_SCALE_MAX, Math.max(MYBOARD_STRUCTURE_IMAGE_SCALE_MIN, steppedValue));
  };
  const changeMyBoardStructureScale = (delta: number) => {
    const currentValue = activeStructureSettings?.myBoardImageScalePercent ?? DEFAULT_GROUP_STRUCTURE_VIEW_SETTINGS.myBoardImageScalePercent;
    updateActiveStructureSettings({
      myBoardImageScalePercent: clampMyBoardStructureScale(currentValue + delta),
    });
  };
  const getGroupStructureSettings = React.useCallback((groupId: string) => ({
    ...DEFAULT_GROUP_STRUCTURE_VIEW_SETTINGS,
    ...groupStructureViewSettings[groupId],
  }), [groupStructureViewSettings]);

  const filteredCompounds = React.useMemo(() => {
    return compoundRows
      .filter((compound) => {
        // If it's a structure search results mode, don't filter out by the keyword string
        const matchesKeyword = keyword === 'Structure Search Result' ||
          compound.name.toLowerCase().includes(keyword.toLowerCase()) ||
          compound.smiles.toLowerCase().includes(keyword.toLowerCase());

        if (selectedGroupIds.length > 0 && !selectedGroupIds.includes(compound.groupId)) return false;
        if (!selectedProjects.includes('ALL') && compound.project && !selectedProjects.includes(compound.project)) return false;
        if (!selectedShares.includes('ALL') && compound.shareStatus && !selectedShares.includes(compound.shareStatus)) return false;
        if (!selectedSources.includes('ALL') && compound.designSource && !selectedSources.includes(compound.designSource)) return false;
        if (keyword && !matchesKeyword) return false;
        return true;
      })
      .sort((a, b) => {
        const aGroupOrder = selectedGroupOrderMap[a.groupId] ?? Number.MAX_SAFE_INTEGER;
        const bGroupOrder = selectedGroupOrderMap[b.groupId] ?? Number.MAX_SAFE_INTEGER;

        if (aGroupOrder !== bGroupOrder) return aGroupOrder - bGroupOrder;
        return compoundRows.indexOf(a) - compoundRows.indexOf(b);
      });
  }, [compoundRows, keyword, selectedGroupIds, selectedGroupOrderMap, selectedProjects, selectedShares, selectedSources]);

  const sarTargetCount = selectedGroupIds.length > 0 ? filteredCompounds.length : 0;
  const selectedDetailCompoundKeys = React.useMemo(
    () => selectedDetailCompoundIds.map(String),
    [selectedDetailCompoundIds]
  );
  const selectedDetailCompounds = React.useMemo(
    () => compoundRows.filter((compound) => selectedDetailCompoundKeys.includes(compound.id)),
    [compoundRows, selectedDetailCompoundKeys]
  );
  const selectedEditableCompound = selectedDetailCompounds.length === 1 ? selectedDetailCompounds[0] : null;
  const isSelectedCompoundSynthesized = Boolean(
    selectedEditableCompound?.isCompleted || selectedEditableCompound?.status === '합성완료'
  );

  React.useEffect(() => {
    const visibleIds = new Set(filteredCompounds.map((compound) => compound.id));
    setSelectedDetailCompoundIds((prev) => prev.filter((id) => visibleIds.has(String(id))));
  }, [filteredCompounds]);

  const firstCompoundByGroupId = React.useMemo(() => {
    return compoundRows.reduce<Record<string, Compound>>((acc, compound) => {
      if (!acc[compound.groupId]) {
        acc[compound.groupId] = compound;
      }
      return acc;
    }, {});
  }, [compoundRows]);

  const renderRepresentativeStructure = (_: any, record: any) => {
    const representativeCompound = firstCompoundByGroupId[record.id];
    const structureSvg = representativeCompound?.structureSvg;
    const structureSettings = getGroupStructureSettings(record.id);
    const rotatedBounds = getRotatedStructureBounds(
      MYBOARD_GROUP_STRUCTURE_WIDTH,
      MYBOARD_GROUP_STRUCTURE_HEIGHT,
      structureSettings.sarRotationDeg
    );
    const structureFitScale = Math.min(
      1,
      MYBOARD_GROUP_STRUCTURE_MAX_WIDTH / rotatedBounds.width,
      MYBOARD_GROUP_STRUCTURE_MAX_HEIGHT / rotatedBounds.height
    );

    return (
      <div
        className="my-board-representative-structure"
        style={{
          margin: '0 auto',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0,
          minWidth: Math.ceil(rotatedBounds.width * structureFitScale),
          minHeight: Math.ceil(rotatedBounds.height * structureFitScale),
          lineHeight: 0,
        }}
      >
        <CompoundStructureView
          svg={structureSvg}
          title={representativeCompound?.compoundId || representativeCompound?.name || 'Structure'}
          smiles={representativeCompound?.smiles}
          molBlock={(representativeCompound as any)?.molBlock ?? (representativeCompound as any)?.mol_block ?? (representativeCompound as any)?.molblock}
          cdxml={(representativeCompound as any)?.draw}
          width={MYBOARD_GROUP_STRUCTURE_WIDTH}
          height={MYBOARD_GROUP_STRUCTURE_HEIGHT}
          iconSize={40}
          gap={0}
          actionPlacement="overlay"
          actionOverlayAnchor="container"
          structureStyle={{ transform: `scale(${structureFitScale}) rotate(${structureSettings.sarRotationDeg}deg)` }}
          frameStyle={{ border: 0, background: 'transparent', boxShadow: 'none', overflow: 'visible' }}
          onPreview={structureSvg ? () => {
            setStructurePreview({
              title: representativeCompound?.compoundId || representativeCompound?.name || 'Structure',
              svg: structureSvg,
            });
          } : undefined}
        />
      </div>
    );
  };

  const renderMultilineText = (value: any) => {
    const text = value == null || value === '' ? '-' : String(value);

    return (
      <span className="my-board-multiline-text" title={text}>
        {text}
      </span>
    );
  };

  const toggleBookmarkedGroup = React.useCallback((groupId: string) => {
    setBookmarkedGroupIds((prev) => (
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [groupId, ...prev]
    ));
  }, []);

  const groupColumns = [
    {
      title: '',
      dataIndex: 'id',
      key: 'bookmark',
      width: MYBOARD_GROUP_COLUMN_WIDTHS.bookmark,
      minWidth: MYBOARD_GROUP_COLUMN_WIDTHS.bookmark,
      align: 'center' as const,
      className: 'my-board-group-fixed-column',
      onCell: (record: any) => ({
        ...createFixedGroupColumnProps(MYBOARD_GROUP_COLUMN_WIDTHS.bookmark),
        onClick: (event: React.MouseEvent<HTMLElement>) => {
          event.stopPropagation();
          toggleBookmarkedGroup(record.id);
        },
        style: {
          ...createFixedGroupColumnStyle(MYBOARD_GROUP_COLUMN_WIDTHS.bookmark),
          cursor: 'pointer',
        },
      }),
      onHeaderCell: () => createFixedGroupColumnProps(MYBOARD_GROUP_COLUMN_WIDTHS.bookmark),
      render: (groupId: string) => {
        const isBookmarked = bookmarkedGroupIds.includes(groupId);

        return (
          <Tooltip title={isBookmarked ? '상단 고정 해제' : '상단 고정'}>
            <Button
              size="small"
              type="text"
              aria-label={isBookmarked ? '상단 고정 해제' : '상단 고정'}
              className={`my-board-bookmark-button${isBookmarked ? ' active' : ''}`}
              onClick={(event) => {
                event.stopPropagation();
                toggleBookmarkedGroup(groupId);
              }}
            >
              <span className="my-board-bookmark-icon" />
            </Button>
          </Tooltip>
        );
      },
    },
    {
      title: 'Date',
      dataIndex: 'creDate',
      key: 'creDate',
      width: MYBOARD_GROUP_COLUMN_WIDTHS.creDate,
      minWidth: MYBOARD_GROUP_COLUMN_WIDTHS.creDate,
      className: 'my-board-group-fixed-column',
      onCell: () => createFixedGroupColumnProps(MYBOARD_GROUP_COLUMN_WIDTHS.creDate),
      onHeaderCell: () => createFixedGroupColumnProps(MYBOARD_GROUP_COLUMN_WIDTHS.creDate),
      render: formatDisplayDate,
    },
    {
      title: 'Target',
      dataIndex: 'target',
      key: 'target',
      width: MYBOARD_GROUP_COLUMN_WIDTHS.target,
      minWidth: MYBOARD_GROUP_COLUMN_WIDTHS.target,
      className: 'my-board-group-fixed-column',
      onCell: () => createFixedGroupColumnProps(MYBOARD_GROUP_COLUMN_WIDTHS.target),
      onHeaderCell: () => createFixedGroupColumnProps(MYBOARD_GROUP_COLUMN_WIDTHS.target),
      render: (t: string) => <Tag color="blue">{t}</Tag>
    },
    {
      title: '화합물 구조',
      key: 'representativeStructure',
      width: MYBOARD_GROUP_COLUMN_WIDTHS.representativeStructure,
      minWidth: MYBOARD_GROUP_COLUMN_WIDTHS.representativeStructure,
      align: 'center' as const,
      className: 'my-board-group-fixed-column my-board-structure-column',
      onCell: () => createFixedGroupColumnProps(MYBOARD_GROUP_COLUMN_WIDTHS.representativeStructure),
      onHeaderCell: () => createFixedGroupColumnProps(MYBOARD_GROUP_COLUMN_WIDTHS.representativeStructure),
      render: renderRepresentativeStructure
    },
    { title: 'Title', dataIndex: 'name', key: 'name', width: groupTableTitleWidth, minWidth: MYBOARD_GROUP_TITLE_MIN_WIDTH, render: renderMultilineText },
    {
      title: '개수',
      dataIndex: 'count',
      key: 'count',
      align: 'right' as const,
      width: MYBOARD_GROUP_COLUMN_WIDTHS.count,
      minWidth: MYBOARD_GROUP_COLUMN_WIDTHS.count,
      className: 'my-board-group-fixed-column',
      onCell: () => createFixedGroupColumnProps(MYBOARD_GROUP_COLUMN_WIDTHS.count),
      onHeaderCell: () => createFixedGroupColumnProps(MYBOARD_GROUP_COLUMN_WIDTHS.count),
    },
    {
      title: '그룹 번호',
      dataIndex: 'id',
      key: 'groupOrder',
      width: MYBOARD_GROUP_COLUMN_WIDTHS.groupOrder,
      minWidth: MYBOARD_GROUP_COLUMN_WIDTHS.groupOrder,
      align: 'center' as const,
      className: 'my-board-group-fixed-column',
      onCell: () => createFixedGroupColumnProps(MYBOARD_GROUP_COLUMN_WIDTHS.groupOrder),
      onHeaderCell: () => createFixedGroupColumnProps(MYBOARD_GROUP_COLUMN_WIDTHS.groupOrder),
      render: (groupId: string) => selectedGroupOrderMap[groupId] ? `G${selectedGroupOrderMap[groupId]}` : '-'
    },
    {
      title: '공유',
      dataIndex: 'shareStatus',
      key: 'shareStatus',
      width: MYBOARD_GROUP_COLUMN_WIDTHS.shareStatus,
      minWidth: MYBOARD_GROUP_COLUMN_WIDTHS.shareStatus,
      className: 'my-board-group-fixed-column',
      onCell: () => createFixedGroupColumnProps(MYBOARD_GROUP_COLUMN_WIDTHS.shareStatus),
      onHeaderCell: () => createFixedGroupColumnProps(MYBOARD_GROUP_COLUMN_WIDTHS.shareStatus),
      render: (status: string) => {
        const iconUrl = status === '공유 하는중'
          ? shareForwardIconMaskUrl
          : status === '공유 받는중'
            ? shareIconMaskUrl
            : null;

        if (!iconUrl) return null;

        return (
          <Tooltip title={status}>
            <span
              aria-label={status}
              role="img"
              style={{
                display: 'inline-block',
                width: 18,
                height: 18,
                backgroundColor: MYBOARD_SHARE_STATUS_COLORS[status as keyof typeof MYBOARD_SHARE_STATUS_COLORS],
                WebkitMask: `url(${iconUrl}) center / contain no-repeat`,
                mask: `url(${iconUrl}) center / contain no-repeat`,
                verticalAlign: 'middle',
              }}
            />
          </Tooltip>
        );
      }
    }
  ];

  const groupContextMenuItems: MenuProps['items'] = [
    {
      key: 'merge',
      icon: <Combine size={14} />,
      label: '그룹 간 통합',
      disabled: selectedGroupIds.length < 2,
    },
    {
      key: 'copy',
      icon: <Copy size={14} />,
      label: '그룹 복사',
      disabled: selectedGroupIds.length !== 1,
    },
    {
      type: 'divider',
    },
    {
      key: 'delete',
      icon: <Trash2 size={14} />,
      label: '그룹 삭제',
      danger: true,
    },
  ];

  const getContextGroupIds = React.useCallback(() => {
    if (!groupContextMenu?.groupId) return selectedGroupIds;
    return selectedGroupIds.includes(groupContextMenu.groupId)
      ? selectedGroupIds
      : [...selectedGroupIds, groupContextMenu.groupId];
  }, [groupContextMenu?.groupId, selectedGroupIds]);

  const getGroupCompoundCount = React.useCallback((groupIds: string[]) => (
    compoundRows.filter((compound) => groupIds.includes(compound.groupId)).length
  ), [compoundRows]);

  const hasSelectedDetailCompounds = selectedDetailCompoundIds.length > 0;
  const canAddCompound = selectedGroupIds.length > 0;
  const canDeleteCompound = hasSelectedDetailCompounds;
  const canEditCompound = selectedDetailCompoundIds.length === 1;

  const getCompoundActionButtonStyle = React.useCallback((enabled: boolean): React.CSSProperties => ({
    background: enabled ? token.colorPrimary : token.colorBgLayout,
    borderColor: enabled ? token.colorPrimary : token.colorBorderSecondary,
    color: enabled ? token.colorBgContainer : token.colorTextTertiary,
  }), [token]);

  const openCompoundGroupSelectModal = React.useCallback((action: 'move' | 'copy') => {
    if (!hasSelectedDetailCompounds) return;
    setCompoundGroupAction(action);
    setSelectedCompoundTargetGroupId(selectedGroupIds[0] ?? groups[0]?.id);
    setIsCompoundGroupSelectModalOpen(true);
  }, [groups, hasSelectedDetailCompounds, selectedGroupIds]);

  const handleDeleteSelectedCompounds = React.useCallback(() => {
    if (!canDeleteCompound) return;
    Modal.confirm({
      title: '화합물 삭제',
      content: `선택한 ${selectedDetailCompoundIds.length}개의 화합물을 삭제하시겠습니까?`,
      okText: '삭제',
      cancelText: '취소',
      okButtonProps: { danger: true },
      onOk: () => {
        const selectedIds = new Set(selectedDetailCompoundIds.map(String));
        setCompoundRows((prev) => prev.filter((compound) => !selectedIds.has(compound.id)));
        setSelectedDetailCompoundIds([]);
        setCompoundContextMenu(null);
      },
    });
  }, [canDeleteCompound, selectedDetailCompoundIds]);

  const handleOpenCompoundEdit = React.useCallback(() => {
    if (!canEditCompound) return;
    setIsCompoundEditModalOpen(true);
    setCompoundContextMenu(null);
  }, [canEditCompound]);

  const handleGroupRowSelection = React.useCallback((groupId: string, event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      toggleGroupSelection(groupId);
      return;
    }

    setSelectedGroupIds([groupId]);
  }, [setSelectedGroupIds, toggleGroupSelection]);

  const toggleDetailCompoundSelection = React.useCallback((compoundId: string) => {
    setSelectedDetailCompoundIds((prev) => (
      prev.includes(compoundId)
        ? prev.filter((id) => id !== compoundId)
        : [...prev, compoundId]
    ));
  }, []);

  const handleDetailCompoundRowSelection = React.useCallback((compoundId: string, event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      toggleDetailCompoundSelection(compoundId);
      return;
    }

    setSelectedDetailCompoundIds([compoundId]);
  }, [toggleDetailCompoundSelection]);

  const compoundContextMenuItems: MenuProps['items'] = [
    {
      key: 'split',
      icon: <Combine size={14} />,
      label: '그룹 분리',
      disabled: !hasSelectedDetailCompounds,
    },
    {
      key: 'newGroup',
      icon: <Plus size={14} />,
      label: '새 그룹 생성',
      disabled: !hasSelectedDetailCompounds,
    },
    {
      type: 'divider',
    },
    {
      key: 'delete',
      icon: <Trash2 size={14} />,
      label: '삭제',
      danger: true,
      disabled: !canDeleteCompound,
    },
    {
      key: 'edit',
      icon: <Edit3 size={14} />,
      label: '수정',
      disabled: !canEditCompound,
    },
    {
      type: 'divider',
    },
    {
      key: 'move',
      icon: <MoveRight size={14} />,
      label: '다른 그룹으로 이동',
      disabled: !hasSelectedDetailCompounds,
    },
    {
      key: 'copy',
      icon: <Copy size={14} />,
      label: '다른 그룹으로 복제',
      disabled: !hasSelectedDetailCompounds,
    },
  ];

  const handleCompoundContextMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'split' || key === 'newGroup') {
      if (!hasSelectedDetailCompounds) return;
      setIsGroupModalOpen(true);
      setCompoundContextMenu(null);
      return;
    }

    if (key === 'delete') {
      handleDeleteSelectedCompounds();
      return;
    }

    if (key === 'edit') {
      handleOpenCompoundEdit();
      return;
    }

    if (key === 'move' || key === 'copy') {
      openCompoundGroupSelectModal(key);
      setCompoundContextMenu(null);
      return;
    }

    setCompoundContextMenu(null);
  };

  const handleApplyCompoundGroupAction = React.useCallback(() => {
    if (!selectedCompoundTargetGroupId || selectedDetailCompoundIds.length === 0) return;
    const selectedIds = new Set(selectedDetailCompoundIds.map(String));

    if (compoundGroupAction === 'move') {
      setCompoundRows((prev) => prev.map((compound) => (
        selectedIds.has(compound.id)
          ? { ...compound, groupId: selectedCompoundTargetGroupId }
          : compound
      )));
    } else {
      const selectedRows = compoundRows.filter((compound) => selectedIds.has(compound.id));
      const timestamp = Date.now();
      setCompoundRows((prev) => [
        ...prev,
        ...selectedRows.map((compound, index) => ({
          ...compound,
          id: `${compound.id}-copy-${timestamp}-${index}`,
          groupId: selectedCompoundTargetGroupId,
          compoundId: `${compound.compoundId}-COPY`,
          name: `${compound.name} Copy`,
        })),
      ]);
    }

    setSelectedDetailCompoundIds([]);
    setIsCompoundGroupSelectModalOpen(false);
    setSelectedCompoundTargetGroupId(undefined);
  }, [compoundGroupAction, compoundRows, selectedCompoundTargetGroupId, selectedDetailCompoundIds]);

  const handleGroupContextMenuClick: MenuProps['onClick'] = ({ key }) => {
    const contextGroupIds = getContextGroupIds();

    if (key === 'merge') {
      if (contextGroupIds.length < 2) return;
      const fallbackName = groups
        .filter((group) => contextGroupIds.includes(group.id))
        .map((group) => group.name)
        .join(' + ');
      setMergeGroupName(fallbackName || '통합 그룹');
      setIsMergeGroupModalOpen(true);
      setGroupContextMenu(null);
      return;
    }

    if (key === 'copy') {
      if (contextGroupIds.length !== 1) return;
      copyGroup(contextGroupIds[0]);
      setGroupContextMenu(null);
      return;
    }

    if (key === 'delete') {
      if (contextGroupIds.length === 0) return;
      const compoundCount = getGroupCompoundCount(contextGroupIds);
      Modal.confirm({
        title: '그룹 삭제',
        content: `총 ${contextGroupIds.length}개의 그룹(${compoundCount}개의 화합물)을 삭제 하시겠습니까?`,
        okText: '삭제',
        cancelText: '취소',
        okButtonProps: { danger: true },
        onOk: () => {
          deleteGroups(contextGroupIds);
          setGroupContextMenu(null);
        },
      });
      return;
    }

    setGroupContextMenu(null);
  };

  const structureOnlyGroupColumns = [
    {
      title: '화합물 구조',
      key: 'representativeStructure',
      width: MYBOARD_GROUP_STRUCTURE_ONLY_COLUMN_WIDTH,
      align: 'center' as const,
      className: 'my-board-structure-column',
      render: renderRepresentativeStructure
    }
  ];

  const allColumnsMap: Record<string, any> = {
    '순번': { title: '순번', key: 'num', render: (_: any, __: any, index: number) => index + 1, width: 48 },
    '그룹 번호': {
      title: '그룹',
      dataIndex: 'groupId',
      key: 'groupOrder',
      width: 56,
      align: 'center' as const,
      render: (groupId: string) => selectedGroupOrderMap[groupId] ? `G${selectedGroupOrderMap[groupId]}` : '-'
    },
    '프로젝트': { title: '프로젝트', dataIndex: 'project', key: 'project', width: 80, render: (project: string) => <Tag color="blue">{project}</Tag> },
    '물질 번호 (VRN)': { title: '물질 번호 (VRN)', dataIndex: 'compoundId', key: 'compoundId', width: 124, render: (id: string) => <Text strong color={token.colorPrimary}>{id}</Text> },
    '화합물 구조': {
      title: '화합물 구조',
      dataIndex: 'structureSvg',
      key: 'structure',
      width: 212,
      className: 'my-board-structure-column',
      render: (structureSvg: string | undefined, record: any) => {
        const displaySvg = searchedSvg && (keyword === record.smiles || keyword === 'Structure Search Result')
          ? searchedSvg
          : structureSvg;
        const structureSettings = getGroupStructureSettings(record.groupId);
        const structureScale = (structureSettings.myBoardImageScalePercent / MYBOARD_STRUCTURE_BASE_PERCENT) * MYBOARD_STRUCTURE_SCALE_BASE_RATIO;
        const structureWidth = Math.round(MYBOARD_STRUCTURE_BASE_WIDTH * structureScale);
        const structureHeight = Math.round(MYBOARD_STRUCTURE_BASE_HEIGHT * structureScale);
        const rotatedStructureBounds = getRotatedStructureBounds(
          structureWidth,
          structureHeight,
          structureSettings.sarRotationDeg
        );

        return (
          <CompoundStructureView
            svg={displaySvg}
            title={record.compoundId || record.name || 'Structure'}
            smiles={record.smiles}
            molBlock={record.molBlock ?? record.mol_block ?? record.molblock}
            cdxml={record.draw}
            width={structureWidth}
            height={structureHeight}
            iconSize={40}
            gap={0}
            actionPlacement="overlay"
            actionOverlayAnchor="container"
            frameless
            rotationDeg={structureSettings.sarRotationDeg}
            containerStyle={{
              minWidth: rotatedStructureBounds.width,
              minHeight: rotatedStructureBounds.height,
            }}
            onPreview={displaySvg ? () => {
              setStructurePreview({
                title: record.compoundId || record.name || 'Structure',
                svg: displaySvg,
              });
            } : undefined}
          />
        );
      }
    },
    '단계': {
      title: '단계',
      dataIndex: 'experimentStage',
      key: 'experimentStage',
      width: 48,
      align: 'center' as const,
      render: (stage: number | undefined, record: any) => (
        <Text strong style={{ color: token.colorPrimary, fontSize: 11 }}>
          {stage ?? ((Number(String(record.id).replace(/\D/g, '')) || 0) % 5) + 1}
        </Text>
      )
    },
    '출처': { title: '출처', dataIndex: 'designSource', key: 'designSource', width: 64 },
    '디자인 비고': { title: '디자인 비고', dataIndex: 'designMemo', key: 'designMemo', width: 220, render: renderMultilineText },
    'MolProp1': {
      title: 'MolProp1',
      dataIndex: 'properties1',
      key: 'props1',
      width: 96,
      render: (props: number[]) => props ? <RadarChart data={props} size={56} /> : '-'
    },
    'MolProp2': {
      title: 'MolProp2',
      dataIndex: 'properties2',
      key: 'props2',
      width: 96,
      render: (props: number[]) => props ? <RadarChart data={props} size={56} color="#5856d6" /> : '-'
    },
    '디자인 번호': { title: '디자인 번호', dataIndex: 'designNo', key: 'designNo', width: 112 },
    '필요량 (mg)': { title: '필요량 (mg)', dataIndex: 'requiredAmountMg', key: 'requiredAmountMg', width: 104, align: 'right' as const },
    '목적 (개선하고자 하는 assay)': { title: '목적 (개선하고자 하는 assay)', dataIndex: 'assayPurpose', key: 'assayPurpose', width: 260, render: renderMultilineText },
    '기대 개선 효과': { title: '기대 개선 효과', dataIndex: 'expectedEffect', key: 'expectedEffect', width: 180, render: renderMultilineText },
    '의뢰일자': { title: '의뢰일자', dataIndex: 'requestDate', key: 'requestDate', width: 96, render: formatDisplayDate },
    '합성 확장 필요 정도': { title: '합성 확장 필요 정도', dataIndex: 'synthesisExpansionLevel', key: 'synthesisExpansionLevel', width: 144 },
    '의뢰 비고': { title: '의뢰 비고', dataIndex: 'requestMemo', key: 'requestMemo', width: 180, render: renderMultilineText },
    '합성 담당자': { title: '합성 담당자', dataIndex: 'synthesisOwner', key: 'synthesisOwner', width: 104 },
    '합성 스터디 그룹 수락일자': { title: '합성 스터디 그룹 수락일자', dataIndex: 'synthesisAcceptedDate', key: 'synthesisAcceptedDate', width: 172, render: formatDisplayDate },
    '합성 목표일': { title: '합성 목표일', dataIndex: 'synthesisTargetDate', key: 'synthesisTargetDate', width: 104, render: formatDisplayDate },
    '진행사항 비고': { title: '진행사항 비고', dataIndex: 'progressMemo', key: 'progressMemo', width: 180, render: renderMultilineText },
    '완료 여부': {
      title: '완료 여부',
      dataIndex: 'isCompleted',
      key: 'isCompleted',
      width: 88,
      render: (isCompleted: boolean) => <Tag color={isCompleted ? 'green' : 'gold'}>{isCompleted ? '완료' : '진행중'}</Tag>
    },
    '등록일': { title: '등록일', dataIndex: 'registeredDate', key: 'registeredDate', width: 96, render: formatDisplayDate },
    '연구노트': { title: '연구노트', dataIndex: 'researchNote', key: 'researchNote', width: 108 },
    '리포트 자료': { title: '리포트 자료', dataIndex: 'reportData', key: 'reportData', width: 156, render: renderMultilineText },
    '합성 종료 이유': { title: '합성 종료 이유', dataIndex: 'synthesisEndReason', key: 'synthesisEndReason', width: 164, render: renderMultilineText }
  };

  const responsiveTextColumnWidth = React.useMemo(() => {
    const selectedColumns = columnOrder
      .filter(key => activeColumns.includes(key))
      .map(key => allColumnsMap[key])
      .filter(Boolean);
    const visibleLongColumnCount = selectedColumns.filter(column => MYBOARD_RESPONSIVE_TEXT_COLUMN_KEYS.has(column.key)).length;

    if (visibleLongColumnCount === 0) return 180;

    const fixedWidth = selectedColumns.reduce((sum, column) => (
      MYBOARD_RESPONSIVE_TEXT_COLUMN_KEYS.has(column.key)
        ? sum
        : sum + (typeof column.width === 'number' ? column.width : 120)
    ), 0);
    const availableWidth = Math.max(
      detailTableEstimatedWidth - fixedWidth - 48,
      MYBOARD_RESPONSIVE_TEXT_COLUMN_MIN_WIDTH * visibleLongColumnCount
    );

    return Math.round(Math.min(
      Math.max(availableWidth / visibleLongColumnCount, MYBOARD_RESPONSIVE_TEXT_COLUMN_MIN_WIDTH),
      MYBOARD_RESPONSIVE_TEXT_COLUMN_MAX_WIDTH
    ));
  }, [activeColumns, columnOrder, detailTableEstimatedWidth]);

  const withMyBoardHeaderCell = React.useCallback((columns: any[]) => (
    columns.map((column) => ({
      ...column,
      align: MYBOARD_CENTER_COLUMN_KEYS.has(column.key) ? 'center' as const : column.align,
      width: MYBOARD_RESPONSIVE_TEXT_COLUMN_KEYS.has(column.key)
        ? Math.max(responsiveTextColumnWidth, typeof column.width === 'number' ? column.width : 0)
        : column.width,
      className: [
        column.className,
        MYBOARD_CENTER_COLUMN_KEYS.has(column.key) ? 'table-center-column' : undefined,
        MYBOARD_RESPONSIVE_TEXT_COLUMN_KEYS.has(column.key) ? 'my-board-responsive-text-column' : undefined,
        MYBOARD_MULTILINE_TEXT_COLUMN_KEYS.has(column.key) ? 'my-board-multiline-text-column' : undefined,
      ].filter(Boolean).join(' ') || undefined,
      onHeaderCell: (...args: any[]) => {
        const headerCellProps = typeof column.onHeaderCell === 'function' ? column.onHeaderCell(...args) : {};

        return {
          ...headerCellProps,
          className: [headerCellProps.className, 'my-board-table-header-cell'].filter(Boolean).join(' '),
        };
      },
    }))
  ), [responsiveTextColumnWidth]);

  const styledGroupColumns = React.useMemo(() => withMyBoardHeaderCell(groupColumns), [groupColumns, withMyBoardHeaderCell]);
  const styledStructureOnlyGroupColumns = React.useMemo(() => withMyBoardHeaderCell(structureOnlyGroupColumns), [structureOnlyGroupColumns, withMyBoardHeaderCell]);

  const dynamicCompoundColumns = columnOrder
    .filter(key => activeColumns.includes(key))
    .map(key => allColumnsMap[key])
    .filter(Boolean);
  const styledDynamicCompoundColumns = React.useMemo(
    () => withMyBoardHeaderCell(dynamicCompoundColumns),
    [dynamicCompoundColumns, withMyBoardHeaderCell]
  );
  const getTableScrollWidth = React.useCallback((columns: any[]) => (
    columns.reduce((sum, column) => {
      if (Array.isArray(column.children) && column.children.length > 0) {
        return sum + getTableScrollWidth(column.children);
      }
      return sum + (typeof column.width === 'number' ? column.width : 120);
    }, 0)
  ), []);
  const groupTableScrollX = React.useMemo(
    () => getTableScrollWidth(isGroupListStructureOnly ? styledStructureOnlyGroupColumns : styledGroupColumns),
    [getTableScrollWidth, isGroupListStructureOnly, styledGroupColumns, styledStructureOnlyGroupColumns]
  );
  const detailTableScrollX = React.useMemo(
    () => getTableScrollWidth(styledDynamicCompoundColumns),
    [getTableScrollWidth, styledDynamicCompoundColumns]
  );

  const measureDetailTableRowHeight = React.useCallback(() => {
    const wrapper = detailTableWrapperRef.current;
    if (!wrapper) return;

    const rows = Array.from(wrapper.querySelectorAll<HTMLTableRowElement>('.my-board-detail-table .ant-table-tbody > tr.ant-table-row'));
    if (rows.length === 0) {
      setDetailUniformRowHeight(null);
      return;
    }

    const maxHeight = Math.ceil(Math.max(...rows.map((row) => {
      const cellHeights = Array.from(row.cells).map((cell) => cell.scrollHeight);
      return Math.max(row.scrollHeight, ...cellHeights);
    })));
    rows.forEach((row) => {
      row.style.height = `${maxHeight}px`;
    });
    setDetailUniformRowHeight(maxHeight);
  }, []);

  React.useLayoutEffect(() => {
    setDetailUniformRowHeight(null);
    const frameId = window.requestAnimationFrame(measureDetailTableRowHeight);
    return () => window.cancelAnimationFrame(frameId);
  }, [
    activeColumns,
    columnOrder,
    detailTableScrollX,
    filteredCompounds,
    groupStructureViewSettings,
    isStackedSplitLayout,
    measureDetailTableRowHeight,
    selectedGroupIds,
    viewMode,
  ]);

  useEffect(() => {
    const wrapper = detailTableWrapperRef.current;
    if (!wrapper) return undefined;

    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(measureDetailTableRowHeight);
    });

    observer.observe(wrapper, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [measureDetailTableRowHeight]);

  // DRAG AND DROP LOGIC
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

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

    setDraggedItemIndex(index);
    setColumnOrder(newOrder);
  };

  const onDragEnd = () => {
    setDraggedItemIndex(null);
  };

  const handleStructureSearchConfirm = (data: { smiles: string; svg: string | null }) => {
    const { smiles, svg } = data;
    console.log('Extracted Data:', { smiles, svgLength: svg?.length });

    if (svg) setSearchedSvg(svg);

    if (smiles && smiles.trim() !== '') {
      setKeyword(smiles);
    } else {
      setKeyword('Structure Search Result');
    }

    setIsStructureModalOpen(false);
  };

  return (
    <div
      className="gx-main-content"
      style={{
        maxWidth: layoutPreset.maxWidth,
        margin: '0 auto',
        padding: `0 ${layoutPreset.sidePadding}px`,
        width: '100%',
        boxSizing: 'border-box',
        height: '100%',
        overflowY: isStackedSplitLayout ? 'auto' : 'visible',
        overflowX: 'hidden'
      }}
    >
      {/* Local Filter Card (Condensed) */}
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
                  maxWidth: isStackedSplitLayout ? '100%' : 350,
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
              <Button icon={<BenzeneIcon size={18} />} onClick={() => setIsStructureModalOpen(true)} className="v-action-btn">구조 검색</Button>
            </div>
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
                    <Segmented options={['3개월', '6개월', '12개월', '전체']} value={period} onChange={(v) => setPeriod(v as string)} />
                    <RangePicker
                      format="YYYY.MM.DD"
                      style={{ borderRadius: 8 }}
                      disabled={period !== '전체'}
                    />
                  </div>
                </Space>
              </Col>
            </Row>
          </div>
        )}
      </Card>

      <div
        ref={splitContainerRef}
        style={{
          display: 'flex',
          flexDirection: isStackedSplitLayout ? 'column' : 'row',
          gap: isStackedSplitLayout ? 16 : isGroupListStructureOnly ? 12 : 0,
          minHeight: 0,
          paddingBottom: isStackedSplitLayout ? 24 : 0
        }}
      >
        {!isGroupListHidden && (
        <div
          style={{
            width: isStackedSplitLayout
              ? '100%'
              : isGroupListStructureOnly
                ? MYBOARD_GROUP_STRUCTURE_ONLY_PANEL_WIDTH
                : `calc(${splitRatio}% - 6px)`,
            flex: isGroupListStructureOnly && !isStackedSplitLayout ? `0 0 ${MYBOARD_GROUP_STRUCTURE_ONLY_PANEL_WIDTH}px` : undefined,
            minWidth: 0,
            transition: isResizingSplit ? 'none' : 'width 0.2s ease, flex-basis 0.2s ease'
          }}
        >
          <div className="v-table-card" ref={groupListTableCardRef}>
            <div className="v-table-header" style={{ padding: isGroupListStructureOnly ? '8px' : undefined, justifyContent: isGroupListStructureOnly ? 'center' : 'space-between' }}>
              {isGroupListStructureOnly ? (
                <Space size={10}>
                  <Tooltip title="그룹 리스트 완전 접기">
                    <Button
                      size="small"
                      type="text"
                      icon={<PanelLeftClose size={14} />}
                      onClick={() => setGroupListMode('hidden')}
                      style={{ width: 30, height: 28 }}
                    />
                  </Tooltip>
                  <Tooltip title="그룹 리스트 펼치기">
                    <Button
                      size="small"
                      type="text"
                      icon={<PanelLeftOpen size={14} />}
                      onClick={() => setGroupListMode('full')}
                      style={{ width: 30, height: 28 }}
                    />
                  </Tooltip>
                </Space>
              ) : (
              <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <Tooltip title="화합물 구조만 보기">
                  <Button
                    size="small"
                    type="text"
                    icon={<PanelLeftClose size={14} />}
                    onClick={() => setGroupListMode('structure')}
                  />
                </Tooltip>
                <Text strong style={{ color: token.colorPrimary }}>그룹 리스트</Text>
                <Button
                  type="primary"
                  size="small"
                  icon={<Plus size={14} />}
                  onClick={() => setIsGroupModalOpen(true)}
                  style={{
                    background: token.colorPrimary,
                    borderColor: token.colorPrimary,
                  }}
                >
                  Add Group
                </Button>
              </div>
              <Space size={8}>
                <Button
                  size="small"
                  icon={<BenzeneIcon size={14} />}
                  onClick={() => {
                    navigate('/myboard/synthesis-board');
                  }}
                >
                  합성 보드
                </Button>
              </Space>
              </>
              )}
            </div>
            <Dropdown
              open={Boolean(groupContextMenu?.open)}
              trigger={['click']}
              placement="bottomLeft"
              menu={{
                items: groupContextMenuItems,
                onClick: handleGroupContextMenuClick,
              }}
              onOpenChange={(open) => {
                if (!open) setGroupContextMenu(null);
              }}
            >
              <span
                style={{
                  display: 'block',
                  position: 'fixed',
                  left: groupContextMenu?.x ?? 0,
                  top: groupContextMenu?.y ?? 0,
                  width: 1,
                  height: 1,
                  zIndex: 9999,
                  pointerEvents: 'auto',
                }}
              />
            </Dropdown>
            <Table
              className={`my-board-table my-board-group-table${isGroupListStructureOnly ? ' my-board-group-table-structure-only' : ''}`}
              dataSource={visibleGroupRows}
              columns={isGroupListStructureOnly ? styledStructureOnlyGroupColumns : styledGroupColumns}
              pagination={false}
              size="small"
              rowKey="id"
              scroll={isGroupListStructureOnly ? undefined : { x: groupTableScrollX }}
              tableLayout="fixed"
              onRow={(record) => ({
                onClick: (event) => {
                  setIsLoading(true);
                  handleGroupRowSelection(record.id, event);
                  setTimeout(() => setIsLoading(false), 500);
                },
                onContextMenu: (event) => {
                  event.stopPropagation();
                  event.preventDefault();

                  if (!selectedGroupIds.includes(record.id)) {
                    setSelectedGroupIds([record.id]);
                  }
                  setGroupContextMenu({
                    open: true,
                    x: event.clientX,
                    y: event.clientY,
                    groupId: record.id,
                  });
                },
                style: { cursor: 'pointer' }
              })}
              rowClassName={(record) => selectedGroupIds.includes(record.id) ? 'row-selected my-board-group-row-selected' : ''}
            />
          </div>
        </div>
        )}

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="MyBoard 패널 너비 조절"
          aria-valuemin={MYBOARD_SPLIT_MIN_PERCENT}
          aria-valuemax={MYBOARD_SPLIT_MAX_PERCENT}
          aria-valuenow={Math.round(splitRatio)}
          tabIndex={0}
          onMouseDown={handleSplitMouseDown}
          onDoubleClick={fitGroupListToTableData}
          onKeyDown={handleSplitKeyDown}
          style={{
            width: 12,
            flexShrink: 0,
            cursor: 'col-resize',
            display: isStackedSplitLayout || !isGroupListFull ? 'none' : 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            outline: 'none'
          }}
        >
          <div
            style={{
              width: 4,
              height: 72,
              borderRadius: 999,
              background: isResizingSplit ? token.colorPrimary : token.colorBorder,
              transition: 'background-color 0.2s ease'
            }}
          />
        </div>

        <div style={{ flex: isStackedSplitLayout ? '0 0 auto' : 1, minWidth: 0, width: isStackedSplitLayout || isGroupListHidden ? '100%' : undefined }}>
          <div className="v-table-card">
            <div className="v-table-header" style={{ flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                {isGroupListHidden && (
                  <Tooltip title="그룹 리스트 펼치기">
                    <Button
                      size="small"
                      type="text"
                      icon={<PanelLeftOpen size={14} />}
                      onClick={() => setGroupListMode('full')}
                    />
                  </Tooltip>
                )}
                <Text strong style={{ color: token.colorPrimary }}>그룹 상세 목록</Text>
                <Space>
                  <Button
                    type="primary"
                    size="small"
                    icon={<Plus size={14} />}
                    disabled={!canAddCompound}
                    style={getCompoundActionButtonStyle(canAddCompound)}
                    onClick={() => setIsDesignModalOpen(true)}
                  >
                    Add
                  </Button>
                  <Button
                    type="primary"
                    size="small"
                    icon={<Trash2 size={14} />}
                    disabled={!canDeleteCompound}
                    style={getCompoundActionButtonStyle(canDeleteCompound)}
                    onClick={handleDeleteSelectedCompounds}
                  >
                    Del
                  </Button>
                  <Button
                    type="primary"
                    size="small"
                    icon={<Edit3 size={14} />}
                    disabled={!canEditCompound}
                    style={getCompoundActionButtonStyle(canEditCompound)}
                    onClick={handleOpenCompoundEdit}
                  >
                    Edit
                  </Button>
                  <Button
                    type="primary"
                    size="small"
                    icon={<Share2 size={14} />}
                    disabled={sarTargetCount === 0}
                    style={{ background: token.colorPrimary, borderColor: token.colorPrimary }}
                    onClick={() => {
                      setSelectedSarCompoundIds(filteredCompounds.map((compound) => compound.id));
                      navigate('/myboard/sar-table');
                    }}
                  >
                    SAR Table로 보기 ({sarTargetCount})
                  </Button>
                </Space>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flex: '1 1 auto' }}>
                <Space>
                  {viewMode === 'table' && (
                  <>
                    <div className="my-board-structure-setting-group" aria-label="화합물 구조 크기 설정">
                      <span className="my-board-structure-setting-label">Scale</span>
                      <div className="my-board-structure-setting-row">
                        <Tooltip title="구조 이미지 축소">
                          <Button
                            size="small"
                            icon={<Minus size={12} />}
                            disabled={isStructureSettingsDisabled}
                            onClick={() => changeMyBoardStructureScale(-MYBOARD_STRUCTURE_IMAGE_SCALE_STEP)}
                          />
                        </Tooltip>
                        <div className="my-board-structure-setting-value">
                          {activeStructureSettings ? `${activeStructureSettings.myBoardImageScalePercent}%` : ''}
                        </div>
                        <Tooltip title="구조 이미지 확대">
                          <Button
                            size="small"
                            icon={<Plus size={12} />}
                            disabled={isStructureSettingsDisabled}
                            onClick={() => changeMyBoardStructureScale(MYBOARD_STRUCTURE_IMAGE_SCALE_STEP)}
                          />
                        </Tooltip>
                      </div>
                    </div>
                    <Divider type="vertical" />
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
                    <Divider type="vertical" />
                  </>
                )}
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
                    icon={<ListIcon size={14} />}
                    style={getViewToggleButtonStyle('table')}
                    onClick={() => setViewMode('table')}
                  >
                    Table
                  </Button>
                  <Button
                    type="text"
                    size="small"
                    icon={<ImageIcon size={14} />}
                    style={getViewToggleButtonStyle('draw')}
                    onClick={() => setViewMode('draw')}
                  >
                    Canvas
                  </Button>
                  <Button
                    type="text"
                    size="small"
                    icon={<GitBranch size={14} />}
                    style={getViewToggleButtonStyle('tree')}
                    onClick={() => setViewMode('tree')}
                  >
                    Tree
                  </Button>
                  </div>
                </Space>
              </div>
            </div>
            {viewMode === 'table' ? (
              <>
              <Dropdown
                open={Boolean(compoundContextMenu?.open)}
                trigger={['click']}
                placement="bottomLeft"
                menu={{
                  items: compoundContextMenuItems,
                  onClick: handleCompoundContextMenuClick,
                }}
                onOpenChange={(open) => {
                  if (!open) setCompoundContextMenu(null);
                }}
              >
                <span
                  style={{
                    position: 'fixed',
                    left: compoundContextMenu?.x ?? 0,
                    top: compoundContextMenu?.y ?? 0,
                    width: 1,
                    height: 1,
                    zIndex: 9999,
                    pointerEvents: 'auto',
                  }}
                />
              </Dropdown>
              <div ref={detailTableWrapperRef}>
                <Table
                  className="my-board-table my-board-detail-table"
                  dataSource={selectedGroupIds.length > 0 ? filteredCompounds : []}
                  columns={styledDynamicCompoundColumns}
                  size="small"
                  rowKey="id"
                  pagination={{
                    defaultPageSize: 10,
                    showSizeChanger: true,
                    pageSizeOptions: [10, 30, 50, 100],
                  }}
                  loading={isLoading}
                  scroll={{ x: detailTableScrollX, y: isStackedSplitLayout ? undefined : 'calc(100vh - 430px)' }}
                  tableLayout="fixed"
                  onRow={(record) => ({
                    onClick: (event) => {
                      const target = event.target as HTMLElement;
                      if (target.closest('button, a, input, textarea, .ant-checkbox-wrapper, .ant-select, .ant-dropdown')) return;
                      handleDetailCompoundRowSelection(record.id, event);
                    },
                    onContextMenu: (event) => {
                      event.stopPropagation();
                      event.preventDefault();

                      if (!selectedDetailCompoundIds.includes(record.id)) {
                        setSelectedDetailCompoundIds([record.id]);
                      }
                      setCompoundContextMenu({
                        open: true,
                        x: event.clientX,
                        y: event.clientY,
                        compoundId: record.id,
                      });
                    },
                    style: {
                      cursor: 'pointer',
                      ...(detailUniformRowHeight ? { height: detailUniformRowHeight } : {}),
                    },
                  })}
                  rowClassName={(record) => selectedDetailCompoundIds.includes(record.id) ? 'row-selected my-board-detail-row-selected' : ''}
                  locale={{ emptyText: selectedGroupIds.length === 0 ? '왼쪽 그룹 리스트에서 그룹을 선택해 주세요.' : '검색 결과가 없습니다.' }}
                />
              </div>
              </>
            ) : viewMode === 'draw' ? (
              <div style={{ padding: 16 }}>
                <WhiteboardEditor
                  height={650}
                  compounds={filteredCompounds}
                  searchedSvg={searchedSvg}
                  searchKeyword={keyword}
                />
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: token.colorTextTertiary }}>Tree View 준비 중...</div>
            )}
          </div>
        </div>
      </div>

      {/* Create Group Modal */}
      <Modal
        title="신규 그룹 등록"
        open={isGroupModalOpen}
        onCancel={() => setIsGroupModalOpen(false)}
        onOk={() => setIsGroupModalOpen(false)}
        okText="생성"
        cancelText="취소"
      >
        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="그룹 이름" required>
            <Input placeholder="그룹 이름을 입력하세요" />
          </Form.Item>
          <Form.Item label="타겟/프로젝트">
            <Select placeholder="타켓 선택">
              {projectList.map(p => <Option key={p} value={p}>{p}</Option>)}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="그룹 간 통합"
        open={isMergeGroupModalOpen}
        okText="통합"
        cancelText="취소"
        onCancel={() => setIsMergeGroupModalOpen(false)}
        onOk={() => {
          const nextName = mergeGroupName.trim();
          if (!nextName || selectedGroupIds.length < 2) return;
          mergeGroups(selectedGroupIds, nextName);
          setIsMergeGroupModalOpen(false);
        }}
      >
        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="통합 그룹 이름" required>
            <Input
              value={mergeGroupName}
              onChange={(event) => setMergeGroupName(event.target.value)}
              placeholder="통합 그룹 이름을 입력하세요"
            />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 11 }}>
            선택된 {selectedGroupIds.length}개의 그룹을 하나의 그룹으로 통합합니다.
          </Text>
        </Form>
      </Modal>

      <Modal
        title={compoundGroupAction === 'move' ? '다른 그룹으로 이동' : '다른 그룹으로 복제'}
        open={isCompoundGroupSelectModalOpen}
        okText={compoundGroupAction === 'move' ? '이동' : '복제'}
        cancelText="취소"
        onCancel={() => setIsCompoundGroupSelectModalOpen(false)}
        onOk={handleApplyCompoundGroupAction}
        okButtonProps={{ disabled: !selectedCompoundTargetGroupId || selectedDetailCompoundIds.length === 0 }}
      >
        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="대상 그룹" required>
            <Select
              placeholder="그룹 선택"
              value={selectedCompoundTargetGroupId}
              onChange={setSelectedCompoundTargetGroupId}
            >
              {groups.map((group) => (
                <Option key={group.id} value={group.id}>{group.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 11 }}>
            선택된 {selectedDetailCompoundIds.length}개의 화합물을 {compoundGroupAction === 'move' ? '선택한 그룹으로 이동합니다.' : '선택한 그룹에 복제합니다.'}
          </Text>
        </Form>
      </Modal>

      <Modal
        title="화합물 수정"
        open={isCompoundEditModalOpen}
        okText="저장"
        cancelText="취소"
        onCancel={() => setIsCompoundEditModalOpen(false)}
        onOk={() => setIsCompoundEditModalOpen(false)}
        width={760}
        destroyOnHidden
      >
        {selectedEditableCompound ? (
          <Form layout="vertical" style={{ marginTop: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="물질 번호">
                  <Input defaultValue={selectedEditableCompound.compoundId} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="단계">
                  <Input defaultValue={selectedEditableCompound.experimentStage} />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item label="구조">
                  <Input.TextArea
                    rows={3}
                    defaultValue={selectedEditableCompound.smiles}
                    disabled={isSelectedCompoundSynthesized}
                    placeholder={isSelectedCompoundSynthesized ? '합성 후 화합물은 구조를 수정할 수 없습니다.' : 'SMILES 또는 구조 정보를 입력하세요.'}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="계산값">
                  <Input value="계산값은 수정할 수 없습니다." disabled />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="실험값">
                  <Input
                    value={isSelectedCompoundSynthesized ? '합성 후 화합물은 실험값을 수정할 수 없습니다.' : '실험값은 수정할 수 없습니다.'}
                    disabled
                  />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item label="세부 정보">
                  <Input.TextArea rows={3} defaultValue={selectedEditableCompound.designMemo} />
                </Form.Item>
              </Col>
            </Row>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {isSelectedCompoundSynthesized
                ? '합성 후 화합물은 세부 정보만 수정할 수 있습니다.'
                : '합성 전 화합물은 구조와 세부 정보를 수정할 수 있으며 계산값은 수정할 수 없습니다.'}
            </Text>
          </Form>
        ) : null}
      </Modal>

      {/* Create Design Modal */}
      <Modal
        title="디자인 등록 (Create Design)"
        open={isDesignModalOpen}
        onCancel={() => {
          setIsDesignModalOpen(false);
          setCdjsInstance(null);
        }}
        onOk={async () => {
          await cdjsInstance?.__flushPendingInput?.();
          setIsDesignModalOpen(false);
          setCdjsInstance(null);
        }}
        okButtonProps={{
          disabled: !cdjsInstance,
          onMouseDown: (event: React.MouseEvent<HTMLElement>) => {
            event.preventDefault();
            void cdjsInstance?.__flushPendingInput?.();
          },
        }}
        okText="등록"
        cancelText="취소"
        width={1200}
        style={{ top: 40 }}
        destroyOnHidden
      >
        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={24}>
            <Col span={8}>
              <Form.Item label="Group" tooltip="선택된 그룹이 자동 지정됩니다.">
                <Select
                  mode="multiple"
                  placeholder="그룹 선택"
                  value={assignedGroupIds}
                  onChange={(ids) => {
                    setAssignedGroupIds(ids);
                  }}
                >
                  {groups.map(g => <Option key={g.id} value={g.id}>{g.name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Source" required rules={[{ required: true, message: '출처를 선택하거나 입력해주세요' }]}>
                <Select placeholder="출처 선택" showSearch allowClear>
                  {sourceList.map(s => <Option key={s} value={s}>{s}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Name" required rules={[{ required: true, message: '이름을 입력해주세요' }]}>
                <Input placeholder="디자인 이름을 입력하세요 (예: VNA-12345)" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="SMILES" required rules={[{ required: true, message: 'SMILES 상식을 입력해주세요' }]}>
                <Input.TextArea
                  rows={2}
                  placeholder="SMILES 문자열을 입력하세요"
                  value={designSmiles}
                  onChange={(e) => setDesignSmiles(e.target.value)}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="Draw (Structure)" required style={{ marginBottom: 0, marginTop: 4 }}>
                <ChemDrawEditor
                  active={isDesignModalOpen}
                  height={420}
                  flipControlsPlacement="left"
                  smilesValue={designSmiles}
                  onSmilesChange={setDesignSmiles}
                  onReady={setCdjsInstance}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '24px 0 16px 0' }} />

          <Form.Item
            label={(
              <Space size={8}>
                <Text strong><Activity size={14} style={{ marginRight: 6 }} />Calculations (다중 선택)</Text>
                <ToggleTag
                  checked={areAllCalculationsSelected}
                  onChange={(checked) => {
                    setSelectedCalculations(checked ? [...calculationOptions] : []);
                  }}
                  style={{ minHeight: 24, padding: '2px 10px', fontSize: 10, marginInlineEnd: 0 }}
                >
                  All
                </ToggleTag>
              </Space>
            )}
          >
            <div
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: token.colorBgLayout,
                padding: 16,
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                {calculationOptions.map(item => (
                  <ToggleTag
                    key={item}
                    checked={selectedCalculations.includes(item)}
                    onChange={(checked) => {
                      setSelectedCalculations((prev) => (
                        checked ? [...prev, item] : prev.filter(value => value !== item)
                      ));
                    }}
                    style={{
                      width: '100%',
                      minHeight: 30,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      whiteSpace: 'normal',
                      lineHeight: 1.25,
                    }}
                  >
                    {item}
                  </ToggleTag>
                ))}
              </div>
            </div>
            <Text type="secondary" style={{ fontSize: '11px', marginTop: 8, display: 'block' }}>
              * 체크된 항목은 API를 통해 계산 결과가 리포트에 포함됩니다.
            </Text>
          </Form.Item>

          <Form.Item label="Memo (Notes)">
            <Input.TextArea rows={2} placeholder="디자인 의도나 참고 사항을 입력하세요" />
          </Form.Item>

          <Form.Item label="Attachment (첨부파일)">
            <Upload.Dragger multiple showUploadList={true} beforeUpload={() => false}>
              <p className="ant-upload-drag-icon" style={{ color: token.colorPrimary }}>
                <UploadIcon size={32} />
              </p>
              <p className="ant-upload-text">파일을 클릭하거나 이 영역으로 드래그하여 업로드하세요</p>
              <p className="ant-upload-hint">실험 데이터, 문서 또는 관련 이미지 등 디자인을 보충할 파일을 첨부할 수 있습니다.</p>
            </Upload.Dragger>
          </Form.Item>
        </Form>
      </Modal>

      {/* Settings Modal (Interactive DND) */}
      <Modal
        className="my-board-settings-modal"
        title="테이블 컬럼 설정 (드래그하여 순서 변경)"
        open={isSettingsModalOpen}
        onCancel={() => setIsSettingsModalOpen(false)}
        styles={{
          body: {
            maxHeight: 'min(70vh, 920px)',
            overflowY: 'auto',
            paddingRight: 16,
          }
        }}
        footer={[
          <Button key="save" type="primary" onClick={handleSavePreset} style={{ background: token.colorPrimary, borderColor: token.colorPrimary, marginRight: 8 }}>
            {activePreset}번 프리셋에 저장
          </Button>,
          <Button key="ok" type="default" onClick={() => setIsSettingsModalOpen(false)}>완료</Button>
        ]}
      >
        <div style={{ padding: '10px 0' }}>
          <div style={{ marginBottom: 24 }}>
            <Text strong style={{ display: 'block', marginBottom: 12 }}>설정 프리셋 선택</Text>
            <div style={{ display: 'flex', gap: 12 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <Button
                  key={n}
                  type={activePreset === n ? 'primary' : 'default'}
                  onClick={() => applyPreset(n)}
                  style={{
                    width: 44, height: 44, borderRadius: 8,
                    background: activePreset === n ? token.colorPrimary : token.colorBgContainer,
                    borderColor: activePreset === n ? token.colorPrimary : token.colorBorder,
                    color: activePreset === n ? token.colorBgContainer : 'inherit'
                  }}
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>
          <Text strong style={{ display: 'block', marginBottom: 4 }}>Column Order & Visibility</Text>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 11 }}>
            현재 {currentUser.team} 권한입니다.
          </Text>
          {columnOrder.map((item, index) => (
            <div
              key={item}
              draggable
              onDragStart={() => onDragStart(index)}
              onDragOver={(e) => onDragOver(e, index)}
              onDragEnd={onDragEnd}
              style={{
                padding: '12px 16px',
                marginBottom: 8,
                background: draggedItemIndex === index ? token.colorPrimaryBg : token.colorBgContainer,
                border: draggedItemIndex === index ? `1px dashed ${token.colorBorderSecondary}` : `1px solid ${token.colorBorderSecondary}`,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'grab',
                opacity: draggedItemIndex === index ? 0.6 : 1,
                transition: 'all 0.2s ease',
                boxShadow: draggedItemIndex === index ? '0 4px 12px rgba(248, 124, 99, 0.1)' : 'none'
              }}
            >
              <Space>
                <GripVertical size={16} color={token.colorTextTertiary} />
                <Text strong={draggedItemIndex === index}>{item}</Text>
              </Space>
              <ToggleTag
                checked={activeColumns.includes(item)}
                onChange={() => toggleColumn(item)}
                style={{ marginInlineEnd: 0 }}
              >
                {activeColumns.includes(item) ? 'ON' : 'OFF'}
              </ToggleTag>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, padding: '12px', background: token.colorBgLayout, borderRadius: 8 }}>
          <Text type="secondary" style={{ fontSize: '11px' }}>
            <Info size={12} style={{ marginRight: 4 }} />
            목록을 마우스로 끌어서 테이블 컬럼의 표시 순서를 변경할 수 있습니다.
          </Text>
        </div>
      </Modal>

      {/* Search by Structure Modal */}
      <ChemDrawModal
        open={isStructureModalOpen}
        onCancel={() => setIsStructureModalOpen(false)}
        onConfirm={handleStructureSearchConfirm}
        title="구조 검색"
        confirmText="이 구조로 검색"
      />

      <Modal
        title={structurePreview?.title || 'Structure'}
        open={!!structurePreview}
        onCancel={() => setStructurePreview(null)}
        footer={null}
        width="min(1200px, calc(100vw - 48px))"
        centered
      >
        {structurePreview ? (
          <div
            className="my-board-structure-preview"
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
            dangerouslySetInnerHTML={{ __html: structurePreview.svg }}
          />
        ) : null}
      </Modal>
      <style>{`
        .ant-table-tbody > tr:hover > td {
          background-color: var(--table-row-hover-bg) !important;
          cursor: pointer;
        }
        .my-board-group-row-selected > td {
          background-color: var(--table-row-selected-bg) !important;
        }
        .my-board-group-row-selected:hover > td {
          background-color: var(--table-row-selected-hover-bg) !important;
        }
        .my-board-detail-row-selected > td {
          background-color: var(--table-row-selected-bg) !important;
        }
        .my-board-detail-row-selected:hover > td {
          background-color: var(--table-row-selected-hover-bg) !important;
        }
        .my-board-detail-table .ant-table-tbody > tr > td.my-board-structure-column {
          padding: 4px !important;
          line-height: 0 !important;
          overflow: visible !important;
          vertical-align: middle !important;
        }
        .my-board-detail-table .ant-table-thead > tr > th.my-board-structure-column {
          padding-left: 4px !important;
          padding-right: 4px !important;
        }
        .my-board-group-table .ant-table-tbody > tr > td.my-board-structure-column {
          padding: 1px 2px !important;
          line-height: 0 !important;
          vertical-align: middle !important;
        }
        .my-board-group-table .ant-table-tbody .my-board-representative-structure,
        .my-board-group-table .ant-table-tbody .my-board-representative-structure .compound-structure-view,
        .my-board-group-table .ant-table-tbody .my-board-representative-structure .compound-structure-frame {
          line-height: 0 !important;
        }
        .my-board-group-table .ant-table-thead > tr > th.my-board-structure-column {
          padding-left: 4px !important;
          padding-right: 4px !important;
        }
        .my-board-table .my-board-structure-column .compound-structure-actions-overlay {
          top: auto;
          right: 4px;
          bottom: 4px;
        }
        .my-board-table .my-board-structure-column .compound-structure-frame {
          border: 0 !important;
          outline: 0 !important;
          box-shadow: none !important;
          background: transparent !important;
        }
        .my-board-structure-setting-row {
          display: inline-grid;
          grid-template-columns: 24px 42px 24px;
          align-items: center;
          gap: 4px;
        }
        .my-board-structure-setting-group {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 28px;
          padding: 3px 6px;
          border: 1px solid ${token.colorBorderSecondary};
          border-radius: 6px;
          background: ${token.colorBgLayout};
          box-sizing: border-box;
        }
        .my-board-structure-setting-label {
          min-width: 42px;
          color: ${token.colorTextSecondary};
          font-size: 10px;
          font-weight: 600;
          line-height: 18px;
          text-align: left;
          user-select: none;
        }
        .my-board-structure-setting-row .ant-btn {
          width: 24px;
          height: 20px;
          min-width: 24px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 2px;
        }
        .my-board-structure-setting-value {
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
        .my-board-group-table-structure-only .ant-table-tbody .my-board-representative-structure {
          width: 100% !important;
          margin: 0 !important;
        }
        }
        .my-board-group-table-structure-only .ant-table-tbody .compound-structure-view {
          width: 100% !important;
          margin: 0 !important;
        }
        .my-board-group-table-structure-only .ant-table-tbody .compound-structure-frame {
          width: ${MYBOARD_GROUP_STRUCTURE_WIDTH}px !important;
          height: ${MYBOARD_GROUP_STRUCTURE_HEIGHT}px !important;
          overflow: visible !important;
        }
        .my-board-group-table-structure-only .ant-table-thead > tr > th {
          text-align: center !important;
        }
        .my-board-group-table-structure-only .ant-table-container,
        .my-board-group-table-structure-only .ant-table-content {
          overflow: visible !important;
        }
        .my-board-structure-preview > svg {
          width: 100% !important;
          height: 100% !important;
          max-width: 100%;
          max-height: 100%;
          display: block;
        }
        .my-board-detail-table .ant-table-body {
          scrollbar-gutter: stable;
          overflow-y: auto !important;
        }
        .my-board-detail-table .ant-pagination {
          padding-right: 16px;
          box-sizing: border-box;
        }
        .my-board-settings-modal .ant-modal-body {
          scrollbar-width: thin;
          scrollbar-color: ${token.colorBorder} transparent;
        }
        .my-board-settings-modal .ant-modal-body::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .my-board-settings-modal .ant-modal-body::-webkit-scrollbar-track {
          background: transparent;
        }
        .my-board-settings-modal .ant-modal-body::-webkit-scrollbar-thumb {
          background-color: ${token.colorBorder};
          border: 3px solid transparent;
          border-radius: 999px;
          background-clip: content-box;
        }
        .my-board-settings-modal .ant-modal-body::-webkit-scrollbar-thumb:hover {
          background-color: ${token.colorTextQuaternary};
        }
        .my-board-bookmark-button {
          width: 24px;
          height: 24px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: ${token.colorTextQuaternary};
          border: 1px solid transparent;
          transition: background-color 0.16s ease, color 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
        }
        .my-board-bookmark-icon {
          width: 14px;
          height: 14px;
          display: inline-block;
          background-color: currentColor;
          -webkit-mask: url("${bookmarkIconMaskUrl}") center / contain no-repeat;
          mask: url("${bookmarkIconMaskUrl}") center / contain no-repeat;
        }
        .my-board-bookmark-button:hover .my-board-bookmark-icon,
        .my-board-bookmark-button:focus .my-board-bookmark-icon,
        .my-board-bookmark-button:focus-visible .my-board-bookmark-icon,
        .my-board-bookmark-button:active .my-board-bookmark-icon {
          color: inherit !important;
          background-color: currentColor !important;
        }
        .my-board-bookmark-button:not(.active):hover .my-board-bookmark-icon,
        .my-board-bookmark-button:not(.active):focus .my-board-bookmark-icon,
        .my-board-bookmark-button:not(.active):focus-visible .my-board-bookmark-icon,
        .my-board-bookmark-button:not(.active):active .my-board-bookmark-icon {
          color: ${token.colorTextQuaternary} !important;
          background-color: ${token.colorTextQuaternary} !important;
        }
        .my-board-bookmark-button.active:hover .my-board-bookmark-icon,
        .my-board-bookmark-button.active:focus .my-board-bookmark-icon,
        .my-board-bookmark-button.active:focus-visible .my-board-bookmark-icon,
        .my-board-bookmark-button.active:active .my-board-bookmark-icon {
          color: ${token.colorPrimary} !important;
          background-color: ${token.colorPrimary} !important;
        }
        .my-board-bookmark-button.active {
          color: ${token.colorPrimary};
          background: transparent !important;
          border-color: transparent;
          box-shadow: none;
          outline: 0;
        }
        .my-board-bookmark-button:hover {
          color: ${token.colorTextQuaternary};
          background: transparent !important;
        }
        .my-board-bookmark-button:focus,
        .my-board-bookmark-button:focus-visible,
        .my-board-bookmark-button:active {
          background: transparent !important;
          box-shadow: none !important;
          outline: 0 !important;
        }
        .my-board-bookmark-button.active:hover,
        .my-board-bookmark-button.active:focus-visible {
          color: ${token.colorPrimary};
          background: transparent !important;
          border-color: transparent;
          box-shadow: none;
          outline: 0;
        }
        .canvas-card:hover { border-color: ${token.colorPrimary} !important; transform: translateY(-4px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .cdd-clipboard-icon-container, .CDW_Logo, .cdd-logo { display: none !important; }
        .my-board-structure-preview svg {
          max-width: calc(100% / 1.5) !important;
          max-height: calc(100% / 1.5) !important;
          width: auto;
          height: auto;
          display: block;
          transform: scale(1.5);
          transform-origin: center;
        }
      `}</style>
    </div>
  );
};

export default MyBoard;
