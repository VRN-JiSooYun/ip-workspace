import type { Layout, LayoutItem, ResponsiveLayouts } from 'react-grid-layout';

export const PATENT_INSIGHT_LAYOUT_SCHEMA_VERSION = 1;

export const PATENT_INSIGHT_BREAKPOINTS = {
  lg: 1200,
  md: 996,
  sm: 768,
  xs: 480,
  xxs: 0,
} as const;

export const PATENT_INSIGHT_COLS = {
  lg: 64,
  md: 54,
  sm: 32,
  xs: 22,
  xxs: 11,
} as const;

export type PatentInsightBreakpoint = keyof typeof PATENT_INSIGHT_BREAKPOINTS;
export type PatentInsightTileId =
  | 'totalPatent'
  | 'filteredPatent'
  | 'patentAcrossTime'
  | 'patentPerOffice'
  | 'companyCount'
  | 'filingLanguageCount'
  | 'patentPerType'
  | 'targetApplicantHeatmap';

export type PatentInsightStoredGridItem = {
  i: PatentInsightTileId;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type PatentInsightLayouts = Record<PatentInsightBreakpoint, PatentInsightStoredGridItem[]>;

type PatentInsightStoredLayout = {
  schemaVersion: number;
  layouts: PatentInsightLayouts;
};

const BREAKPOINT_KEYS = Object.keys(PATENT_INSIGHT_BREAKPOINTS) as PatentInsightBreakpoint[];
const TILE_IDS: PatentInsightTileId[] = [
  'totalPatent',
  'filteredPatent',
  'patentAcrossTime',
  'patentPerOffice',
  'companyCount',
  'filingLanguageCount',
  'patentPerType',
  'targetApplicantHeatmap',
];

const TILE_ID_SET = new Set<string>(TILE_IDS);
const GRID_COLUMN_MARGIN = 12;
const METRIC_CARD_MIN_WIDTH = 240;

export const PATENT_INSIGHT_TILE_CONSTRAINTS: Record<PatentInsightTileId, {
  minW: number;
  minH: number;
}> = {
  totalPatent: { minW: 1, minH: 3 },
  filteredPatent: { minW: 1, minH: 3 },
  patentAcrossTime: { minW: 16, minH: 4 },
  patentPerOffice: { minW: 11, minH: 4 },
  companyCount: { minW: 11, minH: 4 },
  filingLanguageCount: { minW: 11, minH: 4 },
  patentPerType: { minW: 11, minH: 4 },
  targetApplicantHeatmap: { minW: 16, minH: 6 },
};

export const DEFAULT_PATENT_INSIGHT_LAYOUTS: PatentInsightLayouts = {
  lg: [
    { i: 'totalPatent', x: 0, y: 0, w: 1, h: 3 },
    { i: 'filteredPatent', x: 1, y: 0, w: 1, h: 3 },
    { i: 'patentAcrossTime', x: 0, y: 3, w: 43, h: 5 },
    { i: 'targetApplicantHeatmap', x: 43, y: 3, w: 21, h: 10 },
    { i: 'patentPerOffice', x: 0, y: 8, w: 21, h: 5 },
    { i: 'companyCount', x: 21, y: 8, w: 22, h: 5 },
    { i: 'filingLanguageCount', x: 0, y: 13, w: 21, h: 5 },
    { i: 'patentPerType', x: 21, y: 13, w: 22, h: 5 },
  ],
  md: [
    { i: 'totalPatent', x: 0, y: 0, w: 1, h: 3 },
    { i: 'filteredPatent', x: 1, y: 0, w: 1, h: 3 },
    { i: 'patentAcrossTime', x: 0, y: 3, w: 54, h: 5 },
    { i: 'patentPerOffice', x: 0, y: 8, w: 27, h: 5 },
    { i: 'companyCount', x: 27, y: 8, w: 27, h: 5 },
    { i: 'filingLanguageCount', x: 0, y: 13, w: 27, h: 5 },
    { i: 'patentPerType', x: 27, y: 13, w: 27, h: 5 },
    { i: 'targetApplicantHeatmap', x: 0, y: 18, w: 54, h: 9 },
  ],
  sm: [
    { i: 'totalPatent', x: 0, y: 0, w: 1, h: 3 },
    { i: 'filteredPatent', x: 1, y: 0, w: 1, h: 3 },
    { i: 'patentAcrossTime', x: 0, y: 3, w: 32, h: 5 },
    { i: 'patentPerOffice', x: 0, y: 8, w: 16, h: 5 },
    { i: 'companyCount', x: 16, y: 8, w: 16, h: 5 },
    { i: 'filingLanguageCount', x: 0, y: 13, w: 16, h: 5 },
    { i: 'patentPerType', x: 16, y: 13, w: 16, h: 5 },
    { i: 'targetApplicantHeatmap', x: 0, y: 18, w: 32, h: 9 },
  ],
  xs: [
    { i: 'totalPatent', x: 0, y: 0, w: 22, h: 3 },
    { i: 'filteredPatent', x: 0, y: 3, w: 22, h: 3 },
    { i: 'patentAcrossTime', x: 0, y: 6, w: 22, h: 5 },
    { i: 'patentPerOffice', x: 0, y: 11, w: 22, h: 5 },
    { i: 'companyCount', x: 0, y: 16, w: 22, h: 5 },
    { i: 'filingLanguageCount', x: 0, y: 21, w: 22, h: 5 },
    { i: 'patentPerType', x: 0, y: 26, w: 22, h: 5 },
    { i: 'targetApplicantHeatmap', x: 0, y: 31, w: 22, h: 9 },
  ],
  xxs: [
    { i: 'totalPatent', x: 0, y: 0, w: 11, h: 3 },
    { i: 'filteredPatent', x: 0, y: 3, w: 11, h: 3 },
    { i: 'patentAcrossTime', x: 0, y: 6, w: 11, h: 5 },
    { i: 'patentPerOffice', x: 0, y: 11, w: 11, h: 5 },
    { i: 'companyCount', x: 0, y: 16, w: 11, h: 5 },
    { i: 'filingLanguageCount', x: 0, y: 21, w: 11, h: 5 },
    { i: 'patentPerType', x: 0, y: 26, w: 11, h: 5 },
    { i: 'targetApplicantHeatmap', x: 0, y: 31, w: 11, h: 9 },
  ],
};

const cloneLayouts = (layouts: PatentInsightLayouts): PatentInsightLayouts => (
  BREAKPOINT_KEYS.reduce((result, breakpoint) => {
    result[breakpoint] = layouts[breakpoint].map((item) => ({ ...item }));
    return result;
  }, {} as PatentInsightLayouts)
);

const toFiniteInteger = (value: unknown): number | null => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.round(numericValue) : null;
};

