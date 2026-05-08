import React from 'react';
import {
  AreaHighlight,
  TextHighlight,
  useHighlightContainerContext,
} from 'react-pdf-highlighter-plus';

const PatentPdfHighlightContainer: React.FC = () => {
  const { highlight, isScrolledTo, highlightBindings } = useHighlightContainerContext();

  const highlightId = String(highlight.id ?? '');
  const isUserAnnotation = highlightId.startsWith('user_highlight') || (highlight as any).type === 'user_annotation';
  const isCompoundActive = highlightId.startsWith('active_compound_highlight');
  const isSearchActive = highlightId.startsWith('active_search_highlight');
  const isSearchMatch = highlightId.startsWith('search_highlight');

  if (highlight.type === 'area') {
    // ... (tracing 로직 유지)
    
    const border = isSearchActive
      ? '3px solid rgba(120, 0, 0, 0.92)'
      : isCompoundActive
        ? '3px solid rgba(255, 0, 0, 0.9)'
        : isUserAnnotation
          ? '2px solid rgba(255, 200, 0, 0.8)'
          : isSearchMatch
            ? '2px solid rgba(217, 119, 6, 0.9)'
            : '3px solid rgba(255, 226, 143, 1)';
            
	    const backgroundColor = isSearchActive
	      ? 'rgba(255, 77, 79, 0.34)'
	      : isCompoundActive
	        ? 'transparent'
	        : isUserAnnotation
	          ? 'rgba(255, 226, 143, 0.3)'
          : isSearchMatch
            ? 'rgba(255, 214, 10, 0.34)'
            : 'rgba(255, 226, 143, 0.4)';

    return (
      <AreaHighlight
        highlight={highlight}
        isScrolledTo={isScrolledTo}
        bounds={highlightBindings.textLayer}
        onChange={() => {}}
        style={{
          border,
          backgroundColor,
          boxShadow: isSearchActive
            ? '0 0 0 3px rgba(255, 77, 79, 0.28), 0 0 18px rgba(255, 77, 79, 0.45)'
            : isUserAnnotation && isScrolledTo
              ? '0 0 0 2px rgba(255, 200, 0, 0.5)'
              : undefined,
          pointerEvents: isUserAnnotation ? 'auto' : 'none',
        }}
      />
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
