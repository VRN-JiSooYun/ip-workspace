import React, { useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Button, 
  Space, 
  Tag, 
  Card, 
  Modal,
  Tooltip,
  Typography, 
  Tabs, 
  Row, 
  Col, 
  theme,
  Empty,
  Table,
  Badge,
  message
} from 'antd';
import { 
  Plus, 
  ChevronLeft,
  Search,
  Dna,
  Beaker,
  BarChart3,
  FileText,
  Activity,
  Database,
  LayoutGrid,
  Pin,
  Table as TableIcon,
  Layers,
  FileSpreadsheet
} from 'lucide-react';
import { mockPatents, mockResidues } from '../mocks/patents';
import { mockHighlights } from '../mocks/patentHighlights';
import { patentDetailData } from '../mocks/patentDetail_WO2026090333A1';
import patentResultRaw from '../mocks/WO2026090333A1_PATENT_DATA.json';
import { getPatentAnalysisLayoutPreset } from '../config/patentAnalysisLayout';
import { useUIStore } from '../store/useUIStore';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import DataCardItem from '../components/patent-analysis/DataCardItem';
import PatentPdfToolbar from '../components/patent-analysis/pdf/PatentPdfToolbar';
import PatentPdfViewer from '../components/patent-analysis/pdf/PatentPdfViewer';
import { usePatentPdfViewer } from '../hooks/usePatentPdfViewer';

const { Title, Text, Paragraph } = Typography;

const ENABLE_HIGHLIGHT_DEBUG_LOG = true;
const SPLIT_MIN_PERCENT = 30;
const SPLIT_MAX_PERCENT = 70;
const SPLIT_DEFAULT_PERCENT = 50;