export const normalizePatentInsightLayouts = (value: unknown): PatentInsightLayouts => {
  const source = value && typeof value === 'object'
    ? value as Partial<Record<PatentInsightBreakpoint, unknown>>
    : {};

  return BREAKPOINT_KEYS.reduce((result, breakpoint) => {
    const cols = PATENT_INSIGHT_COLS[breakpoint];
    const defaultItems = DEFAULT_PATENT_INSIGHT_LAYOUTS[breakpoint];
    const defaultById = new Map(defaultItems.map((item) => [item.i, item]));
    const seen = new Set<PatentInsightTileId>();
    const rawItems = Array.isArray(source[breakpoint]) ? source[breakpoint] : [];
    const normalizedItems: PatentInsightStoredGridItem[] = [];

    rawItems.forEach((rawItem) => {
      if (!rawItem || typeof rawItem !== 'object') return;
      const item = rawItem as Partial<PatentInsightStoredGridItem>;
      if (typeof item.i !== 'string' || !TILE_ID_SET.has(item.i) || seen.has(item.i as PatentInsightTileId)) return;

      const tileId = item.i as PatentInsightTileId;
      const fallback = defaultById.get(tileId);
      if (!fallback) return;
      const x = toFiniteInteger(item.x);
      const y = toFiniteInteger(item.y);
      const w = toFiniteInteger(item.w);
      const h = toFiniteInteger(item.h);
      if (x === null || y === null || w === null || h === null) return;

      const constraint = PATENT_INSIGHT_TILE_CONSTRAINTS[tileId];
      const minW = Math.min(cols, constraint.minW);
      const nextW = Math.min(cols, Math.max(minW, w));
      normalizedItems.push({
        i: tileId,
        x: Math.min(Math.max(0, x), Math.max(0, cols - nextW)),
        y: Math.min(200, Math.max(0, y)),
        w: nextW,
        h: Math.min(30, Math.max(constraint.minH, h)),
      });
      seen.add(tileId);
    });

    defaultItems.forEach((item) => {
      if (!seen.has(item.i)) normalizedItems.push({ ...item });
    });
    result[breakpoint] = normalizedItems;
    return result;
  }, {} as PatentInsightLayouts);
};

export const getDefaultPatentInsightLayouts = (): PatentInsightLayouts => (
  cloneLayouts(DEFAULT_PATENT_INSIGHT_LAYOUTS)
);

export const getPatentInsightLayoutStorageKey = (userId: string): string => (
  `patent-insight-grid-layout:${userId}:v${PATENT_INSIGHT_LAYOUT_SCHEMA_VERSION}`
);

