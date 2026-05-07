import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Row, Col, Card, Table, Button, Input, Checkbox,
  Space, DatePicker, Segmented, Modal, Divider, Tag, theme
} from 'antd';
import {
  Search, FlaskConical, ChevronDown, ChevronUp, Beaker,
  Settings, Download, Share2, Info, GripVertical, CheckCircle2, XCircle
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { mockCompounds } from '../mocks/compounds';
import { useBoardStore } from '../store/useBoardStore';
import { getPatentAnalysisLayoutPreset } from '../config/patentAnalysisLayout';
import dayjs from 'dayjs';
import { useUIStore } from '../store/useUIStore';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';

const { Title, Text } = Typography;

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

  const sarCompounds = useMemo(() => {
    if (selectedSarCompoundIds.length === 0) return mockCompounds;
    return mockCompounds.filter((compound) => selectedSarCompoundIds.includes(compound.id));
  }, [selectedSarCompoundIds]);

  const [isColorActive, setIsColorActive] = useState(false);
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<number>(1);
  const [viewportWidth, setViewportWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 1920;
    return window.innerWidth;
  });
  const layoutPreset = useMemo(() => getPatentAnalysisLayoutPreset(viewportWidth), [viewportWidth]);

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
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
  const [keyword, setKeyword] = useState<string>('');

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

  const handleCheckboxChange = (vals: string[], setFn: (v: string[]) => void, originalOptions: string[]) => {
    const currentlyHasAll = vals.includes('ALL');
    const previouslyHadAll = (setFn === setSelectedProjects ? selectedProjects :
      setFn === setSelectedShares ? selectedShares :
        selectedSources).includes('ALL');

    if (currentlyHasAll && !previouslyHadAll) {
      setFn(['ALL', ...originalOptions]);
    } else if (!currentlyHasAll && previouslyHadAll) {
      setFn([]);
    } else {
      const filtered = vals.filter(v => v !== 'ALL');
      if (filtered.length === originalOptions.length) {
        setFn(['ALL', ...originalOptions]);
      } else {
        setFn(filtered);
      }
    }
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
    return columnOrder
      .filter(key => activeColumns.includes(key))
      .map(key => {
        const col = { ...allColumnsMap[key] };
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
              if (childDef) orderedChildren.push(childDef);
            }
          });
          col.children = orderedChildren;
        }
        return col;
      });
  }, [columnOrder, activeColumns, subColumnConfig, isColorActive]);

  return (
    <div
      className="gx-main-content"
      style={{
        maxWidth: layoutPreset.maxWidth,
        margin: '0 auto',
        padding: `0 ${layoutPreset.sidePadding}px`,
        width: '100%'
      }}
    >
      {/* Search & Filter Header (MyBoard Layout) */}
      <Card variant="borderless" className="c-card" style={{ marginBottom: 20, borderRadius: 12 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col flex="auto">
            <Space size="middle">
              <Input
                prefix={<Search size={18} color={token.colorTextTertiary} />}
                placeholder="검색어 입력 (이름, SMILES 등)"
                style={{ width: 350, height: 44, borderRadius: 12 }}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
              <Button
                icon={showFilters ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                onClick={() => setShowFilters(!showFilters)}
                style={{ height: 44, borderRadius: 12 }}
              >
                상세 필터 {showFilters ? '닫기' : '열기'}
              </Button>
              <Button icon={<Beaker size={18} />} style={{ height: 44, borderRadius: 12 }}>구조 검색</Button>
              <Button icon={<Download size={18} />} style={{ height: 44, borderRadius: 12 }}>Export</Button>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button type="primary" style={{ height: 44, borderRadius: 12, background: '#003a8c', borderColor: '#003a8c' }}>추가하기</Button>
              <Button style={{ height: 44, borderRadius: 12 }}>돌아가기</Button>
            </Space>
          </Col>
        </Row>
        {showFilters && (
          <div style={{ marginTop: 24, padding: 20, background: token.colorBgLayout, borderRadius: 12 }}>
            <Row gutter={[32, 24]}>
              <Col span={10}>
                <Text strong>Projects</Text><br />
                <Checkbox.Group
                  options={['ALL', ...projectList]}
                  value={selectedProjects}
                  onChange={(v) => handleCheckboxChange(v as string[], setSelectedProjects, projectList)}
                />
              </Col>
              <Col span={6}>
                <Text strong>Share</Text><br />
                <Checkbox.Group
                  options={['ALL', ...shareList]}
                  value={selectedShares}
                  onChange={(v) => handleCheckboxChange(v as string[], setSelectedShares, shareList)}
                />
              </Col>
              <Col span={8}>
                <Text strong>Design Source</Text><br />
                <Checkbox.Group
                  options={['ALL', ...sourceList]}
                  value={selectedSources}
                  onChange={(v) => handleCheckboxChange(v as string[], setSelectedSources, sourceList)}
                />
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

      {/* Compound Cards Slider (Prototype Style) */}
      <div style={{
        padding: '24px 16px',
        background: token.colorBgContainer,
        borderRadius: 12,
        marginBottom: 20,
        border: `1px solid ${token.colorBorderSecondary}`,
        overflowX: 'auto',
        whiteSpace: 'nowrap'
      }}>
        <div style={{ display: 'inline-flex', gap: 24 }}>
          {sarCompounds.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedRowKey(item.id)}
              style={{
                width: 200,
                padding: '16px',
                textAlign: 'center',
                cursor: 'pointer',
                borderRadius: 12,
                border: selectedRowKey === item.id ? `2px solid ${token.colorBorderSecondary}` : `1px solid ${token.colorBorderSecondary}`,
                background: selectedRowKey === item.id ? (isDarkMode ? '#111d2c' : '#e6f7ff') : token.colorBgContainer,
                transition: 'all 0.2s'
              }}
            >
              <div style={{
                height: 120,
                background: token.colorBgContainer,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
                border: `1px solid ${token.colorBorderSecondary}`
              }}>
                <FlaskConical size={48} color={selectedRowKey === item.id ? token.colorPrimary : token.colorTextTertiary} strokeWidth={1} />
              </div>
              <Text strong style={{ fontSize: 13 }}>{item.name}</Text>
            </div>
          ))}
        </div>
      </div>

      {/* Main SAR Table (Multi-level Header) */}
      <div style={{ background: token.colorBgContainer, borderRadius: 12, overflow: 'hidden', border: `1px solid ${token.colorBorderSecondary}`, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <div style={{
          padding: '12px 24px',
          background: token.colorBgLayout,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: `1px solid ${token.colorBorderSecondary}`
        }}>
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
          dataSource={sarCompounds}
          columns={dynamicColumns}
          rowKey="id"
          size="small"
          bordered
          pagination={false}
          scroll={{ x: 1800, y: 500 }}
          onRow={(record) => ({
            onClick: () => setSelectedRowKey(record.id),
          })}
          rowClassName={(record) => record.id === selectedRowKey ? 'sar-row-selected' : ''}
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
                    width: 44, height: 44, borderRadius: 8,
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
                    borderRadius: 8,
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
                    <Text strong={activeColumns.includes(item)} style={{ color: activeColumns.includes(item) ? token.colorPrimary : token.colorTextTertiary }}>
                      {item}
                    </Text>
                  </Space>
                  <Checkbox
                    checked={activeColumns.includes(item)}
                    onChange={() => toggleColumn(item)}
                    onClick={(e) => e.stopPropagation()}
                  />
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
                          borderRadius: 6,
                          border: `1px solid ${token.colorBorderSecondary}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: 12
                        }}
                      >
                        <Space>
                          <GripVertical size={12} color={token.colorBorder} />
                          <Text style={{ fontSize: 12, color: sub.visible ? token.colorText : token.colorTextTertiary }}>{sub.title}</Text>
                        </Space>
                        <Checkbox
                          checked={sub.visible}
                          onChange={() => toggleSubColumn(item, sub.key)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <style>{`
        .sar-row-selected {
          background-color: ${isDarkMode ? '#2a1f1d' : '#fff7f6'} !important;
        }
        .sar-row-selected td {
          background-color: ${isDarkMode ? '#2a1f1d' : '#fff7f6'} !important;
          border-bottom: 1px solid ${isDarkMode ? '#F87C6333' : '#F87C6322'} !important;
        }
        .ant-table-thead > tr > th {
          background: ${isDarkMode ? '#1f1f1f' : '#fafafa'} !important;
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
      `}</style>
    </div>
  );
};

export default SarTable;
