import React from 'react';
import {
  AreaHighlight,
  TextHighlight,
  useHighlightContainerContext,
} from 'react-pdf-highlighter-plus';

type PatentPdfHighlightContainerProps = {
  onHighlightClick?: (highlight: any) => void;
};

const PatentPdfHighlightContainer: React.FC<PatentPdfHighlightContainerProps> = ({ onHighlightClick }) => {
  const { highlight, isScrolledTo, highlightBindings } = useHighlightContainerContext();

  const highlightId = String(highlight.id ?? '');
  const isUserAnnotation = highlightId.startsWith('user_highlight') || (highlight as any).type === 'user_annotation';
  const isCompoundActive = highlightId.startsWith('active_compound_highlight');
  const isDataBbox = highlightId.startsWith('raw_data_bbox_');
  const isDataBboxSelected = isDataBbox && Boolean((highlight as any).source?.selected);
  const isSearchActive = highlightId.startsWith('active_search_highlight');
  const isSearchMatch = highlightId.startsWith('search_highlight');
  const isClickableHighlight = Boolean(onHighlightClick && (isCompoundActive || isDataBbox));
  const highlightSource = (highlight as any).source;
  const highlightCenterKey = highlightSource?.pageNumber && Array.isArray(highlightSource?.rect)
    ? `${highlightSource.pageNumber}:${highlightSource.rect.map(Number).join(',')}`
    : undefined;

  if (highlight.type === 'area') {
    // ... (tracing 로직 유지)
    
    const border = isSearchActive
      ? '3px solid rgba(120, 0, 0, 0.92)'
      : isCompoundActive
        ? '3px solid rgba(255, 0, 0, 0.9)'
        : isDataBboxSelected
          ? '3px solid rgba(255, 0, 0, 0.92)'
        : isDataBbox
          ? '2px solid rgba(24, 144, 255, 0.78)'
          : isUserAnnotation
          ? '2px solid rgba(255, 200, 0, 0.8)'
          : isSearchMatch
            ? '2px solid rgba(217, 119, 6, 0.9)'
            : '3px solid rgba(255, 226, 143, 1)';
            
	    const backgroundColor = isSearchActive
	      ? 'rgba(255, 77, 79, 0.34)'
	      : isCompoundActive
	        ? 'transparent'
	        : isDataBboxSelected
            ? 'rgba(255, 0, 0, 0.08)'
	        : isDataBbox
            ? 'rgba(24, 144, 255, 0.12)'
            : isUserAnnotation
	          ? 'rgba(255, 226, 143, 0.3)'
          : isSearchMatch
            ? 'rgba(255, 214, 10, 0.34)'
            : 'rgba(255, 226, 143, 0.4)';

    const areaHighlightProps = {
      highlight,
      isScrolledTo,
      bounds: highlightBindings.textLayer,
      onChange: () => {},
      style: {
        border,
        backgroundColor,
        boxShadow: isSearchActive
          ? '0 0 0 3px rgba(255, 77, 79, 0.28), 0 0 18px rgba(255, 77, 79, 0.45)'
          : isUserAnnotation && isScrolledTo
            ? '0 0 0 2px rgba(255, 200, 0, 0.5)'
            : undefined,
        // 클릭은 별도 오버레이가 전담하므로 AreaHighlight(Rnd)는 이벤트를 받지 않게 한다.
        pointerEvents: isUserAnnotation ? 'auto' : 'none',
        cursor: isClickableHighlight ? 'pointer' : undefined,
      },
    };

    const areaHighlight = <AreaHighlight {...areaHighlightProps} />;

    if (!isClickableHighlight) {
      return areaHighlight;
    }

    // AreaHighlight는 내부적으로 Rnd(드래그/리사이즈) 컴포넌트라 클릭이 버블링되지 않을 수 있다.
    // bbox 좌표로 직접 크기를 잡은 투명 오버레이를 얹어 클릭을 확실히 받는다.
    // 라이브러리는 position.boundingRect를 이미 렌더 뷰포트 픽셀(left/top/width/height)로 변환해 넘겨준다.
    const boundingRect = (highlight as any)?.position?.boundingRect;
    const rectLeft = Number(boundingRect?.left ?? boundingRect?.x1);
    const rectTop = Number(boundingRect?.top ?? boundingRect?.y1);
    const rectWidth = Number(
      boundingRect?.width ?? (Number(boundingRect?.x2) - Number(boundingRect?.x1)),
    );
    const rectHeight = Number(
      boundingRect?.height ?? (Number(boundingRect?.y2) - Number(boundingRect?.y1)),
    );

    const canComputeOverlay =
      [rectLeft, rectTop, rectWidth, rectHeight].every(Number.isFinite) &&
      rectWidth > 0 &&
      rectHeight > 0;

    const handleClick = (event: React.MouseEvent) => {
      event.stopPropagation();
      onHighlightClick?.(highlight);
    };

    if (!canComputeOverlay) {
      // 좌표 환산이 불가능하면 기존 방식(버블링)으로 폴백.
      return (
        <div
          className="patent-pdf-clickable-highlight"
          data-pdf-highlight-center-key={highlightCenterKey}
          onClick={handleClick}
          style={{ display: 'contents', pointerEvents: 'auto' }}
        >
          {areaHighlight}
        </div>
      );
    }

    const overlayStyle: React.CSSProperties = {
      position: 'absolute',
      left: rectLeft,
      top: rectTop,
      width: rectWidth,
      height: rectHeight,
      pointerEvents: 'auto',
      cursor: 'pointer',
      zIndex: 5,
      background: 'transparent',
    };

    return (
      <>
        {areaHighlight}
        <div
          className="patent-pdf-clickable-highlight"
          data-pdf-highlight-center-key={highlightCenterKey}
          onClick={handleClick}
          style={overlayStyle}
        />
      </>
    );
  }

  return (
    <TextHighlight
      highlight={highlight}
      isScrolledTo={isScrolledTo}
      style={{ 
        background: isUserAnnotation ? 'rgba(255, 226, 143, 0.5)' : 'rgba(248, 124, 99, 0.3)', 
        borderRadius: '4px' 
      }}
    />
  );
};

export default PatentPdfHighlightContainer;
