import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Row, Col, Card, Table, Button, Input,
  Space, Typography, Modal, Form, Tag, List, Select, DatePicker, Avatar, Divider, Upload, Segmented, theme, Tooltip
} from 'antd';
import {
  Search, Plus, Filter, Settings, List as ListIcon,
  Image as ImageIcon, GitBranch, Info, ChevronDown, ChevronUp, Beaker,
  Activity, XCircle, Share2, GripVertical, Upload as UploadIcon, FileText,
  PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { useBoardStore } from '../store/useBoardStore';
import { mockCompounds, mockGroups } from '../mocks/compounds';
import { useUserStore } from '../store/useUserStore';
import RadarChart from '../components/charts/RadarChart';
import dayjs from 'dayjs';
import { useTheme } from '../contexts/ThemeContext';
import { getPatentAnalysisLayoutPreset } from '../config/patentAnalysisLayout';
import { useUIStore } from '../store/useUIStore';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import WhiteboardEditor from '../components/board/WhiteboardEditor';
import ChemDrawModal from '../components/common/ChemDrawModal';
import ChemDrawEditor from '../components/common/ChemDrawEditor';
import BenzeneIcon from '../components/common/BenzeneIcon';
import ToggleTag from '../components/common/ToggleTag';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;
const MYBOARD_SPLIT_MIN_PERCENT = 30;
const MYBOARD_SPLIT_MAX_PERCENT = 70;
const MYBOARD_SPLIT_DEFAULT_PERCENT = 50;

const MyBoard: React.FC = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const { token } = theme.useToken();
  const { setHeaderContent } = useUIStore();
  const { selectedGroupIds, toggleGroupSelection, setSelectedSarCompoundIds } = useBoardStore();
  const { currentUser } = useUserStore();
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isDesignModalOpen, setIsDesignModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isStructureModalOpen, setIsStructureModalOpen] = useState(false);
  const [cdjsInstance, setCdjsInstance] = useState<any>(null);
  const [designSmiles, setDesignSmiles] = useState('');
  const [searchedSvg, setSearchedSvg] = useState<string | null>(null);
  const [structurePreview, setStructurePreview] = useState<{ title: string; svg: string } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'draw' | 'tree'>('table');
  const [assignedGroupIds, setAssignedGroupIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGroupListCollapsed, setIsGroupListCollapsed] = useState(false);
  const [selectedDataSources, setSelectedDataSources] = useState<string[]>(['my designs']);
  const [viewportWidth, setViewportWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 1920;
    return window.innerWidth;
  });
  const layoutPreset = React.useMemo(() => getPatentAnalysisLayoutPreset(viewportWidth), [viewportWidth]);
  const isStackedSplitLayout = viewportWidth <= 1100;
  const [splitRatio, setSplitRatio] = useState<number>(MYBOARD_SPLIT_DEFAULT_PERCENT);
  const [isResizingSplit, setIsResizingSplit] = useState(false);
  const splitContainerRef = React.useRef<HTMLDivElement | null>(null);
  const splitRafRef = React.useRef<number | null>(null);
  const splitStorageKey = 'my-board-split:group-detail';

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
      fontSize: 11,
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

  const resetSplitRatio = React.useCallback(() => {
    setSplitRatio(MYBOARD_SPLIT_DEFAULT_PERCENT);
  }, []);

  const alwaysColumnKeys = React.useMemo(() => [
    '순번', '그룹', '프로젝트', '물질 번호 (VRN)', '화합물 구조', '출처', '디자인 비고', 'Mol.Properties1', 'Mol.Properties2'
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

  const filteredCompounds = mockCompounds.filter((compound) => {
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
  });

  const sarTargetCount = selectedGroupIds.length > 0 ? filteredCompounds.length : 0;

  const groupColumns = [
    { title: 'Date', dataIndex: 'creDate', key: 'creDate', width: 100 },
    { 
      title: 'Type', 
      dataIndex: 'type', 
      key: 'type', 
      width: 60, 
      align: 'center' as const,
      render: (type: string) => (
        <Tag color={type === 'my designs' ? 'orange' : 'cyan'} style={{ fontWeight: 700, borderRadius: 4, margin: 0 }}>
          {type === 'my designs' ? 'D' : 'C'}
        </Tag>
      )
    },
    { title: 'Target', dataIndex: 'target', key: 'target', width: 80, render: (t: string) => <Tag color="blue">{t}</Tag> },
    { title: 'Title', dataIndex: 'name', key: 'name' },
    { title: '개수', dataIndex: 'count', key: 'count', align: 'right' as const, width: 60 },
    {
      title: '공유',
      dataIndex: 'shareStatus',
      key: 'shareStatus',
      render: (status: string) => (
        status === '공유함' ? <Button size="small" type="text" danger icon={<XCircle size={14} />}>공유취소</Button> : null
      )
    }
  ];

  const groupNameMap = React.useMemo(() => {
    return mockGroups.reduce<Record<string, string>>((acc, group) => {
      acc[group.id] = group.name;
      return acc;
    }, {});
  }, []);

  const allColumnsMap: Record<string, any> = {
    '순번': { title: '순번', key: 'num', render: (_: any, __: any, index: number) => index + 1, width: 60 },
    '그룹': {
      title: '그룹',
      dataIndex: 'groupId',
      key: 'groupId',
      width: 140,
      ellipsis: true,
      render: (groupId: string) => groupNameMap[groupId] || groupId
    },
    '프로젝트': { title: '프로젝트', dataIndex: 'project', key: 'project', width: 90, render: (project: string) => <Tag color="blue">{project}</Tag> },
    '물질 번호 (VRN)': { title: '물질 번호 (VRN)', dataIndex: 'compoundId', key: 'compoundId', width: 130, render: (id: string) => <Text strong color={token.colorPrimary}>{id}</Text> },
    '화합물 구조': {
      title: '화합물 구조',
      dataIndex: 'structureSvg',
      key: 'structure',
      width: 120,
      render: (structureSvg: string | undefined, record: any) => {
        const displaySvg = searchedSvg && (keyword === record.smiles || keyword === 'Structure Search Result')
          ? searchedSvg
          : structureSvg;

        return (
          <div
            style={{
              width: 100,
              height: 60,
              background: token.colorBgLayout,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 4,
              border: `1px solid ${token.colorBorderSecondary}`,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {displaySvg ? (
              <>
                <div
                  className="my-board-structure-svg"
                  style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  dangerouslySetInnerHTML={{ __html: displaySvg }}
                />
                <Tooltip title="크게 보기">
                  <Button
                    className="svg-action-btn my-board-structure-preview-button"
                    size="small"
                    type="text"
                    icon={<Search size={14} />}
                    onClick={(event) => {
                      event.stopPropagation();
                      setStructurePreview({
                        title: record.compoundId || record.name || 'Structure',
                        svg: displaySvg,
                      });
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.8)'
                    }}
                  />
                </Tooltip>
              </>
            ) : (
              <BenzeneIcon size={20} color={token.colorTextTertiary} />
            )}
          </div>
        );
      }
    },
    '출처': { title: '출처', dataIndex: 'designSource', key: 'designSource', width: 100 },
    '디자인 비고': { title: '디자인 비고', dataIndex: 'designMemo', key: 'designMemo', ellipsis: true, width: 200 },
    'Mol.Properties1': {
      title: 'Mol.Properties1',
      dataIndex: 'properties1',
      key: 'props1',
      width: 100,
      render: (props: number[]) => props ? <RadarChart data={props} size={60} /> : '-'
    },
    'Mol.Properties2': {
      title: 'Mol.Properties2',
      dataIndex: 'properties2',
      key: 'props2',
      width: 100,
      render: (props: number[]) => props ? <RadarChart data={props} size={60} color="#5856d6" /> : '-'
    },
    '디자인 번호': { title: '디자인 번호', dataIndex: 'designNo', key: 'designNo', width: 120 },
    '필요량 (mg)': { title: '필요량 (mg)', dataIndex: 'requiredAmountMg', key: 'requiredAmountMg', width: 110, align: 'right' as const },
    '목적 (개선하고자 하는 assay)': { title: '목적 (개선하고자 하는 assay)', dataIndex: 'assayPurpose', key: 'assayPurpose', width: 190, ellipsis: true },
    '기대 개선 효과': { title: '기대 개선 효과', dataIndex: 'expectedEffect', key: 'expectedEffect', width: 150, ellipsis: true },
    '의뢰일자': { title: '의뢰일자', dataIndex: 'requestDate', key: 'requestDate', width: 110 },
    '합성 확장 필요 정도': { title: '합성 확장 필요 정도', dataIndex: 'synthesisExpansionLevel', key: 'synthesisExpansionLevel', width: 140 },
    '의뢰 비고': { title: '의뢰 비고', dataIndex: 'requestMemo', key: 'requestMemo', width: 160, ellipsis: true },
    '합성 담당자': { title: '합성 담당자', dataIndex: 'synthesisOwner', key: 'synthesisOwner', width: 110 },
    '합성 스터디 그룹 수락일자': { title: '합성 스터디 그룹 수락일자', dataIndex: 'synthesisAcceptedDate', key: 'synthesisAcceptedDate', width: 170 },
    '합성 목표일': { title: '합성 목표일', dataIndex: 'synthesisTargetDate', key: 'synthesisTargetDate', width: 120 },
    '진행사항 비고': { title: '진행사항 비고', dataIndex: 'progressMemo', key: 'progressMemo', width: 160, ellipsis: true },
    '완료 여부': {
      title: '완료 여부',
      dataIndex: 'isCompleted',
      key: 'isCompleted',
      width: 100,
      render: (isCompleted: boolean) => <Tag color={isCompleted ? 'green' : 'gold'}>{isCompleted ? '완료' : '진행중'}</Tag>
    },
    '등록일': { title: '등록일', dataIndex: 'registeredDate', key: 'registeredDate', width: 110 },
    '연구노트': { title: '연구노트', dataIndex: 'researchNote', key: 'researchNote', width: 130 },
    '리포트 자료': { title: '리포트 자료', dataIndex: 'reportData', key: 'reportData', width: 140, ellipsis: true },
    '합성 종료 이유': { title: '합성 종료 이유', dataIndex: 'synthesisEndReason', key: 'synthesisEndReason', width: 140, ellipsis: true }
  };

  const dynamicCompoundColumns = columnOrder
    .filter(key => activeColumns.includes(key))
    .map(key => allColumnsMap[key])
    .filter(Boolean);

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
        height: '100%',
        overflowY: isStackedSplitLayout ? 'auto' : 'visible',
        overflowX: 'hidden'
      }}
    >
      {/* Local Filter Card (Condensed) */}
      <Card variant="borderless" className="c-card" style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]} align="middle">
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
          <Col flex={isStackedSplitLayout ? '1 1 100%' : 'none'}>
            <Button
              type="primary"
              icon={<Plus size={18} />}
              onClick={() => setIsGroupModalOpen(true)}
              className="v-action-btn"
              style={{
                background: token.colorPrimary,
                borderColor: token.colorPrimary,
                width: isStackedSplitLayout ? '100%' : undefined,
              }}
            >
              상위 그룹 생성
            </Button>
          </Col>
        </Row>
        {showFilters && (
          <div style={{ marginTop: 24, padding: 20, background: token.colorBgLayout, borderRadius: 12 }}>
            <Row gutter={[32, 24]}>
              <Col span={10}>
                <Text strong>Projects</Text><br />
                <Space wrap style={{ marginTop: 8 }}>
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
                <Space wrap style={{ marginTop: 8 }}>
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
                <Space wrap style={{ marginTop: 8 }}>
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
          gap: isStackedSplitLayout ? 16 : 0,
          minHeight: 0,
          paddingBottom: isStackedSplitLayout ? 24 : 0
        }}
      >
        {!isGroupListCollapsed && (
        <div style={{ width: isStackedSplitLayout ? '100%' : `calc(${splitRatio}% - 6px)`, minWidth: 0 }}>
          <div className="v-table-card">
            <div className="v-table-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <Tooltip title="그룹 리스트 접기">
                  <Button
                    size="small"
                    type="text"
                    icon={<PanelLeftClose size={14} />}
                    onClick={() => setIsGroupListCollapsed(true)}
                  />
                </Tooltip>
                <Text strong style={{ color: token.colorPrimary }}>그룹 리스트</Text>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <ToggleTag
                    checked={selectedDataSources.includes('my designs')}
                    onChange={(checked) => {
                      const next = checked
                        ? [...selectedDataSources, 'my designs']
                        : selectedDataSources.filter(s => s !== 'my designs');
                      if (next.length > 0) setSelectedDataSources(next);
                    }}
                    style={{ fontSize: 11 }}
                  >
                    My Designs
                  </ToggleTag>
                  <ToggleTag
                    checked={selectedDataSources.includes('my compounds')}
                    onChange={(checked) => {
                      const next = checked
                        ? [...selectedDataSources, 'my compounds']
                        : selectedDataSources.filter(s => s !== 'my compounds');
                      if (next.length > 0) setSelectedDataSources(next);
                    }}
                    style={{ fontSize: 11 }}
                  >
                    My Compounds
                  </ToggleTag>
                </div>
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
            </div>
            <Table
              dataSource={mockGroups.filter(g => selectedDataSources.includes(g.type))}
              columns={groupColumns}
              pagination={false}
              size="small"
              rowKey="id"
              scroll={{ x: 'max-content' }}
              onRow={(record) => ({
                onClick: () => {
                  setIsLoading(true);
                  toggleGroupSelection(record.id);
                  setTimeout(() => setIsLoading(false), 500);
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
          onDoubleClick={resetSplitRatio}
          onKeyDown={handleSplitKeyDown}
          style={{
            width: 12,
            flexShrink: 0,
            cursor: 'col-resize',
            display: isStackedSplitLayout || isGroupListCollapsed ? 'none' : 'flex',
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

        <div style={{ flex: isStackedSplitLayout ? '0 0 auto' : 1, minWidth: 0, width: isStackedSplitLayout || isGroupListCollapsed ? '100%' : undefined }}>
          <div className="v-table-card">
            <div className="v-table-header" style={{ flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                {isGroupListCollapsed && (
                  <Tooltip title="그룹 리스트 펼치기">
                    <Button
                      size="small"
                      type="text"
                      icon={<PanelLeftOpen size={14} />}
                      onClick={() => setIsGroupListCollapsed(false)}
                    />
                  </Tooltip>
                )}
                <Text strong style={{ color: token.colorPrimary }}>그룹 상세 목록</Text>
                <Space>
                  <Button
                    type="primary"
                    size="small"
                    icon={<Plus size={14} />}
                    disabled={selectedGroupIds.length === 0}
                    style={{ background: token.colorPrimary, borderColor: token.colorPrimary }}
                    onClick={() => setIsDesignModalOpen(true)}
                  >
                    Create Design
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
              <Table
                dataSource={selectedGroupIds.length > 0 ? filteredCompounds : []}
                columns={dynamicCompoundColumns}
                size="small"
                rowKey="id"
                pagination={{ pageSize: 8 }}
                loading={isLoading}
                scroll={{ x: 'max-content' }}
                locale={{ emptyText: selectedGroupIds.length === 0 ? '왼쪽 그룹 리스트에서 그룹을 선택해 주세요.' : '검색 결과가 없습니다.' }}
              />
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
        title="상위 그룹 생성"
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

      {/* Create Design Modal */}
      <Modal
        title="디자인 등록 (Create Design)"
        open={isDesignModalOpen}
        onCancel={() => {
          setIsDesignModalOpen(false);
          setCdjsInstance(null);
        }}
        onOk={() => {
          setIsDesignModalOpen(false);
          setCdjsInstance(null);
        }}
        okButtonProps={{ disabled: !cdjsInstance }}
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
                  {mockGroups.map(g => <Option key={g.id} value={g.id}>{g.name}</Option>)}
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
                  style={{ minHeight: 24, padding: '2px 10px', fontSize: 11, marginInlineEnd: 0 }}
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
            <Text type="secondary" style={{ fontSize: '12px', marginTop: 8, display: 'block' }}>
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
          <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 12 }}>
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
          <Text type="secondary" style={{ fontSize: '12px' }}>
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
        width={900}
      >
        {structurePreview ? (
          <div
            className="my-board-structure-preview"
            style={{
              width: '100%',
              height: 560,
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
        .ant-table-thead > tr > th { background: ${isDarkMode ? '#1f1f1f' : '#f8f9fa'} !important; font-weight: 700; font-size: 13px; }
        .ant-table-tbody > tr > td { font-size: 13px; }
        .my-board-group-row-selected > td {
          background-color: ${isDarkMode ? 'rgba(248, 124, 99, 0.34)' : 'rgba(248, 124, 99, 0.22)'} !important;
        }
        .my-board-group-row-selected:hover > td {
          background-color: ${isDarkMode ? 'rgba(248, 124, 99, 0.42)' : 'rgba(248, 124, 99, 0.3)'} !important;
        }
        .canvas-card:hover { border-color: ${token.colorPrimary} !important; transform: translateY(-4px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .cdd-clipboard-icon-container, .CDW_Logo, .cdd-logo { display: none !important; }
        .my-board-structure-svg svg {
          max-width: 92px !important;
          max-height: 54px !important;
          width: auto;
          height: auto;
          display: block;
        }
        .my-board-structure-preview svg {
          max-width: 100% !important;
          max-height: 100% !important;
          width: auto;
          height: auto;
          display: block;
        }
        .my-board-structure-preview-button {
          position: absolute;
          top: 4px;
          right: 4px;
          z-index: 2;
        }
      `}</style>
    </div>
  );
};

export default MyBoard;
