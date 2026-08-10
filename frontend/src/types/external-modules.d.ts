declare module 'fabric' {
  const fabric: any;
  export = fabric;
}

declare module 'react-pdf-highlighter-plus' {
  import * as React from 'react';

  export type Highlight = any;
  export type PdfHighlighterUtils = any;
  export type PdfDocumentSource = string | {
    url?: string;
    data?: any;
    [key: string]: any;
  };

  export const PdfLoader: React.FC<{
    document: PdfDocumentSource;
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

declare module '*.svg?raw' {
  const content: string;
  export default content;
}

declare module '*.csv?raw' {
  const content: string;
  export default content;
}

declare module '*.svg' {
  const src: string;
  export default src;
}

declare module '*.png' {
  const src: string;
  export default src;
}

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly BASE_URL: string;
  readonly VITE_API_URL?: string;
  readonly VITE_GROUPWARE_ORIGIN?: string;
  readonly VITE_RDKIT_API_URL?: string;
  readonly VITE_COMPOUND_SEARCH_API_URL?: string;
  readonly VITE_MONITORING_URL?: string;
  readonly VITE_CHEMDRAW_CLIPBOARD_FIXER_URL?: string;
  readonly VITE_GMAIL_ALLOWED_RECIPIENT_DOMAINS?: string;
  readonly VITE_AUTH_BYPASS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
