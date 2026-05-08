import React from 'react';
import { Card } from 'antd';
import { PdfLoader } from 'react-pdf-highlighter-plus';
import type { PdfHighlighterUtils } from 'react-pdf-highlighter-plus';
import * as pdfjs from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import PatentPdfRenderer from './Viewer/PatentPdfRenderer';
import PdfSidebar from './Sidebar/PdfSidebar';
import './patentPdfViewer.css';

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

type PatentPdfViewerProps = {
  document: string;
  rotation: number;
  viewerContainerRef: React.RefObject<HTMLDivElement | null>;
  pdfTotalPages: number;
  activeBBox: { pageNumber: number; rect: number[] } | null;
  dynamicHighlights: any[];
  userHighlights: any[];
  onPdfDocumentReady: (pdfDocument: any) => void;
  onPdfTotalPagesChange: (totalPages: number) => void;
  setHighlighterUtils: (utils: PdfHighlighterUtils) => void;
  backgroundColor: string;
  borderColor: string;
  // New handlers for highlights
  onAddHighlight?: (highlight: any) => void;
  onDeleteHighlight?: (id: string) => void;
  onScrollToHighlight?: (highlight: any) => void;
};

const PatentPdfViewer: React.FC<PatentPdfViewerProps> = ({
  document,
  rotation,
  viewerContainerRef,
  pdfTotalPages,
  activeBBox,
  dynamicHighlights,
  userHighlights,
  onPdfDocumentReady,
  onPdfTotalPagesChange,
  setHighlighterUtils,
  backgroundColor,
  borderColor,
  onAddHighlight,
  onDeleteHighlight,
  onScrollToHighlight,
}) => {
  return (
    <Card
      style={{
        flex: 1,
        borderRadius: '16px',
        background: backgroundColor,
        border: `1px solid ${borderColor}`,
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
      styles={{
        body: {
          flex: 1,
          padding: 0,
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          flexDirection: 'row', // Change to row to accommodate sidebar
        },
      }}
    >
      {/* PDF View Area */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <div
            ref={viewerContainerRef}
            style={{
              height: '100%',
              width: '100%',
              transform: `rotate(${rotation}deg)`,
              transformOrigin: 'center center',
              transition: 'transform 0.2s ease',
            }}
          >
            <PdfLoader document={document}>
              {(pdfDocument: any) => (
                <PatentPdfRenderer
                  pdfDocument={pdfDocument}
                  pdfTotalPages={pdfTotalPages}
                  activeBBox={activeBBox}
                  dynamicHighlights={dynamicHighlights}
                  onPdfDocumentReady={onPdfDocumentReady}
                  onPdfTotalPagesChange={onPdfTotalPagesChange}
                  setHighlighterUtils={setHighlighterUtils}
                  onAddHighlight={onAddHighlight}
                />
              )}
            </PdfLoader>
          </div>
        </div>
      </div>

      {/* Sidebar for highlights */}
      <PdfSidebar
        highlights={userHighlights}
        onScrollToHighlight={(h) => onScrollToHighlight?.(h)}
        onDeleteHighlight={(id) => onDeleteHighlight?.(id)}
        backgroundColor={backgroundColor}
        borderColor={borderColor}
      />
    </Card>
  );
};

export default PatentPdfViewer;
