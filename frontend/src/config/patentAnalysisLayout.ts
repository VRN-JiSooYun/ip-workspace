export type PatentAnalysisLayoutPreset = {
  maxWidth: number;
  sidePadding: number;
  defaultSplit: number;
};

export const PATENT_ANALYSIS_LAYOUT_PRESETS: PatentAnalysisLayoutPreset[] = [
  { maxWidth: 9999, sidePadding: 16, defaultSplit: 45 },  // 3200+ — PDF 45%, 탭 55%
  { maxWidth: 9999, sidePadding: 16, defaultSplit: 45 },  // 2560+ — PDF 45%, 탭 55%
  { maxWidth: 9999, sidePadding: 16, defaultSplit: 45 },  // 1920+ — PDF 45%, 탭 55%
  { maxWidth: 9999, sidePadding: 16, defaultSplit: 45 }   // ~1920 — PDF 45%, 탭 55%
];

export const getPatentAnalysisLayoutPreset = (viewportWidth: number): PatentAnalysisLayoutPreset => {
  if (viewportWidth >= 3200) return PATENT_ANALYSIS_LAYOUT_PRESETS[0];
  if (viewportWidth >= 2560) return PATENT_ANALYSIS_LAYOUT_PRESETS[1];
  if (viewportWidth >= 1920) return PATENT_ANALYSIS_LAYOUT_PRESETS[2];
  return PATENT_ANALYSIS_LAYOUT_PRESETS[3];
};
