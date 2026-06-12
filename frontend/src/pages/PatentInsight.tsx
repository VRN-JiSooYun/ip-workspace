import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { Alert, App, Button, Card, Col, DatePicker, Empty, Input, InputNumber, Row, Space, Spin, Table, Tooltip, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { BarChart3, ChevronDown, ChevronUp, Database, RefreshCw, RotateCcw, Search } from 'lucide-react';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import { getPatentAnalysisLayoutPreset } from '../config/patentAnalysisLayout';
import { useTheme } from '../contexts/ThemeContext';
import { mockPatentInsightStatistics, PatentInsightApplicantItem, PatentInsightCountItem, PatentInsightStatistics } from '../mocks/patentInsight';
import { patentInsightApi } from '../services/patentInsightApi';
import { useUIStore } from '../store/useUIStore';

const { RangePicker } = DatePicker;
const { Text } = Typography;

const SPLIT_STORAGE_KEY = 'patent-insight-split-ratio';
const FILTER_STORAGE_KEY = 'patent-insight-filters';
const SPLIT_DEFAULT_PERCENT = 60;
const SPLIT_MIN_PERCENT = 46;
const SPLIT_MAX_PERCENT = 72;
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

const readStoredSplitRatio = () => {
  if (typeof window === 'undefined') return SPLIT_DEFAULT_PERCENT;
  const value = Number(window.localStorage.getItem(SPLIT_STORAGE_KEY));
  return Number.isFinite(value)
    ? Math.min(SPLIT_MAX_PERCENT, Math.max(SPLIT_MIN_PERCENT, value))
    : SPLIT_DEFAULT_PERCENT;
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
    if (!container || typeof ResizeObserver === 'undefined') return;

    const resizeChart = () => {
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
      }
      resizeFrameRef.current = window.requestAnimationFrame(() => {
        resizeFrameRef.current = null;
        const chart = chartRef.current?.getEchartsInstance?.();
        if (chart && !chart.isDisposed?.()) {
          chart.resize();
        }
      });
    };

    const resizeObserver = new ResizeObserver(resizeChart);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
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
}> = ({ title, extra, children, className }) => {
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
        },
      }}
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        boxShadow: 'none',
      }}
    >
      <div className="patent-insight-card-header">
        <Text strong>{title}</Text>
        {extra}
      </div>
      <div className="patent-insight-chart-body">
        {children}
      </div>
    </Card>
  );
};

const MetricCard: React.FC<{ label: string; value: number; caption?: string }> = ({ label, value, caption }) => {
  const { token } = theme.useToken();

  return (
    <Card
      className="patent-insight-metric-card"
      style={{ border: `1px solid ${token.colorBorderSecondary}`, boxShadow: 'none' }}
      styles={{ body: { padding: 16 } }}
    >
      <Text type="secondary" style={{ fontSize: 11, fontWeight: 700 }}>{label}</Text>
      <div style={{ marginTop: 12, fontSize: 30, lineHeight: 1, fontWeight: 760, color: token.colorPrimary }}>
        {formatInteger(value)}
      </div>
      {caption ? <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 11 }}>{caption}</Text> : null}
    </Card>
  );
};

