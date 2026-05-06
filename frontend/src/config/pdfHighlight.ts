const DEFAULT_PDF_HIGHLIGHT_SCALE = 0.36;

const PDF_HIGHLIGHT_SCALE_BY_PATENT: Record<string, number> = {
  // 필요 시 문서별 보정값을 추가합니다. 예: 'WO2026090333A1': 0.36
};

export const getPdfHighlightScale = (patentNumber?: string): number => {
  if (!patentNumber) return DEFAULT_PDF_HIGHLIGHT_SCALE;
  return PDF_HIGHLIGHT_SCALE_BY_PATENT[patentNumber] ?? DEFAULT_PDF_HIGHLIGHT_SCALE;
};

