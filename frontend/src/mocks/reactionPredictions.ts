import exampleCompound1Svg from '../assets/mol_svg/example_compound1.svg?raw';
import exampleCompound2Svg from '../assets/mol_svg/example_compound2.svg?raw';
import exampleCompound3Svg from '../assets/mol_svg/example_compound3.svg?raw';
import exampleCompound4Svg from '../assets/mol_svg/example_compound4.svg?raw';

export type ReactionType = 'oa' | 'snar';
export type ReactionPredictionStatus = 'completed' | 'calculating' | 'failed';

export interface ReactionSite {
  site: string;
  leavingGroup: string;
  enabled: boolean;
  deltaG?: number;
}

export interface ConfidenceCheck {
  label: string;
  status: 'pass' | 'review' | 'fail';
  detail: string;
}

export interface ConfidenceReport {
  score: number;
  verdict: 'high' | 'medium' | 'low';
  checks: ConfidenceCheck[];
}

export interface ReactionFactor {
  label: string;
  detail: string;
  value: number;
  color: string;
}

export interface ReactionPredictionRow {
  id: string;
  name: string;
  smiles: string;
  moleculeSvg: string;
  reactionType: ReactionType;
  majorSite: string;
  leavingGroup: string;
  deltaDeltaG: number | null;
  status: ReactionPredictionStatus;
  startDate: string;
  endDate?: string;
  sites: ReactionSite[];
  confidence?: ConfidenceReport;
  factors?: ReactionFactor[];
}

