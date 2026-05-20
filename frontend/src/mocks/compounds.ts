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
  designNo?: string;
  designMemo?: string;
  requiredAmountMg?: number;
  assayPurpose?: string;
  expectedEffect?: string;
  requestDate?: string;
  synthesisExpansionLevel?: string;
  requestMemo?: string;
  synthesisOwner?: string;
  synthesisAcceptedDate?: string;
  synthesisTargetDate?: string;
  progressMemo?: string;
  isCompleted?: boolean;
  registeredDate?: string;
  researchNote?: string;
  reportData?: string;
  synthesisEndReason?: string;
  sar?: SARData;
}

export const mockGroups: CompoundGroup[] = [
  { id: 'g1', name: 'FGFR 나의 디자인', type: 'my designs', count: 11, creDate: '2026.04.20', target: 'FGFR', shareStatus: '공유함' },
  { id: 'g2', name: 'HER2 활성 증가', type: 'my designs', count: 17, creDate: '2026.04.18', target: 'HER2', shareStatus: '공유안함' },
  { id: 'g3', name: 'cMET Tepotinib 변형', type: 'my designs', count: 7, creDate: '2026.04.15', target: 'cMET', shareStatus: '공유함' },
];

const structureSvgs = [exampleCompound1Svg, exampleCompound2Svg, exampleCompound3Svg, exampleCompound4Svg];
const designSources = ['내 머리', '동료 머리', 'Patent', 'Paper', 'FBDD', 'ELN'];
const synthesisOwners = ['문태훈', '윤지수', '김서연', '박도현'];

const createSarData = (seed: number): SARData => ({
  enzyme: {
    wt: Number((0.04 + (seed % 7) * 0.13).toFixed(2)),
    d1228n: Number((0.07 + (seed % 5) * 0.16).toFixed(2)),
    f1250k: Number((0.03 + (seed % 6) * 0.05).toFixed(2)),
    wt_f1250k: Number((0.4 + (seed % 8) * 2.7).toFixed(1)),
  },
  cell: {
    naive: Number((2.5 + (seed % 6) * 1.4).toFixed(2)),
    fgfr3: Number((0.01 + (seed % 9) * 0.08).toFixed(3)),
    fgfr3_v555m: Number((0.03 + (seed % 7) * 0.09).toFixed(2)),
    rt112: Number((0.18 + (seed % 5) * 0.14).toFixed(2)),
    mkn45: Number((0.05 + (seed % 6) * 0.11).toFixed(2)),
  },
  ms: { h: 70 + (seed % 8) * 3, m: 42 + (seed % 7) * 6 },
  ppb: { h: 96 + (seed % 4), m: 88 + (seed % 10) },
  cyp: {
    '1a2': 75 + (seed % 20),
    '2c9': 80 + (seed % 18),
    '2c19': 65 + (seed % 30),
    '2d6': 58 + (seed % 35),
    '3a4': 70 + (seed % 25),
  },
  herg: Number((2 + (seed % 10) * 2.8).toFixed(1)),
  pk: {
    dose: 10,
    plasma_1h: 520 + seed * 37,
    plasma_4h: 260 + seed * 24,
    lung_1h: 410 + seed * 31,
    lung_4h: 180 + seed * 19,
    brain_1h: 120 + seed * 16,
    brain_4h: 90 + seed * 13,
  },
});

const createMockCompound = (
  seed: number,
  groupId: string,
  project: string,
  designNoPrefix: string,
  memoBase: string,
): Compound => {
  const dateDay = String((seed % 24) + 1).padStart(2, '0');
  const source = designSources[seed % designSources.length];
  const isCompleted = seed % 5 === 0;

  return {
    id: `c${seed}`,
    groupId,
    compoundId: `VNA240${String(140 + seed).padStart(3, '0')}`,
    name: `VNA240${String(140 + seed).padStart(3, '0')}`,
    source: 'Manual',
    smiles: [
      'CCN(CC)C(=O)C1=CC=CC=C1',
      'COC1=CC=C(NC(=O)C2CC2)C=C1',
      'CC1=NC=C(C=C1)C(=O)N2CCOCC2',
      'CN1CCN(CC1)C2=NC=CC=N2',
      'CCOC(=O)N1CCC(CC1)C2=CC=CC=C2',
    ][seed % 5],
    structureSvg: structureSvgs[seed % structureSvgs.length],
    creDate: `2026.04.${dateDay}`,
    manager: synthesisOwners[seed % synthesisOwners.length],
    status: isCompleted ? '합성완료' : seed % 3 === 0 ? '합성중' : '디자인',
    project,
    shareStatus: seed % 4 === 0 ? '공유받음' : seed % 3 === 0 ? '공유함' : '내 물질',
    designSource: source,
    properties1: [45 + (seed % 5) * 8, 35 + (seed % 7) * 7, 50 + (seed % 6) * 6, 42 + (seed % 8) * 5],
    properties2: [52 + (seed % 6) * 6, 40 + (seed % 5) * 9, 48 + (seed % 7) * 6, 38 + (seed % 6) * 7],
    requiredCalcs: seed % 2 === 0 ? ['3D TPSA QM', 'Solubility QM'] : ['Permeability MD', '특허성'],
    designNo: `${designNoPrefix}-${String(seed).padStart(3, '0')}`,
    designMemo: `${memoBase} - ${source} 기반 ${seed % 2 === 0 ? '극성 조정' : '치환기 확장'} 후보`,
    requiredAmountMg: 10 + (seed % 5) * 5,
    assayPurpose: `${project} 활성 및 ADME profile 확인`,
    expectedEffect: seed % 2 === 0 ? '세포 활성 유지 및 용해도 개선' : 'selectivity 개선 및 hERG risk 감소',
    requestDate: `2026.05.${String((seed % 18) + 1).padStart(2, '0')}`,
    synthesisExpansionLevel: seed % 3 === 0 ? '상' : seed % 3 === 1 ? '중' : '하',
    requestMemo: seed % 2 === 0 ? '우선 합성 후보' : '후속 SAR 확인용',
    synthesisOwner: synthesisOwners[seed % synthesisOwners.length],
    synthesisAcceptedDate: `2026.05.${String((seed % 18) + 2).padStart(2, '0')}`,
    synthesisTargetDate: `2026.06.${String((seed % 20) + 1).padStart(2, '0')}`,
    progressMemo: isCompleted ? '합성 완료, 분석 등록' : seed % 3 === 0 ? '중간체 확보' : 'route 검토 중',
    isCompleted,
    registeredDate: `2026.05.${String((seed % 18) + 2).padStart(2, '0')}`,
    researchNote: `ELN-2026-${String(60 + seed).padStart(3, '0')}`,
    reportData: isCompleted ? 'HPLC/NMR 확인' : '예상 MS 등록',
    synthesisEndReason: isCompleted ? '목표 물질 확보' : '-',
    sar: createSarData(seed),
  };
};

