import React, { useEffect } from 'react';
import { PdfHighlighter, type PdfHighlighterUtils } from 'react-pdf-highlighter-plus';
import PatentPdfHighlightContainer from '../PatentPdfHighlightContainer';

type PatentPdfRendererProps = {
  pdfDocument: any;
  pdfTotalPages: number;
  activeBBox: { pageNumber: number; rect: number[] } | null;
  dynamicHighlights: any[];
  onPdfDocumentReady: (pdfDocument: any) => void;
  onPdfTotalPagesChange: (totalPages: number) => void;
  setHighlighterUtils: (utils: PdfHighlighterUtils) => void;
  onAddHighlight?: (highlight: any) => void;
};

const PatentPdfRenderer: React.FC<PatentPdfRendererProps> = ({
  pdfDocument,
  pdfTotalPages,
  activeBBox,
  dynamicHighlights,
  onPdfDocumentReady,
  onPdfTotalPagesChange,
  setHighlighterUtils,
  onAddHighlight,
}) => {
  useEffect(() => {
    onPdfDocumentReady(pdfDocument);
  }, [onPdfDocumentReady, pdfDocument]);

  useEffect(() => {
    const totalPages = Number(pdfDocument?.numPages ?? 0);
    if (totalPages !== pdfTotalPages) {
      onPdfTotalPagesChange(totalPages);
    }
  }, [onPdfTotalPagesChange, pdfDocument, pdfTotalPages]);

  useEffect(() => {
    if (activeBBox?.pageNumber) {
      // Library standard scrollTo or search handles page loading
    }
  }, [activeBBox?.pageNumber, pdfDocument]);

  return (
    <PdfHighlighter
      pdfDocument={pdfDocument}
      highlights={dynamicHighlights}
      utilsRef={setHighlighterUtils}
      pdfScaleValue="page-width"
      style={{ position: 'absolute', inset: 0, overflow: 'auto' }}
    >
      <PatentPdfHighlightContainer />
    </PdfHighlighter>
  );
};

export default PatentPdfRenderer;
