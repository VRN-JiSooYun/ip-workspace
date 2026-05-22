import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Row, Col, Card, Table, Button, Input,
  Space, Modal, Form, Tag, Select, DatePicker, Avatar, Divider, Segmented, theme
} from 'antd';
import {
  Search, ChevronDown, ChevronUp,
  Settings, Download, Share2, Info, GripVertical, CheckCircle2, XCircle, ArrowLeft
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { mockCompounds } from '../mocks/compounds';
import { useBoardStore } from '../store/useBoardStore';
import { getPatentAnalysisLayoutPreset } from '../config/patentAnalysisLayout';
import dayjs from 'dayjs';
import { useUIStore } from '../store/useUIStore';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import BenzeneIcon from '../components/common/BenzeneIcon';
import ChemDrawModal from '../components/common/ChemDrawModal';
import ToggleTag from '../components/common/ToggleTag';
import CompoundStructureView from '../components/common/CompoundStructureView';

const { Title, Text } = Typography;

const SAR_COMPOUND_CARD_GAP = 6;
const SAR_COMPOUND_CARD_GRID_COLUMN_GAP = 4;
const SAR_COMPOUND_CARD_GRID_ROW_GAP = 6;
const SAR_COMPOUND_CARD_BASE_WIDTH = 200;
const SAR_COMPOUND_CARD_BASE_STRUCTURE_HEIGHT = 148;
const SAR_COMPOUND_CARD_EXPANDED_WIDTH = SAR_COMPOUND_CARD_BASE_WIDTH * 2;
const SAR_COMPOUND_CARD_EXPANDED_STRUCTURE_HEIGHT = SAR_COMPOUND_CARD_BASE_STRUCTURE_HEIGHT * 2;

const SarTable: React.FC = () => {
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const { isDarkMode } = useTheme();
  const { selectedSarCompoundIds } = useBoardStore();
  const { setHeaderContent } = useUIStore();

  useEffect(() => {
    setHeaderContent(
      <PageHeaderBreadcrumb 
        items={[
          { label: 'Compounds' },
          { label: 'My board', onClick: () => navigate('/myboard') },
          { label: 'SAR Table' }
        ]} 
      />
    );
    return () => setHeaderContent(null);
  }, [setHeaderContent, navigate]);

  const [keyword, setKeyword] = useState<string>('');

  const sarCompounds = useMemo(() => {
    let base = selectedSarCompoundIds.length === 0 
      ? mockCompounds 
      : mockCompounds.filter((compound) => selectedSarCompoundIds.includes(compound.id));
    
    if (keyword) {
      base = base.filter(c => 
        c.id.toLowerCase().includes(keyword.toLowerCase()) ||
        c.name.toLowerCase().includes(keyword.toLowerCase()) ||
        c.smiles?.toLowerCase().includes(keyword.toLowerCase())
      );
    }
    return base;
  }, [selectedSarCompoundIds, keyword]);

  const [isColorActive, setIsColorActive] = useState(false);
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [hoveredRowKey, setHoveredRowKey] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isStructureModalOpen, setIsStructureModalOpen] = useState(false);
  const [structurePreview, setStructurePreview] = useState<{ title: string; svg: string } | null>(null);
  const [searchedSvg, setSearchedSvg] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<number>(1);
  const [compoundCardViewMode, setCompoundCardViewMode] = useState<'single' | 'twoRows'>('single');
  const [viewportWidth, setViewportWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 1920;
    return window.innerWidth;
  });
  const layoutPreset = useMemo(() => getPatentAnalysisLayoutPreset(viewportWidth), [viewportWidth]);
  const isResponsiveToolbar = viewportWidth <= 1100;

  useEffect(() => {
    if (sarCompounds.length === 0) {
      setSelectedRowKey(null);
      return;
    }

    const hasSelectedRow = sarCompounds.some((compound) => compound.id === selectedRowKey);
    if (!hasSelectedRow) {
      setSelectedRowKey(sarCompounds[0].id);
    }
  }, [sarCompounds, selectedRowKey]);

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
  }, [selectedRowKey, compoundCardViewMode, sarCompounds.length]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const selectCompoundByKeyboard = (key: string) => {
    if (sarCompounds.length === 0) return false;

    const currentIndex = Math.max(0, sarCompounds.findIndex((compound) => compound.id === selectedRowKey));
    let nextIndex = currentIndex;

    if (compoundCardViewMode === 'twoRows') {
      const columnCount = Math.ceil(sarCompounds.length / 2);

      if (key === 'ArrowRight') {
        nextIndex = Math.min(sarCompounds.length - 1, currentIndex + 1);
      } else if (key === 'ArrowLeft') {
        nextIndex = Math.max(0, currentIndex - 1);
      } else if (key === 'ArrowDown') {
        nextIndex = currentIndex + columnCount < sarCompounds.length ? currentIndex + columnCount : currentIndex;
      } else if (key === 'ArrowUp') {
        nextIndex = currentIndex - columnCount >= 0 ? currentIndex - columnCount : currentIndex;
      } else if (key === 'Home') {
        nextIndex = 0;
      } else if (key === 'End') {
        nextIndex = sarCompounds.length - 1;
      } else {
        return false;
      }
    } else if (key === 'ArrowRight' || key === 'ArrowDown') {
      nextIndex = Math.min(sarCompounds.length - 1, currentIndex + 1);
    } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
      nextIndex = Math.max(0, currentIndex - 1);
    } else if (key === 'Home') {
      nextIndex = 0;
    } else if (key === 'End') {
      nextIndex = sarCompounds.length - 1;
    } else {
      return false;
    }

    const nextCompound = sarCompounds[nextIndex];
    if (nextCompound) {
      setSelectedRowKey(nextCompound.id);
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
      if (isSettingsModalOpen || isStructureModalOpen || structurePreview) return;

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
    isSettingsModalOpen,
    isStructureModalOpen,
    sarCompounds,
    selectedRowKey,
    structurePreview,
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
        padding: '10px 4px',
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
        { title: 'Target', dataIndex: 'target', key: 'target', width: 80, render: (text: string) => <Tag color="blue" style={{ fontSize: 11 }}>{text}</Tag> },
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
    const centerColumn = (column: any): any => ({
      ...column,
      align: 'center' as const,
      className: [column.className, 'table-center-column'].filter(Boolean).join(' '),
      children: column.children?.map(centerColumn),
    });

    return columnOrder
      .filter(key => activeColumns.includes(key))
      .map(key => {
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
        return col;
      });
  }, [columnOrder, activeColumns, subColumnConfig, isColorActive, isDarkMode, token]);

  const compoundCardWidth = compoundCardViewMode === 'twoRows'
    ? SAR_COMPOUND_CARD_BASE_WIDTH
    : SAR_COMPOUND_CARD_EXPANDED_WIDTH;
  const compoundCardStructureHeight = compoundCardViewMode === 'twoRows'
    ? SAR_COMPOUND_CARD_BASE_STRUCTURE_HEIGHT
    : SAR_COMPOUND_CARD_EXPANDED_STRUCTURE_HEIGHT;

  return (
    <div
      className="gx-main-content"
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
              icon={<ArrowLeft size={18} />}
              className="v-action-btn"
              onClick={() => navigate(-1)}
              style={{ width: isResponsiveToolbar ? '100%' : undefined }}
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

      {/* Compound Cards Slider (Prototype Style) */}
      <div style={{
        padding: '16px',
        background: token.colorBgContainer,
        borderRadius: 12,
        marginBottom: 20,
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <Space size={8}>
            <BenzeneIcon size={16} color={token.colorPrimary} />
            <Text strong>화합물</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>{sarCompounds.length} compounds</Text>
          </Space>
          <Segmented
            size="small"
            value={compoundCardViewMode}
            onChange={(value) => setCompoundCardViewMode(value as 'single' | 'twoRows')}
            options={[
              { label: '기본', value: 'single' },
              { label: '2줄', value: 'twoRows' },
            ]}
          />
        </div>
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
        <div style={compoundCardViewMode === 'twoRows' ? {
          display: 'grid',
          gridAutoFlow: 'row',
          gridTemplateColumns: `repeat(${Math.ceil(sarCompounds.length / 2)}, ${SAR_COMPOUND_CARD_BASE_WIDTH}px)`,
          gridTemplateRows: 'repeat(2, minmax(0, 1fr))',
          gridAutoRows: 'auto',
          columnGap: SAR_COMPOUND_CARD_GRID_COLUMN_GAP,
          rowGap: SAR_COMPOUND_CARD_GRID_ROW_GAP,
          width: 'max-content',
        } : {
          display: 'inline-flex',
          gap: SAR_COMPOUND_CARD_GAP,
        }}>
          {sarCompounds.map((item) => (
            <div
              id={`sar-compound-card-${item.id}`}
              key={item.id}
              onClick={() => setSelectedRowKey(item.id)}
              onDoubleClick={() => {
                if (item.structureSvg) {
                  setStructurePreview({ title: item.name, svg: item.structureSvg });
                }
              }}
              role="option"
              aria-selected={selectedRowKey === item.id}
              className={`v-item-card sar-compound-card ${selectedRowKey === item.id ? 'selected' : ''} ${hoveredRowKey === item.id ? 'hovered' : ''}`}
              onMouseEnter={() => setHoveredRowKey(item.id)}
              onMouseLeave={() => setHoveredRowKey(null)}
              style={{
                width: compoundCardWidth,
                padding: 0,
                textAlign: 'center',
                cursor: 'pointer',
                background: selectedRowKey === item.id || hoveredRowKey === item.id ? (isDarkMode ? '#111d2c' : '#e6f7ff') : token.colorBgContainer,
                boxSizing: 'border-box',
                borderColor: 'transparent',
              }}
            >
              <div style={{
                height: compoundCardStructureHeight,
                background: token.colorBgContainer,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                marginBottom: compoundCardViewMode === 'twoRows' ? 4 : 6,
                overflow: 'hidden',
              }}>
                <CompoundStructureView
                  svg={item.structureSvg}
                  title={item.name}
                  smiles={item.smiles}
                  molBlock={(item as any).molBlock ?? (item as any).mol_block ?? (item as any).molblock}
                  width={compoundCardWidth}
                  height={compoundCardStructureHeight}
                  iconSize={48}
                  showPreviewAction={false}
                  showCopyAction={false}
                  frameStyle={{ borderColor: 'transparent', background: token.colorBgContainer }}
                />
              </div>
              <Text strong style={{ fontSize: 12, lineHeight: '16px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.name}>
                {item.name}
              </Text>
            </div>
          ))}
        </div>
        </div>
      </div>

      {/* Main SAR Table (Multi-level Header) */}
      <div className="v-table-card sar-table-card">
        <div className="v-table-header">
          <Space>
            <div
              style={{
                width: 28, height: 28,
                background: isColorActive ? token.colorPrimary : token.colorBgContainer,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                border: isColorActive ? `1px solid ${token.colorBorderSecondary}` : `1px solid ${token.colorBorderSecondary}`,
                fontSize: 12,
                fontWeight: 'bold',
                color: isColorActive ? token.colorBgContainer : token.colorText
              }}
              onClick={() => setIsColorActive(!isColorActive)}
            >
              C
            </div>
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
                    fontSize: 11,
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
          dataSource={sarCompounds}
          columns={dynamicColumns}
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ x: 1800, y: sarCompounds.length > 10 ? 500 : undefined }}
          onRow={(record) => ({
            id: `sar-table-row-${record.id}`,
            onClick: () => setSelectedRowKey(record.id),
            onMouseEnter: () => setHoveredRowKey(record.id),
            onMouseLeave: () => setHoveredRowKey(null)
          })}
          rowClassName={(record) => {
            let classes = [];
            if (record.id === selectedRowKey) classes.push('sar-row-selected');
            if (record.id === hoveredRowKey) classes.push('sar-row-hovered');
            return classes.join(' ');
          }}
        />
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
            <Text type="secondary" style={{ fontSize: 12 }}>
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
                          fontSize: 12
                        }}
                      >
                        <Space>
                          <GripVertical size={12} color={token.colorBorder} />
                          <Text 
                            style={{ 
                              fontSize: 12, 
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
            className="sar-structure-preview"
            style={{
              height: 'min(720px, calc(100vh - 180px))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: token.colorBgContainer,
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: 8,
              overflow: 'hidden'
            }}
            dangerouslySetInnerHTML={{ __html: structurePreview.svg }}
          />
        ) : null}
      </Modal>

      <style>{`
        .sar-structure-svg {
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
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
          width: 100% !important;
          height: 100% !important;
          object-fit: contain;
        }
        .sar-structure-svg {
          width: 100%;
          height: 100%;
          max-width: none;
          max-height: none;
        }
        .sar-structure-preview svg {
          display: block;
          max-width: calc(100% / 1.5);
          max-height: calc(100% / 1.5);
          width: auto;
          height: auto;
          transform: scale(1.5);
          transform-origin: center;
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
        .ant-table-thead > tr > th {
          background: var(--table-header-bg) !important;
          color: ${isDarkMode ? 'rgba(255,255,255,0.85)' : '#495057'} !important;
          text-align: center !important;
          border-color: ${isDarkMode ? '#303030' : '#f0f0f0'} !important;
          font-size: 12px;
          font-weight: 600;
          padding: 12px 4px !important;
        }
        .ant-table-thead > tr:first-child > th {
          color: #F87C63 !important;
          border-bottom: 1px solid ${isDarkMode ? '#303030' : '#f0f0f0'} !important;
        }
        .ant-table-tbody > tr > td {
          padding: 10px 4px !important;
          text-align: center !important;
          font-size: 12px;
          border-color: ${isDarkMode ? '#303030' : '#f0f0f0'} !important;
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
        .sar-compound-card {
          border-color: transparent !important;
          box-shadow: none;
        }
        .sar-compound-card:hover {
          border-color: ${token.colorPrimary} !important;
          background-color: ${isDarkMode ? '#1a1a1a' : '#f9f9f9'} !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .sar-compound-card.selected {
          border-color: ${token.colorPrimary} !important;
          box-shadow: 0 0 0 1px ${token.colorPrimary};
        }
        .sar-compound-card.selected:hover {
          background-color: ${isDarkMode ? '#111d2c' : '#e6f7ff'} !important;
        }
        .sar-compound-card.hovered {
          border-color: ${token.colorPrimary} !important;
          background-color: ${isDarkMode ? '#111d2c' : '#e6f7ff'} !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .sar-compound-card-list:focus,
        .sar-compound-card-list:focus-visible,
        .sar-compound-card:focus,
        .sar-compound-card:focus-visible {
          outline: none !important;
          box-shadow: none;
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