export const readPatentInsightLayouts = (userId: string): PatentInsightLayouts => {
  if (typeof window === 'undefined') return getDefaultPatentInsightLayouts();
  try {
    const rawValue = window.localStorage.getItem(getPatentInsightLayoutStorageKey(userId));
    if (!rawValue) return getDefaultPatentInsightLayouts();
    const parsed = JSON.parse(rawValue) as Partial<PatentInsightStoredLayout>;
    if (parsed.schemaVersion !== PATENT_INSIGHT_LAYOUT_SCHEMA_VERSION) {
      return getDefaultPatentInsightLayouts();
    }
    return normalizePatentInsightLayouts(parsed.layouts);
  } catch {
    return getDefaultPatentInsightLayouts();
  }
};

export const writePatentInsightLayouts = (userId: string, layouts: PatentInsightLayouts): void => {
  const value: PatentInsightStoredLayout = {
    schemaVersion: PATENT_INSIGHT_LAYOUT_SCHEMA_VERSION,
    layouts: normalizePatentInsightLayouts(layouts),
  };
  window.localStorage.setItem(getPatentInsightLayoutStorageKey(userId), JSON.stringify(value));
};

export const removePatentInsightLayouts = (userId: string): void => {
  window.localStorage.removeItem(getPatentInsightLayoutStorageKey(userId));
};

export const getPatentInsightBreakpoint = (containerWidth: number): PatentInsightBreakpoint => (
  BREAKPOINT_KEYS.find(
    (breakpoint) => containerWidth >= PATENT_INSIGHT_BREAKPOINTS[breakpoint],
  ) ?? 'xxs'
);

const getMinColumnsForPixelWidth = (
  containerWidth: number,
  cols: number,
  pixelWidth: number,
): number => {
  const columnWidth = (containerWidth - GRID_COLUMN_MARGIN * (cols - 1)) / cols;
  if (columnWidth <= 0) return cols;
  return Math.min(
    cols,
    Math.max(1, Math.ceil((pixelWidth + GRID_COLUMN_MARGIN) / (columnWidth + GRID_COLUMN_MARGIN))),
  );
};

const resolveLayoutCollisionsDownward = (items: Layout): Layout => {
  const resolvedItems: LayoutItem[] = [];

  items.forEach((item) => {
    const nextItem = { ...item };
    let collision = resolvedItems.find((placedItem) => (
      nextItem.x < placedItem.x + placedItem.w &&
      nextItem.x + nextItem.w > placedItem.x &&
      nextItem.y < placedItem.y + placedItem.h &&
      nextItem.y + nextItem.h > placedItem.y
    ));

    while (collision) {
      nextItem.y = collision.y + collision.h;
      collision = resolvedItems.find((placedItem) => (
        nextItem.x < placedItem.x + placedItem.w &&
        nextItem.x + nextItem.w > placedItem.x &&
        nextItem.y < placedItem.y + placedItem.h &&
        nextItem.y + nextItem.h > placedItem.y
      ));
    }
    resolvedItems.push(nextItem);
  });

  return resolvedItems;
};

export const toReactGridLayouts = (
  layouts: PatentInsightLayouts,
  containerWidth?: number,
): ResponsiveLayouts<PatentInsightBreakpoint> => {
  const activeBreakpoint = containerWidth === undefined
    ? null
    : getPatentInsightBreakpoint(containerWidth);

  return BREAKPOINT_KEYS.reduce((result, breakpoint) => {
    const cols = PATENT_INSIGHT_COLS[breakpoint];
    const convertedItems = layouts[breakpoint].map((item): LayoutItem => {
      const constraint = PATENT_INSIGHT_TILE_CONSTRAINTS[item.i];
      const metricMinW = activeBreakpoint === breakpoint &&
        (item.i === 'totalPatent' || item.i === 'filteredPatent') &&
        containerWidth !== undefined
        ? getMinColumnsForPixelWidth(containerWidth, cols, METRIC_CARD_MIN_WIDTH)
        : 0;
      const minW = Math.min(cols, Math.max(constraint.minW, metricMinW));
      return {
        ...item,
        w: Math.max(item.w, minW),
        minW,
        minH: constraint.minH,
      };
    });
    const totalPatent = convertedItems.find((item) => item.i === 'totalPatent');
    const filteredPatent = convertedItems.find((item) => item.i === 'filteredPatent');
    if (totalPatent && filteredPatent && totalPatent.y === filteredPatent.y) {
      const totalPatentRight = totalPatent.x + totalPatent.w;
      const cardsOverlap = filteredPatent.x < totalPatentRight &&
        filteredPatent.x + filteredPatent.w > totalPatent.x;
      if (cardsOverlap && totalPatentRight + filteredPatent.w <= cols) {
        filteredPatent.x = totalPatentRight;
      }
    }
    result[breakpoint] = resolveLayoutCollisionsDownward(convertedItems);
    return result;
  }, {} as Record<PatentInsightBreakpoint, Layout>);
};

export const fromReactGridLayouts = (
  layouts: ResponsiveLayouts<PatentInsightBreakpoint>,
): PatentInsightLayouts => normalizePatentInsightLayouts(layouts);