export const mockReactionPredictions: ReactionPredictionRow[] = [
  {
    id: 'rp-001',
    name: 'Tri-bromo',
    smiles: 'Brc1n[nH]c(Br)c1Br',
    moleculeSvg: exampleCompound1Svg,
    reactionType: 'oa',
    majorSite: 'C5-Br',
    leavingGroup: 'Br',
    deltaDeltaG: 5.2,
    status: 'completed',
    startDate: '26.05.12 13:01',
    endDate: '26.05.12 13:16',
    sites: [
      { site: 'C3', leavingGroup: 'Br', enabled: true, deltaG: 22.8 },
      { site: 'C4', leavingGroup: 'Br', enabled: true, deltaG: 25.4 },
      { site: 'C5', leavingGroup: 'Br', enabled: true, deltaG: 17.6 },
    ],
    confidence: {
      score: 78,
      verdict: 'high',
      checks: [
        { label: 'LG domain', status: 'pass', detail: 'Ar-Cl/Ar-Br in scope' },
        { label: 'Descriptor range', status: 'pass', detail: 'ESP / BSI within training range' },
        { label: 'ΔΔG margin', status: 'pass', detail: '6.5 kJ/mol > model MAE' },
        { label: 'Conformer sensitivity', status: 'review', detail: 'Small but present' },
        { label: 'Known failure motif', status: 'pass', detail: 'No isothiazole flag' },
      ],
    },
    factors: [
      { label: 'ESP1', detail: 'Reactive carbon is more electrophilic', value: 42, color: '#2F80ED' },
      { label: 'ESP2', detail: 'Adjacent heteroatom stabilizes polarized TS', value: 19, color: '#00A889' },
      { label: 'Steric', detail: 'Competing site has larger local A-value', value: 6, color: '#F2994A' },
      { label: 'LG term', detail: 'Br/Cl terms included by BSI + pKa', value: 34, color: '#7C3AED' },
    ],
  },
  {
    id: 'rp-002',
    name: 'OA-028',
    smiles: 'Clc1ncc(Br)cn1',
    moleculeSvg: exampleCompound2Svg,
    reactionType: 'oa',
    majorSite: 'C2-Cl',
    leavingGroup: 'Cl',
    deltaDeltaG: 10.0,
    status: 'completed',
    startDate: '26.05.13 09:26',
    endDate: '26.05.13 09:45',
    sites: [
      { site: 'C2', leavingGroup: 'Cl', enabled: true, deltaG: 18.2 },
      { site: 'C4', leavingGroup: 'Br', enabled: true, deltaG: 28.2 },
    ],
    confidence: {
      score: 78,
      verdict: 'high',
      checks: [
        { label: 'LG domain', status: 'pass', detail: 'Ar-Cl/Ar-Br in scope' },
        { label: 'Descriptor range', status: 'pass', detail: 'ESP / BSI within training range' },
        { label: 'ΔΔG margin', status: 'pass', detail: '6.5 kJ/mol > model MAE' },
        { label: 'Conformer sensitivity', status: 'review', detail: 'Small but present' },
        { label: 'Known failure motif', status: 'pass', detail: 'No isothiazole flag' },
      ],
    },
    factors: [
      { label: 'ESP1', detail: 'Reactive carbon is more electrophilic', value: 42, color: '#2F80ED' },
      { label: 'ESP2', detail: 'Adjacent heteroatom stabilizes polarized TS', value: 19, color: '#00A889' },
      { label: 'Steric', detail: 'Competing site has larger local A-value', value: 6, color: '#F2994A' },
      { label: 'LG term', detail: 'Br/Cl terms included by BSI + pKa', value: 34, color: '#7C3AED' },
    ],
  },
  {
    id: 'rp-003',
    name: 'OA-022',
    smiles: 'Clc1ccc(F)nc1',
    moleculeSvg: exampleCompound3Svg,
    reactionType: 'oa',
    majorSite: 'C3-Cl',
    leavingGroup: 'Cl',
    deltaDeltaG: 4.2,
    status: 'completed',
    startDate: '26.05.14 10:44',
    endDate: '26.05.14 10:59',
    sites: [
      { site: 'C3', leavingGroup: 'Cl', enabled: true, deltaG: 21.1 },
      { site: 'C5', leavingGroup: 'F', enabled: false, deltaG: 21.3 },
    ],
    confidence: {
      score: 78,
      verdict: 'high',
      checks: [
        { label: 'LG domain', status: 'pass', detail: 'Ar-Cl/Ar-Br in scope' },
        { label: 'Descriptor range', status: 'pass', detail: 'ESP / BSI within training range' },
        { label: 'ΔΔG margin', status: 'pass', detail: '6.5 kJ/mol > model MAE' },
        { label: 'Conformer sensitivity', status: 'review', detail: 'Small but present' },
        { label: 'Known failure motif', status: 'pass', detail: 'No isothiazole flag' },
      ],
    },
    factors: [
      { label: 'ESP1', detail: 'Reactive carbon is more electrophilic', value: 42, color: '#2F80ED' },
      { label: 'ESP2', detail: 'Adjacent heteroatom stabilizes polarized TS', value: 19, color: '#00A889' },
      { label: 'Steric', detail: 'Competing site has larger local A-value', value: 6, color: '#F2994A' },
      { label: 'LG term', detail: 'Br/Cl terms included by BSI + pKa', value: 34, color: '#7C3AED' },
    ],
  },
  {
    id: 'rp-004',
    name: 'OA-011',
    smiles: 'Brc1ccncc1',
    moleculeSvg: exampleCompound4Svg,
    reactionType: 'oa',
    majorSite: 'C3-Cl',
    leavingGroup: 'Cl',
    deltaDeltaG: null,
    status: 'calculating',
    startDate: '26.05.28 18:05',
    sites: [
      { site: 'C3', leavingGroup: 'Cl', enabled: true },
      { site: 'C5', leavingGroup: 'Br', enabled: true },
    ],
  },
  {
    id: 'rp-005',
    name: 'SNAr-014',
    smiles: 'Fc1ncccc1Cl',
    moleculeSvg: exampleCompound2Svg,
    reactionType: 'snar',
    majorSite: 'C2-F',
    leavingGroup: 'F',
    deltaDeltaG: 3.8,
    status: 'completed',
    startDate: '26.05.20 11:12',
    endDate: '26.05.20 11:25',
    sites: [
      { site: 'C2', leavingGroup: 'F', enabled: true, deltaG: 15.7 },
      { site: 'C6', leavingGroup: 'Cl', enabled: true, deltaG: 19.5 },
    ],
    confidence: {
      score: 78,
      verdict: 'high',
      checks: [
        { label: 'LG domain', status: 'pass', detail: 'Ar-Cl/Ar-Br in scope' },
        { label: 'Descriptor range', status: 'pass', detail: 'ESP / BSI within training range' },
        { label: 'ΔΔG margin', status: 'pass', detail: '6.5 kJ/mol > model MAE' },
        { label: 'Conformer sensitivity', status: 'review', detail: 'Small but present' },
        { label: 'Known failure motif', status: 'pass', detail: 'No isothiazole flag' },
      ],
    },
    factors: [
      { label: 'ESP1', detail: 'Reactive carbon is more electrophilic', value: 42, color: '#2F80ED' },
      { label: 'ESP2', detail: 'Adjacent heteroatom stabilizes polarized TS', value: 19, color: '#00A889' },
      { label: 'Steric', detail: 'Competing site has larger local A-value', value: 6, color: '#F2994A' },
      { label: 'LG term', detail: 'Br/Cl terms included by BSI + pKa', value: 34, color: '#7C3AED' },
    ],
  },
];