const PatentInsight: React.FC = () => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const { setHeaderContent } = useUIStore();
  const storedFilters = useMemo(readStoredFilters, []);
  const hasLoadedInitialStatisticsRef = useRef(false);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const splitRafRef = useRef<number | null>(null);

  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === 'undefined' ? 1920 : window.innerWidth));
  const [statistics, setStatistics] = useState<PatentInsightStatistics>(EMPTY_PATENT_INSIGHT_STATISTICS);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isViewingMockData, setIsViewingMockData] = useState(false);
  const [applicant, setApplicant] = useState(storedFilters.applicant ?? '');
  const [dateRange, setDateRange] = useState<[any, any] | null>(() => {
    if (!storedFilters.dateRange?.[0] || !storedFilters.dateRange?.[1]) return [dayjs(DEFAULT_DATE_RANGE_START), dayjs()];
    return [dayjs(storedFilters.dateRange[0]), dayjs(storedFilters.dateRange[1])];
  });
  const [topNApplicant, setTopNApplicant] = useState(storedFilters.topNApplicant ?? 10);
  const [topNTarget, setTopNTarget] = useState(storedFilters.topNTarget ?? DEFAULT_TOP_N_TARGET);
  const [splitRatio, setSplitRatio] = useState(readStoredSplitRatio);
  const [isResizingSplit, setIsResizingSplit] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const layoutPreset = useMemo(() => getPatentAnalysisLayoutPreset(viewportWidth), [viewportWidth]);
  const isStackedLayout = viewportWidth < 1200;

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
    window.localStorage.setItem(SPLIT_STORAGE_KEY, String(splitRatio));
  }, [splitRatio]);

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

  const clampSplitRatio = React.useCallback((value: number) =>
    Math.min(SPLIT_MAX_PERCENT, Math.max(SPLIT_MIN_PERCENT, value)), []);

  const updateSplitRatioFromClientX = React.useCallback((clientX: number) => {
    const container = splitContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return;
    setSplitRatio(clampSplitRatio(((clientX - rect.left) / rect.width) * 100));
  }, [clampSplitRatio]);

  const stopSplitResize = React.useCallback(() => {
    setIsResizingSplit(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    if (!isResizingSplit) return;

    const onMouseMove = (event: MouseEvent) => {
      if (splitRafRef.current) {
        window.cancelAnimationFrame(splitRafRef.current);
      }
      splitRafRef.current = window.requestAnimationFrame(() => {
        updateSplitRatioFromClientX(event.clientX);
      });
    };
    const onMouseUp = () => stopSplitResize();

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

  const handleSplitMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsResizingSplit(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleSplitKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = 2;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setSplitRatio(prev => clampSplitRatio(prev - step));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setSplitRatio(prev => clampSplitRatio(prev + step));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setSplitRatio(SPLIT_MIN_PERCENT);
    } else if (event.key === 'End') {
      event.preventDefault();
      setSplitRatio(SPLIT_MAX_PERCENT);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSplitRatio(SPLIT_DEFAULT_PERCENT);
    }
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
      setIsViewingMockData(false);
    } catch (nextError) {
      setIsViewingMockData(false);
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

  const handleShowMockData = () => {
    setStatistics(mockPatentInsightStatistics);
    setError(null);
    setIsViewingMockData(true);
    message.info('Mock statistics are displayed.');
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
    },
    series: [{
      type: 'pie',
      radius: ['52%', '76%'],
      center: ['62%', '52%'],
      label: {
        show: true,
        position: 'center',
        formatter: () => `{value|${formatInteger(filingLanguageChartData.reduce((total, item) => total + item.count, 0))}}\n{label|Total}`,
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
          formatter: () => `{value|${formatInteger(filingLanguageChartData.reduce((total, item) => total + item.count, 0))}}\n{label|Total}`,
        },
      },
      data: filingLanguageChartData.map(item => ({ name: item.name, value: item.count })),
      color: chartPrimaryPalette,
    }],
  }), [chartPrimaryPalette, chartTextColor, chartTooltipBg, filingLanguageChartData, token.colorBorderSecondary, token.colorText, token.colorTextSecondary]);

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
  const leftWidth = isStackedLayout ? '100%' : `calc(${splitRatio}% - 6px)`;
  const rightWidth = isStackedLayout ? '100%' : `calc(${100 - splitRatio}% - 6px)`;

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
                  <Button icon={<Database size={18} />} onClick={handleShowMockData} className="v-action-btn">
                    Mock Data
                  </Button>
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
          {error || isViewingMockData ? (
            <Alert
              type={isViewingMockData ? 'info' : 'error'}
              showIcon
              message={isViewingMockData ? 'Mock statistics를 표시 중입니다.' : 'Patent Insight API request failed.'}
              description={isViewingMockData ? '검색을 누르면 현재 필터 조건으로 API 통계 조회를 다시 시도합니다.' : error}
              style={{ marginBottom: 12 }}
            />
          ) : null}

          <div className="patent-insight-metric-grid">
            <MetricCard label="Total Patent" value={statistics.totalCount} />
            <MetricCard label="Filtered Patent" value={statistics.filteredCount} caption={applicant.trim() || dateRange ? 'Current filter result' : undefined} />
          </div>

          <div
            ref={splitContainerRef}
            className={`patent-insight-split${isStackedLayout ? ' patent-insight-split-stacked' : ''}`}
          >
            <div className="patent-insight-left" style={{ width: leftWidth }}>
              <ChartPanel title="These Patent across time" className="patent-insight-line-panel">
                {statistics.countAcrossTime.length > 0 ? (
                  <SafeReactECharts option={lineOption} theme={chartTheme} style={{ width: '100%', height: '100%' }} />
                ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}
              </ChartPanel>

              <div className="patent-insight-small-grid">
                <ChartPanel title="Patent per Patent Office">
                  <SafeReactECharts option={getBarOption(statistics.patentPerOffice.slice(0, 7))} theme={chartTheme} style={{ width: '100%', height: '100%' }} />
                </ChartPanel>
                <ChartPanel title="Company count">
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
                <ChartPanel title="Filing language count">
                  <SafeReactECharts option={donutOption} theme={chartTheme} style={{ width: '100%', height: '100%' }} />
                </ChartPanel>
                <ChartPanel title="Patent per Patent Type">
                  <SafeReactECharts option={getBarOption(statistics.patentTypeCounts.slice(0, 7), { gridLeft: 128, labelWidth: 116 })} theme={chartTheme} style={{ width: '100%', height: '100%' }} />
                </ChartPanel>
              </div>
            </div>

            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Patent Insight chart area width"
              aria-valuemin={SPLIT_MIN_PERCENT}
              aria-valuemax={SPLIT_MAX_PERCENT}
              aria-valuenow={Math.round(splitRatio)}
              tabIndex={0}
              onMouseDown={handleSplitMouseDown}
              onDoubleClick={() => setSplitRatio(SPLIT_DEFAULT_PERCENT)}
              onKeyDown={handleSplitKeyDown}
              className="patent-insight-resizer"
              style={{ display: isStackedLayout ? 'none' : 'flex' }}
            >
              <div />
            </div>

            <div className="patent-insight-right" style={{ width: rightWidth }}>
              <ChartPanel
                title="Target x Applicant heatmap"
                extra={(
                  <Button
                    type="text"
                    size="small"
                    icon={<RotateCcw size={14} />}
                    onClick={() => setSplitRatio(SPLIT_DEFAULT_PERCENT)}
                  />
                )}
                className="patent-insight-heatmap-panel"
              >
                <SafeReactECharts
                  option={heatmapOption}
                  theme={chartTheme}
                  style={{ width: '100%', height: '100%' }}
                  onEvents={heatmapEvents}
                />
              </ChartPanel>
            </div>
          </div>

          <div className="patent-insight-footnote">
            <BarChart3 size={14} />
            <Text type="secondary">차트 split은 마우스 드래그 또는 키보드 방향키로 조정할 수 있습니다.</Text>
          </div>
        </Spin>
      </div>
    </div>
  );
};

export default PatentInsight;
