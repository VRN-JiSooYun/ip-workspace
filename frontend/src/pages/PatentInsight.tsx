import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { Alert, App, Button, Card, Col, DatePicker, Empty, Input, InputNumber, Row, Space, Spin, Table, Tooltip, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { GridLayout, useContainerWidth } from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import { noCompactor } from 'react-grid-layout/core';
import { BarChart3, Check, ChevronDown, ChevronUp, Edit3, GripVertical, RefreshCw, RotateCcw, Search, X } from 'lucide-react';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import { getPatentAnalysisLayoutPreset } from '../config/patentAnalysisLayout';
import {
  PATENT_INSIGHT_BREAKPOINTS,
  PATENT_INSIGHT_COLS,
  getDefaultPatentInsightLayouts,
  getPatentInsightBreakpoint,
  normalizePatentInsightLayouts,
  readPatentInsightLayouts,
  resolveLayoutCollisionsDownward,
  toReactGridLayouts,
  writePatentInsightLayouts,
  type PatentInsightLayouts,
} from '../config/patentInsightGrid';
import { useAuthSession } from '../contexts/AuthSessionContext';
import { useTheme } from '../contexts/ThemeContext';
import { PatentInsightApplicantItem, PatentInsightCountItem, PatentInsightStatistics } from '../mocks/patentInsight';
import { patentInsightApi } from '../services/patentInsightApi';
import { useUIStore } from '../store/useUIStore';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const { RangePicker } = DatePicker;
const { Text } = Typography;

const FILTER_STORAGE_KEY = 'patent-insight-filters';
const CHART_RESIZE_EVENT = 'patent-insight:chart-resize';
const PATENT_INSIGHT_GRID_MARGIN = [12, 12] as const;
const PATENT_INSIGHT_GRID_PADDING = [0, 0] as const;
const DEFAULT_DATE_RANGE_START = '1970-01-01';
const DEFAULT_TOP_N_TARGET = 20;
const EMPTY_PATENT_INSIGHT_STATISTICS: PatentInsightStatistics = {
  totalCount: 0,
  filteredCount: 0,
  countAcrossTime: [],
  patentPerOffice: [],
  filingLanguageCounts: [],
  patentTypeCounts: [],
  patentCountByApplicant: [],
  patentCountByTargetAndApplicant: [],
};

type StoredFilters = {
  applicant?: string;
  dateRange?: [string | null, string | null] | null;
  topNApplicant?: number;
  topNTarget?: number;
};

const readStoredFilters = (): StoredFilters => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const formatInteger = (value: number) => value.toLocaleString();

const normalizeFilingLanguageName = (name: string) => {
  const normalized = name.trim().toLowerCase();
  if (['korean', 'ko', 'kor', 'kr', '한국어', '한국', 'korea'].includes(normalized)) return 'Korean';
  if (['english', 'en', 'eng'].includes(normalized)) return 'English';
  if (['chinese', 'zh', 'zho', 'chi', 'cn', '中文', '중국어', '중국'].includes(normalized)) return '中文';
  if (['japanese', 'ja', 'jpn', 'jp', '日本語', '일본어', '일본'].includes(normalized)) return 'Japanese';
  return '기타';
};

const normalizeFilingLanguageCounts = (items: PatentInsightCountItem[]) => {
  const displayOrder = ['Korean', 'English', '中文', 'Japanese', '기타'];
  const counts = new Map<string, number>(displayOrder.map(name => [name, 0]));

  items.forEach((item) => {
    const key = normalizeFilingLanguageName(item.name);
    counts.set(key, (counts.get(key) ?? 0) + item.count);
  });

  return Array.from(counts, ([name, count]) => ({ name, count }))
    .sort((a, b) => {
      if (a.name === '기타') return 1;
      if (b.name === '기타') return -1;
      return b.count - a.count || displayOrder.indexOf(a.name) - displayOrder.indexOf(b.name);
    });
};

const getDateYear = (value: any) => {
  if (!value) return null;
  if (typeof value.year === 'function') return Number(value.year());
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.year() : null;
};

const createTextStyle = (color: string) => ({
  color,
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
});

const SafeReactECharts: React.FC<{
  option: any;
  theme?: string;
  style?: React.CSSProperties;
  onEvents?: Record<string, (...args: any[]) => void>;
}> = ({ option, theme, style, onEvents }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<any>(null);
  const resizeFrameRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (resizeFrameRef.current !== null) {
      window.cancelAnimationFrame(resizeFrameRef.current);
      resizeFrameRef.current = null;
    }
    const chart = chartRef.current?.getEchartsInstance?.();
    chartRef.current = null;
    if (chart && !chart.isDisposed?.()) {
      chart.clear();
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeChart = () => {
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
      }
      resizeFrameRef.current = window.requestAnimationFrame(() => {
        resizeFrameRef.current = null;
        const chart = chartRef.current?.getEchartsInstance?.();
        if (chart && !chart.isDisposed?.()) {
          const rect = container.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            chart.resize({
              width: Math.floor(rect.width),
              height: Math.floor(rect.height),
            });
          }
        }
      });
    };

    const gridItem = container.closest('.react-grid-item');
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(resizeChart);
    resizeObserver?.observe(container);
    if (gridItem) resizeObserver?.observe(gridItem);
    window.addEventListener(CHART_RESIZE_EVENT, resizeChart);
    resizeChart();

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener(CHART_RESIZE_EVENT, resizeChart);
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
    };
  }, []);

  return (
    <div ref={containerRef} style={style}>
      <ReactECharts
        ref={chartRef}
        option={option}
        theme={theme}
        style={{ width: '100%', height: '100%' }}
        onEvents={onEvents}
        notMerge
        lazyUpdate
        autoResize={false}
      />
    </div>
  );
};

