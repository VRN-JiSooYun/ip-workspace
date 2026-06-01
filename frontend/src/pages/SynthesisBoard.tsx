import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Row, Col, Card, Table, Button, Input,
  Space, Typography, Modal, Form, Tag, Select, DatePicker, Avatar, Divider, Segmented, Popover, Tooltip, theme
} from 'antd';
import {
  Search, Plus, Filter, Settings, FlaskConical, Info, ChevronDown, ChevronUp, Beaker, Image as ImageIcon, GitBranch,
  UserPlus, CheckCircle2, Clock, AlertCircle, GripVertical, Users, Activity, List as ListIcon, ClipboardList, ArrowLeft
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useUIStore } from '../store/useUIStore';
import { DEFAULT_GROUP_STRUCTURE_VIEW_SETTINGS, useBoardStore } from '../store/useBoardStore';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import BenzeneIcon from '../components/common/BenzeneIcon';
import CompoundStructureView from '../components/common/CompoundStructureView';
import { getPatentAnalysisLayoutPreset } from '../config/patentAnalysisLayout';
import ToggleTag from '../components/common/ToggleTag';
import dayjs from 'dayjs';
import exampleCompound1Svg from '../assets/mol_svg/example_compound1.svg?raw';
import exampleCompound2Svg from '../assets/mol_svg/example_compound2.svg?raw';
import exampleCompound3Svg from '../assets/mol_svg/example_compound3.svg?raw';
import exampleCompound4Svg from '../assets/mol_svg/example_compound4.svg?raw';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const SYNTHESIS_SPLIT_MIN_PERCENT = 35;
const SYNTHESIS_SPLIT_MAX_PERCENT = 75;
const SYNTHESIS_SPLIT_DEFAULT_PERCENT = 58;
const SYNTHESIS_DETAIL_TABLE_MIN_WIDTH = 2096;

interface SynthesisDetail {
  id: string;
  groupId: string;
  groupNum: number;
  compoundId: string;
  name: string;
  smiles: string;
  structureSvg?: string;
  project: string;
  experimentStage: number;
  designSource: string;
  designMemo: string;
  synthesisOwner: string | null;
  synthesisAcceptedDate: string | null;
  synthesisTargetDate: string;
  progressMemo: string;
  isCompleted: boolean;
  registeredDate: string;
  researchNote: string;
  reportData: string;
  synthesisEndReason: string;
  completeDate: string | null;
}

