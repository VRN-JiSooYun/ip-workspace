export type RdkitDrawGlobalOptions = {
  atomLabelBlock: boolean;
  abbrevOption: 0 | 1 | 2;
  transparentBg: boolean;
  fixedBondLength: number;
  fontSize: number;
  fixedFontSize: number;
  lineWidth: number;
  padding: number;
  additionalAtomLabelPadding: number;
  multipleBondOffset: number;
  maxAbbrevCoverage: number;
  kekulize: boolean;
  boldfont: boolean;
  addStereoAnnotation: boolean;
};

export const RDKIT_DRAW_OPTIONS_STORAGE_KEY = 'voronoi:rdkit-draw-options:v1';
export const RDKIT_DRAW_OPTIONS_CHANGED_EVENT = 'voronoi:rdkit-draw-options-changed';

export const DEFAULT_RDKIT_DRAW_OPTIONS: RdkitDrawGlobalOptions = {
  atomLabelBlock: true,
  abbrevOption: 1,
  transparentBg: true,
  fixedBondLength: 42,
  fontSize: 12,
  fixedFontSize: 12,
  lineWidth: 5.5,
  padding: 0.05,
  additionalAtomLabelPadding: 0.05,
  multipleBondOffset: 0.25,
  maxAbbrevCoverage: 0.4,
  kekulize: true,
  boldfont: true,
  addStereoAnnotation: true,
};

export const readRdkitDrawOptions = (): RdkitDrawGlobalOptions => {
  if (typeof window === 'undefined') return DEFAULT_RDKIT_DRAW_OPTIONS;

  try {
    const raw = window.localStorage.getItem(RDKIT_DRAW_OPTIONS_STORAGE_KEY);
    if (!raw) return DEFAULT_RDKIT_DRAW_OPTIONS;
    return { ...DEFAULT_RDKIT_DRAW_OPTIONS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_RDKIT_DRAW_OPTIONS;
  }
};

export const writeRdkitDrawOptions = (options: RdkitDrawGlobalOptions) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(RDKIT_DRAW_OPTIONS_STORAGE_KEY, JSON.stringify(options));
  window.dispatchEvent(new CustomEvent(RDKIT_DRAW_OPTIONS_CHANGED_EVENT, { detail: options }));
};

export const resetRdkitDrawOptions = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(RDKIT_DRAW_OPTIONS_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(RDKIT_DRAW_OPTIONS_CHANGED_EVENT, { detail: DEFAULT_RDKIT_DRAW_OPTIONS }));
};

export const subscribeRdkitDrawOptionsChange = (listener: () => void) => {
  if (typeof window === 'undefined') return () => undefined;

  const handleChange = () => listener();
  window.addEventListener(RDKIT_DRAW_OPTIONS_CHANGED_EVENT, handleChange);

  return () => {
    window.removeEventListener(RDKIT_DRAW_OPTIONS_CHANGED_EVENT, handleChange);
  };
};

export const createRdkitDrawOptionPayload = (options: RdkitDrawGlobalOptions) => ({
  atomLabelBlock: options.atomLabelBlock,
  abbrev_option: options.abbrevOption,
  transparent_bg: options.transparentBg,
  fixed_bond_length: options.fixedBondLength,
  font_size: options.fontSize,
  fixed_font_size: options.fixedFontSize,
  line_width: options.lineWidth,
  padding: options.padding,
  additionalAtomLabelPadding: options.additionalAtomLabelPadding,
  multipleBondOffset: options.multipleBondOffset,
  max_abbrev_coverage: options.maxAbbrevCoverage,
  kekulize: options.kekulize,
  boldfont: options.boldfont,
  addStereoAnnotation: options.addStereoAnnotation,
});