export const mockCompounds: Compound[] = [
  ...Array.from({ length: 11 }, (_, index) =>
    createMockCompound(index + 5, 'g1', 'FGFR', 'D-FGFR', 'FGFR hinge binder SAR')
  ),
  ...Array.from({ length: 17 }, (_, index) =>
    createMockCompound(index + 16, 'g2', 'HER2', 'D-HER2', 'HER2 활성 증가 scaffold')
  ),
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
    requiredCalcs: ['3D TPSA QM', 'Solubility QM'],
    designNo: 'D-cMET-001',
    designMemo: 'Tepotinib hinge binder 변형안',
    requiredAmountMg: 20,
    assayPurpose: 'cMET wt 활성 개선',
    expectedEffect: '세포 활성 2배 개선',
    requestDate: '2026.05.02',
    synthesisExpansionLevel: '중',
    requestMemo: '우선 합성 후보',
    synthesisOwner: '문태훈',
    synthesisAcceptedDate: '2026.05.03',
    synthesisTargetDate: '2026.05.24',
    progressMemo: '중간체 확보',
    isCompleted: false,
    registeredDate: '2026.05.03',
    researchNote: 'ELN-2026-051',
    reportData: 'LCMS 확인',
    synthesisEndReason: '-'
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
    requiredCalcs: ['Solubility DL', 'E-Sol QM'],
    designNo: 'D-cMET-002',
    designMemo: '특허 예시 구조 기반 극성 조정',
    requiredAmountMg: 15,
    assayPurpose: '용해도 개선 후 활성 유지',
    expectedEffect: 'Solubility risk 감소',
    requestDate: '2026.05.04',
    synthesisExpansionLevel: '하',
    requestMemo: '소량 스크리닝',
    synthesisOwner: '윤지수',
    synthesisAcceptedDate: '2026.05.05',
    synthesisTargetDate: '2026.05.21',
    progressMemo: 'route 검토 중',
    isCompleted: false,
    registeredDate: '2026.05.05',
    researchNote: 'ELN-2026-052',
    reportData: '예상 MS 등록',
    synthesisEndReason: '-'
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
    requiredCalcs: ['Permeability MD', '특허성'],
    designNo: 'D-cMET-003',
    designMemo: 'sulfonamide linker SAR 확인',
    requiredAmountMg: 30,
    assayPurpose: 'selectivity profile 확인',
    expectedEffect: 'off-target 감소',
    requestDate: '2026.05.06',
    synthesisExpansionLevel: '상',
    requestMemo: '유도체 확장 가능성 확인',
    synthesisOwner: '문태훈',
    synthesisAcceptedDate: '2026.05.07',
    synthesisTargetDate: '2026.05.29',
    progressMemo: '1단계 반응 완료',
    isCompleted: false,
    registeredDate: '2026.05.07',
    researchNote: 'ELN-2026-053',
    reportData: 'NMR 예정',
    synthesisEndReason: '-'
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
    requiredCalcs: ['3D TPSA QM', '합성기능성'],
    designNo: 'D-cMET-004',
    designMemo: 'fragment merge 후보',
    requiredAmountMg: 10,
    assayPurpose: 'early FBDD hit validation',
    expectedEffect: 'binding efficiency 개선',
    requestDate: '2026.05.08',
    synthesisExpansionLevel: '중',
    requestMemo: '후속 docking 결과 대기',
    synthesisOwner: '윤지수',
    synthesisAcceptedDate: '2026.05.09',
    synthesisTargetDate: '2026.05.23',
    progressMemo: '합성 완료, 정제 중',
    isCompleted: true,
    registeredDate: '2026.05.09',
    researchNote: 'ELN-2026-054',
    reportData: 'HPLC purity 97%',
    synthesisEndReason: '목표 물질 확보'
  },
  ...Array.from({ length: 3 }, (_, index) =>
    createMockCompound(index + 33, 'g3', 'cMET', 'D-cMET', 'Tepotinib 변형 SAR')
  ),
];
