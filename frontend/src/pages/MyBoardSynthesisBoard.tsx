import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react';
import {
  Row, Col, Card, Table, Button, Input,
  Space, Typography, Modal, Form, Tag, List, Select, DatePicker, Avatar, Divider, Upload, Segmented, theme, Tooltip, Dropdown, Popover, App as AntApp, Cascader, InputNumber
} from 'antd';
import type { MenuProps } from 'antd';
import {
  Search, Plus, Filter, Settings,
  Info, ChevronDown, ChevronUp, Beaker,
  Activity, GripVertical, Upload as UploadIcon, FileText,
  UserPlus,
  PanelLeftClose, PanelLeftOpen, Copy, Trash2, Combine, Edit3, MoveRight, ArrowRight, ArrowLeft,
  Bookmark, MoreHorizontal, ZoomIn, ZoomOut, Maximize2, Crosshair, Map as MapIcon
} from 'lucide-react';
import { DEFAULT_GROUP_STRUCTURE_VIEW_SETTINGS, useBoardStore } from '../store/useBoardStore';
import { mockCompounds, type Compound, type CompoundGroup, type CompoundQuickViewerAssetType } from '../mocks/compounds';
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
import CompoundStructureView from '../components/common/CompoundStructureView';
import StructurePreviewModal from '../components/common/StructurePreviewModal';
import ToggleTag from '../components/common/ToggleTag';
import QuickViewerPanel from '../components/myboard/QuickViewerPanel';
import PlainMemoEditor from '../components/common/PlainMemoEditor';
import { compoundApi, type CompoundSearchResult } from '../services/compoundApi';
import shareForwardIconRaw from '../assets/svg/share-forward-fill.svg?raw';
import shareIconRaw from '../assets/svg/share.svg?raw';
import bookmarkIconRaw from '../assets/svg/bookmark.svg?raw';
import eyeOffIconRaw from '../assets/svg/eye-off.svg?raw';
import { formatDisplayDate, formatNumberWithComma } from '../utils/displayFormat';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;
const MYBOARD_SPLIT_MIN_PERCENT = 20;
const MYBOARD_SPLIT_MAX_PERCENT = 80;
const MYBOARD_SPLIT_DEFAULT_PERCENT = 30;
const MYBOARD_SYNTHESIS_STACKED_BREAKPOINT = 1500;
const MYBOARD_QUICK_VIEWER_MIN_WIDTH = 360;
const MYBOARD_QUICK_VIEWER_MAX_WIDTH = 868;
const MYBOARD_QUICK_VIEWER_DEFAULT_WIDTH = 460;
const MYBOARD_SHARE_STATUS_COLORS = {
  '공유 하는중': '#F87C63',
  '공유 받는중': '#1677ff',
} as const;
const createSvgMaskUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
const shareForwardIconMaskUrl = createSvgMaskUrl(shareForwardIconRaw);
const shareIconMaskUrl = createSvgMaskUrl(shareIconRaw);
const bookmarkIconMaskUrl = createSvgMaskUrl(bookmarkIconRaw);
const eyeOffIconMaskUrl = createSvgMaskUrl(eyeOffIconRaw);
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
const isChemDrawModalEventTarget = (target: EventTarget | null) => (
  target instanceof HTMLElement && Boolean(target.closest('.chemdraw-modal'))
);
const MYBOARD_RESPONSIVE_TEXT_COLUMN_MIN_WIDTH = 220;
const MYBOARD_RESPONSIVE_TEXT_COLUMN_MAX_WIDTH = 420;
const MYBOARD_GROUP_TITLE_MIN_WIDTH = 200;
const MYBOARD_GROUP_COLUMN_WIDTHS = {
  sequence: 48,
  creDate: 82,
  target: 80,
  representativeStructure: 135,
  count: 48,
  synthesisIng: 58,
  synthesisDone: 66,
  synthesisUnassigned: 58,
  synthesisStopped: 66,
  groupOrder: 46,
  shareStatus: 46,
} as const;
const MYBOARD_DATA_ASSET_ORDER: CompoundQuickViewerAssetType[] = ['kp', 'pdb', 'docking', 'md'];
const MYBOARD_DATA_ASSET_ORDER_INDEX = new Map(
  MYBOARD_DATA_ASSET_ORDER.map((assetType, index) => [assetType, index])
);
const createFixedGroupColumnStyle = (width: number): React.CSSProperties => ({
  width,
  minWidth: width,
  maxWidth: width,
});
const createFixedGroupColumnProps = (width: number) => ({
  style: createFixedGroupColumnStyle(width),
});
const MYBOARD_GROUP_FIXED_COLUMN_WIDTH = Object.values(MYBOARD_GROUP_COLUMN_WIDTHS).reduce((sum, width) => sum + width, 0);
const MYBOARD_GROUP_TABLE_WIDTH_BUFFER = 16;
const MYBOARD_GROUP_TABLE_MIN_WIDTH = MYBOARD_GROUP_FIXED_COLUMN_WIDTH + MYBOARD_GROUP_TITLE_MIN_WIDTH + MYBOARD_GROUP_TABLE_WIDTH_BUFFER;
const MYBOARD_GROUP_SCROLL_WIDTH_TOLERANCE = 4;
const MYBOARD_STRUCTURE_BASE_WIDTH = 168;
const MYBOARD_STRUCTURE_BASE_HEIGHT = 108;
const MYBOARD_STRUCTURE_BASE_PERCENT = 120;
const MYBOARD_DETAIL_STRUCTURE_MAX_HEIGHT = 250;
const MYBOARD_GROUP_STRUCTURE_WIDTH = 130;
const MYBOARD_GROUP_STRUCTURE_HEIGHT = 97.5;
const MYBOARD_GROUP_STRUCTURE_ONLY_COLUMN_WIDTH = 138;
const MYBOARD_GROUP_STRUCTURE_ONLY_PANEL_WIDTH = 146;
type SvgIntrinsicSize = { width: number; height: number };
type MyBoardGroupPinFilter = 'all' | 'pinned';
type SynthesisManagerStatus = { name: string; count: number; ing: number; done: number; stopped: number };
type SynthesisGroupStatus = {
  title: string;
  ing: number;
  done: number;
  unassigned: number;
  stopped: number;
  managers: SynthesisManagerStatus[];
};
type DesignPurposeValue = (string | number)[];
type DesignExpansionValue = (string | number)[];
type DesignFormInitialValues = Record<string, unknown>;
type SynthesisRequestFormValues = {
  synthesisRequestNo?: string;
  requiredAmountMg?: number;
  assayPurpose?: string;
  synthesisStep?: string;
  synthesisReferenceName?: string;
  expectedEffect?: string;
  requestMemo?: string;
  synthesisRequestType?: string;
};
type DesignMemoPreviewBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; src: string };

const IDEA_COMPOUND_COUNTER_STORAGE_PREFIX = 'my-board:idea-compound-counter';
const IDEA_COMPOUND_PREFIX = 'LYH';
const SYNTHESIS_REQUEST_COUNTER_STORAGE_PREFIX = 'my-board:synthesis-request-counter';
const SYNTHESIS_REQUEST_PREFIX = 'LYH';
const SYNTHESIS_REQUEST_TYPE_OPTIONS = ['신규 합성', '재합성', '스케일업', 'Salt formation/charge', '기타'];
const SYNTHESIS_REQUEST_STATUS_META = {
  requested: { label: '접수 대기', color: 'processing' },
  accepted: { label: '합성 대기', color: 'blue' },
  synthesizing: { label: '합성 중', color: 'gold' },
  vnaIssued: { label: 'VNA 코드', color: 'green' },
} as const;

