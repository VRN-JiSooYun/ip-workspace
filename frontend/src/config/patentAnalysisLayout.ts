export type PatentAnalysisLayoutPreset = {
  maxWidth: number;
  sidePadding: number;
  defaultSplit: number;
};

export const PATENT_ANALYSIS_LAYOUT_PRESETS: PatentAnalysisLayoutPreset[] = [
  { maxWidth: 2560, sidePadding: 32, defaultSplit: 58 },
  { maxWidth: 2240, sidePadding: 28, defaultSplit: 56 },
  { maxWidth: 1920, sidePadding: 24, defaultSplit: 52 },
  { maxWidth: 1600, sidePadding: 24, defaultSplit: 50 }
];

export const getPatentAnalysisLayoutPreset = (viewportWidth: number): PatentAnalysisLayoutPreset => {
  if (viewportWidth >= 3200) return PATENT_ANALYSIS_LAYOUT_PRESETS[0];
  if (viewportWidth >= 2560) return PATENT_ANALYSIS_LAYOUT_PRESETS[1];
  if (viewportWidth >= 1920) return PATENT_ANALYSIS_LAYOUT_PRESETS[2];
  return PATENT_ANALYSIS_LAYOUT_PRESETS[3];
};

