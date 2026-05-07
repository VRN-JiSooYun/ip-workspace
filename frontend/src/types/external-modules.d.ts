declare module 'fabric' {
  const fabric: any;
  export = fabric;
}

declare module 'react-pdf-highlighter-plus' {
  import * as React from 'react';

  export type Highlight = any;
  export type PdfHighlighterUtils = any;

  export const PdfLoader: React.FC<{
    document: string;
    children: (pdfDocument: any) => React.ReactNode;
  }>;

  export const PdfHighlighter: React.FC<{
    pdfDocument: any;
    highlights?: any[];
    utilsRef?: (utils: any) => void;
    pdfScaleValue?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
  }>;

  export const TextHighlight: React.FC<any>;
  export const AreaHighlight: React.FC<any>;

  export function useHighlightContainerContext(): any;
  export function usePdfHighlighterContext(): any;
}

declare module 'pdfjs-dist' {
  export const GlobalWorkerOptions: {
    workerSrc: string;
  };
}