const ChartPanel: React.FC<{
  title: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  isLayoutEditing?: boolean;
}> = ({ title, extra, children, className, isLayoutEditing = false }) => {
  const { token } = theme.useToken();

  return (
    <Card
      className={`patent-insight-chart-card${className ? ` ${className}` : ''}`}
      styles={{
        body: {
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: 14,
          boxSizing: 'border-box',
        },
      }}
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        boxShadow: 'none',
      }}
    >
      <div className="patent-insight-card-header">
        <div className="patent-insight-card-title patent-insight-card-drag-handle">
          {isLayoutEditing ? <GripVertical size={15} aria-hidden="true" /> : null}
          <Text strong>{title}</Text>
        </div>
        {extra}
      </div>
      <div className="patent-insight-chart-body">
        {children}
      </div>
    </Card>
  );
};

const MetricCard: React.FC<{
  label: string;
  value: number;
  caption?: string;
  isLayoutEditing?: boolean;
}> = ({ label, value, caption, isLayoutEditing = false }) => {
  const { token } = theme.useToken();

  return (
    <Card
      className="patent-insight-metric-card"
      style={{ border: `1px solid ${token.colorBorderSecondary}`, boxShadow: 'none' }}
      styles={{
        body: {
          height: '100%',
          padding: 16,
          boxSizing: 'border-box',
        },
      }}
    >
      <div className="patent-insight-metric-title patent-insight-card-drag-handle">
        {isLayoutEditing ? <GripVertical size={15} aria-hidden="true" /> : null}
        <Text type="secondary" style={{ fontSize: 11, fontWeight: 700 }}>{label}</Text>
      </div>
      <div style={{ marginTop: 12, fontSize: 30, lineHeight: 1, fontWeight: 760, color: token.colorPrimary }}>
        {formatInteger(value)}
      </div>
      {caption ? <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 11 }}>{caption}</Text> : null}
    </Card>
  );
};