const ManagerComparisonPopup = ({ record, currentMgrName }: { record: any, currentMgrName?: string }) => {
  const { token } = theme.useToken();
  return (
  <div style={{ minWidth: 300 }}>
    <div style={{ marginBottom: 12, borderBottom: `1px solid ${token.colorBorderSecondary}`, paddingBottom: 8 }}>
      <div style={{ marginBottom: 4 }}>
        <Text strong style={{ fontSize: 12, color: token.colorPrimary }}>{record.title}</Text>
      </div>
      <Text style={{ fontSize: 11, color: token.colorTextSecondary }}>담당자별 합성 현황 비교</Text>
    </div>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
          <th style={{ textAlign: 'left', padding: '4px 0', fontSize: 10, color: token.colorTextSecondary }}>담당자</th>
          <th style={{ textAlign: 'center', padding: '4px 0', fontSize: 10, color: token.colorTextSecondary }}>합성중</th>
          <th style={{ textAlign: 'center', padding: '4px 0', fontSize: 10, color: token.colorTextSecondary }}>완료</th>
          <th style={{ textAlign: 'center', padding: '4px 0', fontSize: 10, color: token.colorTextSecondary }}>합계</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: 6 }).map((_, idx) => {
          const managerName = `담당자${idx + 1}`;
          const m = record.managers.find((mgrObj: any) => mgrObj.name === managerName) ||
            { name: managerName, count: 0, ing: 0, done: 0 };

          return (
            <tr key={idx} style={{ background: m.name === currentMgrName ? token.colorPrimaryBg : 'transparent' }}>
              <td style={{ padding: '6px 0', fontSize: 11 }}>
                <Text strong={m.name === currentMgrName}>{m.name}</Text>
              </td>
              <td style={{ textAlign: 'center', fontSize: 10, color: '#1890ff' }}>{m.ing}</td>
              <td style={{ textAlign: 'center', fontSize: 10, color: '#52c41a' }}>{m.done}</td>
              <td style={{ textAlign: 'center', fontSize: 10, fontWeight: 600 }}>{m.count}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
  );
};

const SynthesisBoard: React.FC = () => {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const { setHeaderContent } = useUIStore();
  const { isDarkMode } = useTheme();
  const { groupStructureViewSettings } = useBoardStore();
  const [showFilters, setShowFilters] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>('sg1');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SynthesisDetail | null>(null);
  const [structurePreview, setStructurePreview] = useState<{ title: string; svg: string } | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'draw' | 'tree'>('table');
  const [viewportWidth, setViewportWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 1920;
    return window.innerWidth;
  });
  const layoutPreset = React.useMemo(() => getPatentAnalysisLayoutPreset(viewportWidth), [viewportWidth]);
  const isResponsiveToolbar = viewportWidth <= 1100;
  const [splitRatio, setSplitRatio] = useState<number>(SYNTHESIS_SPLIT_DEFAULT_PERCENT);
  const [isResizingSplit, setIsResizingSplit] = useState(false);
  const splitContainerRef = React.useRef<HTMLDivElement | null>(null);
  const splitRafRef = React.useRef<number | null>(null);
  const splitStorageKey = 'synthesis-board-split:group-detail';

  const clampSplitRatio = React.useCallback((value: number) => {
    return Math.min(Math.max(value, SYNTHESIS_SPLIT_MIN_PERCENT), SYNTHESIS_SPLIT_MAX_PERCENT);
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

  const getGroupStructureSettings = React.useCallback((groupId: string) => ({
    ...DEFAULT_GROUP_STRUCTURE_VIEW_SETTINGS,
    ...groupStructureViewSettings[groupId],
  }), [groupStructureViewSettings]);

  // Filter States (Sync with MyBoard)
  const projectList = ['FGFR', 'C797S DM', 'cMET', 'VRK1', 'HER2', 'WRN', 'WEE1'];
  const shareList = ['내 물질', '공유함', '공유받음'];
  const sourceList = ['내 머리', '동료 머리', 'Patent', 'Paper', 'FBDD', 'ELN'];

  const [selectedProjects, setSelectedProjects] = useState<string[]>(['ALL', ...projectList]);
  const [selectedShares, setSelectedShares] = useState<string[]>(['ALL', ...shareList]);
  const [selectedSources, setSelectedSources] = useState<string[]>(['ALL', ...sourceList]);
  const [period, setPeriod] = useState<string>('전체');

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

  useEffect(() => {
    setHeaderContent(
      <PageHeaderBreadcrumb 
        items={[
          { label: 'Compounds' },
          { label: 'My board', onClick: () => navigate('/myboard') },
          { label: '합성 보드' }
        ]} 
      />
    );
    return () => setHeaderContent(null);
  }, [setHeaderContent, navigate]);

  React.useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  React.useEffect(() => {
    const raw = window.localStorage.getItem(splitStorageKey);
    if (!raw) {
      setSplitRatio(SYNTHESIS_SPLIT_DEFAULT_PERCENT);
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
      setSplitRatio(SYNTHESIS_SPLIT_MIN_PERCENT);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setSplitRatio(SYNTHESIS_SPLIT_MAX_PERCENT);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSplitRatio(SYNTHESIS_SPLIT_DEFAULT_PERCENT);
    }
  }, [clampSplitRatio]);

  const resetSplitRatio = React.useCallback(() => {
    setSplitRatio(SYNTHESIS_SPLIT_DEFAULT_PERCENT);
  }, []);

  const currentGroups = [
    {
      id: 'sg1', num: 1, date: '2026.04.10', type: 'My Designs', target: 'FGFR', title: 'Leucine series A',
      share: '공유함', ing: 2, done: 1, unassigned: 2, total: 5,
      managers: [
        { name: '담당자1', count: 2, ing: 1, done: 1 },
        { name: '담당자2', count: 1, ing: 1, done: 0 },
        { name: '담당자3', count: 0, ing: 0, done: 0 }
      ]
    },
    {
      id: 'sg2', num: 2, date: '2026.04.12', type: 'My Designs', target: 'HER2', title: 'Scaffold B optimization',
      share: '비공개', ing: 1, done: 2, unassigned: 0, total: 3,
      managers: [
        { name: '담당자4', count: 3, ing: 1, done: 2 }
      ]
    },
    {
      id: 'cg1', num: 1, date: '2026.04.15', type: 'My Compounds', target: 'cMET', title: 'Synthesized VRA-100s',
      share: '공유받음', ing: 5, done: 10, unassigned: 0, total: 15,
      managers: [
        { name: '담당자1', count: 8, ing: 3, done: 5 },
        { name: '담당자5', count: 7, ing: 2, done: 5 }
      ]
    },
    {
      id: 'cg2', num: 2, date: '2026.04.20', type: 'My Compounds', target: 'WRN', title: 'Lead Compound Batch 1',
      share: '비공개', ing: 2, done: 8, unassigned: 1, total: 11,
      managers: [
        { name: '담당자2', count: 4, ing: 1, done: 3 },
        { name: '담당자6', count: 3, ing: 1, done: 2 },
        { name: '담당자7', count: 3, ing: 0, done: 3 }
      ]
    },
  ];

  const mockSynthesisDetails: SynthesisDetail[] = [
    // Designs items
    {
      id: 'sd1', groupId: 'sg1', groupNum: 1, compoundId: 'VRA-001', name: 'VRA-001', smiles: 'CC1=CC=C(C=C1)S', structureSvg: exampleCompound1Svg,
      project: 'FGFR', experimentStage: 1, designSource: '내 머리', designMemo: 'FGFR hinge binder 변형안',
      synthesisOwner: '담당자1', synthesisAcceptedDate: '2026.04.11', synthesisTargetDate: '2026.04.24',
      progressMemo: 'Step 2 조건 최적화 중', isCompleted: false, registeredDate: '2026.04.10', researchNote: 'ELN-2026-101', reportData: 'LCMS preview', synthesisEndReason: '-', completeDate: null
    },
    {
      id: 'sd2', groupId: 'sg1', groupNum: 2, compoundId: 'VRA-002', name: 'VRA-002', smiles: 'CNC1=NC=NC=C1', structureSvg: exampleCompound2Svg,
      project: 'FGFR', experimentStage: 2, designSource: 'Patent', designMemo: '특허 예시 구조 기반 용해도 조정',
      synthesisOwner: '담당자2', synthesisAcceptedDate: '2026.04.12', synthesisTargetDate: '2026.04.25',
      progressMemo: '원료 입고 대기', isCompleted: false, registeredDate: '2026.04.11', researchNote: 'ELN-2026-102', reportData: 'route draft', synthesisEndReason: '-', completeDate: null
    },
    {
      id: 'sd_new1', groupId: 'sg1', groupNum: 3, compoundId: 'VRA-003', name: 'VRA-003 (미배정)', smiles: 'CC(=O)C1=CC=CC=C1', structureSvg: exampleCompound3Svg,
      project: 'FGFR', experimentStage: 3, designSource: 'Paper', designMemo: 'hERG risk 확인용 치환기 변경 후보',
      synthesisOwner: null, synthesisAcceptedDate: null, synthesisTargetDate: '2026.04.29',
      progressMemo: '미배정', isCompleted: false, registeredDate: '2026.04.12', researchNote: '-', reportData: '-', synthesisEndReason: '-', completeDate: null
    },
    {
      id: 'sd3', groupId: 'sg2', groupNum: 1, compoundId: 'VRA-004', name: 'VRA-004', smiles: 'C1=CC=C(C=C1)N', structureSvg: exampleCompound4Svg,
      project: 'HER2', experimentStage: 1, designSource: '동료 머리', designMemo: 'HER2 potency 확인용 follow-up',
      synthesisOwner: '담당자1', synthesisAcceptedDate: '2026.04.13', synthesisTargetDate: '2026.04.20',
      progressMemo: '정제 완료', isCompleted: true, registeredDate: '2026.04.12', researchNote: 'ELN-2026-104', reportData: 'VRA-004_report.pdf', synthesisEndReason: '목표 물질 확보', completeDate: '2026.04.20'
    },
    // Compounds items
    {
      id: 'sd4', groupId: 'cg1', groupNum: 1, compoundId: 'VRA-101', name: 'VRA-101', smiles: 'CC(=O)NC1=CC=CC=C1', structureSvg: exampleCompound1Svg,
      project: 'cMET', experimentStage: 1, designSource: 'FBDD', designMemo: 'cMET analog 확보를 위한 fragment merge 후보',
      synthesisOwner: '담당자1', synthesisAcceptedDate: '2026.04.16', synthesisTargetDate: '2026.04.30',
      progressMemo: '중간체 합성 완료', isCompleted: false, registeredDate: '2026.04.15', researchNote: 'ELN-2026-111', reportData: 'intermediate_lcms', synthesisEndReason: '-', completeDate: null
    },
    {
      id: 'sd5', groupId: 'cg2', groupNum: 1, compoundId: 'VRA-102', name: 'VRA-102', smiles: 'CC(C)C1=CC=CC=C1', structureSvg: exampleCompound2Svg,
      project: 'WRN', experimentStage: 1, designSource: 'ELN', designMemo: 'WRN hit follow-up 표준 조건 적용 후보',
      synthesisOwner: '담당자2', synthesisAcceptedDate: '2026.04.17', synthesisTargetDate: '2026.04.21',
      progressMemo: '완료 및 분석 등록', isCompleted: true, registeredDate: '2026.04.16', researchNote: 'ELN-2026-112', reportData: 'VRA-102_report.pdf', synthesisEndReason: '목표 물질 확보', completeDate: '2026.04.21'
    },
    {
      id: 'sd_new2', groupId: 'cg2', groupNum: 2, compoundId: 'VRA-103', name: 'VRA-103 (미배정)', smiles: 'C1=CC=CC=C1O', structureSvg: exampleCompound3Svg,
      project: 'WRN', experimentStage: 2, designSource: 'Paper', designMemo: 'phenol linker 영향 확인용 후보',
      synthesisOwner: null, synthesisAcceptedDate: null, synthesisTargetDate: '2026.05.06',
      progressMemo: '미배정', isCompleted: false, registeredDate: '2026.04.22', researchNote: '-', reportData: '-', synthesisEndReason: '-', completeDate: null
    },
  ];

  const filteredDetails = useMemo(() => {
    return mockSynthesisDetails.filter(d =>
      d.groupId === selectedGroupId &&
      (d.name.toLowerCase().includes(keyword.toLowerCase()) || d.compoundId.toLowerCase().includes(keyword.toLowerCase()))
    );
  }, [selectedGroupId, keyword]);

  const groupColumns = [
    { title: 'Num', dataIndex: 'num', key: 'num', width: 50, align: 'center' as const },
    { title: 'Date', dataIndex: 'date', key: 'date', width: 90, align: 'center' as const, className: 'table-center-column' },
    { title: 'Target', dataIndex: 'target', key: 'target', width: 80, align: 'center' as const, className: 'table-center-column', render: (text: string) => <Tag color="blue" style={{ fontSize: 10 }}>{text}</Tag> },
    { title: 'Title', dataIndex: 'title', key: 'title', ellipsis: true, render: (text: string) => <Text strong style={{ fontSize: 12 }}>{text}</Text> },
    { title: '공유', dataIndex: 'share', key: 'share', width: 70, align: 'center' as const, className: 'table-center-column', render: (text: string) => <Text type="secondary" style={{ fontSize: 10 }}>{text}</Text> },
    {
      title: '합성중',
      dataIndex: 'ing',
      key: 'ing',
      width: 60,
      align: 'center' as const,
      render: (val: number, record: any) => (
        <Popover content={<ManagerComparisonPopup record={record} />} title={null} trigger="hover" placement="top">
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help' }}>
            <Tag color="blue" style={{ borderRadius: 10, margin: 0 }}>{val}</Tag>
          </div>
        </Popover>
      )
    },
    {
      title: '합성완료',
      dataIndex: 'done',
      key: 'done',
      width: 70,
      align: 'center' as const,
      render: (val: number, record: any) => (
        <Popover content={<ManagerComparisonPopup record={record} />} title={null} trigger="hover" placement="top">
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help' }}>
            <Tag color="success" style={{ borderRadius: 10, margin: 0 }}>{val}</Tag>
          </div>
        </Popover>
      )
    },
    {
      title: '미배정',
      dataIndex: 'unassigned',
      key: 'unassigned',
      width: 60,
      align: 'center' as const,
      render: (val: number, record: any) => (
        <Popover content={<ManagerComparisonPopup record={record} />} title={null} trigger="hover" placement="top">
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help' }}>
            <Tag color={val > 0 ? 'error' : 'default'} style={{ borderRadius: 10, margin: 0 }}>{val}</Tag>
          </div>
        </Popover>
      )
    },
    {
      title: '총개수',
      dataIndex: 'total',
      key: 'total',
      width: 60,
      align: 'center' as const,
      render: (val: number, record: any) => (
        <Popover content={<ManagerComparisonPopup record={record} />} title={null} trigger="hover" placement="top">
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help' }}>
            <Text strong style={{ fontSize: 10 }}>{val}</Text>
          </div>
        </Popover>
      )
    },
    ...Array.from({ length: 6 }).map((_, i) => ({
      title: `담당자${i + 1}`,
      key: `manager${i + 1}`,
      width: 80,
      align: 'center' as const,
      render: (record: any) => {
        const mgrName = `담당자${i + 1}`;
        const mgr = record.managers?.find((m: any) => m.name === mgrName) || { name: mgrName, count: 0 };

        return (
          <Popover content={<ManagerComparisonPopup record={record} currentMgrName={mgr.name} />} title={null} trigger="hover" placement="top">
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help' }}>
              <Text style={{ fontSize: 11, fontWeight: 500, color: mgr.count > 0 ? token.colorText : token.colorTextTertiary }}>
                {mgr.count}
              </Text>
            </div>
          </Popover>
        );
      }
    }))
  ];

  const detailBaseColumns: any[] = [
    { title: '순번', key: 'num', width: 48, align: 'center' as const, render: (_: any, __: any, index: number) => index + 1 },
    {
      title: '그룹',
      dataIndex: 'groupNum',
      key: 'groupOrder',
      width: 72,
      align: 'center' as const,
      render: (num: number) => `G${num}`
    },
    {
      title: '프로젝트',
      dataIndex: 'project',
      key: 'project',
      width: 80,
      render: (project: string) => <Tag color="blue">{project}</Tag>
    },
    {
      title: '물질 번호 (VRN)',
      dataIndex: 'compoundId',
      key: 'compoundId',
      width: 144,
      render: (id: string) => <Text strong color={token.colorPrimary}>{id}</Text>
    },
    {
      title: '화합물 구조',
      dataIndex: 'structureSvg',
      key: 'structure',
      width: 212,
      align: 'center' as const,
      className: 'synthesis-structure-column',
      render: (structureSvg: string | undefined, record: SynthesisDetail) => {
        const structureSettings = getGroupStructureSettings(record.groupId);

        return (
          <CompoundStructureView
            svg={structureSvg}
            title={record.compoundId || record.name || 'Structure'}
            smiles={record.smiles}
            molBlock={(record as any).molBlock ?? (record as any).mol_block ?? (record as any).molblock}
            width={168}
            height={108}
            iconSize={40}
            gap={0}
            actionPlacement="overlay"
            fitRotatedBounds
            frameless
            rotationDeg={structureSettings.sarRotationDeg}
            onPreview={structureSvg ? () => setStructurePreview({ title: record.compoundId || record.name || 'Structure', svg: structureSvg }) : undefined}
          />
        );
      }
    },
    {
      title: '단계',
      dataIndex: 'experimentStage',
      key: 'experimentStage',
      width: 64,
      align: 'center' as const,
      render: (stage: number) => (
        <Text strong style={{ color: token.colorPrimary, fontSize: 11 }}>
          {stage}
        </Text>
      )
    },
    { title: '출처', dataIndex: 'designSource', key: 'designSource', width: 84 },
    { title: '디자인 비고', dataIndex: 'designMemo', key: 'designMemo', ellipsis: true, width: 220 },
  ];

  const synthesisDetailColumns: any[] = [
    {
      title: '합성 담당자',
      dataIndex: 'synthesisOwner',
      key: 'synthesisOwner',
      width: 112,
      align: 'center' as const,
      className: 'table-center-column',
      render: (owner: string | null, record: SynthesisDetail) => (
        owner ? (
          <div
            style={{
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              background: token.colorBgContainer,
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: 6,
              transition: 'all 0.2s',
            }}
            className="assignee-button"
            onClick={() => { setSelectedItem(record); setIsAssignModalOpen(true); }}
          >
            <UserPlus size={14} color={token.colorPrimary} />
            <Text style={{ fontSize: 11, fontWeight: 500, color: token.colorText }}>{owner}</Text>
          </div>
        ) : (
          <Button
            size="small"
            icon={<UserPlus size={14} />}
            onClick={() => { setSelectedItem(record); setIsAssignModalOpen(true); }}
            style={{ borderRadius: 6, fontSize: 10 }}
          >
            배정
          </Button>
        )
      )
    },
    { title: '합성 스터디 그룹 수락일자', dataIndex: 'synthesisAcceptedDate', key: 'synthesisAcceptedDate', width: 172, align: 'center' as const, className: 'table-center-column', render: (date: string | null) => date || '-' },
    { title: '합성 목표일', dataIndex: 'synthesisTargetDate', key: 'synthesisTargetDate', width: 104, align: 'center' as const, className: 'table-center-column' },
    { title: '진행사항 비고', dataIndex: 'progressMemo', key: 'progressMemo', width: 180, ellipsis: true },
    {
      title: '완료 여부',
      dataIndex: 'isCompleted',
      key: 'isCompleted',
      width: 86,
      align: 'center' as const,
      className: 'table-center-column',
      render: (isCompleted: boolean) => (
        <Tag color={isCompleted ? 'green' : 'gold'} style={{ margin: 0 }}>
          {isCompleted ? '완료' : '진행중'}
        </Tag>
      )
    },
    { title: '등록일', dataIndex: 'registeredDate', key: 'registeredDate', width: 96, align: 'center' as const, className: 'table-center-column' },
    { title: '연구노트', dataIndex: 'researchNote', key: 'researchNote', width: 108, align: 'center' as const, className: 'table-center-column' },
    { title: '리포트 자료', dataIndex: 'reportData', key: 'reportData', width: 156, ellipsis: true },
    { title: '합성 종료 이유', dataIndex: 'synthesisEndReason', key: 'synthesisEndReason', width: 164, ellipsis: true },
  ];

  const detailColumns = [
    ...detailBaseColumns,
    ...synthesisDetailColumns,
  ];
  const detailTableScrollX = SYNTHESIS_DETAIL_TABLE_MIN_WIDTH;

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
        overflowY: isResponsiveToolbar ? 'auto' : 'visible',
        overflowX: 'hidden'
      }}
    >
      {/* Top Search Header - Removed Source Toggle from here */}
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
                placeholder="그룹 또는 화합물 ID 검색"
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
            </div>
          </Col>
          <Col flex={isResponsiveToolbar ? '1 1 100%' : 'none'}>
            <div
              style={{
                display: 'flex',
                justifyContent: isResponsiveToolbar ? 'stretch' : 'flex-end',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <Button type="primary" icon={<Plus size={18} />} className="v-action-btn" style={{ background: token.colorPrimary, borderColor: token.colorPrimary, flex: isResponsiveToolbar ? '1 1 140px' : undefined }}>New Group</Button>
              <Button icon={<ClipboardList size={18} />} className="v-action-btn" style={{ flex: isResponsiveToolbar ? '1 1 140px' : undefined }}>합성 관리</Button>
              <Button icon={<ArrowLeft size={18} />} className="v-action-btn" onClick={() => navigate(-1)} style={{ flex: isResponsiveToolbar ? '1 1 140px' : undefined }}>돌아가기</Button>
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
                    <Segmented
                      options={['3개월', '6개월', '12개월', '전체']}
                      value={period}
                      onChange={(v) => setPeriod(v as string)}
                    />
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
          flexDirection: isResponsiveToolbar ? 'column' : 'row',
          gap: isResponsiveToolbar ? 20 : 0,
          minHeight: 0,
          paddingBottom: isResponsiveToolbar ? 24 : 0
        }}
      >
        {/* Left: Group List (Single Select) - Increased width for many columns */}
        <div style={{ width: isResponsiveToolbar ? '100%' : `calc(${splitRatio}% - 6px)`, minWidth: 0 }}>
          <div className="v-table-card">
            <div className="v-table-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <Text strong style={{ color: token.colorPrimary }}>합성 그룹 리스트</Text>
              </div>
            </div>
            <Table
              dataSource={currentGroups}
              columns={groupColumns}
              pagination={false}
              size="small"
              rowKey="id"
              scroll={{ x: 1200, y: !isResponsiveToolbar && currentGroups.length > 10 ? 'calc(100vh - 350px)' : undefined }}
              onRow={(record) => ({
                onClick: () => setSelectedGroupId(record.id),
                style: { cursor: 'pointer' }
              })}
              rowClassName={(record) => selectedGroupId === record.id ? 'row-selected' : ''}
            />
          </div>
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Synthesis Board 패널 너비 조절"
          aria-valuemin={SYNTHESIS_SPLIT_MIN_PERCENT}
          aria-valuemax={SYNTHESIS_SPLIT_MAX_PERCENT}
          aria-valuenow={Math.round(splitRatio)}
          tabIndex={0}
          onMouseDown={handleSplitMouseDown}
          onDoubleClick={resetSplitRatio}
          onKeyDown={handleSplitKeyDown}
          style={{
            width: 12,
            flexShrink: 0,
            cursor: 'col-resize',
            display: isResponsiveToolbar ? 'none' : 'flex',
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

        {/* Right: Synthesis Details */}
        <div style={{ flex: isResponsiveToolbar ? '0 0 auto' : 1, minWidth: 0, width: isResponsiveToolbar ? '100%' : undefined }}>
          <div className="v-table-card">
            <div className="v-table-header">
              <Text strong style={{ color: token.colorPrimary }}>합성 상세 목록</Text>
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
            </div>
            {viewMode === 'table' ? (
              <Table
                className="synthesis-detail-table"
                dataSource={filteredDetails}
                columns={detailColumns}
                size="small"
                pagination={{ pageSize: 20 }}
                rowKey="id"
                scroll={{ x: detailTableScrollX, y: !isResponsiveToolbar && filteredDetails.length > 10 ? 'calc(100vh - 350px)' : undefined }}
              />
            ) : viewMode === 'draw' ? (
              <div style={{ padding: 20, overflowY: 'auto', height: isResponsiveToolbar ? 'auto' : 'calc(100vh - 350px)' }}>
                <Row gutter={[12, 12]}>
                  {filteredDetails.map(d => (
                    <Col span={12} key={d.id}>
                      <div style={{ 
                        border: `1px solid ${token.colorBorderSecondary}`, 
                        borderRadius: 8, 
                        overflow: 'hidden',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer'
                      }}
                      className="canvas-card"
                      onClick={() => { setSelectedItem(d); setIsAssignModalOpen(true); }}
                      >
                        <div style={{ padding: '6px 10px', background: token.colorBgLayout, borderBottom: `1px solid ${token.colorBorderSecondary}`, display: 'flex', justifyContent: 'space-between' }}>
                          <Text strong style={{ color: token.colorPrimary, fontSize: 11 }}>{d.compoundId}</Text>
                          {d.synthesisOwner && <Tag color="orange" style={{ fontSize: 9, margin: 0, padding: '0 4px' }}>{d.synthesisOwner}</Tag>}
                        </div>
                        <div style={{ height: 92, display: 'flex', alignItems: 'center', justifyContent: 'center', background: token.colorBgContainer }}>
                          <CompoundStructureView
                            svg={d.structureSvg}
                            title={d.compoundId || d.name || 'Structure'}
                            smiles={d.smiles}
                            molBlock={(d as any).molBlock ?? (d as any).mol_block ?? (d as any).molblock}
                            width={118}
                            height={72}
                            iconSize={24}
                            gap={5}
                            structureStyle={{ transform: `rotate(${getGroupStructureSettings(d.groupId).sarRotationDeg}deg)` }}
                            frameStyle={{ border: 0, background: 'transparent', boxShadow: 'none' }}
                            onPreview={d.structureSvg ? () => setStructurePreview({ title: d.compoundId || d.name, svg: d.structureSvg || '' }) : undefined}
                          />
                        </div>
                      </div>
                    </Col>
                  ))}
                </Row>
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: token.colorTextTertiary }}>Tree View 준비 중...</div>
            )}
          </div>
        </div>
      </div>

      {/* Assign Manager Modal */}
      <Modal
        title="합성 요청"
        open={isAssignModalOpen}
        onCancel={() => setIsAssignModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsAssignModalOpen(false)}>닫기</Button>,
          selectedItem?.synthesisOwner && (
            <Button 
              key="remove" 
              danger 
              onClick={() => {
                // TODO: 담당자 취소 로직 (API 연동 필요)
                setIsAssignModalOpen(false);
              }}
            >
              담당자 취소
            </Button>
          ),
          <Button key="ok" type="primary" onClick={() => setIsAssignModalOpen(false)} style={{ background: token.colorPrimary, borderColor: token.colorPrimary }}>
            {selectedItem?.synthesisOwner ? '담당자 수정' : '배정 완료'}
          </Button>
        ]}
        width={450}
      >
        <div style={{ padding: '10px 0' }}>
          <div style={{ marginBottom: 20, padding: 16, background: isDarkMode ? '#2a1f1d' : '#fdf2f0', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 60, height: 40, background: token.colorBgContainer, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${token.colorBorderSecondary}` }}>
              <FlaskConical size={20} color={token.colorPrimary} />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>Selected Compound</Text><br />
              <Text strong>{selectedItem?.compoundId} ({selectedItem?.name})</Text>
            </div>
          </div>
          <Text strong>연구원 선택</Text>
          <Select
            showSearch
            placeholder="이름으로 검색하여 연구원 선택"
            style={{ width: '100%', marginTop: 8 }}
            options={[
              { value: 'r1', label: '담당자1' },
              { value: 'r2', label: '담당자2' },
              { value: 'r3', label: '담당자3' },
            ]}
          />
        </div>
      </Modal>

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
            className="synthesis-structure-preview"
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
        .row-selected {
          background-color: var(--table-row-selected-bg) !important;
        }
        .row-selected td {
          background-color: var(--table-row-selected-bg) !important;
        }
        .ant-table-tbody > tr:hover > td {
          background-color: var(--table-row-hover-bg) !important;
          cursor: pointer;
        }
        .ant-table-tbody > tr.row-selected:hover > td {
          background-color: var(--table-row-selected-hover-bg) !important;
        }
        .ant-table-tbody > tr > td {
          font-size: var(--table-cell-font-size);
        }
        .synthesis-detail-table .ant-table-tbody > tr > td.synthesis-structure-column {
          padding: 4px !important;
        }
        .synthesis-detail-table .ant-table-thead > tr > th.synthesis-structure-column {
          padding-left: 4px !important;
          padding-right: 4px !important;
        }
        .synthesis-detail-table .synthesis-structure-column .compound-structure-actions-overlay {
          top: auto;
          right: 4px;
          bottom: 4px;
        }
        .synthesis-detail-table .synthesis-structure-column .compound-structure-frame,
        .canvas-card .compound-structure-frame {
          border: 0 !important;
          outline: 0 !important;
          box-shadow: none !important;
          background: transparent !important;
        }
        .synthesis-structure-svg {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }
        .synthesis-structure-svg svg {
          display: block;
          max-width: 100%;
          max-height: 100%;
          width: auto;
          height: auto;
        }
        .synthesis-structure-svg-table svg {
          max-width: 100% !important;
          max-height: 100% !important;
          width: 100% !important;
          height: 100% !important;
        }
        .synthesis-structure-svg-card {
          padding: 8px;
          box-sizing: border-box;
        }
        .synthesis-structure-svg-card svg {
          max-width: 130px;
          max-height: 64px;
        }
        .synthesis-structure-preview-button {
          position: absolute;
          top: 3px;
          right: 3px;
          z-index: 2;
        }
        .synthesis-structure-preview-button-card {
          top: 6px;
          right: 6px;
        }
        .synthesis-structure-preview svg {
          display: block;
          max-width: calc(100% / 1.5);
          max-height: calc(100% / 1.5);
          width: auto;
          height: auto;
          transform: scale(1.5);
          transform-origin: center;
        }
        .canvas-card:hover {
          border-color: #F87C63 !important;
          box-shadow: 0 4px 12px rgba(248, 124, 99, 0.1);
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
};

export default SynthesisBoard;
