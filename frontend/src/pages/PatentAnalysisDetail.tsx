import React, { useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Button, 
  Space, 
  Tag, 
  Card, 
  Modal,
  Typography, 
  Tabs, 
  Row, 
  Col, 
  theme,
  Empty,
  Table,
  Badge
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
import { useUIStore } from '../store/useUIStore';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import { 
  PdfLoader, 
  PdfHighlighter, 
  TextHighlight, 
  AreaHighlight,
  PdfHighlighterUtils,
  useHighlightContainerContext,
  usePdfHighlighterContext
} from "react-pdf-highlighter-plus";
import "react-pdf-highlighter-plus/style/style.css";
import * as pdfjs from 'pdfjs-dist';

// PDF.js worker 설정
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const { Title, Text, Paragraph } = Typography;

const DEFAULT_PDF_HIGHLIGHT_SCALE = 0.36;
const HIGHLIGHT_PADDING_X = 8;
const HIGHLIGHT_PADDING_Y = 10;
const ENABLE_HIGHLIGHT_DEBUG_LOG = true;

const getPdfHighlightScale = (_patentNumber?: string): number => DEFAULT_PDF_HIGHLIGHT_SCALE;

// SVG 렌더링 컴포넌트
const SvgRenderer: React.FC<{ svg: string; height?: number | string }> = ({ svg, height = '100%' }) => (
  <div 
    style={{ height, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    dangerouslySetInnerHTML={{ __html: svg }}
  />
);

const HighlightContainer = () => {
  const { highlight, isScrolledTo, highlightBindings } = useHighlightContainerContext();
  
  const highlightId = String(highlight.id ?? '');
  const isActive = highlightId.startsWith('active_compound_highlight');

  if (highlight.type === "area") {
    return (
      <AreaHighlight
        highlight={highlight}
        isScrolledTo={isScrolledTo}
        bounds={highlightBindings.textLayer}
        onChange={() => {}}
        style={{
          border: `3px solid ${isActive ? 'rgba(255,0,0,0.9)' : 'rgba(255, 226, 143, 1)'}`,
          backgroundColor: isActive ? 'rgba(255, 0, 0, 0.25)' : 'rgba(255, 226, 143, 0.4)',
          pointerEvents: 'none',
        }}
      />
    );
  }

  // 텍스트 하이라이트 (기본)
  return (
    <TextHighlight
      highlight={highlight}
      isScrolledTo={isScrolledTo}
      style={{ background: "rgba(248, 124, 99, 0.3)", borderRadius: '4px' }}
    />
  );
};

const PatentAnalysisDetail: React.FC = () => {
  const { token } = theme.useToken();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const selectedPatent = useMemo(() => {
    if (!id) return null;
    return mockPatents.find(p => p.id === id) || null;
  }, [id]);

  const { setHeaderContent } = useUIStore();
  const highlighterUtilsRef = React.useRef<PdfHighlighterUtils | null>(null);
  const pdfDocumentRef = React.useRef<any | null>(null);

  const currentHighlights = useMemo(() => {
    if (!selectedPatent) return [];
    return mockHighlights[selectedPatent.id] || [];
  }, [selectedPatent]);

  const setHighlighterUtils = React.useCallback((utils: PdfHighlighterUtils) => {
    highlighterUtilsRef.current = utils;
  }, []);

  const debugLog = React.useCallback((event: string, payload: Record<string, unknown>) => {
    if (!ENABLE_HIGHLIGHT_DEBUG_LOG) return;
    console.log('[PDFHighlightDebug]', event, payload);
  }, []);

  const [pageIndices, setPageIndices] = React.useState<Record<string, number>>({});
  const [activeCompId, setActiveCompId] = React.useState<string | null>(null);
  const [previewSvg, setPreviewSvg] = React.useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = React.useState<string>('이미지 미리보기');
  const [activeBBox, setActiveBBox] = React.useState<{pageNumber: number, rect: number[]} | null>(null);
  const [pendingHighlight, setPendingHighlight] = React.useState<{pageNumber: number, rect: number[]} | null>(null);
  const [activeHighlightRevision, setActiveHighlightRevision] = React.useState(0);
  // PDF 페이지 실제 포인트 크기 캐시 (scale=1 viewport 기준)
  const [pdfPageSizes, setPdfPageSizes] = React.useState<Record<number, {width: number, height: number}>>({});

  const highlightScale = React.useMemo(
    () => getPdfHighlightScale(selectedPatent?.patentNumber),
    [selectedPatent?.patentNumber]
  );

  const ensurePdfPageSize = React.useCallback((pdfDocument: any, pageNumber: number) => {
    if (!pageNumber || pdfPageSizes[pageNumber]) return;
    pdfDocument.getPage(pageNumber).then((page: any) => {
      const vp = page.getViewport({ scale: 1 });
      setPdfPageSizes(prev => {
        if (prev[pageNumber]) return prev;
        return { ...prev, [pageNumber]: { width: vp.width, height: vp.height } };
      });
    }).catch((error: unknown) => {
      console.warn(`Failed to get PDF page size for page ${pageNumber}`, error);
    });
  }, [pdfPageSizes]);

  const normalizeBbox = React.useCallback((bboxRaw: number[]) => {
    if (!Array.isArray(bboxRaw) || bboxRaw.length !== 4) return null;
    const [rx1, ry1, rx2, ry2] = bboxRaw.map(Number);
    if ([rx1, ry1, rx2, ry2].some(v => !Number.isFinite(v))) return null;

    return {
      x1: Math.min(rx1, rx2),
      y1: Math.min(ry1, ry2),
      x2: Math.max(rx1, rx2),
      y2: Math.max(ry1, ry2),
    };
  }, []);

  /**
   * API bbox 픽셀 좌표 → react-pdf-highlighter-plus ScaledPosition 변환
   *
   * portal.html 동일 로직:
   *   left   = x1 * scale * 0.36
   *   top    = y1 * scale * 0.36
   * 즉 API bbox는 (PDF포인트 / 0.36) 배 크기의 이미지 픽셀 좌표.
   * 라이브러리는 boundingRect를 "캡처 당시 viewport 크기 대비 픽셀" 로 저장하므로
   * 포인트 크기(scale=1)를 width/height 로 주고, 좌표를 * 0.36 변환하면 된다.
   */
  const bboxToPosition = React.useCallback((bboxPx: number[], pageNumber: number) => {
    const normalized = normalizeBbox(bboxPx);
    if (!normalized) {
      debugLog('bbox-normalize-failed', { bboxPx, pageNumber });
      return null;
    }

    // 페이지 실제 크기 확보 전 fallback으로 렌더링하면 첫 클릭 위치가 틀어질 수 있어 대기
    const pageSize = pdfPageSizes[pageNumber];
    if (!pageSize) {
      debugLog('page-size-not-ready', { pageNumber, bboxPx });
      return null;
    }
    const pw = pageSize.width;
    const ph = pageSize.height;

    const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
    const x1 = clamp((normalized.x1 * highlightScale) - HIGHLIGHT_PADDING_X, 0, pw);
    const x2 = clamp((normalized.x2 * highlightScale) + HIGHLIGHT_PADDING_X, 0, pw);
    const y1 = clamp((normalized.y1 * highlightScale) - HIGHLIGHT_PADDING_Y, 0, ph);
    const y2 = clamp((normalized.y2 * highlightScale) + HIGHLIGHT_PADDING_Y, 0, ph);

    if (x2 <= x1 || y2 <= y1) {
      debugLog('bbox-invalid-after-convert', {
        pageNumber,
        bboxPx,
        converted: { x1, y1, x2, y2 },
      });
      return null;
    }

    debugLog('bbox-converted', {
      pageNumber,
      bboxPx,
      normalized,
      scale: highlightScale,
      pageSize,
      converted: { x1, y1, x2, y2, width: pw, height: ph },
    });

    return {
      boundingRect: { x1, y1, x2, y2, width: pw, height: ph, pageNumber },
      rects: [],
      pageNumber,
    };
  }, [normalizeBbox, pdfPageSizes, highlightScale, debugLog]);

  const dynamicHighlights = useMemo(() => {
    const base = [...currentHighlights];

    if (activeBBox) {
      const pn = activeBBox.pageNumber;
      const position = bboxToPosition(activeBBox.rect, pn);
      if (!position) {
        debugLog('highlight-render-skipped', {
          activeBBox,
          cachedPageSize: pdfPageSizes[pn],
        });
        return base;
      }
      debugLog('highlight-render', {
        activeBBox,
        boundingRect: position.boundingRect,
      });
      const h: any = {
        id: `active_compound_highlight_${activeHighlightRevision}_${pn}`,
        type: "area",
        content: { text: "" },
        position,
        comment: { text: "", emoji: "" }
      };
      return [...base, h];
    }
    return base;
  }, [currentHighlights, activeBBox, bboxToPosition, activeHighlightRevision, pdfPageSizes, debugLog]);

  useEffect(() => {
    if (!pendingHighlight) return;

    if (pdfDocumentRef.current) {
      ensurePdfPageSize(pdfDocumentRef.current, pendingHighlight.pageNumber);
    }

    const pageSizeReady = !!pdfPageSizes[pendingHighlight.pageNumber];
    const pageElement = document.querySelector(`.page[data-page-number="${pendingHighlight.pageNumber}"]`) as HTMLElement | null;
    const pageRendered = !!pageElement?.querySelector('canvas');

    if (!pageSizeReady || !pageRendered) {
      debugLog('pending-highlight-wait', {
        pageNumber: pendingHighlight.pageNumber,
        pageSizeReady,
        pageRendered,
      });
      const timer = window.setTimeout(() => {
        setPendingHighlight(prev => (prev ? { ...prev } : prev));
      }, 120);
      return () => window.clearTimeout(timer);
    }


    debugLog('pending-highlight-ready', {
      pageNumber: pendingHighlight.pageNumber,
      pageSize: pdfPageSizes[pendingHighlight.pageNumber],
    });

    setActiveBBox({
      pageNumber: pendingHighlight.pageNumber,
      rect: pendingHighlight.rect,
    });
    setActiveHighlightRevision(prev => prev + 1);
    setPendingHighlight(null);
  }, [pendingHighlight, pdfPageSizes, ensurePdfPageSize, debugLog]);

  // 페이지 렌더가 늦게 완료되어 하이라이트 위치가 틀어지는 경우를 보정
  // activeBBox를 일시 제거 후 재추가하여 라이브러리가 강제로 DOM을 재배치하도록 유도
  const isRebumpingRef = React.useRef(false);
  const lastRebumpTargetRef = React.useRef<string>('');

  useEffect(() => {
    if (!activeBBox) return;
    if (isRebumpingRef.current) return;

    // 같은 대상에 대해 이미 rebump를 수행했으면 스킵
    const targetKey = `${activeBBox.pageNumber}_${activeBBox.rect.join(',')}`;
    if (lastRebumpTargetRef.current === targetKey) return;
    lastRebumpTargetRef.current = targetKey;

    const savedBBox = { ...activeBBox, rect: [...activeBBox.rect] };
    const delays = [600, 1500];
    const timers: number[] = [];

    delays.forEach((delay) => {
      timers.push(window.setTimeout(() => {
        debugLog('delayed-highlight-rebump', {
          pageNumber: savedBBox.pageNumber,
          delay,
          action: 'remove',
        });
        isRebumpingRef.current = true;
        setActiveBBox(null);

        requestAnimationFrame(() => {
          setActiveBBox(savedBBox);
          setActiveHighlightRevision(prev => prev + 1);
          isRebumpingRef.current = false;
          debugLog('delayed-highlight-rebump', {
            pageNumber: savedBBox.pageNumber,
            delay,
            action: 'restore',
          });
        });
      }, delay));
    });

    return () => timers.forEach(t => window.clearTimeout(t));
  }, [activeBBox?.pageNumber, activeBBox?.rect]);

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
    if (!targetPage) return;

    debugLog('go-to-pdf', {
      targetPage,
      bboxCoords,
      cachedPageSize: pdfPageSizes[targetPage],
    });

    if (pdfDocumentRef.current) {
      ensurePdfPageSize(pdfDocumentRef.current, targetPage);
    }
    
    if (bboxCoords && bboxCoords.length === 4) {
      // 페이지 렌더/크기 준비 후 하이라이트를 표시하기 위해 pending 큐에 저장
      setActiveBBox(null);
      setPendingHighlight({ pageNumber: targetPage, rect: bboxCoords.map(Number) });
    } else {
      setActiveBBox(null);
      setPendingHighlight(null);
    }

    // 라이브러리 utils의 setScrolledTo 또는 scrollTo를 통한 바로 이동
    const utils = highlighterUtilsRef.current;
    if (utils && typeof (utils as any).scrollTo === 'function') {
      debugLog('scroll-via-utils-scrollTo', { targetPage });
      (utils as any).scrollTo(targetPage);
    } else {
      // fallback: 페이지 DOM 요소 기준 바로 이동 (instant)
      const el = document.querySelector(`.page[data-page-number="${targetPage}"]`);
      if (el) {
        debugLog('scroll-instant-fallback', { targetPage });
        el.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'start' });
      } else {
        // 페이지 DOM 아직 없으면 retry
        const retry = () => {
          const el2 = document.querySelector(`.page[data-page-number="${targetPage}"]`);
          if (el2) {
            el2.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'start' });
          }
        };
        window.setTimeout(retry, 200);
        window.setTimeout(retry, 600);
      }
    }
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

  const openSvgPreview = (svg: string, title: string) => {
    setPreviewSvg(svg);
    setPreviewTitle(title);
  };

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '0 24px', flex: 1, width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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

        <Row gutter={24} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* 좌측: PDF 뷰어 영역 */}
          <Col span={12} style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Card 
              style={{ 
                flex: 1,
                borderRadius: '16px', 
                background: token.colorBgContainer,
                border: `1px solid ${token.colorBorderSecondary}`,
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column'
              }}
              styles={{ body: { flex: 1, padding: 0, overflow: 'hidden', position: 'relative' } }}
            >
              <div style={{ position: 'absolute', inset: 0, overflow: 'auto' }}>
                <PdfLoader document="/WO2026090333A1.pdf">
                  {(pdfDocument) => {
                    pdfDocumentRef.current = pdfDocument;
                    // 기본 페이지 + 활성 페이지는 우선 캐시
                    ensurePdfPageSize(pdfDocument, 1);
                    if (activeBBox?.pageNumber) {
                      ensurePdfPageSize(pdfDocument, activeBBox.pageNumber);
                    }
                    return (
                      <PdfHighlighter
                        pdfDocument={pdfDocument}
                        highlights={dynamicHighlights}
                        utilsRef={setHighlighterUtils}
                        pdfScaleValue="page-width"
                        style={{ height: '100%', overflow: 'auto' }}
                      >
                        <HighlightContainer />
                      </PdfHighlighter>
                    );
                  }}
                </PdfLoader>
              </div>
            </Card>
          </Col>

          {/* 우측: 데이터 분석 영역 */}
          <Col span={12} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
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
                      <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
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
                                {patentDetailData.patentCompounds.slice(0, 10).map((comp, i) => (
                                  <Card key={comp.id} size="small" style={{ 
                                    minWidth: 220, 
                                    flexShrink: 0, 
                                    position: 'relative',
                                    cursor: 'pointer',
                                    border: activeCompId === comp.id.toString() ? '2px solid red' : undefined
                                  }} onClick={() => handleCompoundCardClick(comp, i + 1)}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                      <Tag color="blue">Ranking {i + 1}</Tag>
                                      <span style={{ cursor: 'pointer', fontSize: 16, filter: i === 0 ? 'none' : 'grayscale(100%)' }} title="Key Compound">🔑</span>
                                    </div>
                                    <div style={{ width: '100%', height: 150, background: '#fff', border: `1px solid ${token.colorBorderSecondary}`, borderRadius: '8px', position: 'relative' }}>
                                      <Button
                                        size="small"
                                        type="text"
                                        icon={<Search size={14} />}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openSvgPreview(comp.svg, `추천 Key Compound - ex. ${comp.id}`);
                                        }}
                                        style={{ position: 'absolute', right: 4, top: 4, zIndex: 2, background: 'rgba(255,255,255,0.8)' }}
                                      />
                                      <SvgRenderer svg={comp.svg} />
                                    </div>
                                    <div style={{ marginTop: 8, textAlign: 'center' }}>
                                      <Text strong>ex. {comp.id}</Text>
                                    </div>
                                      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', gap: 8 }}>
                                        <Button size="small" type="text" icon={<ChevronLeft size={14} />} onClick={(e) => { e.stopPropagation(); handlePageChange(comp.id.toString(), -1, comp.page, (comp as any).bbox); }} />
                                        <Text style={{ fontSize: 12, alignSelf: 'center' }}>
                                          Page {Array.isArray(comp.page) && comp.page.length > 0 ? comp.page[pageIndices[comp.id.toString()] ?? 0] : '-'}
                                        </Text>
                                        <Button size="small" type="text" style={{ transform: 'scaleX(-1)' }} icon={<ChevronLeft size={14} />} onClick={(e) => { e.stopPropagation(); handlePageChange(comp.id.toString(), 1, comp.page, (comp as any).bbox); }} />
                                        <Button size="small" type="text" style={{ fontSize: 14 }} title="Copy SMILES" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(comp.smiles); }}>📋</Button>
                                      </div>
                                  </Card>
                                ))}
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
                          <Title level={5} style={{ margin: 0 }}>Embodiment 화합물 목록 (Raw Data)</Title>
                          <Space>
                            <Button size="small">Export CSV</Button>
                            <Button size="small" type="primary">Filter</Button>
                          </Space>
                        </div>
                        <Table 
                          dataSource={patentDetailData.patentCompounds}
                          size="small"
                          rowKey="id"
                          scroll={{ x: 'max-content' }}
                          columns={[
                            { 
                              title: 'pin', 
                              key: 'pin', 
                              width: 50,
                              fixed: 'left',
                              render: () => <Pin size={14} style={{ cursor: 'pointer', color: '#bfbfbf' }} />
                            },
                            { title: 'rank', dataIndex: 'rank', key: 'rank', width: 60, render: (_, __, index) => index + 1 },
                            { title: 'Scaffold Group', dataIndex: 'scaffoldGroup', key: 'scaffoldGroup', width: 120, render: () => 'SCF-001' },
                            { title: 'Example Number', dataIndex: 'id', key: 'exampleNumber', width: 130 },
                            { 
                              title: 'Structure', 
                              key: 'svg', 
                              width: 120,
                              render: (_, record) => (
                                <div style={{ width: 80, height: 80, background: '#fff', padding: 4 }}>
                                  <SvgRenderer svg={record.svg} />
                                </div>
                              )
                            },
                            { title: 'R1', key: 'r1', width: 100, render: () => <Tag color="blue">F</Tag> },
                            { title: 'R2', key: 'r2', width: 100, render: () => <Tag color="green">Cl</Tag> },
                            { title: 'R3', key: 'r3', width: 100, render: () => <Tag color="purple">CN</Tag> },
                            { title: 'SMILES', dataIndex: 'smiles', key: 'smiles', ellipsis: true, width: 200 }
                          ]}
                          pagination={{ pageSize: 10 }}
                        />
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
                        <TableIcon size={16} /> Tables
                      </span>
                    ),
                    children: (
                      <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                          <Title level={5} style={{ margin: 0 }}>Embodiments (Card View)</Title>
                          <Space>
                            <Button size="small" type="primary">Filter</Button>
                          </Space>
                        </div>
                        <Row gutter={[16, 16]}>
                          {patentDetailData.patentCompounds.map((comp) => (
                            <Col span={24} md={12} lg={8} key={comp.id}>
                              <Card size="small" hoverable style={{ 
                                height: '100%',
                                border: activeCompId === comp.id.toString() ? '2px solid red' : undefined
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                  <Text strong>ex. {comp.id}</Text>
                                  <span style={{ fontSize: 16, filter: 'grayscale(100%)', cursor: 'pointer' }} title="Mark as Key Compound">🔑</span>
                                </div>
                                <div style={{ width: '100%', height: 150, background: '#fff', border: `1px solid ${token.colorBorderSecondary}`, borderRadius: '8px', marginBottom: 12 }}>
                                  <SvgRenderer svg={comp.svg} />
                                </div>
                                <Space direction="vertical" style={{ width: '100%' }} size={4}>
                                  <Text type="secondary" style={{ fontSize: 12, wordBreak: 'break-all' }} ellipsis={{ tooltip: comp.smiles }}>
                                    {comp.smiles}
                                  </Text>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                                    <Tag color="blue">Page {Array.isArray(comp.page) ? comp.page.join(', ') : comp.page}</Tag>
                                    <Button size="small" icon={<ChevronLeft size={14} style={{ transform: 'rotate(180deg)' }} />} onClick={() => {
                                      const pageArray = Array.isArray(comp.page) ? comp.page : [comp.page];
                                      const bboxArray = Array.isArray((comp as any).bbox) ? (comp as any).bbox : [];
                                      
                                      setActiveCompId(comp.id.toString());
                                      if (pageArray.length > 0) handleGoToPdf(pageArray[0], bboxArray[0]);
                                    }}>
                                      Go to PDF
                                    </Button>
                                  </div>
                                </Space>
                              </Card>
                            </Col>
                          ))}
                        </Row>
                      </div>
                    )
                  }
                ]}
              />
            </Card>
          </Col>
        </Row>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .pdfViewer .page {
          position: relative;
        }
        .pdfViewer .page::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 45px; /* 헤더 가림 */
          background-color: white;
          z-index: 5;
          pointer-events: none;
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
          opacity: 0.2;
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
      `}</style>

      <Modal
        title={previewTitle}
        open={!!previewSvg}
        onCancel={() => setPreviewSvg(null)}
        footer={null}
        width={900}
      >
        {previewSvg ? (
          <div style={{ width: '100%', height: 600, background: '#fff', borderRadius: 8, border: `1px solid ${token.colorBorderSecondary}` }}>
            <SvgRenderer svg={previewSvg} />
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default PatentAnalysisDetail;
