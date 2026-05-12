import React from 'react';
import { Card } from 'antd';
import { PdfLoader } from 'react-pdf-highlighter-plus';
import type { PdfHighlighterUtils } from 'react-pdf-highlighter-plus';
import * as pdfjs from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import PatentPdfRenderer from './Viewer/PatentPdfRenderer';
import './patentPdfViewer.css';

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;
if (typeof window !== 'undefined' && (window as any).pdfjsLib?.GlobalWorkerOptions) {
  (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

type PatentPdfViewerProps = {
  document: string;
  rotation: number;
  viewerContainerRef: React.RefObject<HTMLDivElement>;
  pdfTotalPages: number;
  activeBBox: { pageNumber: number; rect: number[] } | null;
  dynamicHighlights: any[];
  userHighlights: any[];
  onPdfDocumentReady: (pdfDocument: any) => void;
  onPdfTotalPagesChange: (totalPages: number) => void;
  setHighlighterUtils: (utils: PdfHighlighterUtils) => void;
  backgroundColor: string;
  borderColor: string;
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
  onPdfDocumentReady,
  onPdfTotalPagesChange,
  setHighlighterUtils,
  backgroundColor,
  borderColor,
  onAddHighlight,
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
          flexDirection: 'column',
        },
      }}
    >
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
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
    </Card>
  );
};

export default PatentPdfViewer;
