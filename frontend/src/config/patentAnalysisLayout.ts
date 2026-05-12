export type PatentAnalysisLayoutPreset = {
  maxWidth: number;
  sidePadding: number;
  defaultSplit: number;
};

export const PATENT_ANALYSIS_LAYOUT_PRESETS: PatentAnalysisLayoutPreset[] = [
  { maxWidth: 9999, sidePadding: 24, defaultSplit: 58 },  // 3200+ — 사실상 제한 없음
  { maxWidth: 9999, sidePadding: 20, defaultSplit: 56 },  // 2560+
  { maxWidth: 9999, sidePadding: 16, defaultSplit: 52 },  // 1920+
  { maxWidth: 1600, sidePadding: 16, defaultSplit: 50 }   // ~1920
];

export const getPatentAnalysisLayoutPreset = (viewportWidth: number): PatentAnalysisLayoutPreset => {
  if (viewportWidth >= 3200) return PATENT_ANALYSIS_LAYOUT_PRESETS[0];
  if (viewportWidth >= 2560) return PATENT_ANALYSIS_LAYOUT_PRESETS[1];
  if (viewportWidth >= 1920) return PATENT_ANALYSIS_LAYOUT_PRESETS[2];
  return PATENT_ANALYSIS_LAYOUT_PRESETS[3];
};