const getIdeaYearMonth = () => {
  const now = new Date();
  return `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const getIdeaCounterStorageKey = (prefix: string, yearMonth: string) => (
  `${IDEA_COMPOUND_COUNTER_STORAGE_PREFIX}:${prefix}:${yearMonth}`
);

const readIdeaCounter = (prefix: string, yearMonth: string) => {
  if (typeof window === 'undefined') return 0;
  const value = Number(window.localStorage.getItem(getIdeaCounterStorageKey(prefix, yearMonth)) || '0');
  return Number.isFinite(value) ? value : 0;
};

const formatIdeaNumber = (prefix: string, yearMonth: string, sequence: number) => (
  `${prefix}-${yearMonth}-${String(sequence).padStart(4, '0')}`
);

const getCurrentYearSuffix = () => (
  String(new Date().getFullYear()).slice(-2)
);

const peekNextIdeaNumber = () => {
  const prefix = IDEA_COMPOUND_PREFIX;
  const yearMonth = getIdeaYearMonth();
  return formatIdeaNumber(prefix, yearMonth, readIdeaCounter(prefix, yearMonth) + 1);
};

const reserveNextIdeaNumber = () => {
  const prefix = IDEA_COMPOUND_PREFIX;
  const yearMonth = getIdeaYearMonth();
  const nextSequence = readIdeaCounter(prefix, yearMonth) + 1;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(getIdeaCounterStorageKey(prefix, yearMonth), String(nextSequence));
  }
  return formatIdeaNumber(prefix, yearMonth, nextSequence);
};

const getSynthesisRequestCounterStorageKey = (prefix: string, year: string) => (
  `${SYNTHESIS_REQUEST_COUNTER_STORAGE_PREFIX}:${prefix}:${year}`
);

const readSynthesisRequestCounter = (prefix: string, year: string) => {
  if (typeof window === 'undefined') return 0;
  const value = Number(window.localStorage.getItem(getSynthesisRequestCounterStorageKey(prefix, year)) || '0');
  return Number.isFinite(value) ? value : 0;
};

const formatSynthesisRequestNumber = (prefix: string, year: string, sequence: number) => (
  `${prefix}-${year}-${String(sequence).padStart(4, '0')}`
);

const isSynthesisRequestNumber = (value?: string) => (
  new RegExp(`^${SYNTHESIS_REQUEST_PREFIX}-\\d{2}-\\d{4}$`).test(String(value || '').trim())
);

const peekNextSynthesisRequestNumber = () => {
  const prefix = SYNTHESIS_REQUEST_PREFIX;
  const year = getCurrentYearSuffix();
  return formatSynthesisRequestNumber(prefix, year, readSynthesisRequestCounter(prefix, year) + 1);
};

const reserveNextSynthesisRequestNumber = () => {
  const prefix = SYNTHESIS_REQUEST_PREFIX;
  const year = getCurrentYearSuffix();
  const nextSequence = readSynthesisRequestCounter(prefix, year) + 1;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(getSynthesisRequestCounterStorageKey(prefix, year), String(nextSequence));
  }
  return formatSynthesisRequestNumber(prefix, year, nextSequence);
};

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
  'quickViewerAssets',
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

interface MyBoardTreeMetric {
  label: string;
  value: number | string;
  delta?: number;
  unit?: string;
}

interface MyBoardTreeNode {
  id: string;
  parentId?: string;
  compound: Compound;
  x: number;
  y: number;
  depth: number;
  changeType: 'Core' | 'Replace' | 'Expand' | 'Optimize';
  changeLabel: string;
  metrics: MyBoardTreeMetric[];
}

const MYBOARD_TREE_CANVAS_WIDTH = 2280;
const MYBOARD_TREE_CANVAS_HEIGHT = 900;
const MYBOARD_TREE_NODE_WIDTH = 392;
const MYBOARD_TREE_NODE_HEIGHT = 138;
const MYBOARD_TREE_ZOOM_MIN = 0.35;
const MYBOARD_TREE_ZOOM_MAX = 1.6;
const MYBOARD_TREE_ZOOM_STEP = 0.1;

interface MyBoardTreeFlowNodeData extends Record<string, unknown>, MyBoardTreeNode {
  onStructureGenerated: (compoundId: string, data: { molBlock: string; svg: string; cacheKey: string }) => void;
  onPreview: (compound: Compound, previewSvg: string) => void;
}

type MyBoardTreeFlowNode = Node<MyBoardTreeFlowNodeData, 'myBoardTree'>;
type MyBoardTreeFlowEdge = Edge;

const renderTreeMetricValue = (metric: MyBoardTreeMetric) => {
  const value = typeof metric.value === 'number'
    ? formatNumberWithComma(metric.value)
    : metric.value;
  return `${value}${metric.unit ?? ''}`;
};

const renderTreeMetricDelta = (delta?: number) => {
  if (typeof delta !== 'number') return null;
  const isPositive = delta > 0;
  const isNeutral = delta === 0;

  return (
    <span className={`my-board-tree-metric-delta ${isNeutral ? 'neutral' : isPositive ? 'positive' : 'negative'}`}>
      {isPositive ? '+' : ''}{formatNumberWithComma(delta)}
    </span>
  );
};

const MyBoardTreeFlowNode: React.FC<NodeProps<MyBoardTreeFlowNode>> = React.memo(({ data }) => {
  const { compound } = data;

  return (
    <div className={`my-board-tree-node my-board-tree-node-depth-${data.depth}`}>
      <Handle type="target" position={Position.Left} />
      <div className="my-board-tree-node-header">
        <span className="my-board-tree-checkbox" aria-hidden="true" />
        <Tag className={`my-board-tree-change-tag my-board-tree-change-${data.changeType.toLowerCase()}`}>
          {data.changeLabel}
        </Tag>
        <Text strong ellipsis className="my-board-tree-compound-id">
          {compound.compoundId || compound.designNo || compound.name}
        </Text>
        <Button
          type="text"
          size="small"
          icon={<Bookmark size={13} />}
          className="my-board-tree-icon-button nodrag"
        />
        <Button
          type="text"
          size="small"
          icon={<MoreHorizontal size={14} />}
          className="my-board-tree-icon-button nodrag"
        />
      </div>
      <div className="my-board-tree-node-body">
        <div className="my-board-tree-structure-pane nodrag">
          <CompoundStructureView
            svg={compound.structureSvg}
            rdkitSvg={compound.rdkitSvg}
            rdkitSvgCache={compound.rdkitSvgCache}
            title={compound.compoundId || compound.name || 'Structure'}
            smiles={compound.smiles}
            molBlock={compound.molBlock ?? compound.mol_block ?? compound.molblock}
            cdxml={compound.draw}
            width={132}
            height={96}
            iconSize={34}
            gap={0}
            actionPlacement="overlay"
            actionOverlayAnchor="frame"
            actionOverlayPlacement="bottom-right"
            frameless
            preferRdkitSvg
            rdkitScalePercent={112}
            onStructureGenerated={(generatedData) => data.onStructureGenerated(compound.id, generatedData)}
            onPreview={(previewSvg) => {
              if (!previewSvg) return;
              data.onPreview(compound, previewSvg);
            }}
          />
        </div>
        <div className="my-board-tree-metrics">
          {data.metrics.map((metric) => (
            <div key={metric.label} className="my-board-tree-metric-row">
              <span className="my-board-tree-metric-label">{metric.label}</span>
              <span className="my-board-tree-metric-value">{renderTreeMetricValue(metric)}</span>
              {renderTreeMetricDelta(metric.delta)}
            </div>
          ))}
        </div>
        <div className="my-board-tree-molprops">
          <Tooltip title="MolProp1">
            <div className="my-board-tree-molprop-chart" aria-label="MolProp1">
              {compound.properties1 ? <RadarChart data={compound.properties1} size={46} /> : <Text type="secondary">-</Text>}
            </div>
          </Tooltip>
          <Tooltip title="MolProp2">
            <div className="my-board-tree-molprop-chart" aria-label="MolProp2">
              {compound.properties2 ? <RadarChart data={compound.properties2} size={46} color="#5856d6" /> : <Text type="secondary">-</Text>}
            </div>
          </Tooltip>
        </div>
      </div>
      <button type="button" className="my-board-tree-add-child nodrag" aria-label="하위 디자인 추가">
        <Plus size={14} />
      </button>
      <Handle type="source" position={Position.Right} />
    </div>
  );
});

const myBoardTreeNodeTypes = {
  myBoardTree: MyBoardTreeFlowNode,
};

const ManagerComparisonPopup = ({ record, currentMgrName }: { record: SynthesisGroupStatus; currentMgrName?: string }) => {
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
            <th style={{ textAlign: 'center', padding: '4px 0', fontSize: 10, color: token.colorTextSecondary }}>합성 중</th>
            <th style={{ textAlign: 'center', padding: '4px 0', fontSize: 10, color: token.colorTextSecondary }}>완료</th>
            <th style={{ textAlign: 'center', padding: '4px 0', fontSize: 10, color: token.colorTextSecondary }}>중단</th>
            <th style={{ textAlign: 'center', padding: '4px 0', fontSize: 10, color: token.colorTextSecondary }}>합계</th>
          </tr>
        </thead>
        <tbody>
          {record.managers.length > 0 ? record.managers.map((manager) => (
            <tr key={manager.name} style={{ background: manager.name === currentMgrName ? token.colorPrimaryBg : 'transparent' }}>
              <td style={{ padding: '6px 0', fontSize: 11 }}>
                <Text strong={manager.name === currentMgrName}>{manager.name}</Text>
              </td>
              <td style={{ textAlign: 'center', fontSize: 10, color: '#1890ff' }}>{manager.ing}</td>
              <td style={{ textAlign: 'center', fontSize: 10, color: '#52c41a' }}>{manager.done}</td>
              <td style={{ textAlign: 'center', fontSize: 10, color: token.colorError }}>{manager.stopped}</td>
              <td style={{ textAlign: 'center', fontSize: 10, fontWeight: 600 }}>{manager.count}</td>
            </tr>
          )) : (
            <tr>
              <td colSpan={5} style={{ padding: '10px 0', textAlign: 'center', fontSize: 11, color: token.colorTextTertiary }}>
                배정된 합성 담당자가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

const MyBoardSynthesisBoard: React.FC = () => {
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const { modal } = AntApp.useApp();
  const { setHeaderContent } = useUIStore();
  const {
    selectedGroupIds,
    hiddenCompoundIds,
    toggleGroupSelection,
    setSelectedGroupIds,
    setSelectedSarCompoundIds,
    hideCompounds,
    bookmarkedGroupIds,
    toggleBookmarkedGroup,
    compoundLoginToken,
    externalCompoundRows,
    addExternalCompoundRow,
    setExternalCompoundRows,
    setCompoundSarData,
    groups,
    groupStructureViewSettings,
    mergeGroups,
    copyGroup,
    deleteGroups,
  } = useBoardStore();
  const { currentUser } = useUserStore();
  const [designForm] = Form.useForm();
  const [synthesisRequestForm] = Form.useForm<SynthesisRequestFormValues>();
  const designReferenceName = Form.useWatch('referenceName', designForm) as string | undefined;
  const synthesisReferenceName = Form.useWatch('synthesisReferenceName', synthesisRequestForm) as string | undefined;
  const synthesisRequestFormValues = Form.useWatch([], synthesisRequestForm) as SynthesisRequestFormValues | undefined;
  const [designFormInitialValues, setDesignFormInitialValues] = useState<DesignFormInitialValues>({});
  const [synthesisRequestTarget, setSynthesisRequestTarget] = useState<Compound | null>(null);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isDesignModalOpen, setIsDesignModalOpen] = useState(false);
  const [isSynthesisRequestModalOpen, setIsSynthesisRequestModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isStructureModalOpen, setIsStructureModalOpen] = useState(false);
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isMergeGroupModalOpen, setIsMergeGroupModalOpen] = useState(false);
  const [isCompoundGroupSelectModalOpen, setIsCompoundGroupSelectModalOpen] = useState(false);
  const [isCompoundEditModalOpen, setIsCompoundEditModalOpen] = useState(false);
  const [mergeGroupName, setMergeGroupName] = useState('');
  const [quickAddCode, setQuickAddCode] = useState('');
  const [quickAddResults, setQuickAddResults] = useState<CompoundSearchResult[]>([]);
  const [selectedQuickAddCode, setSelectedQuickAddCode] = useState('');
  const [isQuickAddSearching, setIsQuickAddSearching] = useState(false);
  const [isQuickAddAdding, setIsQuickAddAdding] = useState(false);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [isSarDataLoading, setIsSarDataLoading] = useState(false);
  const [cdjsInstance, setCdjsInstance] = useState<any>(null);
  const [designSmiles, setDesignSmiles] = useState('');
  const [designSmilesError, setDesignSmilesError] = useState('');
  const [selectedDesignPurposes, setSelectedDesignPurposes] = useState<DesignPurposeValue[]>([]);
  const [selectedDesignExpansions, setSelectedDesignExpansions] = useState<DesignExpansionValue[]>([]);
  const [selectedSynthesisRequestPurposes, setSelectedSynthesisRequestPurposes] = useState<DesignPurposeValue[]>([]);
  const [selectedSynthesisRequestSteps, setSelectedSynthesisRequestSteps] = useState<DesignExpansionValue[]>([]);
  const [searchedSvg, setSearchedSvg] = useState<string | null>(null);
  const [structurePreview, setStructurePreview] = useState<{
    title: string;
    svg: string;
    smiles?: string | null;
    molblock?: string | null;
    cdxml?: string | null;
  } | null>(null);
  const [quickViewer, setQuickViewer] = useState<{
    compound: Compound;
    activeType: CompoundQuickViewerAssetType;
  } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode] = useState<'table' | 'draw' | 'tree'>('table');
  const [treeZoom, setTreeZoom] = useState(1);
  const [treeFlowInstance, setTreeFlowInstance] = useState<ReactFlowInstance<MyBoardTreeFlowNode, MyBoardTreeFlowEdge> | null>(null);
  const [isTreeMiniMapVisible, setIsTreeMiniMapVisible] = useState(true);
  const whiteboardCanvasStateRef = React.useRef<Record<string, unknown> | string | null>(null);
  const [detailCompoundTypeFilter, setDetailCompoundTypeFilter] = useState<'all' | 'design' | 'compound'>('all');
  const [compoundRows, setCompoundRows] = useState<Compound[]>(() => (
    insertCompoundsAfterGroupTail(
      mockCompounds.filter((compound) => !externalCompoundRows.some((external) => external.id === compound.id)),
      externalCompoundRows
    )
  ));
  const [selectedDetailCompoundIds, setSelectedDetailCompoundIds] = useState<React.Key[]>([]);
  const [detailPagination, setDetailPagination] = useState({ current: 1, pageSize: 10 });
  const [compoundGroupAction, setCompoundGroupAction] = useState<'move' | 'copy'>('move');
  const [selectedCompoundTargetGroupId, setSelectedCompoundTargetGroupId] = useState<string>();
  const [selectedSynthesisItem, setSelectedSynthesisItem] = useState<Compound | null>(null);
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
  const detailViewContentRef = React.useRef<HTMLDivElement | null>(null);
  const [groupTableScrollY, setGroupTableScrollY] = useState<number | undefined>(undefined);
  const [detailTableScrollY, setDetailTableScrollY] = useState<number | undefined>(() => {
    if (typeof window === 'undefined') return undefined;
    return Math.max(160, window.innerHeight - 330);
  });
  const [detailViewContentHeight, setDetailViewContentHeight] = useState<number>(() => {
    if (typeof window === 'undefined') return 650;
    return Math.max(360, window.innerHeight - 330);
  });
  const [detailUniformRowHeight, setDetailUniformRowHeight] = useState<number | null>(null);
  const [detailStructureSvgSizes, setDetailStructureSvgSizes] = useState<Record<string, SvgIntrinsicSize>>({});
  const [groupListMode, setGroupListMode] = useState<'full' | 'structure' | 'hidden'>('full');
  const [groupPinFilter, setGroupPinFilter] = useState<MyBoardGroupPinFilter>('all');
  const [viewportWidth, setViewportWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 1920;
    return window.innerWidth;
  });

  useEffect(() => {
    const query = quickAddCode.trim();
    setSelectedQuickAddCode((current) => current && current !== query ? '' : current);

    if (!isQuickAddModalOpen || !query || !compoundLoginToken.trim()) {
      setQuickAddResults([]);
      setIsQuickAddSearching(false);
      setQuickAddError(null);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setIsQuickAddSearching(true);
      setQuickAddError(null);
      compoundApi.searchCompounds(compoundLoginToken, query, { signal: controller.signal })
        .then((results) => {
          setQuickAddResults(results);
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          setQuickAddResults([]);
          setQuickAddError(error instanceof Error ? error.message : 'Compound 조회에 실패했습니다.');
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsQuickAddSearching(false);
          }
        });
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [compoundLoginToken, isQuickAddModalOpen, quickAddCode]);

  useEffect(() => {
    if (externalCompoundRows.length === 0) return;

    setCompoundRows((prev) => insertCompoundsAfterGroupTail(
      prev.filter((compound) => !externalCompoundRows.some((external) => external.id === compound.id)),
      externalCompoundRows
    ));
  }, [externalCompoundRows]);
  const handleCompoundStructureGenerated = React.useCallback((
    compoundId: string,
    data: { molBlock: string; svg: string; cacheKey: string }
  ) => {
    const svgSize = getSvgIntrinsicSize(data.svg);
    if (svgSize) {
      setDetailStructureSvgSizes((prev) => {
        const current = prev[compoundId];
        if (current?.width === svgSize.width && current?.height === svgSize.height) return prev;
        return {
          ...prev,
          [compoundId]: svgSize,
        };
      });
    }

    const applyGeneratedStructure = (compound: Compound): Compound => {
      const nextCache = {
        ...(compound.rdkitSvgCache ?? {}),
        [data.cacheKey]: data.svg,
      };

      return {
        ...compound,
        molBlock: compound.molBlock || data.molBlock || undefined,
        rdkitSvg: compound.rdkitSvg || data.svg,
        rdkitSvgCache: nextCache,
      };
    };

    setCompoundRows((prevRows) => prevRows.map((compound) => (
      compound.id === compoundId ? applyGeneratedStructure(compound) : compound
    )));

    const mockCompound = mockCompounds.find((compound) => compound.id === compoundId);
    if (mockCompound) {
      if (!mockCompound.molBlock && data.molBlock) {
        mockCompound.molBlock = data.molBlock;
      }
      mockCompound.rdkitSvg = mockCompound.rdkitSvg || data.svg;
      mockCompound.rdkitSvgCache = {
        ...(mockCompound.rdkitSvgCache ?? {}),
        [data.cacheKey]: data.svg,
      };
    }
  }, []);
  const layoutPreset = React.useMemo(() => getPatentAnalysisLayoutPreset(viewportWidth), [viewportWidth]);
  const isStackedSplitLayout = viewportWidth <= MYBOARD_SYNTHESIS_STACKED_BREAKPOINT;
  const isGroupListFull = groupListMode === 'full';
  const isGroupListStructureOnly = groupListMode === 'structure';
  const isGroupListHidden = groupListMode === 'hidden';
  const initialGroupListPanelWidth = React.useMemo(() => {
    if (isStackedSplitLayout) return null;

    const containerWidth = Math.max(viewportWidth - layoutPreset.sidePadding * 2 - 12, 320);
    const maxWidth = (containerWidth * MYBOARD_SPLIT_MAX_PERCENT) / 100 - 6;
    const minWidth = (containerWidth * MYBOARD_SPLIT_MIN_PERCENT) / 100 - 6;

    return Math.min(Math.max(MYBOARD_GROUP_TABLE_MIN_WIDTH + MYBOARD_GROUP_SCROLL_WIDTH_TOLERANCE, minWidth), maxWidth);
  }, [isStackedSplitLayout, layoutPreset.sidePadding, viewportWidth]);
  const [splitRatio, setSplitRatio] = useState<number>(MYBOARD_SPLIT_DEFAULT_PERCENT);
  const [splitLeftWidth, setSplitLeftWidth] = useState<number | null>(initialGroupListPanelWidth);
  const [initialSplitLeftMinWidth, setInitialSplitLeftMinWidth] = useState<number | null>(null);
  const [isResizingSplit, setIsResizingSplit] = useState(false);
  const splitContainerRef = React.useRef<HTMLDivElement | null>(null);
  const groupListTableCardRef = React.useRef<HTMLDivElement | null>(null);
  const splitRafRef = React.useRef<number | null>(null);
  const hasAppliedInitialSplitRef = React.useRef(false);
  const [quickViewerWidth, setQuickViewerWidth] = useState(MYBOARD_QUICK_VIEWER_DEFAULT_WIDTH);
  const [isResizingQuickViewer, setIsResizingQuickViewer] = useState(false);
  const quickViewerPaneRef = React.useRef<HTMLDivElement | null>(null);
  const quickViewerResizeRafRef = React.useRef<number | null>(null);
  const quickViewerStorageKey = 'my-board-split:quick-viewer';
  const [groupListTableWidth, setGroupListTableWidth] = useState(0);
  const groupSelectionAnchorRef = React.useRef<string | null>(null);
  const detailSelectionAnchorRef = React.useRef<string | null>(null);
  const bookmarkedGroupIdSet = React.useMemo(() => new Set(bookmarkedGroupIds), [bookmarkedGroupIds]);
  const pinnedGroupCount = React.useMemo(
    () => groups.reduce((count, group) => count + (bookmarkedGroupIdSet.has(group.id) ? 1 : 0), 0),
    [bookmarkedGroupIdSet, groups]
  );
  const sortedGroupRows = React.useMemo(
    () => [...groups]
      .sort((a, b) => {
        const aBookmarked = bookmarkedGroupIdSet.has(a.id);
        const bBookmarked = bookmarkedGroupIdSet.has(b.id);
        if (aBookmarked !== bBookmarked) return aBookmarked ? -1 : 1;
        if (aBookmarked && bBookmarked) {
          return bookmarkedGroupIds.indexOf(a.id) - bookmarkedGroupIds.indexOf(b.id);
        }
        return groups.indexOf(a) - groups.indexOf(b);
      }),
    [bookmarkedGroupIdSet, bookmarkedGroupIds, groups]
  );
  const visibleGroupRows = React.useMemo(
    () => (
      groupPinFilter === 'pinned'
        ? sortedGroupRows.filter((group) => bookmarkedGroupIdSet.has(group.id))
        : sortedGroupRows
    ),
    [bookmarkedGroupIdSet, groupPinFilter, sortedGroupRows]
  );
  const clampSplitRatio = React.useCallback((value: number) => {
    return Math.min(Math.max(value, MYBOARD_SPLIT_MIN_PERCENT), MYBOARD_SPLIT_MAX_PERCENT);
  }, []);
  const getSplitWidthFromRatio = React.useCallback((ratio: number, containerWidth: number) => {
    return Math.max((containerWidth * clampSplitRatio(ratio)) / 100 - 6, 0);
  }, [clampSplitRatio]);
  const clampSplitLeftWidth = React.useCallback((width: number, containerWidth: number) => {
    const maxWidth = getSplitWidthFromRatio(MYBOARD_SPLIT_MAX_PERCENT, containerWidth);
    const defaultMinWidth = getSplitWidthFromRatio(MYBOARD_SPLIT_MIN_PERCENT, containerWidth);
    const minWidth = Math.min(Math.max(defaultMinWidth, initialSplitLeftMinWidth ?? 0), maxWidth);

    return Math.min(Math.max(width, minWidth), maxWidth);
  }, [getSplitWidthFromRatio, initialSplitLeftMinWidth]);
  const applySplitRatio = React.useCallback((ratio: number) => {
    const nextRatio = clampSplitRatio(ratio);
    const container = splitContainerRef.current;

    setSplitRatio(nextRatio);

    if (!container) {
      setSplitLeftWidth(null);
      return;
    }

    const containerWidth = container.getBoundingClientRect().width;
    if (containerWidth <= 0) return;

    const nextWidth = clampSplitLeftWidth(getSplitWidthFromRatio(nextRatio, containerWidth), containerWidth);
    const ratioFromWidth = ((nextWidth + 6) / containerWidth) * 100;

    setSplitLeftWidth(nextWidth);
    setSplitRatio(clampSplitRatio(ratioFromWidth));
  }, [clampSplitLeftWidth, clampSplitRatio, getSplitWidthFromRatio]);
  const detailTableEstimatedWidth = React.useMemo(() => {
    if (isStackedSplitLayout || isGroupListHidden) {
      return Math.max(viewportWidth - layoutPreset.sidePadding * 2 - 24, 320);
    }

    const availableWidth = Math.max(viewportWidth - layoutPreset.sidePadding * 2 - 12, 320);
    const leftWidth = splitLeftWidth ?? getSplitWidthFromRatio(splitRatio, availableWidth);

    return Math.max(availableWidth - leftWidth - 12, 320);
  }, [getSplitWidthFromRatio, isGroupListHidden, isStackedSplitLayout, layoutPreset.sidePadding, splitLeftWidth, splitRatio, viewportWidth]);
  const groupTableTitleWidth = React.useMemo(() => {
    const availableContainerWidth = isStackedSplitLayout
      ? Math.max(viewportWidth - layoutPreset.sidePadding * 2 - 24, 320)
      : Math.max(splitLeftWidth ?? getSplitWidthFromRatio(splitRatio, viewportWidth - layoutPreset.sidePadding * 2 - 12), 260);
    const containerWidth = isStackedSplitLayout
      ? Math.min(availableContainerWidth, MYBOARD_GROUP_TABLE_MIN_WIDTH)
      : availableContainerWidth;
    const availableTitleWidth = Math.max(
      containerWidth - MYBOARD_GROUP_FIXED_COLUMN_WIDTH - MYBOARD_GROUP_TABLE_WIDTH_BUFFER,
      MYBOARD_GROUP_TITLE_MIN_WIDTH
    );

    return Math.round(availableTitleWidth);
  }, [getSplitWidthFromRatio, isStackedSplitLayout, layoutPreset.sidePadding, splitLeftWidth, splitRatio, viewportWidth]);
  const autoFitGroupTableWidth = React.useMemo(() => {
    return MYBOARD_GROUP_TABLE_MIN_WIDTH + MYBOARD_GROUP_SCROLL_WIDTH_TOLERANCE;
  }, []);
  const splitMinRatio = React.useMemo(() => {
    const containerWidth = splitContainerRef.current?.getBoundingClientRect().width ?? 0;
    if (containerWidth <= 0 || initialSplitLeftMinWidth === null) return MYBOARD_SPLIT_MIN_PERCENT;

    return clampSplitRatio(((initialSplitLeftMinWidth + 6) / containerWidth) * 100);
  }, [clampSplitRatio, groupListTableWidth, initialSplitLeftMinWidth, viewportWidth]);
  const applyDefaultGroupListSplit = React.useCallback((options?: { fallbackToPercent?: boolean; lockAsInitialMin?: boolean }) => {
    const fallbackToPercent = options?.fallbackToPercent ?? true;
    const container = splitContainerRef.current;
    if (!container || isStackedSplitLayout || !isGroupListFull) {
      if (fallbackToPercent) {
        applySplitRatio(MYBOARD_SPLIT_DEFAULT_PERCENT);
      }
      return false;
    }

    const containerWidth = container.getBoundingClientRect().width;
    if (containerWidth <= 0) {
      if (fallbackToPercent) {
        applySplitRatio(MYBOARD_SPLIT_DEFAULT_PERCENT);
      }
      return false;
    }

    const nextWidth = clampSplitLeftWidth(autoFitGroupTableWidth, containerWidth);
    const nextRatio = ((nextWidth + 6) / containerWidth) * 100;
    setSplitLeftWidth(nextWidth);
    if (options?.lockAsInitialMin) {
      setInitialSplitLeftMinWidth((current) => current ?? nextWidth);
    }
    setSplitRatio(clampSplitRatio(nextRatio));
    return true;
  }, [applySplitRatio, autoFitGroupTableWidth, clampSplitLeftWidth, clampSplitRatio, isGroupListFull, isStackedSplitLayout]);

  useEffect(() => {
    setHeaderContent(
      <PageHeaderBreadcrumb
        items={[
          { label: 'Design', onClick: () => navigate('/myboard') },
          { label: '합성 관리' },
        ]}
      />
    );
    return () => setHeaderContent(null);
  }, [navigate, setHeaderContent]);

  React.useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  React.useLayoutEffect(() => {
    if (hasAppliedInitialSplitRef.current) return;
    let frameId = 0;
    let attemptCount = 0;

    const applyInitialSplit = () => {
      const didApply = applyDefaultGroupListSplit({ fallbackToPercent: false, lockAsInitialMin: true });
      if (didApply) {
        hasAppliedInitialSplitRef.current = true;
        return;
      }

      attemptCount += 1;
      if (attemptCount < 10) {
        frameId = window.requestAnimationFrame(applyInitialSplit);
      }
    };

    frameId = window.requestAnimationFrame(applyInitialSplit);

    return () => window.cancelAnimationFrame(frameId);
  }, [applyDefaultGroupListSplit]);

  React.useEffect(() => {
    const raw = window.localStorage.getItem(quickViewerStorageKey);
    if (!raw) return;

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;

    setQuickViewerWidth(Math.min(
      Math.max(parsed, MYBOARD_QUICK_VIEWER_MIN_WIDTH),
      MYBOARD_QUICK_VIEWER_MAX_WIDTH
    ));
  }, []);

  React.useEffect(() => {
    window.localStorage.setItem(quickViewerStorageKey, String(quickViewerWidth));
  }, [quickViewerWidth]);

  React.useEffect(() => {
    const container = splitContainerRef.current;
    if (
      !container ||
      splitLeftWidth !== null ||
      isStackedSplitLayout ||
      isGroupListHidden ||
      isGroupListStructureOnly
    ) return;

    const containerWidth = container.getBoundingClientRect().width;
    if (containerWidth <= 0) return;

    setSplitLeftWidth(getSplitWidthFromRatio(splitRatio, containerWidth));
  }, [getSplitWidthFromRatio, isGroupListHidden, isGroupListStructureOnly, isStackedSplitLayout, splitLeftWidth, splitRatio]);

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
    const nextWidth = clampSplitLeftWidth(clientX - rect.left - 6, rect.width);
    const nextRatio = ((nextWidth + 6) / rect.width) * 100;

    setSplitLeftWidth(nextWidth);
    setSplitRatio(clampSplitRatio(nextRatio));
  }, [clampSplitLeftWidth, clampSplitRatio]);

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
      applySplitRatio(splitRatio - step);
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      applySplitRatio(splitRatio + step);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      applySplitRatio(MYBOARD_SPLIT_MIN_PERCENT);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      applySplitRatio(MYBOARD_SPLIT_MAX_PERCENT);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      applyDefaultGroupListSplit();
    }
  }, [applyDefaultGroupListSplit, applySplitRatio, splitRatio]);

  const stopQuickViewerResize = React.useCallback(() => {
    setIsResizingQuickViewer(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  const updateQuickViewerWidthFromClientX = React.useCallback((clientX: number) => {
    const availableWidth = Math.max(viewportWidth - layoutPreset.sidePadding * 2, 320);
    const maxWidth = Math.min(MYBOARD_QUICK_VIEWER_MAX_WIDTH, Math.max(availableWidth - 360, MYBOARD_QUICK_VIEWER_MIN_WIDTH));
    const paneRight = quickViewerPaneRef.current?.getBoundingClientRect().right ?? window.innerWidth - layoutPreset.sidePadding;
    const nextWidth = Math.min(
      Math.max(paneRight - clientX, MYBOARD_QUICK_VIEWER_MIN_WIDTH),
      maxWidth
    );

    setQuickViewerWidth(nextWidth);
  }, [layoutPreset.sidePadding, viewportWidth]);

  React.useEffect(() => {
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
      setQuickViewerWidth((width) => Math.min(width + step, MYBOARD_QUICK_VIEWER_MAX_WIDTH));
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setQuickViewerWidth((width) => Math.max(width - step, MYBOARD_QUICK_VIEWER_MIN_WIDTH));
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setQuickViewerWidth(MYBOARD_QUICK_VIEWER_MIN_WIDTH);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setQuickViewerWidth(MYBOARD_QUICK_VIEWER_MAX_WIDTH);
    }
  }, []);

  const fitGroupListToTableData = React.useCallback((event?: React.MouseEvent<HTMLDivElement>) => {
    event?.preventDefault();
    event?.stopPropagation();
    stopSplitResize();

    applyDefaultGroupListSplit();
  }, [applyDefaultGroupListSplit, stopSplitResize]);

  const alwaysColumnKeys = React.useMemo(() => [
    '순번', '그룹 번호', '프로젝트', '물질 번호 (VRN)', '화합물 구조', '데이터', '단계', '출처', '디자인 비고'
  ], []);
  const synthesisDetailColumnKeys = React.useMemo(() => [
    '합성 담당자',
    '합성 스터디 그룹 수락일자',
    '합성 목표일',
    '진행사항 비고',
    '완료 여부',
    '등록일',
    '연구노트',
    '리포트 자료',
    '합성 종료 이유',
  ], []);
  const defaultOrder = React.useMemo(
    () => [...alwaysColumnKeys, ...synthesisDetailColumnKeys],
    [alwaysColumnKeys, synthesisDetailColumnKeys]
  );
  const defaultActive = React.useMemo(
    () => [...alwaysColumnKeys, ...synthesisDetailColumnKeys],
    [alwaysColumnKeys, synthesisDetailColumnKeys]
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
  }, [defaultOrder, defaultActive]);

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
  const designPurposeOptions = [
    {
      value: '신규 컨셉 탐색',
      label: '신규 컨셉 탐색',
      children: ['신규 코어', '포켓 확장', '공유 결합'].map((label) => ({ value: label, label })),
    },
    {
      value: '활성/물성 최적화',
      label: '활성/물성 최적화',
      children: ['활성', '선택성', '뇌투과', '용해도', 'PPB', 'MS', 'CYP', 'hERG', 'PK', 'Salt formation/charge'].map((label) => ({ value: label, label })),
    },
    {
      value: '레퍼런스',
      label: '레퍼런스',
    },
    { value: 'in vivo', label: 'in vivo' },
    { value: '특허 대응', label: '특허 대응' },
  ];
  const designExpansionOptions = [
    { value: '컨셉 확인 (5종 이하)', label: '컨셉 확인 (5종 이하)' },
    { value: '컨셉 확장 (10종 이상)', label: '컨셉 확장 (10종 이상)' },
    { value: '컨셉 집중 (50종 이상)', label: '컨셉 집중 (50종 이상)' },
    {
      value: '기타',
      label: '기타',
      children: ['PK', 'in vivo', '재합성', '레퍼런스', '스케일업'].map((label) => ({ value: label, label })),
    },
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
  const getGroupStructureSettings = React.useCallback((groupId: string) => ({
    ...DEFAULT_GROUP_STRUCTURE_VIEW_SETTINGS,
    ...groupStructureViewSettings[groupId],
  }), [groupStructureViewSettings]);

  const filteredCompounds = React.useMemo(() => {
    return compoundRows
      .filter((compound) => {
        const hasCompoundId = compound.compoundId.trim().length > 0;
        // If it's a structure search results mode, don't filter out by the keyword string
        const matchesKeyword = keyword === 'Structure Search Result' ||
          compound.name.toLowerCase().includes(keyword.toLowerCase()) ||
          compound.compoundId.toLowerCase().includes(keyword.toLowerCase()) ||
          compound.smiles.toLowerCase().includes(keyword.toLowerCase());

        if (hiddenCompoundIds.includes(compound.id)) return false;
        if (detailCompoundTypeFilter === 'design' && hasCompoundId) return false;
        if (detailCompoundTypeFilter === 'compound' && !hasCompoundId) return false;
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
  }, [compoundRows, detailCompoundTypeFilter, hiddenCompoundIds, keyword, selectedGroupIds, selectedGroupOrderMap, selectedProjects, selectedShares, selectedSources]);

  const treeCompounds = React.useMemo(() => {
    const sourceRows = filteredCompounds.length > 0
      ? filteredCompounds
      : compoundRows.filter((compound) => !hiddenCompoundIds.includes(compound.id));

    return sourceRows.slice(0, 14);
  }, [compoundRows, filteredCompounds, hiddenCompoundIds]);

  const treeNodes = React.useMemo<MyBoardTreeNode[]>(() => {
    if (treeCompounds.length === 0) return [];

    const positions = [
      { id: 'root', x: 28, y: 286, depth: 1, parentId: undefined, changeType: 'Core' as const, changeLabel: '+Design' },
      { id: 'branch-a', x: 472, y: 286, depth: 2, parentId: 'root', changeType: 'Replace' as const, changeLabel: 'Replace' },
      { id: 'branch-b', x: 472, y: 554, depth: 2, parentId: 'root', changeType: 'Expand' as const, changeLabel: 'Expand' },
      { id: 'a-1', x: 916, y: 78, depth: 3, parentId: 'branch-a', changeType: 'Replace' as const, changeLabel: 'R1' },
      { id: 'a-2', x: 916, y: 244, depth: 3, parentId: 'branch-a', changeType: 'Replace' as const, changeLabel: 'R2' },
      { id: 'a-3', x: 916, y: 410, depth: 3, parentId: 'branch-a', changeType: 'Replace' as const, changeLabel: 'R3' },
      { id: 'b-1', x: 916, y: 626, depth: 3, parentId: 'branch-b', changeType: 'Optimize' as const, changeLabel: 'Linker' },
      { id: 'a-1-1', x: 1360, y: 44, depth: 4, parentId: 'a-1', changeType: 'Optimize' as const, changeLabel: 'F scan' },
      { id: 'a-1-2', x: 1360, y: 200, depth: 4, parentId: 'a-1', changeType: 'Replace' as const, changeLabel: 'N swap' },
      { id: 'a-3-1', x: 1360, y: 398, depth: 4, parentId: 'a-3', changeType: 'Expand' as const, changeLabel: 'Solvent' },
      { id: 'b-1-1', x: 1360, y: 626, depth: 4, parentId: 'b-1', changeType: 'Replace' as const, changeLabel: 'Tail' },
      { id: 'a-1-1-1', x: 1804, y: 44, depth: 5, parentId: 'a-1-1', changeType: 'Optimize' as const, changeLabel: 'Lead' },
      { id: 'a-3-1-1', x: 1804, y: 398, depth: 5, parentId: 'a-3-1', changeType: 'Optimize' as const, changeLabel: 'PK' },
      { id: 'b-1-1-1', x: 1804, y: 626, depth: 5, parentId: 'b-1-1', changeType: 'Expand' as const, changeLabel: 'Backup' },
    ];

    return positions.map((position, index) => {
      const compound = treeCompounds[index % treeCompounds.length];
      const seed = index + 1;

      return {
        ...position,
        compound,
        metrics: [
          {
            label: 'Binding score',
            value: Number((-6.9 - (seed % 5) * 0.28).toFixed(2)),
            delta: index === 0 ? undefined : Number((((seed % 3) - 1) * 0.34).toFixed(2)),
          },
          {
            label: 'LogP',
            value: Number((1.4 + (seed % 6) * 0.22).toFixed(1)),
            delta: index === 0 ? undefined : Number((((seed % 4) - 2) * 0.17).toFixed(2)),
          },
          {
            label: 'TPSA',
            value: 54 + (seed % 7) * 7,
            delta: index === 0 ? undefined : (seed % 2 === 0 ? 11 + seed : -(5 + seed)),
          },
          {
            label: 'MW',
            value: Number((286.4 + seed * 8.7).toFixed(1)),
            delta: index === 0 ? undefined : Number(((seed % 2 === 0 ? 1 : -1) * (4.8 + seed)).toFixed(1)),
          },
        ],
      };
    });
  }, [treeCompounds]);

  React.useEffect(() => {
    setDetailPagination((prev) => (
      prev.current === 1 ? prev : { ...prev, current: 1 }
    ));
  }, [detailCompoundTypeFilter, hiddenCompoundIds, keyword, selectedGroupIds, selectedProjects, selectedShares, selectedSources]);

  React.useEffect(() => {
    setDetailPagination((prev) => {
      const totalPages = Math.max(1, Math.ceil(filteredCompounds.length / prev.pageSize));
      const nextCurrent = Math.min(prev.current, totalPages);
      return nextCurrent === prev.current ? prev : { ...prev, current: nextCurrent };
    });
  }, [filteredCompounds.length]);

  const pagedDetailCompounds = React.useMemo(() => {
    const startIndex = (detailPagination.current - 1) * detailPagination.pageSize;
    return filteredCompounds.slice(startIndex, startIndex + detailPagination.pageSize);
  }, [detailPagination.current, detailPagination.pageSize, filteredCompounds]);

  const detailStructureScaleRatio = React.useMemo(() => {
    if (selectedGroupIds.length !== 1) return 1;

    const groupId = selectedGroupIds[0];
    const settings = {
      ...DEFAULT_GROUP_STRUCTURE_VIEW_SETTINGS,
      ...groupStructureViewSettings[groupId],
    };

    return settings.myBoardImageScalePercent / MYBOARD_STRUCTURE_BASE_PERCENT;
  }, [groupStructureViewSettings, selectedGroupIds]);

  const detailStructureFrameSize = React.useMemo(() => {
    const maxIntrinsicSize = pagedDetailCompounds.reduce<SvgIntrinsicSize>((maxSize, compound) => {
      const svgSize = detailStructureSvgSizes[compound.id]
        ?? getSvgIntrinsicSize(compound.rdkitSvg)
        ?? getSvgIntrinsicSize(compound.structureSvg);

      if (!svgSize) return maxSize;

      return {
        width: Math.max(maxSize.width, svgSize.width),
        height: Math.max(maxSize.height, svgSize.height),
      };
    }, {
      width: MYBOARD_STRUCTURE_BASE_WIDTH,
      height: MYBOARD_STRUCTURE_BASE_HEIGHT,
    });

    const scale = maxIntrinsicSize.height > MYBOARD_DETAIL_STRUCTURE_MAX_HEIGHT
      ? MYBOARD_DETAIL_STRUCTURE_MAX_HEIGHT / maxIntrinsicSize.height
      : 1;
    const displayScale = scale * detailStructureScaleRatio;

    return {
      width: Math.ceil(maxIntrinsicSize.width * displayScale),
      height: Math.ceil(maxIntrinsicSize.height * displayScale),
      scale: displayScale,
    };
  }, [detailStructureScaleRatio, detailStructureSvgSizes, pagedDetailCompounds]);

  const getDetailStructureDisplaySize = React.useCallback((compound: Compound): SvgIntrinsicSize => {
    const svgSize = detailStructureSvgSizes[compound.id]
      ?? getSvgIntrinsicSize(compound.rdkitSvg)
      ?? getSvgIntrinsicSize(compound.structureSvg)
      ?? {
        width: MYBOARD_STRUCTURE_BASE_WIDTH,
        height: MYBOARD_STRUCTURE_BASE_HEIGHT,
      };

    return {
      width: Math.ceil(svgSize.width * detailStructureFrameSize.scale),
      height: Math.ceil(svgSize.height * detailStructureFrameSize.scale),
    };
  }, [detailStructureFrameSize.scale, detailStructureSvgSizes]);


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

  React.useEffect(() => {
    const visibleIds = new Set(filteredCompounds.map((compound) => compound.id));
    setSelectedDetailCompoundIds((prev) => prev.filter((id) => visibleIds.has(String(id))));
    if (detailSelectionAnchorRef.current && !visibleIds.has(detailSelectionAnchorRef.current)) {
      detailSelectionAnchorRef.current = null;
    }
  }, [filteredCompounds]);

  React.useEffect(() => {
    const visibleIds = new Set(visibleGroupRows.map((group) => group.id));
    if (groupSelectionAnchorRef.current && !visibleIds.has(groupSelectionAnchorRef.current)) {
      groupSelectionAnchorRef.current = null;
    }
  }, [visibleGroupRows]);

  const firstCompoundByGroupId = React.useMemo(() => {
    return compoundRows.reduce<Record<string, Compound>>((acc, compound) => {
      if (!acc[compound.groupId]) {
        acc[compound.groupId] = compound;
      }
      return acc;
    }, {});
  }, [compoundRows]);

  const renderGroupBookmarkButton = React.useCallback((groupId: string) => {
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
  }, [bookmarkedGroupIds, toggleBookmarkedGroup]);

  const renderRepresentativeStructure = (_: any, record: any) => {
    const representativeCompound = firstCompoundByGroupId[record.id];
    const structureSvg = representativeCompound?.structureSvg;
    const structureSettings = getGroupStructureSettings(record.id);
    const isBookmarked = bookmarkedGroupIds.includes(record.id);

    return (
      <div
        className={`my-board-representative-structure${isBookmarked ? ' is-bookmarked' : ''}`}
        style={{
          margin: '0 auto',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0,
          minWidth: MYBOARD_GROUP_STRUCTURE_WIDTH,
          minHeight: MYBOARD_GROUP_STRUCTURE_HEIGHT,
          lineHeight: 0,
          position: 'relative',
        }}
      >
        <div className="my-board-structure-bookmark">
          {renderGroupBookmarkButton(record.id)}
        </div>
        <CompoundStructureView
          svg={structureSvg}
          rdkitSvg={(representativeCompound as any)?.rdkitSvg}
          rdkitSvgCache={(representativeCompound as any)?.rdkitSvgCache}
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
          preferRdkitSvg
          rdkitAngleDeg={structureSettings.sarRotationDeg}
          rdkitScalePercent={structureSettings.myBoardImageScalePercent}
          rdkitMinSize={[MYBOARD_GROUP_STRUCTURE_WIDTH, MYBOARD_GROUP_STRUCTURE_HEIGHT]}
          onStructureGenerated={(data) => {
            if (representativeCompound?.id) handleCompoundStructureGenerated(representativeCompound.id, data);
          }}
          frameStyle={{ border: 0, background: 'transparent', boxShadow: 'none', overflow: 'visible' }}
          onPreview={(previewSvg) => {
            if (!previewSvg) return;
            setStructurePreview({
              title: representativeCompound?.compoundId || representativeCompound?.name || 'Structure',
              svg: previewSvg,
              smiles: representativeCompound?.smiles,
              molblock: representativeCompound?.molBlock ?? representativeCompound?.mol_block ?? representativeCompound?.molblock,
              cdxml: representativeCompound?.draw,
            });
          }}
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

  const getDesignMemoPlainText = React.useCallback((value: unknown) => {
    const html = String(value ?? '').trim();
    if (!html || html === '-') return '-';

    if (typeof window === 'undefined') {
      const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      return text || (/<img\b/i.test(html) ? '이미지 첨부' : '-');
    }

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const text = (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
    return text || (doc.body.querySelector('img') ? '이미지 첨부' : '-');
  }, []);

  const getDesignMemoPreviewBlocks = React.useCallback((value: unknown): DesignMemoPreviewBlock[] => {
    const html = String(value ?? '').trim();
    if (!html || html === '-') return [{ type: 'text' as const, text: '-' }];

    if (typeof window === 'undefined') {
      const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      const imageSources = Array.from(html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi))
        .map((match) => match[1])
        .filter(Boolean);
      const blocks: DesignMemoPreviewBlock[] = [
        ...(text ? [{ type: 'text' as const, text }] : []),
        ...imageSources.map((src): DesignMemoPreviewBlock => ({ type: 'image', src })),
      ];
      return blocks.length > 0 ? blocks : [{ type: 'text', text: '-' }];
    }

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const blocks: DesignMemoPreviewBlock[] = [];

    Array.from(doc.body.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
        if (text) blocks.push({ type: 'text', text });
        return;
      }

      if (!(node instanceof HTMLElement)) return;

      const imageSources = Array.from(node.querySelectorAll('img'))
        .map((image) => image.getAttribute('src') || '')
        .filter(Boolean);
      const text = (node.textContent || '').replace(/\s+/g, ' ').trim();

      if (text) blocks.push({ type: 'text', text });
      imageSources.forEach((src) => blocks.push({ type: 'image', src }));
    });

    return blocks.length > 0 ? blocks : [{ type: 'text', text: '-' }];
  }, []);

  const normalizeDesignMemoValue = React.useCallback((value: unknown) => {
    const html = String(value ?? '').trim();
    if (!html || html === '<p><br></p>') return '-';
    return getDesignMemoPlainText(html) === '-' ? '-' : html;
  }, [getDesignMemoPlainText]);

  const renderDesignMemoPreview = React.useCallback((value: unknown) => {
    const blocks = getDesignMemoPreviewBlocks(value);
    const title = blocks
      .map((block) => (block.type === 'text' ? block.text : '이미지 첨부'))
      .join('\n');

    return (
      <div className="my-board-design-memo-preview" title={title}>
        {blocks.map((block, index) => (
          block.type === 'text' ? (
            <span key={`text-${index}`} className="my-board-design-memo-text">
              {block.text}
            </span>
          ) : (
            <img
              key={`${block.src.slice(0, 48)}-${index}`}
              className="my-board-design-memo-image"
              src={block.src}
              alt={`디자인 비고 이미지 ${index + 1}`}
              loading="lazy"
            />
          )
        ))}
      </div>
    );
  }, [getDesignMemoPreviewBlocks]);

  const synthesisGroupStatusMap = React.useMemo(() => {
    const statusMap = new Map<string, SynthesisGroupStatus>();

    groups.forEach((group) => {
      const groupCompounds = compoundRows.filter((compound) => compound.groupId === group.id);
      const managerMap = new Map<string, SynthesisManagerStatus>();
      let ing = 0;
      let done = 0;
      let unassigned = 0;
      let stopped = 0;

      groupCompounds.forEach((compound) => {
        const synthesisEndReason = String(compound.synthesisEndReason || '').trim();
        const isStopped = compound.status === '합성 중단' || (
          !compound.isCompleted && synthesisEndReason.length > 0 && synthesisEndReason !== '-'
        );
        const isDone = !isStopped && (
          compound.isCompleted || compound.synthesisRequestStatus === 'vnaIssued' || compound.status === '합성 완료'
        );
        const isUnassigned = !isStopped && !isDone && (
          !compound.synthesisOwner ||
          compound.progressMemo === '미배정' ||
          compound.synthesisRequestStatus === 'requested'
        );
        const isIng = !isStopped && !isDone && !isUnassigned && (
          compound.synthesisRequestStatus === 'accepted' ||
          compound.synthesisRequestStatus === 'synthesizing' ||
          compound.status === '합성 중' ||
          Boolean(compound.synthesisOwner)
        );
        const ownerName = String(compound.synthesisOwner || '').trim();
        const manager = ownerName
          ? managerMap.get(ownerName) ?? { name: ownerName, count: 0, ing: 0, done: 0, stopped: 0 }
          : null;

        if (isStopped) {
          stopped += 1;
          if (manager) {
            manager.stopped += 1;
            manager.count += 1;
            managerMap.set(manager.name, manager);
          }
          return;
        }

        if (isDone) {
          done += 1;
          if (manager) {
            manager.done += 1;
            manager.count += 1;
            managerMap.set(manager.name, manager);
          }
          return;
        }

        if (isIng) {
          ing += 1;
          if (manager) {
            manager.ing += 1;
            manager.count += 1;
            managerMap.set(manager.name, manager);
          }
          return;
        }

        if (isUnassigned || !compound.compoundId.trim()) {
          unassigned += 1;
        }
      });

      statusMap.set(group.id, {
        title: group.name,
        ing,
        done,
        unassigned,
        stopped,
        managers: Array.from(managerMap.values()).sort((first, second) => second.count - first.count || first.name.localeCompare(second.name)),
      });
    });

    return statusMap;
  }, [compoundRows, groups]);

  const renderSynthesisSummaryBadge = React.useCallback((
    value: number,
    colors: { background: string; border: string; text: string }
  ) => (
    <Tag
      className="my-board-synthesis-summary-tag"
      style={{ backgroundColor: colors.background, borderColor: colors.border, color: colors.text }}
      title={formatNumberWithComma(value)}
    >
      {formatNumberWithComma(value)}
    </Tag>
  ), []);

  const renderSynthesisStatusTag = React.useCallback((
    groupId: string,
    statusKey: 'ing' | 'done' | 'unassigned' | 'stopped',
    colors: { background: string; border: string; text: string }
  ) => {
    const status = synthesisGroupStatusMap.get(groupId) ?? {
      title: '-',
      ing: 0,
      done: 0,
      unassigned: 0,
      stopped: 0,
      managers: [],
    };
    const value = status[statusKey];

    return (
      <Popover content={<ManagerComparisonPopup record={status} />} title={null} trigger="hover" placement="top">
        <div className="my-board-synthesis-summary-cell">
          {renderSynthesisSummaryBadge(value, colors)}
        </div>
      </Popover>
    );
  }, [renderSynthesisSummaryBadge, synthesisGroupStatusMap]);

  const groupColumns = [
    {
      title: '순번',
      key: 'sequence',
      width: MYBOARD_GROUP_COLUMN_WIDTHS.sequence,
      minWidth: MYBOARD_GROUP_COLUMN_WIDTHS.sequence,
      align: 'center' as const,
      className: 'my-board-group-fixed-column',
      onCell: () => createFixedGroupColumnProps(MYBOARD_GROUP_COLUMN_WIDTHS.sequence),
      onHeaderCell: () => createFixedGroupColumnProps(MYBOARD_GROUP_COLUMN_WIDTHS.sequence),
      render: (_: any, __: any, index: number) => String(index + 1).replace(/\B(?=(\d{3})+(?!\d))/g, ','),
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
    {
      title: 'Title',
      dataIndex: 'name',
      key: 'name',
      width: groupTableTitleWidth,
      minWidth: MYBOARD_GROUP_TITLE_MIN_WIDTH,
      className: 'my-board-group-title-column',
      render: renderMultilineText
    },
    {
      title: '개수',
      dataIndex: 'count',
      key: 'count',
      align: 'center' as const,
      width: MYBOARD_GROUP_COLUMN_WIDTHS.count,
      minWidth: MYBOARD_GROUP_COLUMN_WIDTHS.count,
      className: 'my-board-group-fixed-column',
      onCell: () => createFixedGroupColumnProps(MYBOARD_GROUP_COLUMN_WIDTHS.count),
      onHeaderCell: () => createFixedGroupColumnProps(MYBOARD_GROUP_COLUMN_WIDTHS.count),
      render: (value: number) => (
        <div className="my-board-synthesis-summary-cell">
          {renderSynthesisSummaryBadge(Number(value) || 0, {
            background: '#FFFFFF',
            border: token.colorBorder,
            text: '#000000',
          })}
        </div>
      ),
    },
    {
      title: '합성 완료',
      dataIndex: 'id',
      key: 'synthesisDone',
      width: MYBOARD_GROUP_COLUMN_WIDTHS.synthesisDone,
      minWidth: MYBOARD_GROUP_COLUMN_WIDTHS.synthesisDone,
      align: 'center' as const,
      className: 'my-board-group-fixed-column',
      onCell: () => createFixedGroupColumnProps(MYBOARD_GROUP_COLUMN_WIDTHS.synthesisDone),
      onHeaderCell: () => createFixedGroupColumnProps(MYBOARD_GROUP_COLUMN_WIDTHS.synthesisDone),
      render: (groupId: string) => renderSynthesisStatusTag(groupId, 'done', {
        background: token.colorPrimaryBg,
        border: token.colorPrimaryBorder,
        text: token.colorPrimaryText,
      }),
    },
    {
      title: '합성 중',
      dataIndex: 'id',
      key: 'synthesisIng',
      width: MYBOARD_GROUP_COLUMN_WIDTHS.synthesisIng,
      minWidth: MYBOARD_GROUP_COLUMN_WIDTHS.synthesisIng,
      align: 'center' as const,
      className: 'my-board-group-fixed-column',
      onCell: () => createFixedGroupColumnProps(MYBOARD_GROUP_COLUMN_WIDTHS.synthesisIng),
      onHeaderCell: () => createFixedGroupColumnProps(MYBOARD_GROUP_COLUMN_WIDTHS.synthesisIng),
      render: (groupId: string) => renderSynthesisStatusTag(groupId, 'ing', {
        background: token.colorInfoBg,
        border: token.colorInfoBorder,
        text: token.colorInfoText,
      }),
    },
    {
      title: '미배정',
      dataIndex: 'id',
      key: 'synthesisUnassigned',
      width: MYBOARD_GROUP_COLUMN_WIDTHS.synthesisUnassigned,
      minWidth: MYBOARD_GROUP_COLUMN_WIDTHS.synthesisUnassigned,
      align: 'center' as const,
      className: 'my-board-group-fixed-column',
      onCell: () => createFixedGroupColumnProps(MYBOARD_GROUP_COLUMN_WIDTHS.synthesisUnassigned),
      onHeaderCell: () => createFixedGroupColumnProps(MYBOARD_GROUP_COLUMN_WIDTHS.synthesisUnassigned),
      render: (groupId: string) => renderSynthesisStatusTag(groupId, 'unassigned', {
        background: token.colorFillTertiary,
        border: token.colorBorder,
        text: token.colorTextSecondary,
      }),
    },
    {
      title: '합성 중단',
      dataIndex: 'id',
      key: 'synthesisStopped',
      width: MYBOARD_GROUP_COLUMN_WIDTHS.synthesisStopped,
      minWidth: MYBOARD_GROUP_COLUMN_WIDTHS.synthesisStopped,
      align: 'center' as const,
      className: 'my-board-group-fixed-column',
      onCell: () => createFixedGroupColumnProps(MYBOARD_GROUP_COLUMN_WIDTHS.synthesisStopped),
      onHeaderCell: () => createFixedGroupColumnProps(MYBOARD_GROUP_COLUMN_WIDTHS.synthesisStopped),
      render: (groupId: string) => renderSynthesisStatusTag(groupId, 'stopped', {
        background: token.colorErrorBg,
        border: token.colorErrorBorder,
        text: token.colorErrorText,
      }),
    },
    {
      title: '그룹',
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
  const canHideCompound = hasSelectedDetailCompounds;
  const selectedDesignGroups = React.useMemo(
    () => groups.filter((group) => selectedGroupIds.includes(group.id)),
    [groups, selectedGroupIds]
  );
  const selectedDesignTargetText = React.useMemo(() => {
    const targets = Array.from(new Set(selectedDesignGroups.map((group) => group.target).filter((target) => target && target !== '-')));
    return targets.length > 0 ? targets.join(', ') : '-';
  }, [selectedDesignGroups]);
  const selectedDesignGroupDisplayText = React.useMemo(
    () => selectedDesignGroups
      .map((group) => {
        const order = selectedGroupOrderMap[group.id];
        return order ? `[${order}] ${group.name}` : group.name;
      })
      .join(', '),
    [selectedDesignGroups, selectedGroupOrderMap]
  );
  const getGroupDisplayText = React.useCallback((group?: CompoundGroup) => {
    if (!group) return '-';
    const order = selectedGroupOrderMap[group.id];
    return order ? `[${order}] ${group.name}` : group.name;
  }, [selectedGroupOrderMap]);
  const isDesignReferencePurposeSelected = React.useMemo(
    () => selectedDesignPurposes.some((path) => path.includes('레퍼런스')),
    [selectedDesignPurposes]
  );
  const isSynthesisRequestReferencePurposeSelected = React.useMemo(
    () => selectedSynthesisRequestPurposes.some((path) => path.includes('레퍼런스')),
    [selectedSynthesisRequestPurposes]
  );
  const expandDesignPurposeParentPath = React.useCallback((path: DesignPurposeValue): DesignPurposeValue[] => {
    if (path.length !== 1) return [path];
    const parentOption = designPurposeOptions.find((option) => option.value === path[0]);
    return parentOption?.children?.length
      ? parentOption.children.map((child) => [path[0], child.value])
      : [path];
  }, [designPurposeOptions]);
  const expandDesignExpansionParentPath = React.useCallback((path: DesignExpansionValue): DesignExpansionValue[] => {
    if (path.length !== 1) return [path];
    const parentOption = designExpansionOptions.find((option) => option.value === path[0]);
    return parentOption?.children?.length
      ? parentOption.children.map((child) => [path[0], child.value])
      : [path];
  }, [designExpansionOptions]);
  const handleDesignPurposeChange = React.useCallback((value: DesignPurposeValue[]) => {
    const nextPaths = value.filter((path) => path.length > 0);
    let nextSelectedPurposes: DesignPurposeValue[];
    if (nextPaths.length <= 1) {
      nextSelectedPurposes = nextPaths.flatMap(expandDesignPurposeParentPath);
      setSelectedDesignPurposes(nextSelectedPurposes);
      if (!nextSelectedPurposes.some((path) => path.includes('레퍼런스'))) {
        designForm.setFieldValue('referenceName', undefined);
      }
      return;
    }

    const pathKey = (path: DesignPurposeValue) => path.join('>');
    const previousKeys = new Set(selectedDesignPurposes.map(pathKey));
    const addedPath = nextPaths.find((path) => !previousKeys.has(pathKey(path)));
    const activeRoot = String((addedPath ?? nextPaths[0])[0]);
    const sameRootPaths = nextPaths.filter((path) => String(path[0]) === activeRoot);
    const normalizedPaths = sameRootPaths.some((path) => path.length === 1)
      ? expandDesignPurposeParentPath(sameRootPaths.find((path) => path.length === 1) ?? sameRootPaths[sameRootPaths.length - 1])
      : sameRootPaths.flatMap(expandDesignPurposeParentPath);

    nextSelectedPurposes = normalizedPaths;
    setSelectedDesignPurposes(nextSelectedPurposes);
    if (!nextSelectedPurposes.some((path) => path.includes('레퍼런스'))) {
      designForm.setFieldValue('referenceName', undefined);
    }
  }, [designForm, expandDesignPurposeParentPath, selectedDesignPurposes]);
  const handleDesignExpansionChange = React.useCallback((value: DesignExpansionValue[]) => {
    const nextPaths = value.filter((path) => path.length > 0);
    if (nextPaths.length <= 1) {
      setSelectedDesignExpansions(nextPaths.flatMap(expandDesignExpansionParentPath));
      return;
    }

    const pathKey = (path: DesignExpansionValue) => path.join('>');
    const previousKeys = new Set(selectedDesignExpansions.map(pathKey));
    const addedPath = nextPaths.find((path) => !previousKeys.has(pathKey(path)));
    if (addedPath && String(addedPath[0]) !== '기타') {
      setSelectedDesignExpansions(expandDesignExpansionParentPath(addedPath));
      return;
    }

    const otherPaths = nextPaths.filter((path) => String(path[0]) === '기타' && path.length > 1);
    const parentOtherPath = nextPaths.find((path) => String(path[0]) === '기타' && path.length === 1);
    setSelectedDesignExpansions(
      parentOtherPath
        ? expandDesignExpansionParentPath(parentOtherPath)
        : otherPaths.length > 0 ? otherPaths : expandDesignExpansionParentPath(nextPaths[nextPaths.length - 1])
    );
  }, [expandDesignExpansionParentPath, selectedDesignExpansions]);
  const handleSynthesisRequestPurposeChange = React.useCallback((value: DesignPurposeValue[]) => {
    const nextPaths = value.filter((path) => path.length > 0);
    let nextSelectedPurposes: DesignPurposeValue[];
    if (nextPaths.length <= 1) {
      nextSelectedPurposes = nextPaths.flatMap(expandDesignPurposeParentPath);
      setSelectedSynthesisRequestPurposes(nextSelectedPurposes);
      if (!nextSelectedPurposes.some((path) => path.includes('레퍼런스'))) {
        synthesisRequestForm.setFieldValue('synthesisReferenceName', undefined);
      }
      return;
    }

    const pathKey = (path: DesignPurposeValue) => path.join('>');
    const previousKeys = new Set(selectedSynthesisRequestPurposes.map(pathKey));
    const addedPath = nextPaths.find((path) => !previousKeys.has(pathKey(path)));
    const activeRoot = String((addedPath ?? nextPaths[0])[0]);
    const sameRootPaths = nextPaths.filter((path) => String(path[0]) === activeRoot);
    const normalizedPaths = sameRootPaths.some((path) => path.length === 1)
      ? expandDesignPurposeParentPath(sameRootPaths.find((path) => path.length === 1) ?? sameRootPaths[sameRootPaths.length - 1])
      : sameRootPaths.flatMap(expandDesignPurposeParentPath);

    nextSelectedPurposes = normalizedPaths;
    setSelectedSynthesisRequestPurposes(nextSelectedPurposes);
    if (!nextSelectedPurposes.some((path) => path.includes('레퍼런스'))) {
      synthesisRequestForm.setFieldValue('synthesisReferenceName', undefined);
    }
  }, [expandDesignPurposeParentPath, selectedSynthesisRequestPurposes, synthesisRequestForm]);
  const handleSynthesisRequestStepChange = React.useCallback((value: DesignExpansionValue[]) => {
    const nextPaths = value.filter((path) => path.length > 0);
    if (nextPaths.length <= 1) {
      setSelectedSynthesisRequestSteps(nextPaths.flatMap(expandDesignExpansionParentPath));
      return;
    }

    const pathKey = (path: DesignExpansionValue) => path.join('>');
    const previousKeys = new Set(selectedSynthesisRequestSteps.map(pathKey));
    const addedPath = nextPaths.find((path) => !previousKeys.has(pathKey(path)));
    if (addedPath && String(addedPath[0]) !== '기타') {
      setSelectedSynthesisRequestSteps(expandDesignExpansionParentPath(addedPath));
      return;
    }

    const otherPaths = nextPaths.filter((path) => String(path[0]) === '기타' && path.length > 1);
    const parentOtherPath = nextPaths.find((path) => String(path[0]) === '기타' && path.length === 1);
    setSelectedSynthesisRequestSteps(
      parentOtherPath
        ? expandDesignExpansionParentPath(parentOtherPath)
        : otherPaths.length > 0 ? otherPaths : expandDesignExpansionParentPath(nextPaths[nextPaths.length - 1])
    );
  }, [expandDesignExpansionParentPath, selectedSynthesisRequestSteps]);

  const getCompoundActionButtonStyle = React.useCallback((enabled: boolean): React.CSSProperties => ({
    background: enabled ? token.colorPrimary : token.colorBgLayout,
    borderColor: enabled ? token.colorPrimary : token.colorBorderSecondary,
    color: enabled ? token.colorBgContainer : token.colorTextTertiary,
  }), [token]);

  const resetDesignModalState = React.useCallback(() => {
    setDesignFormInitialValues({});
    setDesignSmiles('');
    setDesignSmilesError('');
    setSelectedCalculations([]);
    setSelectedDesignPurposes([]);
    setSelectedDesignExpansions([]);
    setCdjsInstance(null);
  }, []);

  const handleDesignSmilesChange = React.useCallback((value: string) => {
    setDesignSmiles(value);
    setDesignSmilesError('');
  }, []);

  const handleOpenDesignModal = React.useCallback(() => {
    if (!canAddCompound) return;
    const nextIdeaNumber = peekNextIdeaNumber();
    const nextSynthesisRequestNumber = peekNextSynthesisRequestNumber();
    resetDesignModalState();
    setIsCompoundEditModalOpen(false);
    setDesignFormInitialValues({
      target: selectedDesignTargetText,
      group: selectedDesignGroupDisplayText,
      ideaNumber: nextIdeaNumber,
      synthesisRequestNo: nextSynthesisRequestNumber,
      requiredAmountMg: 10,
    });
    setIsDesignModalOpen(true);
  }, [canAddCompound, resetDesignModalState, selectedDesignGroupDisplayText, selectedDesignTargetText]);

  const handleCloseDesignModal = React.useCallback(() => {
    setIsDesignModalOpen(false);
    setIsCompoundEditModalOpen(false);
    resetDesignModalState();
  }, [resetDesignModalState]);

  const parseCascaderText = React.useCallback((
    value: string | undefined,
    options: Array<{ value: string | number; children?: Array<{ value: string | number }> }>
  ) => {
    const resolvePath = (parts: string[]): (string | number)[] => {
      if (parts.length > 1) return parts;
      const label = parts[0];
      const rootOption = options.find((option) => String(option.value) === label);
      if (rootOption) return [rootOption.value];

      for (const option of options) {
        const childOption = option.children?.find((child) => String(child.value) === label);
        if (childOption) return [option.value, childOption.value];
      }

      return parts;
    };

    return String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item && item !== '-')
      .filter((item) => !item.startsWith('레퍼런스:'))
      .map((item) => item.split(' > ').map((part) => part.trim()).filter(Boolean))
      .filter((path) => path.length > 0)
      .map(resolvePath);
  }, []);

  const getCascaderLeafLabel = React.useCallback((path: (string | number)[]) => (
    String(path[path.length - 1] ?? '')
  ), []);

  const getDesignPurposeText = React.useCallback((referenceName?: string) => {
    const normalizedReferenceName = referenceName?.trim();
    return [
      ...(selectedDesignPurposes.length > 0
        ? selectedDesignPurposes
          .map(getCascaderLeafLabel)
          .filter((label) => label && label !== '레퍼런스')
        : []),
      normalizedReferenceName ? `레퍼런스: ${normalizedReferenceName}` : '',
      !normalizedReferenceName && isDesignReferencePurposeSelected ? '레퍼런스' : '',
    ].filter(Boolean).join(', ');
  }, [getCascaderLeafLabel, isDesignReferencePurposeSelected, selectedDesignPurposes]);
  const getDesignExpansionText = React.useCallback(() => (
    selectedDesignExpansions.map(getCascaderLeafLabel).filter(Boolean).join(', ')
  ), [getCascaderLeafLabel, selectedDesignExpansions]);
  const getCascaderStringValue = React.useCallback((value: Array<Array<string | number>>) => (
    value.map((path) => path.map(String))
  ), []);
  const isSynthesisRequestSubmitEnabled = React.useMemo(() => {
    const values = synthesisRequestFormValues ?? {};
    return Boolean(
      String(values.synthesisRequestNo ?? '').trim()
      && Number(values.requiredAmountMg) > 0
      && selectedSynthesisRequestPurposes.length > 0
      && selectedSynthesisRequestSteps.length > 0
      && String(values.synthesisRequestType ?? '').trim()
    );
  }, [selectedSynthesisRequestPurposes.length, selectedSynthesisRequestSteps.length, synthesisRequestFormValues]);
  const isSynthesisRequestReadOnly = synthesisRequestTarget?.synthesisRequestStatus === 'requested';

  const updateCompoundRowsById = React.useCallback((
    compoundId: string,
    updater: (compound: Compound) => Compound
  ) => {
    const updateRow = (compound: Compound) => (
      compound.id === compoundId ? updater(compound) : compound
    );
    setCompoundRows((prev) => prev.map(updateRow));
    setExternalCompoundRows(externalCompoundRows.map(updateRow));
  }, [externalCompoundRows, setExternalCompoundRows]);

  const handleOpenSynthesisRequest = React.useCallback((compound: Compound) => {
    const compoundCode = String(compound.compoundId || '').trim();
    if (compoundCode && compoundCode !== '-') return;

    const synthesisRequestNo = isSynthesisRequestNumber(compound.progressMemo)
      ? compound.progressMemo
      : peekNextSynthesisRequestNumber();
    const referenceName = String(compound.assayPurpose || '').match(/레퍼런스:\s*([^,]+)/)?.[1]?.trim();
    const purposePaths = parseCascaderText(compound.assayPurpose, designPurposeOptions) as DesignPurposeValue[];

    setSynthesisRequestTarget(compound);
    setSelectedSynthesisRequestPurposes(referenceName ? [...purposePaths, ['레퍼런스']] : purposePaths);
    setSelectedSynthesisRequestSteps(parseCascaderText(compound.synthesisStep || compound.synthesisExpansionLevel, designExpansionOptions) as DesignExpansionValue[]);
    synthesisRequestForm.setFieldsValue({
      synthesisRequestNo,
      requiredAmountMg: compound.requiredAmountMg && compound.requiredAmountMg > 0 ? compound.requiredAmountMg : undefined,
      synthesisReferenceName: referenceName,
      expectedEffect: compound.expectedEffect === '-' ? '' : compound.expectedEffect,
      requestMemo: compound.requestMemo === '-' ? '' : compound.requestMemo,
      synthesisRequestType: compound.synthesisSite || compound.synthesisRequestType,
    });
    setIsSynthesisRequestModalOpen(true);
  }, [designExpansionOptions, designPurposeOptions, parseCascaderText, synthesisRequestForm]);

  const handleCloseSynthesisRequest = React.useCallback(() => {
    setIsSynthesisRequestModalOpen(false);
    setSynthesisRequestTarget(null);
    setSelectedSynthesisRequestPurposes([]);
    setSelectedSynthesisRequestSteps([]);
    synthesisRequestForm.resetFields();
  }, [synthesisRequestForm]);

  const handleSubmitSynthesisRequest = React.useCallback(async () => {
    if (!synthesisRequestTarget) return;
    if (selectedSynthesisRequestPurposes.length === 0 || selectedSynthesisRequestSteps.length === 0) return;
    const values = await synthesisRequestForm.validateFields();
    const hasExistingRequestNumber = isSynthesisRequestNumber(synthesisRequestTarget.progressMemo);
    const synthesisRequestNo = hasExistingRequestNumber
      ? String(values.synthesisRequestNo || synthesisRequestTarget.progressMemo).trim()
      : reserveNextSynthesisRequestNumber();
    const normalizedReferenceName = values.synthesisReferenceName?.trim();
    const purposeText = [
      ...selectedSynthesisRequestPurposes
        .map(getCascaderLeafLabel)
        .filter((label) => label && label !== '레퍼런스'),
      normalizedReferenceName ? `레퍼런스: ${normalizedReferenceName}` : '',
      !normalizedReferenceName && isSynthesisRequestReferencePurposeSelected ? '레퍼런스' : '',
    ].filter(Boolean).join(', ');
    const stepText = selectedSynthesisRequestSteps.map(getCascaderLeafLabel).filter(Boolean).join(', ');

    updateCompoundRowsById(synthesisRequestTarget.id, (compound) => ({
      ...compound,
      requiredAmountMg: Number(values.requiredAmountMg) || 0,
      assayPurpose: purposeText || '-',
      expectedEffect: normalizeDesignMemoValue(values.expectedEffect),
      requestMemo: normalizeDesignMemoValue(values.requestMemo),
      progressMemo: synthesisRequestNo,
      requestDate: formatDisplayDate(new Date().toISOString()),
      synthesisOwner: currentUser?.name ?? compound.synthesisOwner ?? '문태훈',
      synthesisRequestStatus: 'requested',
      synthesisRequestType: String(values.synthesisRequestType || '').trim(),
      synthesisStep: stepText || '-',
    }));
    handleCloseSynthesisRequest();
  }, [
    currentUser?.name,
    handleCloseSynthesisRequest,
    getCascaderLeafLabel,
    isSynthesisRequestReferencePurposeSelected,
    normalizeDesignMemoValue,
    selectedSynthesisRequestPurposes,
    selectedSynthesisRequestSteps,
    synthesisRequestForm,
    synthesisRequestTarget,
    updateCompoundRowsById,
  ]);

  const handleCancelSynthesisRequest = React.useCallback((compound: Compound, closeAfterCancel = false) => {
    modal.confirm({
      title: '합성 요청을 취소할까요?',
      content: `${compound.designNo || compound.name} 요청 완료 상태를 취소합니다.`,
      okText: '요청 취소',
      cancelText: '닫기',
      okButtonProps: { danger: true },
      onOk: () => {
        updateCompoundRowsById(compound.id, (row) => ({
          ...row,
          synthesisRequestStatus: undefined,
        }));
        if (closeAfterCancel) {
          handleCloseSynthesisRequest();
        }
      },
    });
  }, [handleCloseSynthesisRequest, modal, updateCompoundRowsById]);

  const handleRegisterDesignIdea = React.useCallback(async () => {
    if (!selectedGroupIds[0]) return;
    await cdjsInstance?.__flushPendingInput?.();
    const values = await designForm.validateFields();
    if (!designSmiles.trim()) {
      setDesignSmilesError('SMILES 또는 구조 정보를 입력해주세요');
      return;
    }
    const ideaNumber = reserveNextIdeaNumber();
    const reservedSynthesisRequestNumber = reserveNextSynthesisRequestNumber();
    const synthesisRequestNumber = String(values.synthesisRequestNo || '').trim() || reservedSynthesisRequestNumber;
    const targetGroupId = selectedGroupIds[0];
    const targetGroup = groups.find((group) => group.id === targetGroupId);
    const timestamp = Date.now();
    const purposeText = getDesignPurposeText(values.referenceName);
    const expansionText = getDesignExpansionText();
    const newCompound: Compound = {
      id: `idea-${targetGroupId}-${ideaNumber}-${timestamp}`,
      groupId: targetGroupId,
      compoundId: '',
      name: ideaNumber,
      source: values.source || 'Manual',
      smiles: designSmiles.trim(),
      creDate: formatDisplayDate(new Date().toISOString()),
      manager: currentUser?.name ?? '문태훈',
      status: '디자인',
      project: targetGroup?.target && targetGroup.target !== '-' ? targetGroup.target : 'Unassigned',
      shareStatus: '내 물질',
      designSource: values.source || '-',
      properties1: [50, 50, 50, 50],
      properties2: [50, 50, 50, 50],
      requiredCalcs: selectedCalculations,
      designNo: ideaNumber,
      designMemo: normalizeDesignMemoValue(values.designMemo),
      requiredAmountMg: Number(values.requiredAmountMg) || 0,
      assayPurpose: purposeText || '-',
      expectedEffect: normalizeDesignMemoValue(values.expectedEffect),
      requestDate: formatDisplayDate(new Date().toISOString()),
      synthesisExpansionLevel: expansionText || '-',
      requestMemo: normalizeDesignMemoValue(values.requestMemo),
      synthesisOwner: currentUser?.name ?? '문태훈',
      synthesisAcceptedDate: '-',
      synthesisTargetDate: '-',
      progressMemo: synthesisRequestNumber,
      isCompleted: false,
      registeredDate: formatDisplayDate(new Date().toISOString()),
      researchNote: '-',
      reportData: '-',
      synthesisEndReason: '-',
      experimentStage: 1,
      quickViewerAssets: [],
    };

    setCompoundRows((prev) => insertCompoundsAfterGroupTail(prev, [newCompound]));
    setSelectedDetailCompoundIds([newCompound.id]);
    detailSelectionAnchorRef.current = newCompound.id;
    setIsDesignModalOpen(false);
    resetDesignModalState();
  }, [
    cdjsInstance,
    currentUser?.name,
    designForm,
    designSmiles,
    getDesignPurposeText,
    getDesignExpansionText,
    groups,
    normalizeDesignMemoValue,
    resetDesignModalState,
    selectedCalculations,
    selectedGroupIds,
  ]);

  const handleUpdateDesignIdea = React.useCallback(async () => {
    if (!selectedEditableCompound) return;
    await cdjsInstance?.__flushPendingInput?.();
    const values = await designForm.validateFields();
    if (!designSmiles.trim()) {
      setDesignSmilesError('SMILES 또는 구조 정보를 입력해주세요');
      return;
    }
    const purposeText = getDesignPurposeText(values.referenceName);
    const expansionText = getDesignExpansionText();
    const nextSource = values.source || '-';
    const updateCompound = (compound: Compound): Compound => (
      compound.id === selectedEditableCompound.id
        ? {
          ...compound,
          source: nextSource,
          smiles: designSmiles.trim(),
          designSource: nextSource,
          requiredCalcs: selectedCalculations,
          designNo: values.ideaNumber || compound.designNo,
          name: values.ideaNumber || compound.name,
          designMemo: normalizeDesignMemoValue(values.designMemo),
          requiredAmountMg: Number(values.requiredAmountMg) || 0,
          assayPurpose: purposeText || '-',
          expectedEffect: normalizeDesignMemoValue(values.expectedEffect),
          synthesisExpansionLevel: expansionText || '-',
          requestMemo: normalizeDesignMemoValue(values.requestMemo),
          progressMemo: values.synthesisRequestNo || '-',
        }
        : compound
    );

    setCompoundRows((prev) => prev.map(updateCompound));
    setExternalCompoundRows(externalCompoundRows.map(updateCompound));
    setIsDesignModalOpen(false);
    setIsCompoundEditModalOpen(false);
    resetDesignModalState();
  }, [
    cdjsInstance,
    designForm,
    designSmiles,
    externalCompoundRows,
    getDesignExpansionText,
    getDesignPurposeText,
    normalizeDesignMemoValue,
    resetDesignModalState,
    selectedCalculations,
    selectedEditableCompound,
    setExternalCompoundRows,
  ]);

  const openCompoundGroupSelectModal = React.useCallback((action: 'move' | 'copy') => {
    if (!hasSelectedDetailCompounds) return;
    setCompoundGroupAction(action);
    setSelectedCompoundTargetGroupId(selectedGroupIds[0] ?? groups[0]?.id);
    setIsCompoundGroupSelectModalOpen(true);
  }, [groups, hasSelectedDetailCompounds, selectedGroupIds]);

  const handleDeleteSelectedCompounds = React.useCallback(() => {
    if (!canDeleteCompound) return;
    modal.confirm({
      title: '화합물 삭제',
      content: `선택한 ${selectedDetailCompoundIds.length}개의 화합물을 삭제하시겠습니까?`,
      okText: '삭제',
      cancelText: '취소',
      okButtonProps: { danger: true },
      onOk: () => {
        const selectedIds = new Set(selectedDetailCompoundIds.map(String));
        setCompoundRows((prev) => prev.filter((compound) => !selectedIds.has(compound.id)));
        setExternalCompoundRows(externalCompoundRows.filter((compound) => !selectedIds.has(compound.id)));
        setSelectedDetailCompoundIds([]);
        setCompoundContextMenu(null);
      },
    });
  }, [canDeleteCompound, externalCompoundRows, modal, selectedDetailCompoundIds, setExternalCompoundRows]);

  const handleHideSelectedCompounds = React.useCallback(() => {
    if (!canHideCompound) return;
    hideCompounds(selectedDetailCompoundIds.map(String));
    setSelectedDetailCompoundIds([]);
    setCompoundContextMenu(null);
  }, [canHideCompound, hideCompounds, selectedDetailCompoundIds]);

  const handleQuickAddCompound = React.useCallback(async () => {
    const compoundCode = (selectedQuickAddCode || quickAddCode).trim();
    const targetGroupId = selectedGroupIds[0];
    if (!compoundCode || !targetGroupId) return;
    if (!compoundLoginToken.trim()) {
      modal.error({
        title: 'Login token 필요',
        content: '헤더의 login token 버튼에서 compound_api login_token을 먼저 입력해주세요.',
      });
      return;
    }

    setIsQuickAddAdding(true);

    try {
      const response = await compoundApi.getCompounds(compoundLoginToken, [compoundCode]);
      const compoundData = response.compounds.find((compound) => (
        compound.compound_code.toLowerCase() === compoundCode.toLowerCase()
      )) ?? response.compounds[0];

      const compoundSmiles = compoundData?.smiles?.trim() ?? '';
      if (!compoundData || !compoundSmiles || compoundSmiles.toLowerCase() === 'no permission') {
        modal.error({
          title: '권한 없음',
          content: `${compoundCode} compound의 구조 권한이 없어 그룹 상세 목록에 추가할 수 없습니다.`,
        });
        return;
      }

      const resolvedCompoundCode = compoundData.compound_code || compoundCode;
      const timestamp = Date.now();
      const targetGroup = groups.find((group) => group.id === targetGroupId);
      const newCompound: Compound = {
        id: `quick-${targetGroupId}-${resolvedCompoundCode}-${timestamp}`,
        groupId: targetGroupId,
        compoundId: resolvedCompoundCode,
        name: resolvedCompoundCode,
        source: 'Manual',
        externalSource: 'compound_api',
        smiles: compoundSmiles,
        creDate: formatDisplayDate(new Date().toISOString()),
        manager: currentUser?.name ?? '문태훈',
        status: '디자인',
        project: targetGroup?.target && targetGroup.target !== '-' ? targetGroup.target : 'Unassigned',
        shareStatus: '내 물질',
        designSource: '',
        properties1: [50, 50, 50, 50],
        properties2: [50, 50, 50, 50],
        requiredCalcs: [],
        designNo: `D-${resolvedCompoundCode}`,
        designMemo: '',
        requiredAmountMg: 10,
        assayPurpose: '',
        expectedEffect: '-',
        requestDate: formatDisplayDate(new Date().toISOString()),
        synthesisExpansionLevel: '',
        requestMemo: '-',
        synthesisOwner: currentUser?.name ?? '문태훈',
        synthesisAcceptedDate: '-',
        synthesisTargetDate: '-',
        progressMemo: '',
        isCompleted: false,
        registeredDate: formatDisplayDate(new Date().toISOString()),
        researchNote: '-',
        reportData: '-',
        synthesisEndReason: '-',
        experimentStage: 1,
        quickViewerAssets: [],
      };

      setCompoundRows((prev) => insertCompoundsAfterGroupTail(prev, [newCompound]));
      addExternalCompoundRow(newCompound);
      setSelectedDetailCompoundIds([newCompound.id]);
      detailSelectionAnchorRef.current = newCompound.id;
      setQuickAddCode('');
      setSelectedQuickAddCode('');
      setQuickAddResults([]);
      setIsQuickAddModalOpen(false);
    } catch (error) {
      modal.error({
        title: 'Compound 추가 실패',
        content: error instanceof Error ? error.message : 'Compound 정보를 불러오지 못했습니다.',
      });
    } finally {
      setIsQuickAddAdding(false);
    }
  }, [
    addExternalCompoundRow,
    compoundLoginToken,
    currentUser?.name,
    groups,
    modal,
    quickAddCode,
    selectedGroupIds,
    selectedQuickAddCode,
  ]);

  const handleOpenSarTable = React.useCallback(async () => {
    const sarTargetIds = filteredCompounds.map((compound) => compound.id);
    const externalCompoundCodes = Array.from(new Set(
      filteredCompounds
        .filter((compound) => compound.externalSource === 'compound_api' && compound.compoundId.trim())
        .map((compound) => compound.compoundId.trim()),
    ));

    setSelectedSarCompoundIds(sarTargetIds);

    if (externalCompoundCodes.length === 0) {
      setCompoundSarData([], []);
      navigate('/myboard/sar-table');
      return;
    }

    if (!compoundLoginToken.trim()) {
      modal.error({
        title: 'Login token 필요',
        content: 'SAR 데이터를 조회하려면 헤더의 login token 버튼에서 compound_api login_token을 먼저 입력해주세요.',
      });
      return;
    }

    setIsSarDataLoading(true);
    try {
      const response = await compoundApi.getCompoundSarData(compoundLoginToken, externalCompoundCodes);
      setCompoundSarData(response.rows, response.groups);
      navigate('/myboard/sar-table');
    } catch (error) {
      modal.error({
        title: 'SAR 데이터 조회 실패',
        content: error instanceof Error ? error.message : 'SAR 데이터를 불러오지 못했습니다.',
      });
    } finally {
      setIsSarDataLoading(false);
    }
  }, [
    compoundLoginToken,
    filteredCompounds,
    modal,
    navigate,
    setCompoundSarData,
    setSelectedSarCompoundIds,
  ]);

  const handleOpenCompoundEdit = React.useCallback(() => {
    if (!canEditCompound || !selectedEditableCompound) return;
    const targetGroup = groups.find((group) => group.id === selectedEditableCompound.groupId);
    const referenceName = String(selectedEditableCompound.assayPurpose || '').match(/레퍼런스:\s*([^,]+)/)?.[1]?.trim();
    const purposePaths = parseCascaderText(selectedEditableCompound.assayPurpose, designPurposeOptions);

    resetDesignModalState();
    setDesignSmiles(selectedEditableCompound.smiles || '');
    setSelectedCalculations(selectedEditableCompound.requiredCalcs ?? []);
    setSelectedDesignPurposes(referenceName ? [...purposePaths, ['레퍼런스']] : purposePaths);
    setSelectedDesignExpansions(parseCascaderText(selectedEditableCompound.synthesisExpansionLevel, designExpansionOptions));
    setDesignFormInitialValues({
      target: targetGroup?.target && targetGroup.target !== '-' ? targetGroup.target : '-',
      group: getGroupDisplayText(targetGroup),
      ideaNumber: selectedEditableCompound.designNo || selectedEditableCompound.name || selectedEditableCompound.compoundId,
      smilesPreview: selectedEditableCompound.smiles || '',
      designMemo: selectedEditableCompound.designMemo === '-' ? '' : selectedEditableCompound.designMemo,
      synthesisRequestNo: selectedEditableCompound.progressMemo === '-' ? '' : selectedEditableCompound.progressMemo,
      requiredAmountMg: selectedEditableCompound.requiredAmountMg ?? 0,
      expectedEffect: selectedEditableCompound.expectedEffect === '-' ? '' : selectedEditableCompound.expectedEffect,
      referenceName,
      requestMemo: selectedEditableCompound.requestMemo === '-' ? '' : selectedEditableCompound.requestMemo,
      source: selectedEditableCompound.designSource || selectedEditableCompound.source,
    });
    setIsDesignModalOpen(false);
    setIsCompoundEditModalOpen(true);
    setCompoundContextMenu(null);
  }, [canEditCompound, designExpansionOptions, designPurposeOptions, getGroupDisplayText, groups, parseCascaderText, resetDesignModalState, selectedEditableCompound]);

  const handleGroupRowSelection = React.useCallback((groupId: string, event: React.MouseEvent) => {
    if (isChemDrawModalEventTarget(event.target)) return;

    setDetailPagination((prev) => (
      prev.current === 1 ? prev : { ...prev, current: 1 }
    ));

    if (event.shiftKey) {
      event.preventDefault();
      const rangeIds = getRangeSelectionIds(visibleGroupRows, groupSelectionAnchorRef.current, groupId);
      if (event.ctrlKey || event.metaKey) {
        setSelectedGroupIds(Array.from(new Set([...selectedGroupIds, ...rangeIds])));
      } else {
        setSelectedGroupIds(rangeIds);
      }
      groupSelectionAnchorRef.current = groupSelectionAnchorRef.current ?? groupId;
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      toggleGroupSelection(groupId);
      groupSelectionAnchorRef.current = groupId;
      return;
    }

    setSelectedGroupIds([groupId]);
    groupSelectionAnchorRef.current = groupId;
  }, [selectedGroupIds, setSelectedGroupIds, toggleGroupSelection, visibleGroupRows]);

  const toggleDetailCompoundSelection = React.useCallback((compoundId: string) => {
    setSelectedDetailCompoundIds((prev) => (
      prev.includes(compoundId)
        ? prev.filter((id) => id !== compoundId)
        : [...prev, compoundId]
    ));
  }, []);

  const handleDetailCompoundRowSelection = React.useCallback((compoundId: string, event: React.MouseEvent) => {
    if (isChemDrawModalEventTarget(event.target)) return;

    if (event.shiftKey) {
      event.preventDefault();
      const rangeIds = getRangeSelectionIds(filteredCompounds, detailSelectionAnchorRef.current, compoundId);
      if (event.ctrlKey || event.metaKey) {
        setSelectedDetailCompoundIds((prev) => Array.from(new Set([...prev.map(String), ...rangeIds])));
      } else {
        setSelectedDetailCompoundIds(rangeIds);
      }
      detailSelectionAnchorRef.current = detailSelectionAnchorRef.current ?? compoundId;
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      toggleDetailCompoundSelection(compoundId);
      detailSelectionAnchorRef.current = compoundId;
      return;
    }

    setSelectedDetailCompoundIds([compoundId]);
    detailSelectionAnchorRef.current = compoundId;
  }, [filteredCompounds, toggleDetailCompoundSelection]);

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
      key: 'hide',
      icon: <span className="my-board-action-icon my-board-action-icon-eye-off" aria-hidden="true" />,
      label: '숨기기',
      disabled: !canHideCompound,
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

    if (key === 'hide') {
      handleHideSelectedCompounds();
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
      const moveCompound = (compound: Compound) => (
        selectedIds.has(compound.id)
          ? { ...compound, groupId: selectedCompoundTargetGroupId }
          : compound
      );
      setCompoundRows((prev) => prev.map(moveCompound));
      setExternalCompoundRows(externalCompoundRows.map(moveCompound));
    } else {
      const selectedRows = compoundRows.filter((compound) => selectedIds.has(compound.id));
      const timestamp = Date.now();
      const copiedRows = selectedRows.map((compound, index) => ({
        ...compound,
        id: `${compound.id}-copy-${timestamp}-${index}`,
        groupId: selectedCompoundTargetGroupId,
        compoundId: compound.externalSource === 'compound_api' ? compound.compoundId : `${compound.compoundId}-COPY`,
        name: compound.externalSource === 'compound_api' ? compound.name : `${compound.name} Copy`,
      }));
      setCompoundRows((prev) => insertCompoundsAfterGroupTail(prev, copiedRows));
      setExternalCompoundRows(insertCompoundsAfterGroupTail(
        externalCompoundRows,
        copiedRows.filter((compound) => compound.externalSource === 'compound_api')
      ));
    }

    setSelectedDetailCompoundIds([]);
    setIsCompoundGroupSelectModalOpen(false);
    setSelectedCompoundTargetGroupId(undefined);
  }, [
    compoundGroupAction,
    compoundRows,
    externalCompoundRows,
    selectedCompoundTargetGroupId,
    selectedDetailCompoundIds,
    setExternalCompoundRows,
  ]);

  const renderCompoundIdStatusCell = React.useCallback((id: string, record: Compound) => {
    const compoundCode = String(id || '').trim();
    if (compoundCode && compoundCode !== '-') {
      return <Text strong style={{ color: token.colorPrimary }}>{compoundCode}</Text>;
    }

    const status = record.synthesisRequestStatus;
    if (!status) {
      return (
        <Button
          size="small"
          type="primary"
          className="my-board-synthesis-request-button"
          onClick={(event) => {
            event.stopPropagation();
            handleOpenSynthesisRequest(record);
          }}
        >
          합성 요청
        </Button>
      );
    }

    const statusMeta = SYNTHESIS_REQUEST_STATUS_META[status];

    if (status === 'requested') {
      return (
        <div className="my-board-synthesis-status-cell">
          <button
            type="button"
            className="my-board-synthesis-status-text-button"
            style={{ color: token.colorText }}
            onClick={(event) => {
              event.stopPropagation();
              handleOpenSynthesisRequest(record);
            }}
          >
            {statusMeta.label}
          </button>
        </div>
      );
    }

    return (
      <div className="my-board-synthesis-status-cell">
        <Text className="my-board-synthesis-status-text">
          {statusMeta.label}
        </Text>
      </div>
    );
  }, [handleOpenSynthesisRequest, token.colorPrimary, token.colorText]);
  const synthesisRequestTargetGroup = React.useMemo(
    () => groups.find((group) => group.id === synthesisRequestTarget?.groupId),
    [groups, synthesisRequestTarget?.groupId]
  );

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
      modal.confirm({
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
    '물질 번호 (VRN)': { title: '물질 번호 (VRN)', dataIndex: 'compoundId', key: 'compoundId', width: 128, render: renderCompoundIdStatusCell },
    '화합물 구조': {
      title: '화합물 구조',
      dataIndex: 'structureSvg',
      key: 'structure',
      width: Math.max(212, detailStructureFrameSize.width + 24),
      className: 'my-board-structure-column',
      render: (structureSvg: string | undefined, record: any) => {
        const displaySvg = searchedSvg && (keyword === record.smiles || keyword === 'Structure Search Result')
          ? searchedSvg
          : structureSvg;
        const structureSettings = getGroupStructureSettings(record.groupId);
        const structureDisplaySize = getDetailStructureDisplaySize(record);

        return (
          <CompoundStructureView
            svg={displaySvg}
            rdkitSvg={record.rdkitSvg}
            rdkitSvgCache={record.rdkitSvgCache}
            title={record.compoundId || record.name || 'Structure'}
            smiles={record.smiles}
            molBlock={record.molBlock ?? record.mol_block ?? record.molblock}
            cdxml={record.draw}
            width={structureDisplaySize.width}
            height={structureDisplaySize.height}
            iconSize={40}
            gap={0}
            actionPlacement="overlay"
            actionOverlayAnchor="container"
            frameless
            preferRdkitSvg
            rdkitAngleDeg={structureSettings.sarRotationDeg}
            rdkitScalePercent={MYBOARD_STRUCTURE_BASE_PERCENT}
            rdkitMinSize={undefined}
            onStructureGenerated={(data) => handleCompoundStructureGenerated(record.id, data)}
            onPreview={(previewSvg) => {
              if (!previewSvg) return;
              setStructurePreview({
                title: record.compoundId || record.name || 'Structure',
                svg: previewSvg,
                smiles: record.smiles,
                molblock: record.molBlock ?? record.mol_block ?? record.molblock,
                cdxml: record.draw,
              });
            }}
          />
        );
      }
    },
    '데이터': {
      title: '데이터',
      dataIndex: 'quickViewerAssets',
      key: 'quickViewerAssets',
      width: 88,
      align: 'center' as const,
      render: (_: unknown, record: Compound) => {
        const assets = record.quickViewerAssets ?? [];

        if (assets.length === 0) {
          return <Text type="secondary">-</Text>;
        }

        const orderedAssets = [...assets]
          .sort((first, second) => (
            (MYBOARD_DATA_ASSET_ORDER_INDEX.get(first.type) ?? Number.MAX_SAFE_INTEGER)
            - (MYBOARD_DATA_ASSET_ORDER_INDEX.get(second.type) ?? Number.MAX_SAFE_INTEGER)
          ));
        const renderAssetButton = (asset: NonNullable<Compound['quickViewerAssets']>[number]) => (
          <button
            key={asset.type}
            type="button"
            className={`my-board-data-tag my-board-data-tag-${asset.type}`}
            onClick={(event) => {
              event.stopPropagation();
              setQuickViewer({
                compound: record,
                activeType: asset.type,
              });
            }}
          >
            {asset.label}
          </button>
        );

        return (
          <div className="my-board-data-tags">
            {orderedAssets.map(renderAssetButton)}
          </div>
        );
      },
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
    '디자인 비고': { title: '디자인 비고', dataIndex: 'designMemo', key: 'designMemo', width: 220, render: renderDesignMemoPreview },
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
    '기대 개선 효과': { title: '기대 개선 효과', dataIndex: 'expectedEffect', key: 'expectedEffect', width: 180, render: renderDesignMemoPreview },
    '의뢰일자': { title: '의뢰일자', dataIndex: 'requestDate', key: 'requestDate', width: 96, render: formatDisplayDate },
    '합성 확장 필요 정도': { title: '합성 확장 필요 정도', dataIndex: 'synthesisExpansionLevel', key: 'synthesisExpansionLevel', width: 144 },
    '의뢰 비고': { title: '의뢰 비고', dataIndex: 'requestMemo', key: 'requestMemo', width: 180, render: renderDesignMemoPreview },
    '합성 담당자': {
      title: '합성 담당자',
      dataIndex: 'synthesisOwner',
      key: 'synthesisOwner',
      width: 112,
      align: 'center' as const,
      className: 'table-center-column',
      render: (owner: string | null | undefined, record: Compound) => (
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
            onClick={(event) => {
              event.stopPropagation();
              setSelectedSynthesisItem(record);
              setIsAssignModalOpen(true);
            }}
          >
            <UserPlus size={14} color={token.colorPrimary} />
            <Text style={{ fontSize: 11, fontWeight: 500, color: token.colorText }}>{owner}</Text>
          </div>
        ) : (
          <Button
            size="small"
            icon={<UserPlus size={14} />}
            onClick={(event) => {
              event.stopPropagation();
              setSelectedSynthesisItem(record);
              setIsAssignModalOpen(true);
            }}
            style={{ borderRadius: 6, fontSize: 10 }}
          >
            배정
          </Button>
        )
      ),
    },
    '합성 스터디 그룹 수락일자': {
      title: '합성 스터디 그룹 수락일자',
      dataIndex: 'synthesisAcceptedDate',
      key: 'synthesisAcceptedDate',
      width: 172,
      align: 'center' as const,
      className: 'table-center-column',
      render: formatDisplayDate,
    },
    '합성 목표일': {
      title: '합성 목표일',
      dataIndex: 'synthesisTargetDate',
      key: 'synthesisTargetDate',
      width: 104,
      align: 'center' as const,
      className: 'table-center-column',
      render: formatDisplayDate,
    },
    '진행사항 비고': { title: '진행사항 비고', dataIndex: 'progressMemo', key: 'progressMemo', width: 180, ellipsis: true },
    '완료 여부': {
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
      ),
    },
    '등록일': {
      title: '등록일',
      dataIndex: 'registeredDate',
      key: 'registeredDate',
      width: 96,
      align: 'center' as const,
      className: 'table-center-column',
      render: formatDisplayDate,
    },
    '연구노트': {
      title: '연구노트',
      dataIndex: 'researchNote',
      key: 'researchNote',
      width: 108,
      align: 'center' as const,
      className: 'table-center-column',
    },
    '리포트 자료': { title: '리포트 자료', dataIndex: 'reportData', key: 'reportData', width: 156, ellipsis: true },
    '합성 종료 이유': { title: '합성 종료 이유', dataIndex: 'synthesisEndReason', key: 'synthesisEndReason', width: 164, ellipsis: true },
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

  const shouldCenterDetailColumn = React.useCallback((_column: any) => true, []);

  const withMyBoardDetailHeaderCell = React.useCallback((columns: any[]) => (
    withMyBoardHeaderCell(columns).map((column) => {
      const shouldCenter = shouldCenterDetailColumn(column);

      return {
        ...column,
        align: shouldCenter ? 'center' as const : column.align,
        className: [
          column.className,
          shouldCenter ? 'table-center-column' : undefined,
        ].filter(Boolean).join(' ') || undefined,
      };
    })
  ), [shouldCenterDetailColumn, withMyBoardHeaderCell]);

  const styledGroupColumns = React.useMemo(() => withMyBoardHeaderCell(groupColumns), [groupColumns, withMyBoardHeaderCell]);
  const styledStructureOnlyGroupColumns = React.useMemo(() => withMyBoardHeaderCell(structureOnlyGroupColumns), [structureOnlyGroupColumns, withMyBoardHeaderCell]);

  const dynamicCompoundColumns = columnOrder
    .filter(key => activeColumns.includes(key))
    .map(key => allColumnsMap[key])
    .filter(Boolean);
  const styledDynamicCompoundColumns = React.useMemo(
    () => withMyBoardDetailHeaderCell(dynamicCompoundColumns),
    [dynamicCompoundColumns, withMyBoardDetailHeaderCell]
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
  const shouldUseGroupTableHorizontalScroll = React.useMemo(() => {
    if (isGroupListStructureOnly) return false;
    if (groupListTableWidth <= 0) return false;

    return groupListTableWidth < MYBOARD_GROUP_TABLE_MIN_WIDTH - MYBOARD_GROUP_SCROLL_WIDTH_TOLERANCE;
  }, [groupListTableWidth, isGroupListStructureOnly]);
  const detailTableScrollX = React.useMemo(
    () => getTableScrollWidth(styledDynamicCompoundColumns),
    [getTableScrollWidth, styledDynamicCompoundColumns]
  );
  const detailCanvasHeight = React.useMemo(() => (
    Math.max(160, detailViewContentHeight - 49)
  ), [detailViewContentHeight]);

  const updateTableScrollHeights = React.useCallback(() => {
    if (isStackedSplitLayout) {
      setGroupTableScrollY(undefined);
      setDetailTableScrollY(undefined);
      return;
    }

    const bottomGap = 16;
    const cardBottomInset = 2;
    const minBodyHeight = 160;

    const groupTable = groupListTableCardRef.current;
    const groupBody = groupTable?.querySelector<HTMLElement>('.ant-table-body');
    const groupTbody = groupTable?.querySelector<HTMLElement>('.my-board-group-table .ant-table-tbody');
    const groupMeasureElement = groupBody ?? groupTbody;
    if (groupMeasureElement && groupTbody) {
      const maxGroupBodyHeight = Math.max(
        minBodyHeight,
        Math.floor(window.innerHeight - groupMeasureElement.getBoundingClientRect().top - bottomGap - cardBottomInset)
      );
      const groupRowsHeight = Math.ceil(groupTbody.getBoundingClientRect().height);
      const nextGroupScrollY = groupRowsHeight <= maxGroupBodyHeight ? undefined : maxGroupBodyHeight;

      setGroupTableScrollY((current) => (
        current === nextGroupScrollY ? current : nextGroupScrollY
      ));
    }

    const detailWrapper = detailTableWrapperRef.current;
    const detailBody = detailWrapper?.querySelector<HTMLElement>('.my-board-detail-table .ant-table-body');
    if (detailWrapper && detailBody) {
      const pagination = detailWrapper.querySelector<HTMLElement>('.ant-pagination');
      const paginationStyle = pagination ? window.getComputedStyle(pagination) : null;
      const paginationReserve = pagination
        ? Math.ceil(
            pagination.getBoundingClientRect().height
            + Number.parseFloat(paginationStyle?.marginTop || '0')
            + Number.parseFloat(paginationStyle?.marginBottom || '0')
          )
        : 48;
      const nextDetailScrollY = Math.max(
        minBodyHeight,
        Math.floor(window.innerHeight - detailBody.getBoundingClientRect().top - paginationReserve - bottomGap - cardBottomInset)
      );

      setDetailTableScrollY((current) => (
        current === nextDetailScrollY ? current : nextDetailScrollY
      ));
    }
  }, [isStackedSplitLayout]);

  const groupTableScroll = React.useMemo(() => {
    const nextScroll: { x?: number; y?: number } = {};

    if (shouldUseGroupTableHorizontalScroll) {
      nextScroll.x = groupTableScrollX;
    }
    if (!isStackedSplitLayout && groupTableScrollY !== undefined) {
      nextScroll.y = groupTableScrollY;
    }

    return nextScroll.x !== undefined || nextScroll.y !== undefined ? nextScroll : undefined;
  }, [groupTableScrollX, groupTableScrollY, isStackedSplitLayout, shouldUseGroupTableHorizontalScroll]);

  React.useLayoutEffect(() => {
    const frameId = window.requestAnimationFrame(updateTableScrollHeights);
    return () => window.cancelAnimationFrame(frameId);
  }, [
    activeColumns,
    columnOrder,
    detailPagination.current,
    detailPagination.pageSize,
    detailTableScrollX,
    filteredCompounds.length,
    groupListMode,
    groupPinFilter,
    groupTableScrollX,
    isGroupListStructureOnly,
    quickViewer,
    showFilters,
    updateTableScrollHeights,
    viewMode,
    visibleGroupRows.length,
  ]);

  React.useEffect(() => {
    if (isStackedSplitLayout) return undefined;

    const onResize = () => {
      window.requestAnimationFrame(updateTableScrollHeights);
    };
    window.addEventListener('resize', onResize);

    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(updateTableScrollHeights);
    });
    if (groupListTableCardRef.current) {
      resizeObserver.observe(groupListTableCardRef.current);
    }
    if (detailTableWrapperRef.current) {
      resizeObserver.observe(detailTableWrapperRef.current);
    }

    return () => {
      window.removeEventListener('resize', onResize);
      resizeObserver.disconnect();
    };
  }, [isStackedSplitLayout, updateTableScrollHeights]);

  React.useLayoutEffect(() => {
    const element = detailViewContentRef.current;
    if (!element) return undefined;

    const updateDetailViewContentHeight = () => {
      const nextHeight = Math.max(240, Math.floor(element.getBoundingClientRect().height));
      setDetailViewContentHeight((current) => (current === nextHeight ? current : nextHeight));
    };

    updateDetailViewContentHeight();
    const resizeObserver = new ResizeObserver(updateDetailViewContentHeight);
    resizeObserver.observe(element);
    window.addEventListener('resize', updateDetailViewContentHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDetailViewContentHeight);
    };
  }, [isStackedSplitLayout, quickViewer, showFilters, viewMode]);

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
    detailStructureFrameSize,
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

  const handleTreeViewportChange = React.useCallback((zoom: number) => {
    setTreeZoom(Number(zoom.toFixed(2)));
  }, []);

  const changeTreeZoom = React.useCallback((delta: number) => {
    if (!treeFlowInstance) return;

    if (delta > 0) {
      void treeFlowInstance.zoomIn({ duration: 180 });
    } else {
      void treeFlowInstance.zoomOut({ duration: 180 });
    }
  }, [treeFlowInstance]);

  const fitTreeView = React.useCallback(() => {
    treeFlowInstance?.fitView({
      duration: 240,
      padding: 0.12,
      minZoom: MYBOARD_TREE_ZOOM_MIN,
      maxZoom: 1,
    });
  }, [treeFlowInstance]);

  const focusFirstTreeNode = React.useCallback(() => {
    if (!treeFlowInstance || treeNodes.length === 0) return;

    treeFlowInstance.setCenter(
      treeNodes[0].x + MYBOARD_TREE_NODE_WIDTH / 2,
      treeNodes[0].y + MYBOARD_TREE_NODE_HEIGHT / 2,
      { duration: 240, zoom: Math.max(treeZoom, 0.9) }
    );
  }, [treeFlowInstance, treeNodes, treeZoom]);

  const handleTreeStructurePreview = React.useCallback((compound: Compound, previewSvg: string) => {
    setStructurePreview({
      title: compound.compoundId || compound.name || 'Structure',
      svg: previewSvg,
      smiles: compound.smiles,
      molblock: compound.molBlock ?? compound.mol_block ?? compound.molblock,
      cdxml: compound.draw,
    });
  }, []);

  const initialTreeFlowNodes = React.useMemo<MyBoardTreeFlowNode[]>(() => (
    treeNodes.map((node) => ({
      id: node.id,
      type: 'myBoardTree',
      position: { x: node.x, y: node.y },
      data: {
        ...node,
        onStructureGenerated: handleCompoundStructureGenerated,
        onPreview: handleTreeStructurePreview,
      },
      draggable: true,
    }))
  ), [handleCompoundStructureGenerated, handleTreeStructurePreview, treeNodes]);

  const treeFlowEdges = React.useMemo<MyBoardTreeFlowEdge[]>(() => {
    const nodeMap = new Map(treeNodes.map((node) => [node.id, node]));

    return treeNodes
      .filter((node) => node.parentId && nodeMap.has(node.parentId))
      .map((node) => ({
        id: `${node.parentId}-${node.id}`,
        source: node.parentId!,
        target: node.id,
        type: 'smoothstep',
        animated: false,
        selectable: false,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
        },
      }));
  }, [treeNodes]);

  const treeFlowKey = React.useMemo(() => (
    treeNodes.map((node) => `${node.id}:${node.compound.id}`).join('|')
  ), [treeNodes]);

  const renderTreeView = () => {
    if (treeNodes.length === 0) {
      return (
        <div className="my-board-tree-empty">
          <Text type="secondary">Tree에 표시할 화합물 mock 데이터가 없습니다.</Text>
        </div>
      );
    }

    return (
      <div className="my-board-tree-view">
        <div className="my-board-tree-toolbar">
          <Space wrap size={10}>
            <span className="my-board-tree-select-all">
              <span className="my-board-tree-checkbox" aria-hidden="true" />
              <Text>All</Text>
            </span>
            <Select
              size="small"
              value="management"
              style={{ width: 138 }}
              options={[{ value: 'management', label: 'Management' }]}
            />
            <Button size="small" icon={<Bookmark size={14} />}>Bookmark</Button>
          </Space>
          <Space size={8}>
            <Text type="secondary" className="my-board-tree-zoom-value">
              {Math.round(treeZoom * 100)}%
            </Text>
            <Tooltip title="축소">
              <Button
                size="small"
                icon={<ZoomOut size={14} />}
                disabled={treeZoom <= MYBOARD_TREE_ZOOM_MIN}
                onClick={() => changeTreeZoom(-MYBOARD_TREE_ZOOM_STEP)}
              />
            </Tooltip>
            <Tooltip title="확대">
              <Button
                size="small"
                icon={<ZoomIn size={14} />}
                disabled={treeZoom >= MYBOARD_TREE_ZOOM_MAX}
                onClick={() => changeTreeZoom(MYBOARD_TREE_ZOOM_STEP)}
              />
            </Tooltip>
            <Tooltip title="화면 맞춤">
              <Button size="small" icon={<Maximize2 size={14} />} onClick={fitTreeView} />
            </Tooltip>
            <Tooltip title="선택 위치로 이동">
              <Button size="small" icon={<Crosshair size={14} />} onClick={focusFirstTreeNode} />
            </Tooltip>
            <Tooltip title={isTreeMiniMapVisible ? '미니맵 숨기기' : '미니맵 보이기'}>
              <Button
                size="small"
                icon={<MapIcon size={14} />}
                type={isTreeMiniMapVisible ? 'primary' : 'default'}
                onClick={() => setIsTreeMiniMapVisible((visible) => !visible)}
              />
            </Tooltip>
          </Space>
        </div>
        <div className="my-board-tree-canvas-shell">
          <ReactFlow<MyBoardTreeFlowNode, MyBoardTreeFlowEdge>
            key={treeFlowKey}
            defaultNodes={initialTreeFlowNodes}
            defaultEdges={treeFlowEdges}
            nodeTypes={myBoardTreeNodeTypes}
            fitView
            minZoom={MYBOARD_TREE_ZOOM_MIN}
            maxZoom={MYBOARD_TREE_ZOOM_MAX}
            panOnScroll
            proOptions={{ hideAttribution: true }}
            defaultViewport={{ x: 24, y: 48, zoom: 0.72 }}
            translateExtent={[
              [-240, -240],
              [MYBOARD_TREE_CANVAS_WIDTH + 480, MYBOARD_TREE_CANVAS_HEIGHT + 480],
            ]}
            nodeExtent={[
              [-120, -120],
              [MYBOARD_TREE_CANVAS_WIDTH + 480, MYBOARD_TREE_CANVAS_HEIGHT + 480],
            ]}
            onInit={(instance) => {
              setTreeFlowInstance(instance);
              handleTreeViewportChange(instance.getZoom());
            }}
            onMove={(_, viewport) => handleTreeViewportChange(viewport.zoom)}
          >
            {isTreeMiniMapVisible && (
              <MiniMap
                pannable
                zoomable
                nodeColor={(node) => (node.data?.depth === 1 ? '#F87C63' : '#8FBFE8')}
                maskColor="rgba(15, 23, 42, 0.08)"
              />
            )}
          </ReactFlow>
        </div>
      </div>
    );
  };

  return (
    <div
      className="gx-main-content my-board-page"
      style={{
        maxWidth: layoutPreset.maxWidth,
        margin: '0 auto',
        padding: `0 ${layoutPreset.sidePadding}px`,
        width: '100%',
        boxSizing: 'border-box',
        height: '100%',
        overflowY: isStackedSplitLayout ? 'auto' : 'hidden',
        overflowX: isStackedSplitLayout ? 'visible' : 'hidden'
      }}
    >
      <div className={`my-board-workspace ${quickViewer ? 'my-board-workspace-with-viewer' : ''} ${viewMode === 'table' ? '' : 'my-board-workspace-visual'}`}>
        <div className={`my-board-workspace-main ${viewMode === 'table' ? '' : 'my-board-workspace-main-visual'}`}>
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
          <Col flex={isStackedSplitLayout ? '1 1 100%' : 'none'}>
            <Button
              type="primary"
              icon={<ArrowRight size={18} />}
              iconPosition="end"
              disabled={sarTargetCount === 0}
              loading={isSarDataLoading}
              style={{ ...getCompoundActionButtonStyle(sarTargetCount > 0), minWidth: 117, width: isStackedSplitLayout ? '100%' : undefined }}
              onClick={handleOpenSarTable}
            >
              SAR table
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
        className="my-board-split"
        style={{
          display: 'flex',
          flexDirection: isStackedSplitLayout ? 'column' : 'row',
          flex: viewMode === 'table' ? undefined : '1 1 auto',
          gap: isStackedSplitLayout ? 16 : isGroupListStructureOnly ? 12 : 0,
          minHeight: 0,
          paddingBottom: isStackedSplitLayout ? 24 : 0
        }}
      >
        {!isGroupListHidden && (
        <div
          className="my-board-group-panel"
          style={{
            flex: isStackedSplitLayout
              ? undefined
              : isGroupListStructureOnly
                ? `0 0 ${MYBOARD_GROUP_STRUCTURE_ONLY_PANEL_WIDTH}px`
                : `0 0 ${typeof splitLeftWidth === 'number' ? `${splitLeftWidth}px` : `calc(${splitRatio}% - 6px)`}`,
            width: isStackedSplitLayout
              ? '100%'
              : isGroupListStructureOnly
                ? MYBOARD_GROUP_STRUCTURE_ONLY_PANEL_WIDTH
                : splitLeftWidth ?? `calc(${splitRatio}% - 6px)`,
            minWidth: 0,
            transition: isResizingSplit ? 'none' : 'width 0.2s ease, flex-basis 0.2s ease'
          }}
        >
          <div className="v-table-card my-board-list-card" ref={groupListTableCardRef}>
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
                <Text
                  strong
                  style={{
                    color: token.colorPrimary,
                    display: 'inline-flex',
                    alignItems: 'center',
                    fontSize: 16,
                    lineHeight: '24px',
                    minHeight: 24,
                  }}
                >
                  그룹 리스트
                </Text>
                <Space size={8} className="my-board-group-pin-filter">
                  <Button
                    type={groupPinFilter === 'pinned' ? 'primary' : 'default'}
                    size="small"
                    icon={<Bookmark size={12} />}
                    onClick={() => setGroupPinFilter((value) => value === 'pinned' ? 'all' : 'pinned')}
                  >
                    핀 고정
                    <span className="my-board-group-pin-filter-count">{formatNumberWithComma(pinnedGroupCount)}</span>
                  </Button>
                </Space>
              </div>
              <Space size={8}>
                <Button
                  size="middle"
                  icon={<ArrowLeft size={15} />}
                  style={{ height: 30, paddingInline: 12, fontWeight: 700 }}
                  onClick={() => {
                    navigate('/myboard');
                  }}
                >
                  돌아가기
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
              className={[
                'my-board-table',
                'my-board-group-table',
                isGroupListStructureOnly ? 'my-board-group-table-structure-only' : undefined,
                !shouldUseGroupTableHorizontalScroll ? 'my-board-group-table-no-horizontal-scroll' : undefined,
              ].filter(Boolean).join(' ')}
              dataSource={visibleGroupRows}
              columns={isGroupListStructureOnly ? styledStructureOnlyGroupColumns : styledGroupColumns}
              pagination={false}
              size="small"
              rowKey="id"
              locale={{ emptyText: groupPinFilter === 'pinned' ? '핀 고정된 그룹이 없습니다.' : '그룹이 없습니다.' }}
              scroll={groupTableScroll}
              tableLayout="fixed"
              onRow={(record) => ({
                onMouseDown: (event) => {
                  if (!event.shiftKey) return;
                  const target = event.target as HTMLElement;
                  if (target.closest('button, a, input, textarea, .ant-checkbox-wrapper, .ant-select, .ant-dropdown')) return;
                  event.preventDefault();
                },
                onClick: (event) => {
                  setIsLoading(true);
                  handleGroupRowSelection(record.id, event);
                  setTimeout(() => setIsLoading(false), 500);
                },
                onContextMenu: (event) => {
                  event.stopPropagation();
                  event.preventDefault();

                  if (!selectedGroupIds.includes(record.id)) {
                    setDetailPagination((prev) => (
                      prev.current === 1 ? prev : { ...prev, current: 1 }
                    ));
                    setSelectedGroupIds([record.id]);
                  }
                  groupSelectionAnchorRef.current = record.id;
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
          aria-valuemin={Math.round(splitMinRatio)}
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

        <div className="my-board-detail-panel" style={{ flex: isStackedSplitLayout ? '0 0 auto' : 1, minWidth: 0, width: isStackedSplitLayout || isGroupListHidden ? '100%' : undefined }}>
          <div className={`v-table-card my-board-list-card ${viewMode === 'table' ? '' : 'my-board-detail-visual-card'}`}>
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
                <Text
                  strong
                  style={{
                    color: token.colorPrimary,
                    display: 'inline-flex',
                    alignItems: 'center',
                    fontSize: 16,
                    lineHeight: '24px',
                    minHeight: 24,
                  }}
                >
                  그룹 상세 목록
                </Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flex: '1 1 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <div
                        key={n}
                        onClick={() => applyPreset(n)}
                        style={{
                          width: 24,
                          height: 24,
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
                <div className="my-board-detail-table-wrapper" ref={detailTableWrapperRef}>
                  <Table
                    className="my-board-table my-board-detail-table"
                    dataSource={selectedGroupIds.length > 0 ? filteredCompounds : []}
                    columns={styledDynamicCompoundColumns}
                    size="small"
                    rowKey="id"
                    pagination={{
                      current: detailPagination.current,
                      pageSize: detailPagination.pageSize,
                      showSizeChanger: true,
                      pageSizeOptions: [10, 30, 50, 100],
                      onChange: (current, pageSize) => {
                        setDetailPagination({ current, pageSize });
                      },
                    }}
                    loading={isLoading}
                    scroll={{ x: detailTableScrollX, y: detailTableScrollY }}
                    tableLayout="fixed"
                    onRow={(record) => ({
                      onMouseDown: (event) => {
                        if (!event.shiftKey) return;
                        const target = event.target as HTMLElement;
                        if (target.closest('button, a, input, textarea, .ant-checkbox-wrapper, .ant-select, .ant-dropdown')) return;
                        event.preventDefault();
                      },
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
                        detailSelectionAnchorRef.current = record.id;
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
            ) : (
              <div className="my-board-detail-visual-content" ref={detailViewContentRef}>
                {viewMode === 'draw' ? (
                  <div className="my-board-canvas-view">
                    <WhiteboardEditor
                      height={detailCanvasHeight}
                      compounds={filteredCompounds}
                      searchedSvg={searchedSvg}
                      searchKeyword={keyword}
                      canvasStateRef={whiteboardCanvasStateRef}
                    />
                  </div>
                ) : (
                  renderTreeView()
                )}
              </div>
            )}
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
              aria-valuemin={MYBOARD_QUICK_VIEWER_MIN_WIDTH}
              aria-valuemax={MYBOARD_QUICK_VIEWER_MAX_WIDTH}
              aria-valuenow={Math.round(quickViewerWidth)}
              tabIndex={0}
              className="my-board-quick-viewer-resizer"
              onMouseDown={handleQuickViewerResizeMouseDown}
              onKeyDown={handleQuickViewerResizeKeyDown}
            >
              <div className="my-board-quick-viewer-resizer-bar" />
            </div>
            <div
              ref={quickViewerPaneRef}
              className="my-board-quick-viewer-pane"
              style={{
                flexBasis: isStackedSplitLayout ? undefined : quickViewerWidth,
                width: isStackedSplitLayout ? '100%' : quickViewerWidth,
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
        title="합성 요청"
        open={isAssignModalOpen}
        onCancel={() => setIsAssignModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsAssignModalOpen(false)}>닫기</Button>,
          selectedSynthesisItem?.synthesisOwner ? (
            <Button
              key="remove"
              danger
              onClick={() => setIsAssignModalOpen(false)}
            >
              담당자 취소
            </Button>
          ) : null,
          <Button
            key="ok"
            type="primary"
            onClick={() => setIsAssignModalOpen(false)}
            style={{ background: token.colorPrimary, borderColor: token.colorPrimary }}
          >
            {selectedSynthesisItem?.synthesisOwner ? '담당자 수정' : '배정 완료'}
          </Button>
        ]}
        width={450}
      >
        <div style={{ padding: '10px 0' }}>
          <div style={{ marginBottom: 20, padding: 16, background: token.colorPrimaryBg, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 60, height: 40, background: token.colorBgContainer, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${token.colorBorderSecondary}` }}>
              <Beaker size={20} color={token.colorPrimary} />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>Selected Compound</Text><br />
              <Text strong>{selectedSynthesisItem?.compoundId || selectedSynthesisItem?.designNo || '-'} ({selectedSynthesisItem?.name})</Text>
            </div>
          </div>
          <Text strong>연구원 선택</Text>
          <Select
            showSearch
            style={{ width: '100%', marginTop: 8 }}
            placeholder="담당자 선택"
            defaultValue={selectedSynthesisItem?.synthesisOwner || undefined}
            options={[
              { value: '담당자1', label: '담당자1' },
              { value: '담당자2', label: '담당자2' },
              { value: '담당자3', label: '담당자3' },
              { value: '담당자4', label: '담당자4' },
            ]}
          />
        </div>
      </Modal>

      <Modal
        title="화합물 합성 요청"
        open={isSynthesisRequestModalOpen}
        onCancel={handleCloseSynthesisRequest}
        onOk={() => {
          if (isSynthesisRequestReadOnly && synthesisRequestTarget) {
            handleCancelSynthesisRequest(synthesisRequestTarget, true);
            return;
          }
          void handleSubmitSynthesisRequest();
        }}
        okText={isSynthesisRequestReadOnly ? '요청 취소' : '요청'}
        cancelText="닫기"
        width={760}
        className="synthesis-request-modal"
        okButtonProps={{
          danger: isSynthesisRequestReadOnly,
          disabled: isSynthesisRequestReadOnly ? !synthesisRequestTarget : !isSynthesisRequestSubmitEnabled,
        }}
      >
        <Form
          form={synthesisRequestForm}
          layout="vertical"
          className="synthesis-request-form"
        >
          <div className="synthesis-request-summary">
            <div className="synthesis-request-structure">
              <Text strong className="synthesis-request-section-label">화합물 구조</Text>
              <div className="synthesis-request-structure-frame">
                {synthesisRequestTarget ? (
                  <CompoundStructureView
                    className="synthesis-request-structure-view"
                    svg={synthesisRequestTarget.structureSvg}
                    rdkitSvg={synthesisRequestTarget.rdkitSvg}
                    rdkitSvgCache={synthesisRequestTarget.rdkitSvgCache}
                    title={synthesisRequestTarget.designNo || synthesisRequestTarget.name || 'Structure'}
                    smiles={synthesisRequestTarget.smiles}
                    molBlock={synthesisRequestTarget.molBlock ?? synthesisRequestTarget.mol_block ?? synthesisRequestTarget.molblock}
                    cdxml={synthesisRequestTarget.draw}
                    width={332}
                    height={236}
                    iconSize={36}
                    gap={0}
                    actionPlacement="overlay"
                    actionOverlayAnchor="frame"
                    actionOverlayPlacement="bottom-right"
                    frameless
                    preferRdkitSvg
                    onStructureGenerated={(data) => handleCompoundStructureGenerated(synthesisRequestTarget.id, data)}
                  />
                ) : null}
              </div>
            </div>
            <div className="synthesis-request-readonly">
              <Form.Item label="타겟" className="synthesis-request-inline-item">
                <Input disabled value={synthesisRequestTargetGroup?.target || synthesisRequestTarget?.project || '-'} />
              </Form.Item>
              <Form.Item label="그룹" className="synthesis-request-inline-item">
                <Input disabled value={getGroupDisplayText(synthesisRequestTargetGroup)} />
              </Form.Item>
              <Form.Item label="아이디어 번호" className="synthesis-request-inline-item">
                <Input disabled value={synthesisRequestTarget?.designNo || synthesisRequestTarget?.name || '-'} />
              </Form.Item>
              <Form.Item label="디자인 비고" className="synthesis-request-inline-item synthesis-request-design-memo-item">
                <div className="synthesis-request-design-memo-preview">
                  {renderDesignMemoPreview(synthesisRequestTarget?.designMemo)}
                </div>
              </Form.Item>
            </div>
          </div>

          <Divider />

          <Row gutter={[20, 8]}>
            <Col span={12}>
              <Form.Item
                name="synthesisRequestNo"
                label="합성 의뢰 번호"
                className="synthesis-request-inline-item"
                rules={[{ required: true, message: '합성 의뢰 번호가 필요합니다.' }]}
              >
                <Input disabled />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="합성 목적"
                className="synthesis-request-inline-item"
                required
              >
                <Form.Item name="synthesisReferenceName" hidden noStyle>
                  <Input />
                </Form.Item>
                <Cascader
                  multiple
                  disabled={isSynthesisRequestReadOnly}
                  options={designPurposeOptions}
                  classNames={{ popup: { root: 'idea-compound-popup-scroll idea-toggle-cascader-popup' } }}
                  showCheckedStrategy={Cascader.SHOW_CHILD}
                  value={getCascaderStringValue(selectedSynthesisRequestPurposes)}
                  onChange={(value) => handleSynthesisRequestPurposeChange(value as DesignPurposeValue[])}
                  displayRender={(labels) => {
                    const leafLabel = String(labels[labels.length - 1] ?? '');
                    const normalizedReferenceName = synthesisReferenceName?.trim();
                    return leafLabel === '레퍼런스' && normalizedReferenceName
                      ? `레퍼런스: ${normalizedReferenceName}`
                      : leafLabel;
                  }}
                  placeholder="합성 목적 선택"
                  popupRender={(menus) => (
                    <div className="idea-reference-cascader-dropdown">
                      {menus}
                      {isSynthesisRequestReferencePurposeSelected ? (
                        <div
                          className="idea-reference-cascader-panel"
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Text strong className="idea-reference-cascader-title">레퍼런스 이름</Text>
                          <Input
                            size="small"
                            disabled={isSynthesisRequestReadOnly}
                            placeholder="레퍼런스 이름 입력"
                            value={synthesisReferenceName ?? ''}
                            onKeyDown={(event) => {
                              event.stopPropagation();
                            }}
                            onChange={(event) => {
                              synthesisRequestForm.setFieldValue('synthesisReferenceName', event.target.value);
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                  )}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="requiredAmountMg"
                label="필요량(mg)"
                className="synthesis-request-inline-item"
                rules={[{ required: true, message: '필요량을 입력하세요.' }]}
              >
                <InputNumber
                  className="patent-insight-filter-number-input"
                  disabled={isSynthesisRequestReadOnly}
                  min={1}
                  step={1}
                  placeholder="10"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="단계"
                className="synthesis-request-inline-item"
                required
              >
                <Cascader
                  multiple
                  disabled={isSynthesisRequestReadOnly}
                  options={designExpansionOptions}
                  classNames={{ popup: { root: 'idea-compound-popup-scroll idea-toggle-cascader-popup' } }}
                  showCheckedStrategy={Cascader.SHOW_CHILD}
                  value={getCascaderStringValue(selectedSynthesisRequestSteps)}
                  onChange={(value) => handleSynthesisRequestStepChange(value as DesignExpansionValue[])}
                  displayRender={(labels) => labels[labels.length - 1]}
                  placeholder="단계 선택"
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="expectedEffect"
                label="기대 개선 효과"
                className="synthesis-request-inline-item"
                getValueFromEvent={(value) => (typeof value === 'string' ? value : '')}
              >
                {isSynthesisRequestReadOnly ? (
                  <div className="synthesis-request-readonly-memo-preview">
                    {renderDesignMemoPreview(synthesisRequestTarget?.expectedEffect)}
                  </div>
                ) : (
                  <PlainMemoEditor
                    className="synthesis-request-memo-editor"
                    placeholder="기대 개선 효과"
                  />
                )}
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="requestMemo"
                label="비고"
                className="synthesis-request-inline-item"
                getValueFromEvent={(value) => (typeof value === 'string' ? value : '')}
              >
                {isSynthesisRequestReadOnly ? (
                  <div className="synthesis-request-readonly-memo-preview">
                    {renderDesignMemoPreview(synthesisRequestTarget?.requestMemo)}
                  </div>
                ) : (
                  <PlainMemoEditor
                    className="synthesis-request-memo-editor"
                    placeholder="비고"
                  />
                )}
              </Form.Item>
            </Col>
          </Row>

          <Divider />

          <Row gutter={[20, 8]}>
            <Col span={12}>
              <Form.Item
                name="synthesisRequestType"
                label="합성 요청 구분"
                className="synthesis-request-inline-item"
                rules={[{ required: true, message: '합성 요청 구분을 선택하세요.' }]}
              >
                <Select placeholder="요청 구분 선택" disabled={isSynthesisRequestReadOnly}>
                  {SYNTHESIS_REQUEST_TYPE_OPTIONS.map((item) => (
                    <Option key={item} value={item}>{item}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title="Quick add"
        open={isQuickAddModalOpen}
        onCancel={() => {
          setIsQuickAddModalOpen(false);
          setQuickAddCode('');
          setSelectedQuickAddCode('');
          setQuickAddResults([]);
          setQuickAddError(null);
        }}
        onOk={handleQuickAddCompound}
        okText="추가"
        cancelText="취소"
        okButtonProps={{
          disabled: !(selectedQuickAddCode || quickAddCode).trim() || selectedGroupIds.length === 0 || !compoundLoginToken.trim(),
          loading: isQuickAddAdding,
        }}
      >
        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="내부 화합물 코드 번호" required>
            <Input
              autoFocus
              placeholder="예: VNA-G01-001"
              value={quickAddCode}
              onChange={(event) => {
                setQuickAddCode(event.target.value);
                setSelectedQuickAddCode('');
              }}
              onPressEnter={() => {
                if ((selectedQuickAddCode || quickAddCode).trim() && selectedGroupIds.length > 0) {
                  void handleQuickAddCompound();
                }
              }}
            />
          </Form.Item>
          {!compoundLoginToken.trim() ? (
            <Text type="danger" style={{ fontSize: 12 }}>
              헤더의 login token 버튼에서 compound_api login_token을 먼저 입력해주세요.
            </Text>
          ) : null}
          {quickAddError ? (
            <Text type="danger" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
              {quickAddError}
            </Text>
          ) : null}
          <List
            className="my-board-quick-add-list"
            size="small"
            loading={isQuickAddSearching}
            dataSource={quickAddResults}
            locale={{ emptyText: quickAddCode.trim() ? '조회 결과 없음' : 'compound code를 입력하세요' }}
            style={{ marginTop: 12, maxHeight: 220, overflowY: 'auto' }}
            renderItem={(item) => {
              const isSelected = selectedQuickAddCode === item.compound_code;
              return (
                <List.Item
                  onClick={() => {
                    setSelectedQuickAddCode(item.compound_code);
                    setQuickAddCode(item.compound_code);
                  }}
                  style={{
                    cursor: 'pointer',
                    borderRadius: 6,
                    paddingInline: 8,
                    background: isSelected ? token.colorPrimaryBg : undefined,
                  }}
                >
                  <Text strong={isSelected}>{item.compound_code}</Text>
                </List.Item>
              );
            }}
          />
        </Form>
      </Modal>

      {/* Create Design Modal */}
      <Modal
        className="idea-compound-modal"
        title={isCompoundEditModalOpen ? '아이디어 화합물 수정' : '아이디어 화합물 등록'}
        open={isDesignModalOpen || isCompoundEditModalOpen}
        onCancel={handleCloseDesignModal}
        onOk={isCompoundEditModalOpen ? handleUpdateDesignIdea : handleRegisterDesignIdea}
        okButtonProps={{
          disabled: !cdjsInstance,
          onMouseDown: (event: React.MouseEvent<HTMLElement>) => {
            event.preventDefault();
            void cdjsInstance?.__flushPendingInput?.();
          },
        }}
        okText={isCompoundEditModalOpen ? '수정' : '등록'}
        cancelText="취소"
        width="min(1440px, calc(100vw - 24px))"
        style={{ top: 18 }}
        styles={{ body: { maxHeight: 'calc(100vh - 132px)', overflowX: 'hidden', overflowY: 'auto', paddingTop: 12 } }}
        destroyOnHidden
      >
        <Form
          form={designForm}
          layout="vertical"
          className="idea-compound-form"
          initialValues={designFormInitialValues}
        >
          <Row gutter={[24, 10]}>
            <Col span={6}>
              <Form.Item name="target" label="타겟" className="idea-inline-form-item">
                <Input disabled />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="group" label="그룹" className="idea-inline-form-item">
                <Input disabled />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="ideaNumber" label="아이디어 번호" className="idea-inline-form-item">
                <Input disabled />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item label="화합물 구조" required className="idea-structure-form-item">
                <ChemDrawEditor
                  active={isDesignModalOpen || isCompoundEditModalOpen}
                  height={300}
                  flipControlsPlacement="left"
                  smilesValue={designSmiles}
                  onSmilesChange={handleDesignSmilesChange}
                  onReady={setCdjsInstance}
                  showHelperText={false}
                />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item
                name="smilesPreview"
                validateStatus={designSmilesError ? 'error' : undefined}
                help={designSmilesError || undefined}
                label={<span aria-hidden="true">&nbsp;</span>}
                className="idea-inline-form-item idea-smiles-form-item"
                style={{ marginBottom: 8 }}
              >
                <Input.TextArea
                  rows={1}
                  placeholder="SMILES"
                  style={{ resize: 'none' }}
                  value={designSmiles}
                  onChange={(event) => {
                    handleDesignSmilesChange(event.target.value);
                  }}
                />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item
                name="designMemo"
                label="디자인 비고"
                className="idea-inline-form-item"
                getValueFromEvent={(value) => (typeof value === 'string' ? value : '')}
              >
                <PlainMemoEditor
                  className="idea-design-memo-editor"
                  placeholder="디자인 의도나 참고 사항을 입력하세요"
                />
              </Form.Item>
            </Col>

            <Col span={24}>
              <div className="idea-synthesis-section">
                <Row gutter={[24, 12]}>
                  <Col span={6}>
                    <Form.Item name="synthesisRequestNo" label="합성 의뢰 번호" className="idea-inline-form-item">
                      <Input disabled placeholder="LYH-26-0001" />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item name="referenceName" hidden>
                      <Input />
                    </Form.Item>
                    <Form.Item label="합성 목적" className="idea-inline-form-item">
                      <Cascader
                        multiple
                        options={designPurposeOptions}
                        classNames={{ popup: { root: 'idea-compound-popup-scroll idea-toggle-cascader-popup' } }}
                        showCheckedStrategy={Cascader.SHOW_CHILD}
                        value={getCascaderStringValue(selectedDesignPurposes)}
                        onChange={(value) => handleDesignPurposeChange(value as DesignPurposeValue[])}
                        displayRender={(labels) => {
                          const leafLabel = String(labels[labels.length - 1] ?? '');
                          const normalizedReferenceName = designReferenceName?.trim();
                          return leafLabel === '레퍼런스' && normalizedReferenceName
                            ? `레퍼런스: ${normalizedReferenceName}`
                            : leafLabel;
                        }}
                        placeholder="합성 목적 선택"
                        popupRender={(menus) => (
                          <div className="idea-reference-cascader-dropdown">
                            {menus}
                            {isDesignReferencePurposeSelected ? (
                              <div
                                className="idea-reference-cascader-panel"
                                onMouseDown={(event) => event.stopPropagation()}
                                onClick={(event) => event.stopPropagation()}
                              >
                                <Text strong className="idea-reference-cascader-title">레퍼런스 이름</Text>
                                <Input
                                  size="small"
                                  placeholder="레퍼런스 이름 입력"
                                  value={designReferenceName ?? ''}
                                  onKeyDown={(event) => {
                                    event.stopPropagation();
                                  }}
                                  onChange={(event) => {
                                    designForm.setFieldValue('referenceName', event.target.value);
                                  }}
                                />
                              </div>
                            ) : null}
                          </div>
                        )}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item label="합성 확장필요 정도" className="idea-inline-form-item">
                      <Cascader
                        multiple
                        options={designExpansionOptions}
                        classNames={{ popup: { root: 'idea-compound-popup-scroll idea-toggle-cascader-popup' } }}
                        showCheckedStrategy={Cascader.SHOW_CHILD}
                        value={getCascaderStringValue(selectedDesignExpansions)}
                        onChange={(value) => handleDesignExpansionChange(value as DesignExpansionValue[])}
                        displayRender={(labels) => labels[labels.length - 1]}
                        placeholder="확장 필요 정도 선택"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item name="requiredAmountMg" label="필요량" className="idea-inline-form-item">
                      <InputNumber
                        className="patent-insight-filter-number-input"
                        min={0}
                        step={1}
                        placeholder="10"
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="expectedEffect"
                      label="기대 개선 효과"
                      className="idea-inline-form-item idea-rich-text-form-item"
                      getValueFromEvent={(value) => (typeof value === 'string' ? value : '')}
                    >
                      <PlainMemoEditor
                        className="idea-design-memo-editor"
                        placeholder="기대 개선 효과"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="requestMemo"
                      label="합성 의뢰 비고"
                      className="idea-inline-form-item idea-rich-text-form-item"
                      getValueFromEvent={(value) => (typeof value === 'string' ? value : '')}
                    >
                      <PlainMemoEditor
                        className="idea-design-memo-editor"
                        placeholder="합성 의뢰 비고"
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </div>
            </Col>

            <Col span={8}>
              <div className="idea-source-stack">
                <Form.Item name="source" label="출처" className="idea-inline-form-item">
                  <Select
                    classNames={{ popup: { root: 'idea-compound-popup-scroll' } }}
                    placeholder="출처 선택"
                    showSearch
                    allowClear
                  >
                    {sourceList.map(s => <Option key={s} value={s}>{s}</Option>)}
                  </Select>
                </Form.Item>
                <Form.Item label="첨부파일" className="idea-inline-form-item idea-attachment-form-item">
                  <Upload multiple showUploadList={true} beforeUpload={() => false}>
                    <Button icon={<UploadIcon size={14} />}>파일 첨부</Button>
                  </Upload>
                </Form.Item>
              </div>
            </Col>
            <Col span={16}>
              <Form.Item
                label={(
                  <div className="idea-calculation-label">
                    <Text strong style={{ fontSize: 12 }}><Activity size={13} style={{ marginRight: 4 }} />Calculations</Text>
                    <ToggleTag
                      checked={areAllCalculationsSelected}
                      onChange={(checked) => {
                        setSelectedCalculations(checked ? [...calculationOptions] : []);
                      }}
                      style={{ minHeight: 22, padding: '1px 8px', fontSize: 10, marginInlineEnd: 0 }}
                    >
                      All
                    </ToggleTag>
                  </div>
                )}
                className="idea-calculation-form-item"
              >
                <div className="idea-calculation-grid">
                  {calculationOptions.map(item => (
                    <ToggleTag
                      key={item}
                      checked={selectedCalculations.includes(item)}
                      onChange={(checked) => {
                        setSelectedCalculations((prev) => (
                          checked ? [...prev, item] : prev.filter(value => value !== item)
                        ));
                      }}
                    >
                      {item}
                    </ToggleTag>
                  ))}
                </div>
              </Form.Item>
            </Col>
          </Row>
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

      <StructurePreviewModal
        title={structurePreview?.title || 'Structure'}
        open={!!structurePreview}
        onCancel={() => setStructurePreview(null)}
        svg={structurePreview?.svg}
        smiles={structurePreview?.smiles}
        molblock={structurePreview?.molblock}
        cdxml={structurePreview?.cdxml}
        className="my-board-structure-preview"
      />
      <style>{`
        .my-board-synthesis-summary-cell {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
        }
        .my-board-synthesis-summary-tag.ant-tag {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          min-width: 28px;
          height: 28px;
          margin-inline-end: 0;
          padding: 0;
          border-radius: 50%;
          font-size: 12px;
          font-weight: 700;
          line-height: 26px;
          white-space: nowrap;
          box-sizing: border-box;
        }
        .my-board-synthesis-request-button.ant-btn {
          min-width: 78px;
          height: 24px;
          padding: 0 9px;
          border-radius: 990px;
          font-size: 11px;
          line-height: 22px;
        }
        .my-board-synthesis-status-cell {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 2px;
          width: 100%;
          min-width: 0;
        }
        .my-board-synthesis-status-text,
        .my-board-synthesis-status-text-button {
          font-size: 12px;
          line-height: 20px;
          font-weight: 400;
        }
        .my-board-synthesis-status-text-button {
          appearance: none;
          padding: 0;
          border: 0;
          background: transparent;
          font-family: inherit;
          cursor: pointer;
        }
        .my-board-synthesis-status-text-button:hover,
        .my-board-synthesis-status-text-button:focus-visible {
          text-decoration: underline;
        }
        .synthesis-request-form {
          padding-top: 4px;
        }
        .synthesis-request-summary {
          display: grid;
          grid-template-columns: 348px minmax(0, 1fr);
          gap: 28px;
          align-items: start;
        }
        .synthesis-request-section-label {
          display: block;
          margin-bottom: 6px;
          color: ${token.colorText};
          font-size: 13px;
        }
        .synthesis-request-structure-frame {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 348px;
          height: 327px;
          border: 1px solid ${token.colorBorder};
          border-radius: 8px;
          background: ${token.colorBgContainer};
          overflow: hidden;
        }
        .synthesis-request-structure-view .compound-structure-actions-overlay-bottom-right {
          right: 8px;
          bottom: 8px;
        }
        .synthesis-request-structure-view .compound-structure-action-button.ant-btn {
          width: 22px !important;
          min-width: 22px !important;
          height: 22px !important;
        }
        .synthesis-request-readonly {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding-top: 25px;
        }
        .synthesis-request-inline-item {
          margin-bottom: 8px;
        }
        .synthesis-request-inline-item .ant-form-item-row {
          display: grid !important;
          grid-template-columns: 96px minmax(0, 1fr);
          column-gap: 8px;
          align-items: center;
        }
        .synthesis-request-inline-item .ant-form-item-label {
          grid-column: 1;
          max-width: none !important;
          flex: none !important;
          padding: 0;
          text-align: right;
          white-space: nowrap;
        }
        .synthesis-request-inline-item .ant-form-item-label > label {
          height: 28px;
          color: ${token.colorTextSecondary};
          font-size: 12px;
          font-weight: 700;
        }
        .synthesis-request-inline-item .ant-form-item-control {
          grid-column: 2;
          max-width: none !important;
          flex: none !important;
          min-width: 0;
        }
        .synthesis-request-inline-item .ant-input,
        .synthesis-request-inline-item .ant-input-number,
        .synthesis-request-inline-item .ant-select-selector {
          min-height: 28px;
        }
        .synthesis-request-design-memo-item .ant-form-item-row,
        .synthesis-request-inline-item:has(.synthesis-request-memo-editor) .ant-form-item-row,
        .synthesis-request-inline-item:has(.synthesis-request-readonly-memo-preview) .ant-form-item-row {
          align-items: start;
        }
        .synthesis-request-design-memo-preview {
          display: flex;
          align-items: flex-start;
          justify-content: flex-start;
          height: 161px;
          box-sizing: border-box;
          padding: 6px 8px;
          border: 1px solid ${token.colorBorder};
          border-radius: 6px;
          background: ${token.colorBgContainerDisabled};
          overflow: auto;
        }
        .synthesis-request-design-memo-preview .my-board-design-memo-preview {
          min-height: 0;
          align-items: flex-start;
          justify-content: flex-start;
          text-align: left;
        }
        .synthesis-request-design-memo-preview .my-board-design-memo-text {
          text-align: left;
        }
        .synthesis-request-readonly-memo-preview {
          min-height: 54px;
          padding: 6px 8px;
          border: 1px solid ${token.colorBorder};
          border-radius: 6px;
          background: ${token.colorBgContainerDisabled};
          overflow: auto;
        }
        .synthesis-request-readonly-memo-preview .my-board-design-memo-preview {
          min-height: 0;
          align-items: flex-start;
          justify-content: flex-start;
          text-align: left;
        }
        .synthesis-request-readonly-memo-preview .my-board-design-memo-text {
          text-align: left;
        }
        .synthesis-request-design-memo-item .ant-form-item-label > label,
        .synthesis-request-inline-item:has(.synthesis-request-memo-editor) .ant-form-item-label > label,
        .synthesis-request-inline-item:has(.synthesis-request-readonly-memo-preview) .ant-form-item-label > label {
          padding-top: 4px;
        }
        .synthesis-request-form .ant-input[disabled],
        .synthesis-request-form .ant-input-disabled,
        .synthesis-request-form .ant-input-number-disabled input,
        .synthesis-request-form .ant-select-disabled .ant-select-selection-item {
          color: #000 !important;
          -webkit-text-fill-color: #000 !important;
        }
        .synthesis-request-memo-editor {
          width: 100%;
          min-height: 54px;
        }
        .synthesis-request-modal .synthesis-request-memo-editor .ql-container {
          border-color: ${token.colorBorder} !important;
          border-radius: ${token.borderRadius}px !important;
          overflow: hidden;
        }
        .idea-compound-form .ant-form-item {
          margin-bottom: 8px;
        }
        .idea-compound-modal {
          --idea-label-width: 132px;
        }
        .idea-inline-form-item,
        .idea-structure-form-item,
        .idea-calculation-form-item {
          display: block;
        }
        .idea-inline-form-item .ant-form-item-row,
        .idea-structure-form-item .ant-form-item-row,
        .idea-calculation-form-item .ant-form-item-row {
          display: grid !important;
          grid-template-columns: var(--idea-label-width) minmax(0, 1fr);
          column-gap: 8px;
        }
        .idea-inline-form-item .ant-form-item-row {
          align-items: center;
        }
        .idea-rich-text-form-item .ant-form-item-row,
        .idea-structure-form-item .ant-form-item-row,
        .idea-calculation-form-item .ant-form-item-row {
          align-items: start;
        }
        .idea-inline-form-item .ant-form-item-label,
        .idea-structure-form-item .ant-form-item-label,
        .idea-calculation-form-item .ant-form-item-label {
          grid-column: 1;
          max-width: none !important;
          flex: none !important;
          padding: 0;
          text-align: right;
          white-space: nowrap;
        }
        .idea-inline-form-item .ant-form-item-label > label,
        .idea-structure-form-item .ant-form-item-label > label,
        .idea-calculation-form-item .ant-form-item-label > label {
          height: 28px;
          color: ${token.colorTextSecondary};
          font-size: 12px;
          font-weight: 700;
        }
        .idea-structure-form-item .ant-form-item-label > label,
        .idea-calculation-form-item .ant-form-item-label > label {
          padding-top: 4px;
        }
        .idea-calculation-form-item .ant-form-item-label > label {
          height: auto;
          align-items: flex-start;
          justify-content: flex-end;
        }
        .idea-calculation-label {
          display: inline-flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
          line-height: 1.2;
        }
        .idea-structure-form-item .ant-form-item-label {
          display: flex;
          justify-content: flex-end;
          text-align: right;
        }
        .idea-structure-form-item .ant-form-item-label > label {
          height: 28px;
          padding-top: 4px;
        }
        .idea-structure-form-item .ant-form-item-control {
          display: block;
          padding-right: 2px;
        }
        .idea-inline-form-item .ant-form-item-control,
        .idea-structure-form-item .ant-form-item-control,
        .idea-calculation-form-item .ant-form-item-control {
          grid-column: 2;
          max-width: none !important;
          flex: none !important;
          min-width: 0;
        }
        .idea-inline-form-item .ant-input,
        .idea-inline-form-item .ant-input-number,
        .idea-inline-form-item .ant-select-selector,
        .idea-inline-form-item .ant-cascader-picker,
        .idea-inline-form-item .ant-btn {
          min-height: 28px;
        }
        .idea-compound-form .ant-input[disabled],
        .idea-compound-form .ant-input-disabled,
        .idea-compound-form .ant-input-number-disabled input,
        .idea-compound-form .ant-select-disabled .ant-select-selection-item {
          color: #000 !important;
          -webkit-text-fill-color: #000 !important;
        }
        .idea-smiles-form-item textarea {
          resize: none !important;
        }
        .idea-smiles-form-item .ant-form-item-control {
          padding-left: 45px;
        }
        .idea-synthesis-section {
          margin: 12px 0 16px;
          padding: 12px 0 14px;
          border-top: 1px solid ${token.colorBorderSecondary};
          border-bottom: 1px solid ${token.colorBorderSecondary};
        }
        .idea-design-memo-editor {
          width: 100%;
        }
        .idea-design-memo-editor .ql-toolbar {
          display: none;
        }
        .idea-design-memo-editor .ql-container {
          min-height: 86px;
          border: 1px solid ${token.colorBorder};
          border-radius: 6px;
          background: ${token.colorBgContainer};
          color: ${token.colorText};
          font-family: inherit;
          font-size: 12px;
        }
        .idea-design-memo-editor .ql-editor {
          min-height: 84px;
          max-height: 132px;
          padding: 6px 10px;
          line-height: 1.45;
          overflow-y: auto;
        }
        .idea-design-memo-editor .ql-editor.ql-blank::before {
          left: 10px;
          right: 10px;
          color: ${token.colorTextTertiary};
          font-style: normal;
        }
        .idea-design-memo-editor .ql-editor img {
          display: block;
          max-width: 100%;
          max-height: 96px;
          margin: 4px 0;
          object-fit: contain;
        }
        .my-board-design-memo-preview {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          min-width: 0;
          width: 100%;
          text-align: center;
        }
        .my-board-design-memo-text {
          display: block;
          width: 100%;
          text-align: center;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }
        .my-board-design-memo-image {
          display: block;
          width: 105px;
          height: 105px;
          border: 1px solid ${token.colorBorderSecondary};
          border-radius: 4px;
          background: ${token.colorBgContainer};
          object-fit: contain;
        }
        .idea-source-stack {
          display: grid;
          grid-template-rows: 32px 78px;
          row-gap: 12px;
        }
        .idea-source-stack .ant-form-item {
          margin-bottom: 0;
        }
        .idea-attachment-form-item {
          padding-top: 2px;
        }
        .idea-attachment-form-item .ant-upload-wrapper {
          display: block;
          min-height: 76px;
          max-height: 76px;
          overflow: hidden;
        }
        .idea-attachment-form-item .ant-upload-list {
          max-height: 34px;
          overflow-y: hidden;
          scrollbar-width: thin;
          scrollbar-color: ${token.colorBorder} ${token.colorBgContainer};
        }
        .idea-attachment-form-item .ant-upload-list:has(.ant-upload-list-item + .ant-upload-list-item) {
          max-height: 50px;
          overflow-y: auto;
        }
        .idea-attachment-form-item .ant-upload-list-item {
          margin-top: 4px;
        }
        .idea-attachment-form-item .ant-upload-list-item-name {
          line-height: 22px;
        }
        .idea-attachment-form-item .ant-upload-list::-webkit-scrollbar {
          width: 8px;
        }
        .idea-attachment-form-item .ant-upload-list::-webkit-scrollbar-track {
          background: ${token.colorBgContainer};
        }
        .idea-attachment-form-item .ant-upload-list::-webkit-scrollbar-thumb {
          background: ${token.colorBorder};
          border: 2px solid ${token.colorBgContainer};
          border-radius: 999px;
        }
        .idea-attachment-form-item .ant-upload-list::-webkit-scrollbar-thumb:hover {
          background: ${token.colorTextTertiary};
        }
        .idea-calculation-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 4px;
        }
        .idea-calculation-grid .v-project-tag {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          width: 100%;
          min-width: 0;
          justify-content: center;
          margin: 0;
          padding: 2px 6px;
          font-size: 10px;
          line-height: 1;
          text-align: center;
          white-space: normal;
        }
        .idea-compound-modal .ant-modal-body {
          scrollbar-width: thin;
          scrollbar-color: ${token.colorBorder} ${token.colorBgContainer};
        }
        .idea-compound-modal .ant-modal-body::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .idea-compound-modal .ant-modal-body::-webkit-scrollbar-track {
          background: ${token.colorBgContainer};
        }
        .idea-compound-modal .ant-modal-body::-webkit-scrollbar-thumb {
          background: ${token.colorBorder};
          border: 2px solid ${token.colorBgContainer};
          border-radius: 999px;
        }
        .idea-compound-modal .ant-modal-body::-webkit-scrollbar-thumb:hover {
          background: ${token.colorTextTertiary};
        }
        .idea-compound-popup-scroll,
        .idea-compound-popup-scroll .ant-select-item,
        .idea-compound-popup-scroll .ant-cascader-menu {
          background: ${token.colorBgElevated};
          color: ${token.colorText};
        }
        .idea-compound-popup-scroll .ant-select-item-option-active:not(.ant-select-item-option-disabled),
        .idea-compound-popup-scroll .ant-cascader-menu-item-active:not(.ant-cascader-menu-item-disabled),
        .idea-compound-popup-scroll .ant-cascader-menu-item:hover {
          background: ${token.colorFillSecondary};
        }
        .idea-compound-popup-scroll .ant-select-item-option-selected:not(.ant-select-item-option-disabled),
        .idea-compound-popup-scroll .ant-cascader-menu-item-active {
          background: ${token.colorPrimaryBg};
          color: ${token.colorText};
        }
        .idea-toggle-cascader-popup .ant-cascader-menu {
          padding: 6px;
        }
        .idea-toggle-cascader-popup .ant-cascader-menu-item {
          min-height: 26px;
          margin: 2px 0;
          padding: 3px 10px;
          border: 1px solid transparent;
          border-radius: 990px;
          transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
        }
        .idea-toggle-cascader-popup .ant-cascader-checkbox {
          display: none;
        }
        .idea-toggle-cascader-popup .ant-cascader-menu-item:hover {
          background: ${token.colorFillSecondary};
          border-color: ${token.colorBorderSecondary};
        }
        .idea-toggle-cascader-popup .ant-cascader-menu-item-active,
        .idea-toggle-cascader-popup .ant-cascader-menu-item:has(.ant-cascader-checkbox-checked),
        .idea-toggle-cascader-popup .ant-cascader-menu-item:has(.ant-cascader-checkbox-indeterminate) {
          background: ${token.colorPrimaryBg};
          border-color: ${token.colorPrimary};
          color: ${token.colorPrimary};
          font-weight: 600;
        }
        .idea-reference-cascader-dropdown {
          display: flex;
          align-items: stretch;
          background: ${token.colorBgElevated};
        }
        .idea-reference-cascader-panel {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 180px;
          min-height: 100%;
          padding: 10px;
          border-left: 1px solid ${token.colorBorderSecondary};
          background: ${token.colorBgElevated};
        }
        .idea-reference-cascader-title {
          color: ${token.colorTextSecondary};
          font-size: 12px;
          line-height: 18px;
        }
        .idea-compound-popup-scroll .rc-virtual-list-holder,
        .idea-compound-popup-scroll .ant-cascader-menu {
          scrollbar-width: thin;
          scrollbar-color: ${token.colorBorder} ${token.colorBgElevated};
        }
        .idea-compound-popup-scroll .rc-virtual-list-holder::-webkit-scrollbar,
        .idea-compound-popup-scroll .ant-cascader-menu::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .idea-compound-popup-scroll .rc-virtual-list-holder::-webkit-scrollbar-track,
        .idea-compound-popup-scroll .ant-cascader-menu::-webkit-scrollbar-track {
          background: ${token.colorBgElevated};
        }
        .idea-compound-popup-scroll .rc-virtual-list-holder::-webkit-scrollbar-thumb,
        .idea-compound-popup-scroll .ant-cascader-menu::-webkit-scrollbar-thumb {
          background: ${token.colorBorder};
          border: 2px solid ${token.colorBgElevated};
          border-radius: 999px;
        }
        .idea-compound-popup-scroll .rc-virtual-list-holder::-webkit-scrollbar-thumb:hover,
        .idea-compound-popup-scroll .ant-cascader-menu::-webkit-scrollbar-thumb:hover {
          background: ${token.colorTextTertiary};
        }
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
        .my-board-group-pin-filter {
          flex: 0 0 auto;
        }
        .my-board-group-pin-filter .ant-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          height: 24px;
          padding-inline: 8px;
          font-size: 12px;
          white-space: nowrap;
        }
        .my-board-group-pin-filter .ant-btn-primary .my-board-group-pin-filter-count {
          color: rgba(255, 255, 255, 0.86);
        }
        .my-board-group-pin-filter-count {
          color: ${token.colorTextSecondary};
          font-size: 11px;
        }
        .my-board-detail-row-selected > td {
          background-color: var(--table-row-selected-bg) !important;
        }
        .my-board-detail-row-selected:hover > td {
          background-color: var(--table-row-selected-hover-bg) !important;
        }
        .my-board-page {
          --table-row-hover-bg: rgba(248, 124, 99, 0.06);
          --table-row-selected-hover-bg: rgba(248, 124, 99, 0.16);
          min-height: 0;
        }
        [data-theme='dark'] .my-board-page {
          --table-row-hover-bg: rgba(248, 124, 99, 0.10);
          --table-row-selected-hover-bg: rgba(248, 124, 99, 0.24);
        }
        .my-board-group-panel,
        .my-board-detail-panel,
        .my-board-list-card {
          min-height: 0;
        }
        .my-board-list-card > .ant-table-wrapper,
        .my-board-detail-table-wrapper {
          min-height: 0;
        }
        .my-board-workspace-visual,
        .my-board-workspace-main-visual {
          height: 100%;
          min-height: 0;
        }
        .my-board-workspace-main-visual,
        .my-board-detail-visual-card {
          display: flex;
          flex-direction: column;
        }
        .my-board-workspace-main-visual,
        .my-board-detail-visual-card,
        .my-board-detail-visual-content {
          flex: 1 1 auto;
          height: 100%;
          min-height: 0;
        }
        .my-board-detail-visual-content {
          display: flex;
          flex-direction: column;
        }
        .my-board-detail-visual-content .my-board-tree-empty,
        .my-board-detail-visual-content .my-board-tree-view {
          flex: 1 1 auto;
          height: 100%;
          min-height: 0;
        }
        .my-board-detail-visual-content .my-board-tree-canvas-shell {
          flex: 1 1 auto;
          height: auto;
          min-height: 0;
        }
        .my-board-canvas-view {
          flex: 1 1 auto;
          height: 100%;
          min-height: 0;
          box-sizing: border-box;
          overflow: hidden;
        }
        .my-board-canvas-view > .ant-card {
          height: 100%;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }
        .my-board-canvas-view > .ant-card > .ant-card-body {
          height: 100%;
          min-height: 0;
          display: flex;
          flex-direction: column;
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
        .my-board-group-table:not(.my-board-group-table-structure-only) .ant-table-container,
        .my-board-group-table:not(.my-board-group-table-structure-only) .ant-table-content,
        .my-board-detail-table .ant-table-container,
        .my-board-detail-table .ant-table-content {
          min-width: 0;
          overflow-x: auto !important;
          overscroll-behavior-x: contain;
          -webkit-overflow-scrolling: touch;
        }
        .my-board-group-table-no-horizontal-scroll .ant-table-container,
        .my-board-group-table-no-horizontal-scroll .ant-table-content,
        .my-board-group-table-no-horizontal-scroll .ant-table-body {
          overflow-x: hidden !important;
        }
        .my-board-group-table-no-horizontal-scroll .ant-table {
          width: 100% !important;
          min-width: 0 !important;
        }
        .my-board-detail-table .ant-table-body {
          overflow-x: auto !important;
        }
        .my-board-group-table .ant-table-body {
          padding-bottom: 2px;
          box-sizing: border-box;
        }
        .my-board-page,
        .my-board-page .ant-table-body,
        .my-board-page .ant-table-content,
        .my-board-quick-add-list,
        .quick-viewer-body {
          scrollbar-width: thin;
          scrollbar-color: ${token.colorBorder} ${token.colorBgContainer};
        }
        .my-board-page::-webkit-scrollbar,
        .my-board-page .ant-table-body::-webkit-scrollbar,
        .my-board-page .ant-table-content::-webkit-scrollbar,
        .my-board-quick-add-list::-webkit-scrollbar,
        .quick-viewer-body::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .my-board-page::-webkit-scrollbar-track,
        .my-board-page .ant-table-body::-webkit-scrollbar-track,
        .my-board-page .ant-table-content::-webkit-scrollbar-track,
        .my-board-quick-add-list::-webkit-scrollbar-track,
        .quick-viewer-body::-webkit-scrollbar-track {
          background: ${token.colorBgContainer};
        }
        .my-board-page::-webkit-scrollbar-thumb,
        .my-board-page .ant-table-body::-webkit-scrollbar-thumb,
        .my-board-page .ant-table-content::-webkit-scrollbar-thumb,
        .my-board-quick-add-list::-webkit-scrollbar-thumb,
        .quick-viewer-body::-webkit-scrollbar-thumb {
          background: ${token.colorBorder};
          border: 2px solid ${token.colorBgContainer};
          border-radius: 999px;
        }
        .my-board-page::-webkit-scrollbar-thumb:hover,
        .my-board-page .ant-table-body::-webkit-scrollbar-thumb:hover,
        .my-board-page .ant-table-content::-webkit-scrollbar-thumb:hover,
        .my-board-quick-add-list::-webkit-scrollbar-thumb:hover,
        .quick-viewer-body::-webkit-scrollbar-thumb:hover {
          background: ${token.colorTextTertiary};
        }
        .my-board-data-tags {
          display: flex;
          width: 100%;
          min-width: 0;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 3px;
        }
        .my-board-data-tag {
          height: 20px;
          min-width: 24px;
          padding: 0 7px;
          flex: 0 0 auto;
          border: 1px solid ${token.colorBorderSecondary};
          border-radius: 999px;
          background: ${token.colorBgLayout};
          color: ${token.colorTextSecondary};
          font-size: 10px;
          font-weight: 700;
          line-height: 18px;
          white-space: nowrap;
          cursor: pointer;
          transition: color 0.16s ease, background-color 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
        }
        .my-board-data-tag:hover {
          color: ${token.colorPrimary};
          border-color: ${token.colorPrimary};
          background: ${token.colorPrimaryBg};
        }
        .my-board-data-tag-kp {
          min-width: 28px;
        }
        .my-board-workspace {
          display: flex;
          align-items: flex-start;
          gap: 0;
          width: 100%;
          min-width: 0;
        }
        .my-board-workspace-main {
          flex: 1 1 auto;
          min-width: 0;
          transition: flex-basis 0.18s ease, width 0.18s ease;
        }
        .my-board-quick-viewer-resizer {
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
        .my-board-quick-viewer-resizer-bar {
          width: 4px;
          height: 88px;
          border-radius: 999px;
          background: ${isResizingQuickViewer ? token.colorPrimary : token.colorBorder};
          transition: background-color 0.16s ease, height 0.16s ease;
        }
        .my-board-quick-viewer-resizer:hover .my-board-quick-viewer-resizer-bar,
        .my-board-quick-viewer-resizer:focus-visible .my-board-quick-viewer-resizer-bar {
          background: ${token.colorPrimary};
          height: 112px;
        }
        .my-board-quick-viewer-pane {
          flex: 0 0 auto;
          min-width: ${MYBOARD_QUICK_VIEWER_MIN_WIDTH}px;
          max-width: ${MYBOARD_QUICK_VIEWER_MAX_WIDTH}px;
          height: calc(100vh - 132px);
          min-height: 520px;
          position: sticky;
          top: 0;
          overflow: hidden;
          box-sizing: border-box;
        }
        .quick-viewer-panel {
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
        .quick-viewer-panel-open {
          pointer-events: auto;
        }
        .quick-viewer-header {
          height: 56px;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--c-card-border);
          box-sizing: border-box;
        }
        .quick-viewer-title {
          display: block;
          color: ${token.colorText};
          font-size: 15px;
          font-weight: 800;
          line-height: 18px;
        }
        .quick-viewer-subtitle {
          display: block;
          color: ${token.colorTextSecondary};
          font-size: 11px;
          line-height: 14px;
        }
        .quick-viewer-tabs {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 6px;
          padding: 10px 14px;
          border-bottom: 1px solid var(--c-card-border);
          background: var(--bg-color);
        }
        .quick-viewer-tab {
          height: 28px;
          border: 1px solid ${token.colorBorderSecondary};
          border-radius: 999px;
          background: ${token.colorBgContainer};
          color: ${token.colorTextSecondary};
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }
        .quick-viewer-tab:disabled {
          opacity: 0.42;
          cursor: not-allowed;
        }
        .quick-viewer-tab-active {
          border-color: #F87C63;
          background: #F87C63;
          color: #FFFFFF;
        }
        .quick-viewer-body {
          min-height: 0;
          flex: 1;
          overflow: auto;
          padding: 10px;
          background: var(--card-bg);
        }
        .quick-viewer-result-row {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 6px;
        }
        .quick-viewer-result-select {
          width: min(100%, 260px);
        }
        .quick-viewer-kinome-stage,
        .quick-viewer-placeholder-stage {
          position: relative;
          width: 100%;
          min-height: 0;
          border: 1px solid ${token.colorBorderSecondary};
          border-radius: 8px;
          background: #FFFFFF;
          overflow: hidden;
        }
        .quick-viewer-molstar-stage {
          position: relative;
          width: 100%;
          height: clamp(320px, 52vh, 560px);
          min-height: 320px;
          border: 1px solid ${token.colorBorderSecondary};
          border-radius: 8px;
          background: #05070A;
          overflow: hidden;
        }
        .quick-viewer-molstar-canvas {
          position: absolute;
          inset: 0;
          display: block;
          width: 100%;
          height: 100%;
          outline: none;
        }
        .quick-viewer-molstar-overlay {
          position: absolute;
          inset: 0;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: color-mix(in srgb, ${token.colorBgContainer} 76%, transparent);
        }
        .quick-viewer-molstar-overlay-error {
          align-items: flex-start;
          padding-top: 18px;
        }
        .quick-viewer-molstar-loading {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          color: ${token.colorTextSecondary};
          font-size: 12px;
          font-weight: 500;
          line-height: 1.4;
        }
        .quick-viewer-molstar-tooltip {
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
        .quick-viewer-kinome-svg,
        .quick-viewer-pdb-svg {
          display: block;
          width: 100%;
          height: auto;
        }
        .quick-viewer-zoom-button {
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
        .quick-viewer-zoom-button:hover {
          border-color: ${token.colorPrimary};
          color: ${token.colorPrimary};
        }
        .quick-viewer-kinome-modal .ant-modal-body {
          padding: 12px;
        }
        .quick-viewer-kinome-modal-stage {
          width: 100%;
          max-height: min(78vh, 820px);
          overflow: auto;
          scrollbar-width: thin;
          scrollbar-color: ${token.colorBorder} ${token.colorBgContainer};
          border: 1px solid ${token.colorBorderSecondary};
          border-radius: 8px;
          background: ${token.colorBgContainer};
        }
        .quick-viewer-kinome-modal-stage::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .quick-viewer-kinome-modal-stage::-webkit-scrollbar-track {
          background: ${token.colorBgContainer};
        }
        .quick-viewer-kinome-modal-stage::-webkit-scrollbar-thumb {
          background: ${token.colorBorder};
          border: 2px solid ${token.colorBgContainer};
          border-radius: 999px;
        }
        .quick-viewer-kinome-modal-stage::-webkit-scrollbar-thumb:hover {
          background: ${token.colorTextTertiary};
        }
        .quick-viewer-kinome-modal-svg {
          display: block;
          width: 100%;
          min-width: 1240px;
          height: auto;
        }
        .quick-viewer-placeholder-stage {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .quick-viewer-cta {
          height: 34px;
          margin-top: 8px;
          border-radius: 6px;
          font-weight: 800;
        }
        .quick-viewer-info-table {
          margin-top: 8px;
          border: 1px solid ${token.colorBorderSecondary};
          border-radius: 8px;
          overflow: hidden;
        }
        .quick-viewer-info-row {
          min-height: 30px;
          padding: 7px 10px;
          display: grid;
          grid-template-columns: minmax(90px, 0.45fr) minmax(0, 1fr);
          gap: 8px;
          align-items: center;
          border-bottom: 1px solid ${token.colorBorderSecondary};
          font-size: 11px;
        }
        .quick-viewer-info-row:last-child {
          border-bottom: 0;
        }
        .quick-viewer-info-row span {
          color: ${token.colorTextSecondary};
        }
        .quick-viewer-info-row strong {
          color: ${token.colorText};
          font-weight: 800;
          text-align: right;
          overflow-wrap: anywhere;
        }
        @media (max-width: ${MYBOARD_SYNTHESIS_STACKED_BREAKPOINT}px) {
          .my-board-workspace {
            display: block;
          }
          .my-board-page,
          .my-board-workspace-main,
          .my-board-split,
          .my-board-group-panel,
          .my-board-detail-panel,
          .my-board-list-card,
          .my-board-detail-table-wrapper {
            display: block;
            height: auto;
            max-height: none;
          }
          .my-board-quick-viewer-resizer {
            display: none;
          }
          .my-board-quick-viewer-pane {
            position: fixed;
            inset: 0;
            z-index: 1200;
            width: 100vw !important;
            height: 100vh;
            max-width: none;
            min-width: 0;
            min-height: 0;
            background: ${token.colorBgContainer};
            padding: 0;
          }
          .quick-viewer-panel {
            width: 100%;
            height: 100%;
            border: 0;
            border-radius: 0;
          }
          .quick-viewer-molstar-stage {
            height: calc(100vh - 210px);
            min-height: 360px;
          }
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
        .my-board-action-icon {
          display: block;
          width: 14px;
          height: 14px;
          pointer-events: none;
        }
        .my-board-action-icon-eye-off {
          background: currentColor;
          mask: url("${eyeOffIconMaskUrl}") center / contain no-repeat;
          -webkit-mask: url("${eyeOffIconMaskUrl}") center / contain no-repeat;
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
          margin-bottom: 2px;
          padding-bottom: 2px;
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
        .my-board-structure-bookmark {
          position: absolute;
          top: 2px;
          left: 2px;
          z-index: 12;
          line-height: 1;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.16s ease;
        }
        .my-board-representative-structure:hover .my-board-structure-bookmark,
        .my-board-representative-structure.is-bookmarked .my-board-structure-bookmark {
          opacity: 1;
          pointer-events: auto;
        }
        .my-board-bookmark-button {
          width: 16px;
          min-width: 16px;
          height: 16px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: ${token.colorTextQuaternary};
          border: 1px solid transparent;
          border-radius: 4px;
          transition: background-color 0.16s ease, color 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
        }
        .my-board-structure-bookmark .my-board-bookmark-button {
          background: color-mix(in srgb, ${token.colorBgContainer} 88%, transparent) !important;
          backdrop-filter: blur(2px);
        }
        .my-board-bookmark-icon {
          width: 12px;
          height: 12px;
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
        .my-board-structure-bookmark .my-board-bookmark-button,
        .my-board-structure-bookmark .my-board-bookmark-button:hover,
        .my-board-structure-bookmark .my-board-bookmark-button:focus,
        .my-board-structure-bookmark .my-board-bookmark-button:focus-visible,
        .my-board-structure-bookmark .my-board-bookmark-button:active,
        .my-board-structure-bookmark .my-board-bookmark-button.active,
        .my-board-structure-bookmark .my-board-bookmark-button.active:hover,
        .my-board-structure-bookmark .my-board-bookmark-button.active:focus-visible {
          background: color-mix(in srgb, ${token.colorBgContainer} 88%, transparent) !important;
        }
        .canvas-card:hover { border-color: ${token.colorPrimary} !important; transform: translateY(-4px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .cdd-clipboard-icon-container, .CDW_Logo, .cdd-logo { display: none !important; }
      `}</style>
    </div>
  );
};

export default MyBoardSynthesisBoard;