const PatentInsight: React.FC = () => {
  const { token } = theme.useToken();
  const { message, modal } = App.useApp();
  const session = useAuthSession();
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const { setHeaderContent } = useUIStore();
  const storedFilters = useMemo(readStoredFilters, []);
  const hasLoadedInitialStatisticsRef = useRef(false);
  const initialGridLayouts = useMemo(
    () => readPatentInsightLayouts(session.user.id),
    [session.user.id],
  );
  const {
    width: gridWidth,
    containerRef: gridContainerRef,
    mounted: isGridMeasured,
  } = useContainerWidth({ initialWidth: 1280 });
  const handleGridContainerRef = React.useCallback((node: HTMLDivElement | null) => {
    (gridContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  }, [gridContainerRef]);

  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === 'undefined' ? 1920 : window.innerWidth));
  const [statistics, setStatistics] = useState<PatentInsightStatistics>(EMPTY_PATENT_INSIGHT_STATISTICS);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applicant, setApplicant] = useState(storedFilters.applicant ?? '');
  const [dateRange, setDateRange] = useState<[any, any] | null>(() => {
    if (!storedFilters.dateRange?.[0] || !storedFilters.dateRange?.[1]) return [dayjs(DEFAULT_DATE_RANGE_START), dayjs()];
    return [dayjs(storedFilters.dateRange[0]), dayjs(storedFilters.dateRange[1])];
  });
  const [topNApplicant, setTopNApplicant] = useState(storedFilters.topNApplicant ?? 10);
  const [topNTarget, setTopNTarget] = useState(storedFilters.topNTarget ?? DEFAULT_TOP_N_TARGET);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filingLanguageLegendSelected, setFilingLanguageLegendSelected] = useState<Record<string, boolean>>({});
  const [savedGridLayouts, setSavedGridLayouts] = useState<PatentInsightLayouts>(() => (
    normalizePatentInsightLayouts(initialGridLayouts)
  ));
  const [draftGridLayouts, setDraftGridLayouts] = useState<PatentInsightLayouts>(() => (
    normalizePatentInsightLayouts(initialGridLayouts)
  ));
  const draftGridLayoutsRef = useRef<PatentInsightLayouts>(
    normalizePatentInsightLayouts(initialGridLayouts),
  );
  const layoutEditSnapshotRef = useRef<PatentInsightLayouts | null>(null);
  const activeGridInteractionItemRef = useRef<string | null>(null);
  const [isLayoutEditing, setIsLayoutEditing] = useState(false);
  const [gridRenderRevision, setGridRenderRevision] = useState(0);

  const layoutPreset = useMemo(() => getPatentAnalysisLayoutPreset(viewportWidth), [viewportWidth]);
  const isStackedLayout = viewportWidth < 1200;
  const canEditGridLayout = isGridMeasured && gridWidth >= PATENT_INSIGHT_BREAKPOINTS.sm;
  const isGridInteractionEnabled = isLayoutEditing && canEditGridLayout;
  const activeGridBreakpoint = getPatentInsightBreakpoint(gridWidth);
  const gridColumnCount = PATENT_INSIGHT_COLS[activeGridBreakpoint];
  const gridStyle = useMemo(() => ({
    '--patent-insight-grid-columns': gridColumnCount,
  }) as React.CSSProperties, [gridColumnCount]);
  const gridDragConfig = useMemo(() => ({
    enabled: isGridInteractionEnabled,
    handle: '.patent-insight-card-drag-handle',
    cancel: '.patent-insight-chart-body, canvas, button, a, input, .ant-table, .ant-select',
  }), [isGridInteractionEnabled]);
  const gridResizeConfig = useMemo(() => ({
    enabled: isGridInteractionEnabled,
    handles: ['se' as const],
  }), [isGridInteractionEnabled]);
  const deferredCollisionCompactor = useMemo(() => ({
    ...noCompactor,
    allowOverlap: true,
    preventCollision: false,
  }), []);
  const gridConfig = useMemo(() => ({
    cols: gridColumnCount,
    rowHeight: 33,
    margin: PATENT_INSIGHT_GRID_MARGIN,
    containerPadding: PATENT_INSIGHT_GRID_PADDING,
  }), [gridColumnCount]);
  const reactGridLayouts = useMemo(
    () => toReactGridLayouts(draftGridLayouts, gridWidth),
    [draftGridLayouts, gridWidth],
  );
  const activeGridLayout = reactGridLayouts[activeGridBreakpoint] ?? [];

  const chartTextColor = token.colorTextSecondary;
  const chartGridColor = token.colorBorderSecondary;
  const chartAxisLineColor = token.colorBorder;
  const chartTooltipBg = token.colorBgElevated;
  const chartPrimaryPalette = useMemo(() => [
    token.colorPrimary,
    token.colorPrimaryHover,
    token.colorPrimaryActive,
    token.colorPrimaryBorder,
    token.colorPrimaryBorderHover,
    token.colorTextQuaternary,
  ], [
    token.colorPrimary,
    token.colorPrimaryActive,
    token.colorPrimaryBorder,
    token.colorPrimaryBorderHover,
    token.colorPrimaryHover,
    token.colorTextQuaternary,
  ]);
  const heatmapPalette = useMemo(() => (
    isDarkMode
      ? [token.colorPrimaryBg, token.colorPrimaryBorder, token.colorPrimary]
      : [token.colorPrimaryBg, token.colorPrimaryBorderHover, token.colorPrimaryActive]
  ), [
    isDarkMode,
    token.colorPrimary,
    token.colorPrimaryActive,
    token.colorPrimaryBg,
    token.colorPrimaryBorder,
    token.colorPrimaryBorderHover,
  ]);
  const filingLanguageChartData = useMemo(
    () => normalizeFilingLanguageCounts(statistics.filingLanguageCounts),
    [statistics.filingLanguageCounts],
  );
  const filingLanguageActiveTotal = useMemo(
    () => filingLanguageChartData.reduce((total, item) => (
      filingLanguageLegendSelected[item.name] === false ? total : total + item.count
    ), 0),
    [filingLanguageChartData, filingLanguageLegendSelected],
  );
  const filingLanguageChartEvents = useMemo(() => ({
    legendselectchanged: (params: any) => {
      setFilingLanguageLegendSelected(params?.selected ?? {});
    },
  }), []);

  useEffect(() => {
    setFilingLanguageLegendSelected((prev) => {
      const validNames = new Set(filingLanguageChartData.map(item => item.name));
      const next = Object.entries(prev).reduce<Record<string, boolean>>((acc, [name, selected]) => {
        if (validNames.has(name)) acc[name] = selected;
        return acc;
      }, {});
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
  }, [filingLanguageChartData]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    setHeaderContent(
      <PageHeaderBreadcrumb
        items={[
          { label: 'Documents' },
          { label: 'Patents' },
          { label: 'Insight' },
        ]}
      />,
    );
    return () => setHeaderContent(null);
  }, [setHeaderContent]);

  useEffect(() => {
    window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({
      applicant,
      dateRange: dateRange ? [
        typeof dateRange[0]?.format === 'function' ? dateRange[0].format('YYYY-MM-DD') : null,
        typeof dateRange[1]?.format === 'function' ? dateRange[1].format('YYYY-MM-DD') : null,
      ] : null,
      topNApplicant,
      topNTarget,
    }));
  }, [applicant, dateRange, topNApplicant, topNTarget]);

  useEffect(() => {
    const nextLayouts = readPatentInsightLayouts(session.user.id);
    const nextSavedLayouts = normalizePatentInsightLayouts(nextLayouts);
    const nextDraftLayouts = normalizePatentInsightLayouts(nextLayouts);
    setSavedGridLayouts(nextSavedLayouts);
    setDraftGridLayouts(nextDraftLayouts);
    draftGridLayoutsRef.current = nextDraftLayouts;
    layoutEditSnapshotRef.current = null;
    activeGridInteractionItemRef.current = null;
    setIsLayoutEditing(false);
  }, [session.user.id]);

  useEffect(() => {
    if (canEditGridLayout || !isLayoutEditing) return;
    const restoredLayouts = normalizePatentInsightLayouts(
      layoutEditSnapshotRef.current ?? savedGridLayouts,
    );
    setDraftGridLayouts(restoredLayouts);
    draftGridLayoutsRef.current = restoredLayouts;
    layoutEditSnapshotRef.current = null;
    activeGridInteractionItemRef.current = null;
    setIsLayoutEditing(false);
  }, [canEditGridLayout, isLayoutEditing, savedGridLayouts]);

  const handleGridLayoutChange = React.useCallback((currentLayout: Layout) => {
    if (!isGridInteractionEnabled) return;
    const nextActiveLayout = activeGridInteractionItemRef.current
      ? currentLayout
      : resolveLayoutCollisionsDownward(currentLayout);
    draftGridLayoutsRef.current = normalizePatentInsightLayouts({
      ...draftGridLayoutsRef.current,
      [activeGridBreakpoint]: nextActiveLayout,
    });
  }, [activeGridBreakpoint, isGridInteractionEnabled]);

  const commitGridInteractionLayout = React.useCallback((currentLayout: Layout) => {
    const resolvedLayout = resolveLayoutCollisionsDownward(
      currentLayout,
      activeGridInteractionItemRef.current,
    );
    const nextLayouts = normalizePatentInsightLayouts({
      ...draftGridLayoutsRef.current,
      [activeGridBreakpoint]: resolvedLayout,
    });

    draftGridLayoutsRef.current = nextLayouts;
    setDraftGridLayouts(nextLayouts);
    activeGridInteractionItemRef.current = null;
  }, [activeGridBreakpoint]);

  const handleGridResizeStop = React.useCallback((currentLayout: Layout) => {
    commitGridInteractionLayout(currentLayout);
    window.dispatchEvent(new Event(CHART_RESIZE_EVENT));
  }, [commitGridInteractionLayout]);

  const handleGridInteractionStart = React.useCallback((
    _layout: Layout,
    _oldItem: Layout[number] | null,
    newItem: Layout[number] | null,
  ) => {
    activeGridInteractionItemRef.current = newItem?.i ?? null;
  }, []);

  const handleGridDragStop = React.useCallback((currentLayout: Layout) => {
    commitGridInteractionLayout(currentLayout);
  }, [commitGridInteractionLayout]);

  const handleStartLayoutEdit = () => {
    if (!canEditGridLayout) return;
    const snapshotLayouts = normalizePatentInsightLayouts(savedGridLayouts);
    const nextDraftLayouts = normalizePatentInsightLayouts(snapshotLayouts);
    layoutEditSnapshotRef.current = snapshotLayouts;
    activeGridInteractionItemRef.current = null;
    setDraftGridLayouts(nextDraftLayouts);
    draftGridLayoutsRef.current = nextDraftLayouts;
    setIsLayoutEditing(true);
  };

  const handleCancelLayoutEdit = () => {
    const storedLayouts = readPatentInsightLayouts(session.user.id);
    const restoredSavedLayouts = normalizePatentInsightLayouts(storedLayouts);
    const restoredDraftLayouts = normalizePatentInsightLayouts(storedLayouts);
    setSavedGridLayouts(restoredSavedLayouts);
    setDraftGridLayouts(restoredDraftLayouts);
    draftGridLayoutsRef.current = restoredDraftLayouts;
    layoutEditSnapshotRef.current = null;
    activeGridInteractionItemRef.current = null;
    setIsLayoutEditing(false);
    setGridRenderRevision((revision) => revision + 1);
  };

  const handleSaveLayout = () => {
    try {
      const nextLayouts = normalizePatentInsightLayouts(draftGridLayoutsRef.current);
      const nextDraftLayouts = normalizePatentInsightLayouts(nextLayouts);
      writePatentInsightLayouts(session.user.id, nextLayouts);
      setSavedGridLayouts(nextLayouts);
      setDraftGridLayouts(nextDraftLayouts);
      draftGridLayoutsRef.current = nextDraftLayouts;
      layoutEditSnapshotRef.current = null;
      activeGridInteractionItemRef.current = null;
      setIsLayoutEditing(false);
      message.success('차트 배치를 브라우저에 저장했습니다.');
    } catch {
      message.error('차트 배치를 저장하지 못했습니다.');
    }
  };

  const handleResetLayout = () => {
    modal.confirm({
      title: '기본 차트 배치로 초기화할까요?',
      content: '기본 배치를 편집 화면에 적용합니다. 저장을 눌러야 확정됩니다.',
      okText: '초기화',
      cancelText: '취소',
      onOk: () => {
        const nextLayouts = getDefaultPatentInsightLayouts();
        draftGridLayoutsRef.current = nextLayouts;
        setDraftGridLayouts(nextLayouts);
        message.info('기본 배치를 적용했습니다. 저장을 눌러 확정하세요.');
      },
    });
  };

  const loadStatistics = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const nextStatistics = await patentInsightApi.getAllStatistics({
        applicant: applicant.trim() || undefined,
        fromDate: dateRange?.[0]?.format?.('YYYY-MM-DD'),
        toDate: dateRange?.[1]?.format?.('YYYY-MM-DD'),
        topNApplicant,
        topNTarget,
      });
      setStatistics(nextStatistics);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Patent Insight statistics request failed.');
    } finally {
      setIsLoading(false);
    }
  }, [applicant, dateRange, topNApplicant, topNTarget]);

  useEffect(() => {
    if (hasLoadedInitialStatisticsRef.current) return;
    hasLoadedInitialStatisticsRef.current = true;
    void loadStatistics();
  }, [loadStatistics]);

  const handleRefreshStatistics = async () => {
    setIsRefreshing(true);
    try {
      await patentInsightApi.refreshStatistics();
      message.success('Patent statistics refreshed.');
      await loadStatistics();
    } catch (nextError) {
      message.error(nextError instanceof Error ? nextError.message : 'Failed to refresh patent statistics.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const applicantColumns: ColumnsType<PatentInsightApplicantItem> = [
    {
      title: 'Applicant',
      dataIndex: 'applicant',
      key: 'applicant',
      ellipsis: true,
      render: (value: string) => <Text style={{ fontSize: 12 }}>{value}</Text>,
    },
    {
      title: 'Count',
      dataIndex: 'count',
      key: 'count',
      width: 92,
      align: 'right',
      render: (value: number) => <Text style={{ fontSize: 12 }}>{formatInteger(value)}</Text>,
    },
  ];

  const lineOption = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: chartTooltipBg,
      borderColor: token.colorBorderSecondary,
      textStyle: createTextStyle(token.colorText),
      valueFormatter: (value: number) => formatInteger(Number(value)),
    },
    grid: { top: 24, left: 46, right: 18, bottom: 40 },
    xAxis: {
      type: 'category',
      data: statistics.countAcrossTime.map(item => item.year),
      axisLabel: { color: chartTextColor, fontSize: 10 },
      axisLine: { lineStyle: { color: chartAxisLineColor } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: chartTextColor, fontSize: 10, formatter: (value: number) => formatInteger(value) },
      splitLine: { lineStyle: { color: chartGridColor } },
    },
    series: [{
      name: 'Patent count',
      type: 'line',
      data: statistics.countAcrossTime.map(item => item.count),
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      lineStyle: { color: token.colorPrimary, width: 2 },
      itemStyle: { color: token.colorBgContainer, borderColor: token.colorPrimary, borderWidth: 2 },
      areaStyle: { color: token.colorPrimaryBg },
    }],
  }), [chartAxisLineColor, chartGridColor, chartTextColor, chartTooltipBg, statistics.countAcrossTime, token.colorBgContainer, token.colorBorderSecondary, token.colorPrimary, token.colorPrimaryBg, token.colorText]);

  const getBarOption = (
    data: { name: string; count: number }[],
    config: { labelWidth?: number; gridLeft?: number } = {},
  ) => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: chartTooltipBg,
      borderColor: token.colorBorderSecondary,
      textStyle: createTextStyle(token.colorText),
      valueFormatter: (value: number) => formatInteger(Number(value)),
    },
    grid: { top: 12, left: config.gridLeft ?? 88, right: 14, bottom: 24 },
    xAxis: {
      type: 'value',
      axisLabel: { color: chartTextColor, fontSize: 10, formatter: (value: number) => formatInteger(value) },
      splitLine: { lineStyle: { color: chartGridColor } },
    },
    yAxis: {
      type: 'category',
      data: data.map(item => item.name).reverse(),
      axisLabel: {
        color: chartTextColor,
        fontSize: 10,
        interval: 0,
        hideOverlap: false,
        width: config.labelWidth ?? 76,
        overflow: 'break',
        lineHeight: 12,
      },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [{
      type: 'bar',
      data: data.map(item => item.count).reverse(),
      barWidth: 12,
      itemStyle: { color: token.colorPrimary, borderRadius: [0, 4, 4, 0] },
    }],
  });

  const donutOption = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: chartTooltipBg,
      borderColor: token.colorBorderSecondary,
      textStyle: createTextStyle(token.colorText),
      formatter: (params: any) => `${params.name}<br/>${formatInteger(params.value)} (${params.percent}%)`,
    },
    legend: {
      orient: 'vertical',
      left: 0,
      top: 'middle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: chartTextColor, fontSize: 10 },
      selected: filingLanguageLegendSelected,
    },
    series: [{
      type: 'pie',
      radius: ['52%', '76%'],
      center: ['62%', '52%'],
      label: {
        show: true,
        position: 'center',
        formatter: () => `{value|${formatInteger(filingLanguageActiveTotal)}}\n{label|Total}`,
        rich: {
          value: {
            color: token.colorText,
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 18,
          },
          label: {
            color: token.colorTextSecondary,
            fontSize: 10,
            fontWeight: 600,
            lineHeight: 14,
          },
        },
      },
      labelLine: { show: false },
      emphasis: {
        label: {
          show: true,
          formatter: () => `{value|${formatInteger(filingLanguageActiveTotal)}}\n{label|Total}`,
        },
      },
      data: filingLanguageChartData.map(item => ({ name: item.name, value: item.count })),
      color: chartPrimaryPalette,
    }],
  }), [chartPrimaryPalette, chartTextColor, chartTooltipBg, filingLanguageActiveTotal, filingLanguageChartData, filingLanguageLegendSelected, token.colorBorderSecondary, token.colorText, token.colorTextSecondary]);

  const heatmapTargets = useMemo(() => {
    const targetTotals = statistics.patentCountByTargetAndApplicant.reduce<Record<string, number>>((acc, item) => {
      acc[item.target] = (acc[item.target] ?? 0) + item.count;
      return acc;
    }, {});
    return Object.entries(targetTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, Math.max(8, topNTarget))
      .map(([target]) => target)
      .reverse();
  }, [statistics.patentCountByTargetAndApplicant, topNTarget]);

  const heatmapYears = useMemo(() => {
    const startYear = getDateYear(dateRange?.[0]);
    const endYear = getDateYear(dateRange?.[1]);
    const years = statistics.patentCountByTargetAndApplicant
      .map(item => item.year)
      .filter(year => (!startYear || year >= startYear) && (!endYear || year <= endYear));

    if (endYear) years.push(endYear);

    return Array.from(new Set(years)).sort((a, b) => a - b);
  }, [dateRange, statistics.patentCountByTargetAndApplicant]);

  const heatmapUsesApplicantAxis = useMemo(() => (
    statistics.patentCountByTargetAndApplicant.some(item => Boolean(item.applicant?.trim()))
  ), [statistics.patentCountByTargetAndApplicant]);

  const heatmapApplicants = useMemo(() => {
    const applicantTotals = statistics.patentCountByTargetAndApplicant.reduce<Record<string, number>>((acc, item) => {
      const itemApplicant = item.applicant?.trim();
      if (!itemApplicant) return acc;
      acc[itemApplicant] = (acc[itemApplicant] ?? 0) + item.count;
      return acc;
    }, {});

    return Object.entries(applicantTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, Math.max(8, topNApplicant))
      .map(([itemApplicant]) => itemApplicant);
  }, [statistics.patentCountByTargetAndApplicant, topNApplicant]);

  const heatmapXAxisLabels = useMemo(() => (
    heatmapUsesApplicantAxis ? heatmapApplicants : heatmapYears.map(String)
  ), [heatmapApplicants, heatmapUsesApplicantAxis, heatmapYears]);

  const heatmapValues = useMemo(() => {
    const targetIndex = new Map(heatmapTargets.map((target, index) => [target, index]));
    const xAxisIndex = new Map(heatmapXAxisLabels.map((label, index) => [label, index]));
    const valueMap = new Map<string, [number, number, number, string]>();

    statistics.patentCountByTargetAndApplicant.forEach((item) => {
      const xAxisLabel = heatmapUsesApplicantAxis ? item.applicant?.trim() : String(item.year);
      if (!xAxisLabel || !targetIndex.has(item.target) || !xAxisIndex.has(xAxisLabel)) return;
      const xIndex = xAxisIndex.get(xAxisLabel) ?? 0;
      const yIndex = targetIndex.get(item.target) ?? 0;
      const key = `${xIndex}:${yIndex}`;
      const current = valueMap.get(key);
      if (current) {
        current[2] += item.count;
      } else {
        valueMap.set(key, [xIndex, yIndex, item.count, xAxisLabel]);
      }
    });

    return Array.from(valueMap.values());
  }, [heatmapTargets, heatmapUsesApplicantAxis, heatmapXAxisLabels, statistics.patentCountByTargetAndApplicant]);

  const maxHeatmapValue = useMemo(() => Math.max(1, ...heatmapValues.map(item => Number(item[2]))), [heatmapValues]);

  const handleHeatmapClick = React.useCallback((params: any) => {
    const value = Array.isArray(params?.value) ? params.value : [];
    const xAxisLabel = heatmapXAxisLabels[Number(value[0])];
    const target = heatmapTargets[Number(value[1])];
    const count = Number(value[2]);
    if (!xAxisLabel || !target || !Number.isFinite(count) || count <= 0) return;

    const searchParams = new URLSearchParams({
      source: 'insight',
      target,
    });

    if (heatmapUsesApplicantAxis) {
      searchParams.set('applicant', xAxisLabel);
      if (dateRange?.[0] && dateRange?.[1]) {
        searchParams.set('dateFrom', dateRange[0].format('YYYY-MM-DD'));
        searchParams.set('dateTo', dateRange[1].format('YYYY-MM-DD'));
      }
    } else {
      searchParams.set('dateFrom', `${xAxisLabel}-01-01`);
      searchParams.set('dateTo', `${xAxisLabel}-12-31`);
      const trimmedApplicant = applicant.trim();
      if (trimmedApplicant) {
        searchParams.set('applicant', trimmedApplicant);
      }
    }

    navigate(`/patents/analysis?${searchParams.toString()}`);
  }, [applicant, dateRange, heatmapTargets, heatmapUsesApplicantAxis, heatmapXAxisLabels, navigate]);

  const heatmapEvents = useMemo(() => ({
    click: handleHeatmapClick,
  }), [handleHeatmapClick]);

  const heatmapOption = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      position: 'top',
      backgroundColor: chartTooltipBg,
      borderColor: token.colorBorderSecondary,
      textStyle: createTextStyle(token.colorText),
      formatter: (params: any) => {
        const xAxisLabel = heatmapXAxisLabels[params.value[0]];
        const target = heatmapTargets[params.value[1]];
        return `<strong>${target}</strong><br/>${xAxisLabel}: ${formatInteger(params.value[2])}`;
      },
    },
    grid: { top: 26, left: 70, right: 82, bottom: 42 },
    xAxis: {
      type: 'category',
      data: heatmapXAxisLabels,
      splitArea: { show: true },
      axisLabel: {
        color: chartTextColor,
        fontSize: 10,
        hideOverlap: false,
        showMaxLabel: true,
        interval: (index: number) => {
          if (index === 0 || index === heatmapXAxisLabels.length - 1) return true;
          if (heatmapXAxisLabels.length <= 12) return true;
          return index % Math.ceil(heatmapXAxisLabels.length / 8) === 0;
        },
      },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: chartAxisLineColor } },
    },
    yAxis: {
      type: 'category',
      data: heatmapTargets,
      splitArea: { show: true },
      axisLabel: { color: chartTextColor, fontSize: 10 },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: chartAxisLineColor } },
    },
    visualMap: {
      min: 0,
      max: maxHeatmapValue,
      dimension: 2,
      calculable: true,
      orient: 'vertical',
      right: 6,
      top: 'middle',
      textStyle: { color: chartTextColor, fontSize: 10 },
      inRange: { color: heatmapPalette },
    },
    series: [{
      name: 'Patent count',
      type: 'heatmap',
      data: heatmapValues,
      encode: { x: 0, y: 1, value: 2 },
      cursor: 'pointer',
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.25)' } },
    }],
  }), [chartAxisLineColor, chartTextColor, chartTooltipBg, heatmapPalette, heatmapTargets, heatmapValues, heatmapXAxisLabels, maxHeatmapValue, token.colorBorderSecondary, token.colorText]);

  const chartTheme = isDarkMode ? 'dark' : undefined;

  return (
    <div
      className="patent-insight-page"
      style={{
        padding: `0 ${layoutPreset.sidePadding}px 24px`,
        maxWidth: layoutPreset.maxWidth,
        margin: '0 auto',
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <Card variant="borderless" className="c-card compact-filter-card" style={{ marginBottom: 12 }}>
        <Row gutter={[12, 8]} align="middle">
          <Col flex="auto" style={{ minWidth: 0 }}>
            <div className="patent-insight-search-controls">
              <RangePicker
                value={dateRange}
                onChange={(value) => setDateRange(value as [any, any] | null)}
                format="YYYY.MM.DD"
                allowClear
                className="v-search-input"
                style={{
                  flex: '1 1 260px',
                  minWidth: 240,
                  maxWidth: isStackedLayout ? '100%' : 320,
                }}
                presets={[
                  { label: 'Last 30 days', value: [dayjs().subtract(30, 'day'), dayjs()] },
                  { label: 'Last 12 months', value: [dayjs().subtract(12, 'month'), dayjs()] },
                  { label: 'Last 10 years', value: [dayjs().subtract(10, 'year'), dayjs()] },
                  { label: `1970-${dayjs().year()}`, value: [dayjs(DEFAULT_DATE_RANGE_START), dayjs()] },
                ]}
              />
              <Input
                allowClear
                prefix={<Search size={18} color={token.colorTextTertiary} />}
                value={applicant}
                onChange={(event) => setApplicant(event.target.value)}
                onPressEnter={() => {
                  if (!isLoading) void loadStatistics();
                }}
                placeholder="Applicant"
                className="v-search-input"
                style={{
                  flex: '1 1 240px',
                  minWidth: 180,
                  maxWidth: isStackedLayout ? '100%' : 320,
                }}
              />
              <Button
                icon={showAdvancedFilters ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                onClick={() => setShowAdvancedFilters(prev => !prev)}
                className="v-action-btn"
              >
                상세 필터 {showAdvancedFilters ? '닫기' : '열기'}
              </Button>
              <Button type="primary" icon={<Search size={18} />} disabled={isLoading} onClick={() => void loadStatistics()} className="v-action-btn">
                검색
              </Button>
              <Space size={8} wrap className="patent-insight-layout-actions">
                {isLayoutEditing ? (
                  <>
                    <Button
                      icon={<RotateCcw size={16} />}
                      onClick={handleResetLayout}
                      className="v-action-btn"
                    >
                      기본 배치
                    </Button>
                    <Button icon={<X size={16} />} onClick={handleCancelLayoutEdit} className="v-action-btn">
                      취소
                    </Button>
                    <Button type="primary" icon={<Check size={16} />} onClick={handleSaveLayout} className="v-action-btn">
                      저장
                    </Button>
                  </>
                ) : (
                  <Tooltip title={canEditGridLayout ? '카드를 이동하거나 크기를 조절합니다.' : '화면 너비가 768px 이상일 때 사용할 수 있습니다.'}>
                    <Button
                      icon={<Edit3 size={16} />}
                      disabled={!canEditGridLayout}
                      onClick={handleStartLayoutEdit}
                      className="v-action-btn"
                    >
                      레이아웃 편집
                    </Button>
                  </Tooltip>
                )}
              </Space>
            </div>
          </Col>
        </Row>
        {showAdvancedFilters && (
          <div className="compact-filter-panel">
            <Row gutter={[24, 12]} align="middle">
              <Col xs={24} sm={12} md={8} lg={6}>
                <Text strong>Applicants</Text><br />
                <InputNumber
                  className="patent-insight-filter-number-input"
                  min={5}
                  max={50}
                  step={5}
                  value={topNApplicant}
                  onChange={(value) => setTopNApplicant(Number(value) || 10)}
                  style={{ marginTop: 6, width: 96 }}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={6}>
                <Text strong>Targets</Text><br />
                <InputNumber
                  className="patent-insight-filter-number-input"
                  min={8}
                  max={50}
                  step={2}
                  value={topNTarget}
                  onChange={(value) => setTopNTarget(Number(value) || DEFAULT_TOP_N_TARGET)}
                  style={{ marginTop: 6, width: 96 }}
                />
              </Col>
              <Col xs={24} md={8} lg={12}>
                <Text strong>Actions</Text><br />
                <Space wrap size={8} style={{ marginTop: 6 }}>
                  <Tooltip title="Daily statistics refresh">
                    <Button icon={<RefreshCw size={18} />} onClick={handleRefreshStatistics} className="v-action-btn">
                      Statistics Refresh
                    </Button>
                  </Tooltip>
                </Space>
              </Col>
            </Row>
          </div>
        )}
      </Card>

      <div className="patent-insight-results-region">
        <Spin spinning={isLoading || isRefreshing} size="large">
          {error ? (
            <Alert
              type="error"
              showIcon
              message="Patent Insight API request failed."
              description={error}
              style={{ marginBottom: 12 }}
            />
          ) : null}

          <div ref={handleGridContainerRef} className="patent-insight-grid-container">
            {isGridMeasured ? (
              <GridLayout
                key={`patent-insight-grid-${gridRenderRevision}`}
                className={`patent-insight-grid${isLayoutEditing ? ' is-editing' : ''}`}
                style={gridStyle}
                width={gridWidth}
                layout={activeGridLayout}
                gridConfig={gridConfig}
                compactor={deferredCollisionCompactor}
                dragConfig={gridDragConfig}
                resizeConfig={gridResizeConfig}
                onLayoutChange={handleGridLayoutChange}
                onDragStart={handleGridInteractionStart}
                onDragStop={handleGridDragStop}
                onResizeStart={handleGridInteractionStart}
                onResizeStop={handleGridResizeStop}
              >
                <div key="totalPatent" className="patent-insight-grid-item patent-insight-metric-grid-item">
                  <MetricCard
                    label="Total Patent"
                    value={statistics.totalCount}
                    isLayoutEditing={isLayoutEditing}
                  />
                </div>
                <div key="filteredPatent" className="patent-insight-grid-item patent-insight-metric-grid-item">
                  <MetricCard
                    label="Filtered Patent"
                    value={statistics.filteredCount}
                    caption={applicant.trim() || dateRange ? 'Current filter result' : undefined}
                    isLayoutEditing={isLayoutEditing}
                  />
                </div>
                <div key="patentAcrossTime" className="patent-insight-grid-item">
                  <ChartPanel title="These Patent across time" isLayoutEditing={isLayoutEditing}>
                    {statistics.countAcrossTime.length > 0 ? (
                      <SafeReactECharts option={lineOption} theme={chartTheme} style={{ width: '100%', height: '100%' }} />
                    ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}
                  </ChartPanel>
                </div>
                <div key="patentPerOffice" className="patent-insight-grid-item">
                  <ChartPanel title="Patent per Patent Office" isLayoutEditing={isLayoutEditing}>
                    <SafeReactECharts option={getBarOption(statistics.patentPerOffice.slice(0, 7))} theme={chartTheme} style={{ width: '100%', height: '100%' }} />
                  </ChartPanel>
                </div>
                <div key="companyCount" className="patent-insight-grid-item">
                  <ChartPanel title="Company count" isLayoutEditing={isLayoutEditing}>
                    <Table<PatentInsightApplicantItem>
                      className="patent-insight-company-table"
                      rowKey="applicant"
                      size="small"
                      pagination={false}
                      columns={applicantColumns}
                      dataSource={statistics.patentCountByApplicant.slice(0, topNApplicant)}
                      scroll={{ y: 190 }}
                    />
                  </ChartPanel>
                </div>
                <div key="filingLanguageCount" className="patent-insight-grid-item">
                  <ChartPanel title="Filing language count" isLayoutEditing={isLayoutEditing}>
                    <SafeReactECharts
                      option={donutOption}
                      theme={chartTheme}
                      style={{ width: '100%', height: '100%' }}
                      onEvents={filingLanguageChartEvents}
                    />
                  </ChartPanel>
                </div>
                <div key="patentPerType" className="patent-insight-grid-item">
                  <ChartPanel title="Patent per Patent Type" isLayoutEditing={isLayoutEditing}>
                    <SafeReactECharts option={getBarOption(statistics.patentTypeCounts.slice(0, 7), { gridLeft: 128, labelWidth: 116 })} theme={chartTheme} style={{ width: '100%', height: '100%' }} />
                  </ChartPanel>
                </div>
                <div key="targetApplicantHeatmap" className="patent-insight-grid-item">
                  <ChartPanel title="Target x Applicant heatmap" isLayoutEditing={isLayoutEditing}>
                    <SafeReactECharts
                      option={heatmapOption}
                      theme={chartTheme}
                      style={{ width: '100%', height: '100%' }}
                      onEvents={heatmapEvents}
                    />
                  </ChartPanel>
                </div>
              </GridLayout>
            ) : (
              <div className="patent-insight-grid-loading"><Spin /></div>
            )}
          </div>

          {isLayoutEditing ? (
            <div className="patent-insight-footnote">
              <BarChart3 size={14} />
              <Text type="secondary">
                카드 제목을 드래그해 이동하고 우측 하단 핸들로 크기를 조절한 뒤 저장하세요.
              </Text>
            </div>
          ) : null}
        </Spin>
      </div>
    </div>
  );
};

export default PatentInsight;