// SVG 렌더링 컴포넌트
const SvgRenderer: React.FC<{ svg: string; height?: number | string }> = ({ svg, height = '100%' }) => (
  <div 
    style={{ height, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
    dangerouslySetInnerHTML={{ __html: svg }}
  />
);

const PatentAnalysisDetail: React.FC = () => {
  const { token } = theme.useToken();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const patentResult = (patentResultRaw as any)?.result ?? {};
  const frequencyAnalysis = patentResult.frequency_analysis_result_json
    ?? patentResult.data?.[0]?.frequency_analysis_result_json
    ?? { r_groups: {} };
  
  const selectedPatent = useMemo(() => {
    if (!id) return null;
    return mockPatents.find(p => p.id === id) || null;
  }, [id]);

  const { setHeaderContent } = useUIStore();

  const currentHighlights = useMemo(() => {
    if (!selectedPatent) return [];
    return mockHighlights[selectedPatent.id] || [];
  }, [selectedPatent]);
  const pdfViewer = usePatentPdfViewer({
    patentNumber: selectedPatent?.patentNumber,
    currentHighlights,
  });

  const clampSplitRatio = React.useCallback((value: number) => {
    return Math.min(Math.max(value, SPLIT_MIN_PERCENT), SPLIT_MAX_PERCENT);
  }, []);

  const debugLog = React.useCallback((event: string, payload: Record<string, unknown>) => {
    if (!ENABLE_HIGHLIGHT_DEBUG_LOG) return;
    console.log('[PDFHighlightDebug]', event, payload);
  }, []);

  const [pageIndices, setPageIndices] = React.useState<Record<string, number>>({});
  const [activeCompId, setActiveCompId] = React.useState<string | null>(null);
  const [rawDataView, setRawDataView] = React.useState<'table' | 'card'>('table');
  const [previewSvg, setPreviewSvg] = React.useState<string | null>(null);
  const [previewImageSrc, setPreviewImageSrc] = React.useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = React.useState<string>('이미지 미리보기');
  const [splitRatio, setSplitRatio] = React.useState<number>(SPLIT_DEFAULT_PERCENT);
  const [isResizingSplit, setIsResizingSplit] = React.useState(false);
  const [viewportWidth, setViewportWidth] = React.useState<number>(() => {
    if (typeof window === 'undefined') return 1920;
    return window.innerWidth;
  });
  const [viewportHeight, setViewportHeight] = React.useState<number>(() => {
    if (typeof window === 'undefined') return 1080;
    return window.innerHeight;
  });
  const splitContainerRef = React.useRef<HTMLDivElement | null>(null);
  const splitRafRef = React.useRef<number | null>(null);
  const splitStorageKey = React.useMemo(() => `patent-analysis-split:${id ?? 'default'}`, [id]);
  const layoutPreset = React.useMemo(() => getPatentAnalysisLayoutPreset(viewportWidth), [viewportWidth]);
  const rawDataTableScrollY = React.useMemo(() => {
    return Math.max(300, viewportHeight - 470);
  }, [viewportHeight]);
  const rawDataTablePageSize = React.useMemo(() => {
    const estimatedRowHeight = 72;
    const calculated = Math.floor(rawDataTableScrollY / estimatedRowHeight);
    return Math.min(40, Math.max(10, calculated));
  }, [rawDataTableScrollY]);

  useEffect(() => {
    const onResize = () => {
      setViewportWidth(window.innerWidth);
      setViewportHeight(window.innerHeight);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const raw = window.localStorage.getItem(splitStorageKey);
    if (!raw) {
      setSplitRatio(clampSplitRatio(layoutPreset.defaultSplit));
      return;
    }
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      setSplitRatio(clampSplitRatio(parsed));
    }
  }, [splitStorageKey, clampSplitRatio, layoutPreset.defaultSplit]);

  useEffect(() => {
    window.localStorage.setItem(splitStorageKey, String(splitRatio));
  }, [splitRatio, splitStorageKey]);

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
      setSplitRatio(SPLIT_MIN_PERCENT);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setSplitRatio(SPLIT_MAX_PERCENT);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSplitRatio(clampSplitRatio(layoutPreset.defaultSplit));
    }
  }, [clampSplitRatio, layoutPreset.defaultSplit]);

  const resetSplitRatio = React.useCallback(() => {
    setSplitRatio(clampSplitRatio(layoutPreset.defaultSplit));
  }, [clampSplitRatio, layoutPreset.defaultSplit]);

  useEffect(() => {
    if (selectedPatent) {
      setHeaderContent(
        <PageHeaderBreadcrumb 
          items={[
            { label: 'Documents' },
            { label: 'Patents' },
            { label: 'My 특허 분석', onClick: () => navigate('/patents/analysis') },
            { label: selectedPatent.patentNumber }
          ]}
        />
      );
    }
    return () => setHeaderContent(null);
  }, [selectedPatent, setHeaderContent, navigate]);

  if (!selectedPatent) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Empty description="해당 특허를 찾을 수 없습니다." />
        <Button onClick={() => navigate('/patents/analysis')} style={{ marginTop: 16 }}>목록으로 돌아가기</Button>
      </div>
    );
  }

  const handleGoToPdf = (targetPage: number, bboxCoords?: any[]) => {
    pdfViewer.handleGoToPdf(targetPage, bboxCoords);
  };

  const handlePageChange = (compId: string, direction: number, pages: any, bboxes?: any[]) => {
    setActiveCompId(compId);
    const pageArray = Array.isArray(pages) ? pages : [pages];
    const bboxArray = Array.isArray(bboxes) ? bboxes : [];
    
    if (pageArray.length === 0) return;
    
    const currentIndex = pageIndices[compId] ?? 0;
    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) nextIndex = pageArray.length - 1;
    if (nextIndex >= pageArray.length) nextIndex = 0;
    
    setPageIndices(prev => ({ ...prev, [compId]: nextIndex }));
    handleGoToPdf(pageArray[nextIndex], bboxArray[nextIndex]);
  };

  const handleCompoundCardClick = (comp: any, rank: number) => {
    const compId = comp.id.toString();
    const pageArray = Array.isArray(comp.page) ? comp.page : [comp.page];
    const bboxArray = Array.isArray((comp as any).bbox) ? (comp as any).bbox : [];
    if (pageArray.length === 0) return;

    const currentIndex = pageIndices[compId] ?? 0;
    debugLog('compound-card-click', {
      rank,
      compId,
      currentIndex,
      targetPage: pageArray[currentIndex],
      targetBBox: bboxArray[currentIndex],
      allPages: pageArray,
    });
    setActiveCompId(compId);
    handleGoToPdf(pageArray[currentIndex], bboxArray[currentIndex]);
  };

  const normalizeTablePageNumber = (rawPage: any): number => {
    if (Array.isArray(rawPage)) {
      return normalizeTablePageNumber(rawPage[0]);
    }
    const page = Number(rawPage);
    return Number.isFinite(page) ? page : 0;
  };

  const normalizeTableBbox = (rawBbox: any): number[] | undefined => {
    if (typeof rawBbox === 'string') {
      const trimmed = rawBbox.trim();

      // "[265, 871, 1387, 1863]" 형태
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsedJson = JSON.parse(trimmed);
          if (Array.isArray(parsedJson) && parsedJson.length === 4) {
            const parsedNums = parsedJson.map(Number);
            if (parsedNums.every(v => Number.isFinite(v))) return parsedNums;
          }
        } catch {
          // JSON 파싱 실패 시 regex fallback 사용
        }
      }

      // 숫자 추출 fallback (공백/쉼표/문자 혼합 대응)
      const matched = trimmed.match(/-?\d+(?:\.\d+)?/g);
      if (matched && matched.length >= 4) {
        const parsedNums = matched.slice(0, 4).map(Number);
        if (parsedNums.every(v => Number.isFinite(v))) return parsedNums;
      }

      return undefined;
    }

    if (Array.isArray(rawBbox)) {
      if (rawBbox.length === 4) {
        const parsed = rawBbox.map(Number);
        if (parsed.every(v => Number.isFinite(v))) {
          return parsed;
        }
      }
      if (rawBbox.length > 0) {
        return normalizeTableBbox(rawBbox[0]);
      }
      return undefined;
    }

    if (rawBbox && typeof rawBbox === 'object') {
      const { x1, y1, x2, y2 } = rawBbox as Record<string, unknown>;
      const parsed = [Number(x1), Number(y1), Number(x2), Number(y2)];
      if (parsed.every(v => Number.isFinite(v))) {
        return parsed;
      }
    }

    return undefined;
  };

  const handleTableCardClick = (tableItem: any, index: number) => {
    const cardKey = `table-${tableItem?.table_num ?? index}-${index}`;
    const pageArray = Array.isArray(tableItem?.page) ? tableItem.page : [];
    const bboxArray = Array.isArray(tableItem?.bbox) ? tableItem.bbox : [];
    if (pageArray.length === 0) return;

    const currentIndex = pageIndices[cardKey] ?? 0;
    const targetPage = normalizeTablePageNumber(pageArray[currentIndex]);
    const targetBbox = normalizeTableBbox(bboxArray[currentIndex]);

    debugLog('table-card-click', {
      cardKey,
      targetPage,
      rawBbox: bboxArray[currentIndex],
      normalizedBbox: targetBbox,
    });

    setActiveCompId(cardKey);
    if (targetPage) {
      handleGoToPdf(targetPage, targetBbox as any);
    }
  };

  const handleTablePageChange = (tableItem: any, index: number, direction: number) => {
    const cardKey = `table-${tableItem?.table_num ?? index}-${index}`;
    const pageArray = Array.isArray(tableItem?.page) ? tableItem.page : [];
    const bboxArray = Array.isArray(tableItem?.bbox) ? tableItem.bbox : [];
    if (pageArray.length === 0) return;

    const currentIndex = pageIndices[cardKey] ?? 0;
    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) nextIndex = pageArray.length - 1;
    if (nextIndex >= pageArray.length) nextIndex = 0;

    setPageIndices(prev => ({ ...prev, [cardKey]: nextIndex }));
    setActiveCompId(cardKey);
    const targetPage = normalizeTablePageNumber(pageArray[nextIndex]);
    const targetBbox = normalizeTableBbox(bboxArray[nextIndex]);

    debugLog('table-page-change', {
      cardKey,
      nextIndex,
      targetPage,
      rawBbox: bboxArray[nextIndex],
      normalizedBbox: targetBbox,
    });

    if (targetPage) {
      handleGoToPdf(targetPage, targetBbox as any);
    }
  };

  const openSvgPreview = (svg: string, title: string) => {
    setPreviewImageSrc(null);
    setPreviewSvg(svg);
    setPreviewTitle(title);
  };

  const openImagePreview = (src: string, title: string) => {
    setPreviewSvg(null);
    setPreviewImageSrc(src);
    setPreviewTitle(title);
  };

  const resultTables = React.useMemo(() => {
    const root: any = patentResultRaw as any;
    const tables = root?.result?.tables;
    return Array.isArray(tables) ? tables : [];
  }, []);

  const fitPageToScreen = React.useCallback(() => {
    if (splitRatio <= SPLIT_MIN_PERCENT) {
      // 현재 최소(30%) 상태이면 기본값(50%)으로 확대
      debugLog('fit-to-page-expand', { currentRatio: splitRatio, targetRatio: SPLIT_DEFAULT_PERCENT });
      setSplitRatio(SPLIT_DEFAULT_PERCENT);
    } else {
      // 그 외 상태이면 30%로 축소 (우측 분석 영역 최대화)
      debugLog('fit-to-page-shrink', { currentRatio: splitRatio, targetRatio: SPLIT_MIN_PERCENT });
      setSplitRatio(SPLIT_MIN_PERCENT);
    }
  }, [splitRatio, debugLog]);

  return (
    <div style={{ maxWidth: layoutPreset.maxWidth, margin: '0 auto', padding: `0 ${layoutPreset.sidePadding}px`, flex: 1, width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'fadeIn 0.3s ease-out', paddingBottom: 8 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '0 4px', flexShrink: 0 }}>
          <Space size={16}>
            <Button 
              icon={<ChevronLeft size={20} />} 
              onClick={() => navigate('/patents/analysis')}
              style={{ borderRadius: '10px' }}
            />
            <div>
              <Title level={4} style={{ margin: 0, lineHeight: '1.2' }}>{selectedPatent.title}</Title>
              <Text type="secondary" style={{ fontSize: '13px' }}>{selectedPatent.patentNumber} | {selectedPatent.applicant} | {selectedPatent.publicationDate}</Text>
            </div>
          </Space>
          <Button type="primary" icon={<Plus size={18} />} style={{ borderRadius: '10px', height: 40 }}>
            분석 리포트 생성
          </Button>
        </div>

        <div ref={splitContainerRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex' }}>
          {/* 좌측: PDF 뷰어 영역 */}
          <div
            style={{
              width: `calc(${splitRatio}% - 6px)`,
              minWidth: 0,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
            >
            <PatentPdfToolbar
              splitRatio={splitRatio}
              minSplitPercent={SPLIT_MIN_PERCENT}
              borderColor={token.colorBorderSecondary}
              backgroundColor={token.colorBgContainer}
              textColor={token.colorText}
              searchQuery={pdfViewer.searchQuery}
              searchMatchCount={pdfViewer.matchCount.total}
              activeMatchIndex={pdfViewer.matchCount.current}
              searchExecuted={pdfViewer.matchCount.total > 0}
              currentPage={pdfViewer.pdfCurrentPage}
              totalPages={pdfViewer.pdfTotalPages}
              onToggleFit={fitPageToScreen}
              onSearchQueryChange={pdfViewer.searchPdf}
              onRunSearch={() => {}}
              onClearSearch={() => pdfViewer.searchPdf('')}
              onMoveSearchMatch={(dir) => dir > 0 ? pdfViewer.findNext() : pdfViewer.findPrevious()}
              onRotateLeft={() => pdfViewer.setPdfRotation(r => (r - 90 + 360) % 360)}
              onRotateRight={() => pdfViewer.setPdfRotation(r => (r + 90) % 360)}
              onGoToPage={(page) => handleGoToPdf(page)}
            />

            <PatentPdfViewer
              document="/WO2026090333A1.pdf"
              rotation={pdfViewer.pdfRotation}
              viewerContainerRef={pdfViewer.pdfViewerContainerRef}
              pdfTotalPages={pdfViewer.pdfTotalPages}
              activeBBox={pdfViewer.activeBBox}
              dynamicHighlights={pdfViewer.dynamicHighlights}
              userHighlights={pdfViewer.userHighlights}
              onPdfDocumentReady={pdfViewer.setPdfDocument}
              onPdfTotalPagesChange={pdfViewer.setPdfTotalPages}
              setHighlighterUtils={pdfViewer.setHighlighterUtils}
              backgroundColor={token.colorBgContainer}
              borderColor={token.colorBorderSecondary}
              onAddHighlight={pdfViewer.addHighlight}
              onDeleteHighlight={pdfViewer.deleteHighlight}
              onScrollToHighlight={pdfViewer.scrollToHighlight}
            />
          </div>

          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="PDF 영역 너비 조절"
            aria-valuemin={SPLIT_MIN_PERCENT}
            aria-valuemax={SPLIT_MAX_PERCENT}
            aria-valuenow={Math.round(splitRatio)}
            tabIndex={0}
            onMouseDown={handleSplitMouseDown}
            onDoubleClick={resetSplitRatio}
            onKeyDown={handleSplitKeyDown}
            style={{
              width: 12,
              flexShrink: 0,
              cursor: 'col-resize',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              outline: 'none'
            }}
          >
            <div
              style={{
                width: 4,
                height: 64,
                borderRadius: 999,
                background: isResizingSplit ? token.colorPrimary : token.colorBorder,
                transition: 'background-color 0.2s ease'
              }}
            />
          </div>

          {/* 우측: 데이터 분석 영역 */}
          <div
            style={{
              width: `calc(${100 - splitRatio}% - 6px)`,
              minWidth: 0,
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Card style={{ flex: 1, borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} styles={{ body: { padding: 0, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' } }}>
              <Tabs
                defaultActiveKey="summary"
                style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                tabBarStyle={{ padding: '0 24px', margin: 0, height: 50, flexShrink: 0 }}
                items={[
                  {
                    key: 'summary',
                    label: (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Layers size={16} /> Summary
                      </span>
                    ),
                    children: (
                      <div className="raw-data-tab-content" style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
                        <Title level={5}>Patent Analysis Summary</Title>
                        
                        <Row gutter={[16, 16]}>
                          <Col span={24}>
                            <Card size="small" title="Scaffold Ranking" style={{ borderRadius: '12px' }}>
                              <Row gutter={[16, 16]}>
                                <Col span={12} md={6}>
                                  <Card size="small" type="inner" title="Parent Scaffold">
                                    <div style={{ width: '100%', height: 120, background: '#fff', border: `1px solid ${token.colorBorderSecondary}`, borderRadius: '8px', position: 'relative' }}>
                                      <Button
                                        size="small"
                                        type="text"
                                        icon={<Search size={14} />}
                                        onClick={() => openSvgPreview(patentDetailData.analysis.parentScaffold.svg, 'Parent Scaffold')}
                                        style={{ position: 'absolute', right: 4, top: 4, zIndex: 2, background: 'rgba(255,255,255,0.8)' }}
                                      />
                                      <SvgRenderer svg={patentDetailData.analysis.parentScaffold.svg} />
                                    </div>
                                  </Card>
                                </Col>
                                {patentDetailData.analysis.scaffoldRanks && patentDetailData.analysis.scaffoldRanks.map(rankData => (
                                  <Col span={12} md={6} key={rankData.rank}>
                                    <Card size="small" type="inner" title={<><Badge count={rankData.rank} style={{ backgroundColor: rankData.rank === 1 ? '#f5222d' : rankData.rank === 2 ? '#fa8c16' : '#d9d9d9' }} /> Rank {rankData.rank}</>}>
                                      <div style={{ width: '100%', height: 120, background: '#fff', border: `1px solid ${token.colorBorderSecondary}`, borderRadius: '8px', position: 'relative' }}>
                                        <Button
                                          size="small"
                                          type="text"
                                          icon={<Search size={14} />}
                                          onClick={() => openSvgPreview(rankData.svg, `Scaffold Rank ${rankData.rank}`)}
                                          style={{ position: 'absolute', right: 4, top: 4, zIndex: 2, background: 'rgba(255,255,255,0.8)' }}
                                        />
                                        <SvgRenderer svg={rankData.svg} />
                                      </div>
                                      <div style={{ marginTop: 8, textAlign: 'center' }}>
                                        <Text type="secondary">Frequency: {rankData.frequency}</Text>
                                      </div>
                                    </Card>
                                  </Col>
                                ))}
                              </Row>
                            </Card>
                          </Col>

                          <Col span={24}>
                            <Card size="small" title="Functional Group Analysis" style={{ borderRadius: '12px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                {/* Scaffold Rank 1 Image for Functional Group Context */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                  <Title level={5} style={{ marginTop: 0, marginBottom: 8, color: token.colorPrimary }}>Scaffold Rank 1</Title>
                                  <div style={{ width: 200, height: 200, background: '#fff', border: `1px solid ${token.colorBorderSecondary}`, borderRadius: '8px', padding: 8, position: 'relative' }}>
                                    <Button
                                      size="small"
                                      type="text"
                                      icon={<Search size={14} />}
                                      onClick={() => openSvgPreview(
                                        patentDetailData.analysis.scaffoldRanks && patentDetailData.analysis.scaffoldRanks.length > 0
                                          ? patentDetailData.analysis.scaffoldRanks[0].svg
                                          : patentDetailData.analysis.parentScaffold.svg,
                                        'Functional Group - Scaffold Rank 1'
                                      )}
                                      style={{ position: 'absolute', right: 4, top: 4, zIndex: 2, background: 'rgba(255,255,255,0.8)' }}
                                    />
                                    <SvgRenderer svg={patentDetailData.analysis.scaffoldRanks && patentDetailData.analysis.scaffoldRanks.length > 0 ? patentDetailData.analysis.scaffoldRanks[0].svg : patentDetailData.analysis.parentScaffold.svg} />
                                  </div>
                                </div>
                                
                                {/* R-Groups List */}
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
                                  {patentDetailData.analysis.rGroups.map(group => (
                                    <div key={group.id}>
                                      <Title level={5} style={{ marginTop: 0, marginBottom: 8, color: token.colorPrimary }}>{group.id}</Title>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                                        {group.variants.map((v: any, idx: number) => (
                                          <Card key={idx} size="small" type="inner" style={{ width: 140 }}>
                                            <div style={{ width: '100%', height: 80, position: 'relative' }}>
                                              <Button
                                                size="small"
                                                type="text"
                                                icon={<Search size={12} />}
                                                onClick={() => openSvgPreview(v.svg, `${group.id} Variant ${idx + 1}`)}
                                                style={{ position: 'absolute', right: 2, top: 2, zIndex: 2, background: 'rgba(255,255,255,0.8)' }}
                                              />
                                              <SvgRenderer svg={v.svg} />
                                            </div>
                                            <div style={{ textAlign: 'center', marginTop: 4 }}>
                                              <Text type="secondary">Freq: {v.frequency}</Text>
                                            </div>
                                          </Card>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </Card>
                          </Col>

                          <Col span={24}>
                            <Card size="small" title="추천 Key Compound (빈도수/중요도 기반)" style={{ borderRadius: '12px' }}>
                              <div style={{ display: 'flex', overflowX: 'auto', gap: 16, paddingBottom: 8 }}>
                                {((patentResultRaw as any)?.result?.patent_compound ?? []).slice(0, 10).map((comp: any) => {
                                  const compKey = String(comp.id);
                                  const pageArr: number[] = Array.isArray(comp.page) ? comp.page : [];
                                  const bboxArr: any[] = Array.isArray(comp.bbox) ? comp.bbox : [];
                                  const curIdx = pageIndices[compKey] ?? 0;
                                  
                                  return (
                                    <div key={comp.id} style={{ minWidth: 220, flexShrink: 0 }}>
                                      <DataCardItem
                                        title={comp.compound_id}
                                        tags={comp.ranking ? [{ label: `Rank ${comp.ranking}`, color: 'blue' }] : []}
                                        cornerIcon={
                                          comp.is_human_key_compound ? (
                                            <span style={{ fontSize: 16, cursor: 'pointer' }} title="Key Compound">🔑</span>
                                          ) : undefined
                                        }
                                        imageUrl={comp.compound_svg}
                                        imageType="svg"
                                        imageHeight={150}
                                        isActive={activeCompId === compKey}
                                        onClick={() => handleCompoundCardClick(comp, comp.ranking)}
                                        onPreview={() => openSvgPreview(comp.compound_svg, `추천 Key Compound - ${comp.compound_id}`)}
                                        pagination={
                                          pageArr.length > 0
                                            ? {
                                                currentIndex: curIdx,
                                                totalCount: pageArr.length,
                                                onPrev: () => handlePageChange(compKey, -1, pageArr, bboxArr),
                                                onNext: () => handlePageChange(compKey, 1, pageArr, bboxArr),
                                                pageLabel: () => `p.${pageArr[curIdx] ?? '-'}`,
                                              }
                                            : undefined
                                        }
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </Card>
                          </Col>
                        </Row>
                      </div>
                    )
                  },
                  {
                    key: 'raw-data',
                    label: (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FileSpreadsheet size={16} /> Raw Data
                      </span>
                    ),
                    children: (
                      <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                          <Title level={5} style={{ margin: 0 }}>Embodiment 화합물 목록</Title>
                          <Space>
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
                                icon={<TableIcon size={14} />}
                                onClick={() => setRawDataView('table')}
                                style={{
                                  background: rawDataView === 'table' ? token.colorPrimaryBg : 'transparent',
                                  border: `1px solid ${rawDataView === 'table' ? token.colorPrimary : 'transparent'}`,
                                  color: rawDataView === 'table' ? token.colorPrimary : token.colorTextSecondary,
                                  borderRadius: 6,
                                  fontWeight: rawDataView === 'table' ? 600 : 500
                                }}
                              >
                                Table
                              </Button>
                              <Button
                                type="text"
                                size="small"
                                icon={<LayoutGrid size={14} />}
                                onClick={() => setRawDataView('card')}
                                style={{
                                  background: rawDataView === 'card' ? token.colorPrimaryBg : 'transparent',
                                  border: `1px solid ${rawDataView === 'card' ? token.colorPrimary : 'transparent'}`,
                                  color: rawDataView === 'card' ? token.colorPrimary : token.colorTextSecondary,
                                  borderRadius: 6,
                                  fontWeight: rawDataView === 'card' ? 600 : 500
                                }}
                              >
                                Card
                              </Button>
                            </div>
                            <Button size="small">Export CSV</Button>
                            <Button size="small" type="primary">Filter</Button>
                          </Space>
                        </div>
                        {rawDataView === 'table' ? (
                          (() => {
                            // patentResultRaw에서 실제 patent_compound 데이터 사용
                            const rawPc: any[] = patentResult.patent_compound ?? [];
                            // 전체 r_group key 수집 (R1~R7 등 동적)
                            const allRGroupKeys = Array.from(
                              new Set(rawPc.flatMap((c: any) => Object.keys(c.r_groups ?? {})))
                            ).sort();

                            const rGroupColumns = allRGroupKeys.map((key) => ({
                              title: key,
                              key: `rg_${key}`,
                              width: 190,
                              render: (_: any, record: any) => {
                                const smiles = record.r_groups?.[key];
                                // frequency_analysis_result_json에서 SVG 찾기
                                const faRGroups = frequencyAnalysis?.r_groups ?? {};
                                const variants: any[] = faRGroups[key] ?? [];
                                const match = variants.find((v: any) => v.smiles === smiles);
                                const svg = match?._svg || record.r_group_svgs?.[key] || '';
                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                    <div
                                      className="raw-data-svg-frame"
                                      style={{ width: 140, height: 100, background: '#fff', border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 6, position: 'relative', cursor: svg ? 'pointer' : 'default', overflow: 'hidden', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                      onClick={() => { if (svg) openSvgPreview(svg, `${key}: ${smiles}`); }}>
                                      {svg ? (
                                        <SvgRenderer svg={svg} height={92} />
                                      ) : (
                                        <Text style={{ fontSize: 12, color: token.colorTextTertiary }}>no image</Text>
                                      )}
                                    </div>
                                    <Text style={{ fontSize: 11, color: token.colorTextSecondary, maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={smiles}>
                                      {smiles || '-'}
                                    </Text>
                                  </div>
                                );
                              }
                            }));

                            const columns = [
                              {
                                title: 'pin',
                                key: 'pin',
                                width: 56,
                                fixed: 'left' as const,
                                render: () => <Pin size={14} style={{ cursor: 'pointer', color: '#bfbfbf' }} />
                              },
                              { title: 'Rank', dataIndex: 'ranking', key: 'ranking', width: 90, fixed: 'left' as const,
                                sorter: (a: any, b: any) => (a.ranking ?? 999) - (b.ranking ?? 999),
                                render: (ranking: any, _: any, index: number) => {
                                  // 같은 ranking 값이 여러 개인지 확인 (동률)
                                  const sameCount = rawPc.filter((c: any) => c.ranking === ranking).length;
                                  return (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                      <Text style={{ fontSize: 12 }}>{ranking ?? '-'}</Text>
                                      {sameCount > 1 && (
                                        <Tag color="orange" style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px', margin: 0 }}>동률</Tag>
                                      )}
                                    </div>
                                  );
                                }
                              },
                              { title: 'Scaffold Rank', dataIndex: 'scaffold_ranking', key: 'scaffold_ranking', width: 120, render: (v: any) => v ?? '-' },
                              { title: 'Example No.', dataIndex: 'compound_id', key: 'compound_id', width: 130, fixed: 'left' as const },
                              {
                                title: 'Structure',
                                key: 'structure',
                                width: 240,
                                render: (_: any, record: any) => {
                                  const compKey = String(record.id);
                                  const pageArr: number[] = Array.isArray(record.page) ? record.page : [];
                                  const bboxArr: any[] = Array.isArray(record.bbox) ? record.bbox : [];
                                  const curIdx = pageIndices[compKey] ?? 0;
                                  return (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                      <div
                                        className="raw-data-svg-frame"
                                        style={{ width: 180, height: 130, background: '#fff', border: `2px solid ${activeCompId === compKey ? 'red' : token.colorBorderSecondary}`, borderRadius: 8, position: 'relative', cursor: 'pointer', overflow: 'hidden', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        onClick={() => { setActiveCompId(compKey); handleGoToPdf(pageArr[curIdx], bboxArr[curIdx]); }}
                                      >
                                        <Button size="small" type="text" icon={<Search size={11} />}
                                          onClick={(e) => { e.stopPropagation(); openSvgPreview(record.compound_svg, `Compound ${record.compound_id}`); }}
                                          style={{ position: 'absolute', right: 2, top: 2, zIndex: 2, background: 'rgba(255,255,255,0.85)', padding: '0 2px' }} />
                                        <SvgRenderer svg={record.compound_svg} height={120} />
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Button size="small" type="text" icon={<ChevronLeft size={12} />}
                                          onClick={() => { setActiveCompId(compKey); handlePageChange(compKey, -1, pageArr, bboxArr); }} />
                                        <Text style={{ fontSize: 11 }}>p.{pageArr[curIdx] ?? '-'}</Text>
                                        <Button size="small" type="text" style={{ transform: 'scaleX(-1)' }} icon={<ChevronLeft size={12} />}
                                          onClick={() => { setActiveCompId(compKey); handlePageChange(compKey, 1, pageArr, bboxArr); }} />
                                      </div>
                                    </div>
                                  );
                                }
                              },
                              {
                                title: 'Scaffold',
                                key: 'scaffold',
                                width: 220,
                                render: (_: any, record: any) => record.scaffold_svg ? (
                                  <div
                                    className="raw-data-svg-frame"
                                    style={{ width: 170, height: 130, background: '#fff', border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 8, cursor: 'pointer', position: 'relative', overflow: 'hidden', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    onClick={() => openSvgPreview(record.scaffold_svg, `Scaffold - ${record.compound_id}`)}
                                  >
                                    <Button size="small" type="text" icon={<Search size={11} />}
                                      onClick={(e) => { e.stopPropagation(); openSvgPreview(record.scaffold_svg, `Scaffold - ${record.compound_id}`); }}
                                      style={{ position: 'absolute', right: 2, top: 2, zIndex: 2, background: 'rgba(255,255,255,0.85)', padding: '0 2px' }} />
                                    <SvgRenderer svg={record.scaffold_svg} height={120} />
                                  </div>
                                ) : (
                                  <div
                                    className="raw-data-svg-frame"
                                    style={{ width: 170, height: 130, background: '#fff', border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 8, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  >
                                    <Text style={{ fontSize: 12, color: token.colorTextTertiary }}>no image</Text>
                                  </div>
                                )
                              },
                              ...rGroupColumns,
                              {
                                title: 'SMILES',
                                dataIndex: 'scaffold',
                                key: 'smiles',
                                ellipsis: true,
                                width: 300,
                                render: (_v: any, record: any) => {
                                  const smilesText = typeof record.scaffold === 'string' ? record.scaffold.trim() : '';
                                  if (!smilesText) {
                                    return <Text type="secondary" style={{ fontSize: 11 }}>-</Text>;
                                  }
                                  return (
                                    <Text style={{ fontSize: 11 }} copyable={{ text: smilesText }}>
                                      {smilesText}
                                    </Text>
                                  );
                                }
                              },
                            ];

                            return (
                              <div
                                className="raw-data-table-shell"
                                style={{
                                  background: token.colorBgContainer,
                                  borderRadius: 20,
                                  border: `1px solid ${token.colorBorderSecondary}`,
                                  overflow: 'hidden'
                                }}
                              >
                                <Table
                                  className="raw-data-embodiment-table"
                                  dataSource={rawPc}
                                  size="small"
                                  rowKey="id"
                                  scroll={{ x: 'max-content', y: rawDataTableScrollY }}
                                  columns={columns}
                                  rowClassName={(record: any) => activeCompId === String(record.id) ? 'raw-data-row-active' : ''}
                                  onRow={(record: any) => ({
                                    onClick: () => {
                                      const compKey = String(record.id);
                                      const pageArr: number[] = Array.isArray(record.page) ? record.page : [];
                                      const bboxArr: any[] = Array.isArray(record.bbox) ? record.bbox : [];
                                      const curIdx = pageIndices[compKey] ?? 0;
                                      setActiveCompId(compKey);
                                      if (pageArr.length > 0) {
                                        handleGoToPdf(pageArr[curIdx], bboxArr[curIdx]);
                                      }
                                    },
                                    style: { cursor: 'pointer' }
                                  })}
                                  pagination={{ pageSize: rawDataTablePageSize, showSizeChanger: true, position: ['bottomCenter'], style: { margin: '14px 0' } }}
                                />
                              </div>
                            );
                          })()

                        ) : (
                          <Row gutter={[16, 16]}>
                            {((patentResultRaw as any)?.result?.patent_compound ?? []).map((comp: any) => {
                              const compKey = String(comp.id);
                              const pageArr: number[] = Array.isArray(comp.page) ? comp.page : [];
                              const bboxArr: any[] = Array.isArray(comp.bbox) ? comp.bbox : [];
                              const curIdx = pageIndices[compKey] ?? 0;
                              const rEntries = Object.entries(comp.r_groups ?? {}) as [string, string][];
                              
                              return (
                                <Col span={24} md={12} lg={8} key={comp.id}>
                                  <DataCardItem
                                    title={comp.compound_id}
                                    tags={comp.ranking ? [{ label: `Rank ${comp.ranking}`, color: 'blue' }] : []}
                                    cornerIcon={
                                      comp.is_human_key_compound ? (
                                        <span style={{ fontSize: 16, cursor: 'pointer' }} title="Key Compound">🔑</span>
                                      ) : undefined
                                    }
                                    imageUrl={comp.compound_svg}
                                    imageType="svg"
                                    imageHeight={130}
                                    isActive={activeCompId === compKey}
                                    onClick={() => {
                                      setActiveCompId(compKey);
                                      if (pageArr.length > 0) handleGoToPdf(pageArr[curIdx], bboxArr[curIdx]);
                                    }}
                                    onPreview={() => openSvgPreview(comp.compound_svg, comp.compound_id)}
                                    extraInfo={
                                      rEntries.length > 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                          {rEntries.map(([k, v]) => (
                                            <Tooltip key={k} title={`${k}: ${String(v ?? '')}`}>
                                              <Tag
                                                style={{
                                                  fontSize: 10,
                                                  maxWidth: 170,
                                                  cursor: 'copy',
                                                  overflow: 'hidden',
                                                  textOverflow: 'ellipsis',
                                                  whiteSpace: 'nowrap',
                                                  display: 'inline-flex',
                                                  alignItems: 'center',
                                                  gap: 2
                                                }}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  const copiedText = `${k}: ${String(v ?? '')}`;
                                                  navigator.clipboard.writeText(copiedText)
                                                    .then(() => message.success(`${k} 값이 복사되었습니다.`))
                                                    .catch(() => message.error('복사에 실패했습니다.'));
                                                }}
                                              >
                                                <Text strong style={{ fontSize: 10 }}>{k}:</Text>
                                                <span
                                                  style={{
                                                    maxWidth: 110,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                  }}
                                                >
                                                  {String(v ?? '')}
                                                </span>
                                              </Tag>
                                            </Tooltip>
                                          ))}
                                        </div>
                                      )
                                    }
                                    footerText={comp.scaffold}
                                    pagination={
                                      pageArr.length > 0
                                        ? {
                                            currentIndex: curIdx,
                                            totalCount: pageArr.length,
                                            onPrev: () => handlePageChange(compKey, -1, pageArr, bboxArr),
                                            onNext: () => handlePageChange(compKey, 1, pageArr, bboxArr),
                                            pageLabel: () => `p.${pageArr[curIdx] ?? '-'}`,
                                          }
                                        : undefined
                                    }
                                  />
                                </Col>
                              );
                            })}
                          </Row>
                        )}
                      </div>
                    )
                  },
                  {
                    key: 'clean-data',
                    label: (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Activity size={16} /> Clean Data
                      </span>
                    ),
                    children: (
                      <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
                        <Empty description="Clean Data 분석 진행 중입니다." />
                      </div>
                    )
                  },
                  {
                    key: 'tables',
                    label: (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <LayoutGrid size={16} /> Tables
                      </span>
                    ),
                    children: (
                        <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
                          <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>Result Tables</Title>
                          {resultTables.length === 0 ? (
                              <Empty description="result.tables 데이터가 없습니다." />
                          ) : (
                              <Row gutter={[16, 16]}>
                                {resultTables.map((tableItem: any, i: number) => {
                                  const cardKey = `table-${tableItem?.table_num ?? i}-${i}`;
                                  const base64List = Array.isArray(tableItem?.table_base64) ? tableItem.table_base64 : [];
                                  const firstImage =
                                    typeof base64List[0] === 'string'
                                      ? base64List[0].startsWith('data:')
                                        ? base64List[0]
                                        : `data:image/png;base64,${base64List[0]}`
                                      : null;
                                  const pageArray = Array.isArray(tableItem?.page) ? tableItem.page : [];
                                  const tableCurrentIndex = pageIndices[cardKey] ?? 0;
                                  
                                  return (
                                    <Col span={24} md={12} lg={8} key={cardKey}>
                                      <DataCardItem
                                        title={`Table ${tableItem?.table_group ?? tableItem?.table_num ?? '?'}`}
                                        tags={[
                                          { label: `Table ${tableItem?.table_group ?? ''}`, color: 'blue' },
                                          {
                                            label: tableItem?.has_compound ? 'Compound 포함' : 'Compound 없음',
                                            color: tableItem?.has_compound ? 'green' : 'default',
                                          },
                                        ]}
                                        imageUrl={firstImage || ''}
                                        imageType="base64"
                                        imageHeight={150}
                                        isActive={activeCompId === cardKey}
                                        onClick={() => handleTableCardClick(tableItem, i)}
                                        onPreview={
                                          firstImage
                                            ? () => openImagePreview(firstImage, `Table ${tableItem?.table_num ?? '?'}`)
                                            : undefined
                                        }
                                        extraInfo={
                                          <div>
                                            <Text style={{ fontSize: 12 }}>
                                              Pages: {pageArray.length > 0 ? pageArray.join(', ') : '-'}
                                            </Text>
                                            <br />
                                            <Text style={{ fontSize: 12 }}>Images: {base64List.length}</Text>
                                          </div>
                                        }
                                        pagination={
                                          pageArray.length > 0
                                            ? {
                                                currentIndex: tableCurrentIndex,
                                                totalCount: pageArray.length,
                                                onPrev: () => handleTablePageChange(tableItem, i, -1),
                                                onNext: () => handleTablePageChange(tableItem, i, 1),
                                                pageLabel: () => `p.${pageArray[tableCurrentIndex] ?? '-'}`,
                                              }
                                            : undefined
                                        }
                                      />
                                    </Col>
                                  );
                                })}
                              </Row>
                          )}
                        </div>
                    )
                  }
                ]}
              />
            </Card>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .pdfViewer .page {
          position: relative !important;
          margin: 1px auto 10px auto !important;
          display: block !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        .pdfViewer .page .canvasWrapper,
        .pdfViewer .page .textLayer,
        .pdfViewer .page .Highlight__container,
        .pdfViewer .page .PdfHighlighter__highlight-layer,
        .pdfViewer .page .annotationLayer {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
        }
        .pdfViewer .page .canvasWrapper {
          z-index: 1 !important;
        }
        .pdfViewer .page .textLayer {
          z-index: 2 !important;
          opacity: 1 !important;
          mix-blend-mode: multiply;
        }
        .pdfViewer .page .textLayer > span,
        .pdfViewer .page .textLayer > div {
          position: absolute !important;
          white-space: pre !important;
          cursor: text !important;
          transform-origin: 0% 0% !important;
          color: transparent !important;
        }
        .pdfViewer .page .Highlight__container,
        .pdfViewer .page .PdfHighlighter__highlight-layer {
          z-index: 3 !important;
          pointer-events: none;
        }
        .pdfViewer .page .annotationLayer {
          z-index: 4 !important;
        }
        .TextHighlight__part {
          background-color: rgba(248, 124, 99, 0.3) !important;
          border-radius: 4px;
        }
        .Highlight__part {
          background-color: rgba(248, 124, 99, 0.3);
        }
        .active_compound_highlight .TextHighlight__part {
          background-color: rgba(255, 0, 0, 0.2) !important;
          border: 3px solid red !important;
          border-radius: 0 !important;
        }
        .pdfViewer .page::after {
          content: "";
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 0px; /* 하단 잘림 방지: 가림 제거 */
          background-color: white;
          z-index: 5;
          pointer-events: none;
        }
        .textLayer {
          overflow: hidden !important;
          width: 100% !important;
          max-width: 100% !important;
          opacity: 1 !important;
        }
        .textLayer span,
        .textLayer br {
          color: transparent;
        }
        .textLayer .highlight.end,
        .textLayer .highlight:not(.begin):not(.middle):not(.selected) {
          padding-right: 8px;
        }
        .pdfViewer {
          overflow-x: hidden !important;
          padding-bottom: 0 !important;
        }
        .pdfViewer .page {
          overflow: hidden !important;
          margin-bottom: 10px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .react-pdf-highlighter__pdf-container {
          overflow: hidden !important;
        }
        .cdd-clipboard-icon-container, .CDW_Logo, .cdd-logo { display: none !important; }
        .ant-tabs-content-holder {
          flex: 1;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .ant-tabs-content {
          height: 100%;
        }
        .ant-tabs-tabpane {
          height: 100%;
          overflow-y: auto;
          overflow-x: hidden;
        }
        .raw-data-tab-content .raw-data-svg-frame svg {
          max-width: 100% !important;
          max-height: 100% !important;
          display: block;
        }
        .raw-data-tab-content .raw-data-embodiment-table .ant-table {
          background: transparent;
        }
        .raw-data-tab-content .raw-data-embodiment-table .ant-table-thead > tr > th {
          background: transparent !important;
          border-bottom: 2px solid ${token.colorBorderSecondary} !important;
          padding: 14px 12px;
          font-size: 13px;
          font-weight: 600;
        }
        .raw-data-tab-content .raw-data-embodiment-table .ant-table-tbody > tr > td {
          vertical-align: middle;
          padding: 14px 12px;
          transition: background-color 0.2s ease;
        }
        .raw-data-tab-content .raw-data-embodiment-table .raw-data-row-active > td {
          background: ${token.colorPrimaryBg} !important;
        }
        .raw-data-tab-content .raw-data-embodiment-table .ant-table-row:hover > td {
          background: ${token.colorFillAlter} !important;
        }
      `}</style>

      <Modal
        title={previewTitle}
        open={!!previewSvg || !!previewImageSrc}
        onCancel={() => {
          setPreviewSvg(null);
          setPreviewImageSrc(null);
        }}
        footer={null}
        width={900}
      >
        {previewSvg || previewImageSrc ? (
          <div style={{ width: '100%', height: 600, background: '#fff', borderRadius: 8, border: `1px solid ${token.colorBorderSecondary}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {previewImageSrc ? (
              <img src={previewImageSrc} alt="table-preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            ) : null}
            {previewSvg ? (
            <SvgRenderer svg={previewSvg} />
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default PatentAnalysisDetail;
