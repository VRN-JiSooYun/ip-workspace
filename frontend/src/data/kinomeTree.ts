export type KinaseFamily = 'TK' | 'TKL' | 'STE' | 'CK1' | 'AGC' | 'CAMK' | 'CMGC' | 'Atypical' | 'Other';
export type KinomeLayoutId = 'coral-basetree';

export interface KinaseTreeNode {
  gene: string;
  family: KinaseFamily;
  x: number;
  y: number;
  labelDx?: number;
  labelDy?: number;
}

export interface KinomeLayout {
  id: KinomeLayoutId;
  viewBox: string;
  viewBoxRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  nodes: Record<string, KinaseTreeNode>;
}

const CORAL_MAIN_TREE_VIEWBOX = '200 0 610 620';

const coralBasetreeNodes: KinaseTreeNode[] = [
  { gene: 'FGFR3', family: 'TK', x: 374.333, y: 25.75, labelDy: -10 },
  { gene: 'KDR', family: 'TK', x: 392.459, y: 50.005, labelDy: -10 },
  { gene: 'RET', family: 'TK', x: 370.505, y: 61.833, labelDy: -10 },
  { gene: 'KIT', family: 'TK', x: 406.621, y: 58.126, labelDy: -10 },
  { gene: 'FLT3', family: 'TK', x: 400.469, y: 72.437, labelDy: -10 },
  { gene: 'MET', family: 'TK', x: 365.696, y: 82.73, labelDy: -10 },
  { gene: 'EGFR', family: 'TK', x: 414.416, y: 82.036, labelDy: -10 },
  { gene: 'YES', family: 'TK', x: 257.083, y: 83.117, labelDy: -10 },
  { gene: 'SRC', family: 'TK', x: 255.663, y: 89.356, labelDy: -10 },
  { gene: 'ALK', family: 'TK', x: 331.512, y: 94.564, labelDy: -10 },
  { gene: 'FYN', family: 'TK', x: 274.95, y: 103.803, labelDy: -10 },
  { gene: 'LCK', family: 'TK', x: 255.112, y: 114.796, labelDy: -10 },
  { gene: 'JAK2', family: 'TK', x: 445.37, y: 114.983, labelDy: -10 },
  { gene: 'SYK', family: 'TK', x: 364.58, y: 132.126, labelDy: -10 },
  { gene: 'BTK', family: 'TK', x: 263.855, y: 156.391, labelDy: -10 },
  { gene: 'ABL1', family: 'TK', x: 274.286, y: 178.808, labelDy: -10 },
  { gene: 'DDR1', family: 'TK', x: 325.667, y: 68.924, labelDy: -10 },
  { gene: 'RAF1', family: 'TKL', x: 542.98, y: 142.351, labelDy: -10 },
  { gene: 'BRAF', family: 'TKL', x: 548.574, y: 146.605, labelDy: -10 },
  { gene: 'IRAK4', family: 'TKL', x: 450.526, y: 196.328, labelDy: -10 },
  { gene: 'PAK1', family: 'STE', x: 601.76, y: 262.82, labelDy: -10 },
  { gene: 'MAP2K1', family: 'STE', x: 590.61, y: 279.735, labelDy: -10 },
  { gene: 'CDK5', family: 'CMGC', x: 270.87, y: 405.667, labelDy: -10 },
  { gene: 'CDK2', family: 'CMGC', x: 253.32, y: 424.766, labelDy: -10 },
  { gene: 'GSK3B', family: 'CMGC', x: 268.112, y: 308.728, labelDy: -10 },
  { gene: 'MAPK14', family: 'CMGC', x: 237.886, y: 374.28, labelDy: -10 },
  { gene: 'AKT1', family: 'AGC', x: 659.04, y: 413.048, labelDy: -10 },
  { gene: 'SGK1', family: 'AGC', x: 660.069, y: 422.009, labelDy: -10 },
  { gene: 'PKCA', family: 'AGC', x: 665.309, y: 473.7, labelDy: -10 },
  { gene: 'CAMK2A', family: 'CAMK', x: 511.325, y: 529.241, labelDy: -10 },
  { gene: 'CHEK1', family: 'CAMK', x: 448.6, y: 408.594, labelDy: -10 },
  { gene: 'CSNK1D', family: 'CK1', x: 601.316, y: 301.881, labelDy: -10 },
  { gene: 'AURKB', family: 'Other', x: 549.658, y: 371.685, labelDy: -10 },
  { gene: 'PLK1', family: 'Other', x: 549.658, y: 371.685, labelDy: -10 },
  { gene: 'RIOK1', family: 'Atypical', x: 747.516, y: 267.803, labelDx: -18, labelDy: -10 },
];

const toNodeMap = (nodes: KinaseTreeNode[]) => nodes.reduce<Record<string, KinaseTreeNode>>((map, node) => {
  map[node.gene] = node;
  return map;
}, {});

export const KINOME_LAYOUTS: Record<KinomeLayoutId, KinomeLayout> = {
  'coral-basetree': {
    id: 'coral-basetree',
    viewBox: CORAL_MAIN_TREE_VIEWBOX,
    viewBoxRect: { x: 200, y: 0, width: 610, height: 620 },
    nodes: toNodeMap(coralBasetreeNodes),
  },
};
