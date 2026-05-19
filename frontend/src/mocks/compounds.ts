import exampleCompound1Svg from '../assets/mol_svg/example_compound1.svg?raw';
import exampleCompound2Svg from '../assets/mol_svg/example_compound2.svg?raw';
import exampleCompound3Svg from '../assets/mol_svg/example_compound3.svg?raw';
import exampleCompound4Svg from '../assets/mol_svg/example_compound4.svg?raw';

export interface CompoundGroup {
  id: string;
  name: string;
  type: 'my designs' | 'my compounds';
  count: number;
  creDate: string;
  target?: string;
  shareStatus?: '공유함' | '공유안함';
}

export interface SARData {
  enzyme?: {
    wt?: number;
    d1228n?: number;
    f1250k?: number;
    wt_f1250k?: number;
  };
  cell?: {
    naive?: number;
    fgfr3?: number;
    fgfr3_v555m?: number;
    rt112?: number;
    mkn45?: number;
  };
  ms?: { h?: number; m?: number; };
  ppb?: { h?: number; m?: number; };
  cyp?: { '1a2'?: number; '2c9'?: number; '2c19'?: number; '2d6'?: number; '3a4'?: number; };
  herg?: number;
  pk?: {
    dose?: number;
    plasma_1h?: number;
    plasma_4h?: number;
    lung_1h?: number;
    lung_4h?: number;
    brain_1h?: number;
    brain_4h?: number;
  };
}

export interface Compound {
  id: string;
  groupId: string;
  compoundId: string;
  name: string;
  source: string;
  smiles: string;
  structureSvg?: string;
  draw?: string;
  creDate: string;
  manager?: string;
  status?: string;
  project?: string;
  shareStatus?: string;
  designSource?: string;
  properties1?: number[];
  properties2?: number[];
  requiredCalcs?: string[];
  sar?: SARData;
}

export const mockGroups: CompoundGroup[] = [
  { id: 'g1', name: 'FGFR 나의 디자인', type: 'my designs', count: 11, creDate: '2026.04.20', target: 'FGFR', shareStatus: '공유함' },
  { id: 'g2', name: 'HER2 활성 증가', type: 'my designs', count: 17, creDate: '2026.04.18', target: 'HER2', shareStatus: '공유안함' },
  { id: 'g3', name: 'cMET Tepotinib 변형', type: 'my designs', count: 7, creDate: '2026.04.15', target: 'cMET', shareStatus: '공유함' },
];

export const mockCompounds: Compound[] = [
  {
    id: 'c1', groupId: 'g3', compoundId: 'VNA240137', name: 'VNA240137', source: 'Manual', smiles: 'CC(C)CC(C(=O)O)N', creDate: '2025.04.10', project: 'cMET', shareStatus: '내 물질', designSource: '내 머리',
    structureSvg: exampleCompound1Svg,
    sar: {
      enzyme: { wt: 0.22, d1228n: 0.19, f1250k: 0.07, wt_f1250k: 3.0 },
      cell: { naive: 10, fgfr3: 0.09, fgfr3_v555m: 0.1, rt112: 0.35, mkn45: 0.29 },
      ms: { h: 80.4, m: 37.8 },
      ppb: { h: 99.9, m: 99.9 },
      cyp: { '1a2': 98.7, '2c9': 100, '2c19': 100, '2d6': 91.5, '3a4': 83.7 },
      herg: 30,
      pk: { dose: 10, plasma_1h: 753.0, plasma_4h: 357.5, lung_4h: 385.9, brain_1h: 604.2, brain_4h: 1872.5 }
    },
    properties1: [100, 20, 40, 50],
    properties2: [80, 40, 60, 30],
    requiredCalcs: ['3D TPSA QM', 'Solubility QM']
  },
  {
    id: 'c2', groupId: 'g3', compoundId: 'VNA240138', name: 'VNA240138', source: 'Manual', smiles: 'CN(C)C(=O)C1=CC=CC=C1', creDate: '2025.03.21', project: 'cMET', shareStatus: '공유함', designSource: 'Patent',
    structureSvg: exampleCompound2Svg,
    sar: {
      enzyme: { wt: 0.02, d1228n: 0.35, f1250k: 0.17, wt_f1250k: 0.1 },
      cell: { naive: 5.42, fgfr3: 0.008, fgfr3_v555m: 0.04, rt112: 0.76, mkn45: 0.02 },
      ms: { h: 86.2, m: 83.4 },
      ppb: { h: 99.81, m: 9.99 },
      cyp: { '1a2': 99.9, '2c9': 100, '2c19': 100, '2d6': 94.5, '3a4': 62.8 },
      herg: 30,
      pk: { dose: 10, plasma_1h: 2537.0, plasma_4h: 1530.7, lung_1h: 2857.5, lung_4h: 1792.3, brain_1h: 1891.0, brain_4h: 3856.7 }
    },
    properties1: [60, 80, 30, 90],
    properties2: [40, 60, 80, 50],
    requiredCalcs: ['Solubility DL', 'E-Sol QM']
  },
  {
    id: 'c3', groupId: 'g3', compoundId: 'VNA240139', name: 'VNA240139', source: 'Manual', smiles: 'C1=CC=C(C=C1)S(=O)(=O)N', creDate: '2024.12.15', project: 'cMET', shareStatus: '공유받음', designSource: 'Paper',
    structureSvg: exampleCompound3Svg,
    sar: {
      enzyme: { wt: 1.25, d1228n: 0.99, f1250k: 0.03, wt_f1250k: 34.8 },
      cell: { naive: 10, fgfr3: 0.89, fgfr3_v555m: 0.65, rt112: 0.9, mkn45: 0 },
      ms: { h: 89.7, m: 79.8 },
      ppb: { h: 98.75, m: 99.99 },
      cyp: { '1a2': 83.9, '2c9': 93.4, '2c19': 22.5, '2d6': 14.1, '3a4': 100 },
      herg: 1.82,
      pk: { dose: 10, plasma_1h: 1094.5, plasma_4h: 1287.6, lung_1h: 1298.7, lung_4h: 1982.1, brain_4h: 150.8 }
    },
    properties1: [90, 30, 70, 40],
    properties2: [70, 50, 90, 60],
    requiredCalcs: ['Permeability MD', '특허성']
  },
  {
    id: 'c4', groupId: 'g3', compoundId: 'VNA240140', name: 'VNA240140', source: 'Manual', smiles: 'CC1=CC=C(C=C1)C(=O)N', creDate: '2025.01.28', project: 'cMET', shareStatus: '내 물질', designSource: 'FBDD',
    structureSvg: exampleCompound4Svg,
    sar: {
      enzyme: { wt: 0.48, d1228n: 0.42, f1250k: 0.12, wt_f1250k: 4.7 },
      cell: { naive: 8.5, fgfr3: 0.12, fgfr3_v555m: 0.18, rt112: 0.44, mkn45: 0.31 },
      ms: { h: 74.2, m: 68.9 },
      ppb: { h: 98.4, m: 97.2 },
      cyp: { '1a2': 88.5, '2c9': 96.1, '2c19': 91.7, '2d6': 84.3, '3a4': 79.2 },
      herg: 12.4,
      pk: { dose: 10, plasma_1h: 1412.3, plasma_4h: 822.8, lung_1h: 1188.2, lung_4h: 704.5, brain_1h: 420.4, brain_4h: 388.1 }
    },
    properties1: [75, 55, 65, 45],
    properties2: [68, 58, 72, 52],
    requiredCalcs: ['3D TPSA QM', '합성기능성']
  }
];
