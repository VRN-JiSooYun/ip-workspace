import exampleCompound1Svg from '../assets/mol_svg/example_compound1.svg?raw';
import exampleCompound2Svg from '../assets/mol_svg/example_compound2.svg?raw';
import exampleCompound3Svg from '../assets/mol_svg/example_compound3.svg?raw';
import exampleCompound4Svg from '../assets/mol_svg/example_compound4.svg?raw';
import myBoardGroup4Svg from '../assets/mol_svg/myboard_group4.svg?raw';
import myBoardGroup5Svg from '../assets/mol_svg/myboard_group5.svg?raw';
import exampleCompoundsCsv from './Example_compounds.csv?raw';
import type { KinaseFamily, KinomeLayoutId } from '../data/kinomeTree';
import type { CompoundCalculateData } from '../services/compoundApi';
import type { QuantumCalculationJob } from '../services/calculationApi';
import type { VpropResult } from '../services/vpropApi';

export interface CompoundGroup {
  id: string;
  name: string;
  type: 'my designs' | 'my compounds';
  count: number;
  creDate: string;
  target?: string;
  shareStatus?: '공유 하는중' | '공유 받는중' | '공유 안함';
}

export interface SARData {
  tsa_tm?: number;
  enzyme?: {
    wt?: number;
    d1228n?: number;
    f1250k?: number;
    wt_f1250k?: number;
  };
  cell?: {
    ebc1?: number;
    hs746t?: number;
    snu16?: number;
    naive?: number;
    fgfr3?: number;
    fgfr3_v555m?: number;
    rt112?: number;
    mkn45?: number;
  };
  ms?: { h?: number; m?: number; };
  ppb?: { h?: number; m?: number; };
  cyp?: {
    '1a2'?: number;
    '2c9'?: number;
    '2c19'?: number;
    '2d6'?: number;
    '3a_m'?: number;
    '3a_t'?: number;
    '3a4'?: number;
  };
  herg?: number;
  pk?: {
    pe?: number;
    salt_form?: string;
    dose?: number;
    plasma_1h?: number;
    plasma_4h?: number;
    lung_1h?: number;
    lung_4h?: number;
    brain_1h?: number;
    brain_4h?: number;
  };
}

export type CompoundQuickViewerAssetType = 'pdb' | 'docking' | 'md' | 'kp';

export interface KinomeProfilePoint {
  gene: string;
  family: KinaseFamily;
  inhibition: number;
  x?: number;
  y?: number;
}

export interface CompoundQuickViewerAsset {
  type: CompoundQuickViewerAssetType;
  label: 'PDB' | 'Docking' | 'MD' | 'KP';
  resultCount?: number;
  payload?: {
    title?: string;
    assay?: string;
    layout?: KinomeLayoutId;
    points?: KinomeProfilePoint[];
    infoRows?: Array<{ label: string; value: string | number }>;
    structureUrl?: string;
    structureFormat?: 'mmcif' | 'pdb' | 'sdf';
    pdbId?: string;
    sourceLabel?: string;
  };
}

export type ChemaxonCalculationResult = {
  smiles: string;
  calculatedAt: string;
  data: CompoundCalculateData;
};

export type QuantumCalculations = {
  psa?: QuantumCalculationJob;
  esol?: QuantumCalculationJob;
};

export type VpropCalculationResult = {
  smiles: string;
  method: 'rdkit';
  calculatedAt: string;
  data: VpropResult;
};

export interface Compound {
  id: string;
  groupId: string;
  compoundId: string;
  name: string;
  source: string;
  externalSource?: 'compound_api';
  smiles: string;
  structureSvg?: string;
  rdkitSvg?: string;
  rdkitSvgCache?: Record<string, string>;
  molBlock?: string;
  mol_block?: string;
  molblock?: string;
  draw?: string;
  creDate: string;
  manager?: string;
  status?: string;
  project?: string;
  shareStatus?: string;
  designSource?: string;
  properties1?: number[];
  properties2?: number[];
  molecularWeight?: number;
  requiredCalcs?: string[];
  chemaxonCalculation?: ChemaxonCalculationResult;
  vpropCalculation?: VpropCalculationResult;
  quantumCalculations?: QuantumCalculations;
  ideaNumber?: string;
  ideaMemo?: string;
  requiredAmountMg?: number;
  assayPurpose?: string;
  expectedEffect?: string;
  requestDate?: string;
  synthesisExpansionLevel?: string;
  requestMemo?: string;
  synthesisOwner?: string;
  synthesisStudyGroup?: string;
  synthesisAcceptedDate?: string;
  synthesisTargetDate?: string;
  progressMemo?: string;
  isCompleted?: boolean;
  registeredDate?: string;
  researchNote?: string;
  reportData?: string;
  synthesisEndReason?: string;
  synthesisRequestStatus?: 'requested' | 'accepted' | 'synthesizing' | 'vnaIssued';
  synthesisRequestType?: string;
  synthesisSite?: 'In-house' | 'Wuxi';
  synthesisStep?: string;
  experimentStage?: number;
  quickViewerAssets?: CompoundQuickViewerAsset[];
  sar?: SARData;
  sarApiRows?: Record<string, string | number | null>[];
}

interface ExampleCompoundCsvRow {
  group: string;
  index: number;
  smiles: string;
}

const parseExampleCompoundsCsv = (csv: string): ExampleCompoundCsvRow[] => (
  csv
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => {
      const [group, index, ...smilesParts] = line.split(',');
      return {
        group: group.trim(),
        index: Number(index),
        smiles: smilesParts.join(',').trim(),
      };
    })
    .filter((row) => row.group && Number.isFinite(row.index) && row.smiles)
);

const exampleCompoundRows = parseExampleCompoundsCsv(exampleCompoundsCsv);
const exampleGroupProjectMap: Record<string, string> = {
  Group1: 'EGFR',
  Group2: 'ALK',
  Group3: 'Macrocycle',
  Group4: 'Pyrimidine',
};
const exampleGroupShareStatuses: Array<CompoundGroup['shareStatus']> = ['공유 하는중', '공유 안함', '공유 받는중'];
const getExampleGroupNumber = (group: string) => Number(group.match(/\d+/)?.[0] ?? 0);
const getExampleGroupId = (group: string) => `g${getExampleGroupNumber(group) || group}`;
const getExampleGroupProject = (group: string) => exampleGroupProjectMap[group] ?? group;
const getExampleCompoundId = (row: ExampleCompoundCsvRow) => {
  const groupNumber = String(getExampleGroupNumber(row.group)).padStart(2, '0');
  return `VNA-G${groupNumber}-${String(row.index).padStart(3, '0')}`;
};

export const mockGroups: CompoundGroup[] = Array.from(
  exampleCompoundRows.reduce<Map<string, ExampleCompoundCsvRow[]>>((acc, row) => {
    acc.set(row.group, [...(acc.get(row.group) ?? []), row]);
    return acc;
  }, new Map())
).map(([group, rows], index) => ({
  id: getExampleGroupId(group),
  name: `${group} ${getExampleGroupProject(group)} SAR`,
  type: 'my designs',
  count: rows.length,
  creDate: `2026.04.${String(20 - index).padStart(2, '0')}`,
  target: getExampleGroupProject(group),
  shareStatus: exampleGroupShareStatuses[index % exampleGroupShareStatuses.length],
}));

const structureSvgs = [exampleCompound1Svg, exampleCompound2Svg, exampleCompound3Svg, exampleCompound4Svg];
const sampleSmiles = [
  'COc1cc2ncnc(Nc3ccc(OCCN4CCOCC4)cc3)c2cc1OC',
  'COc1cc2ncnc(Nc3ccc(OCCN4CCN(C)CC4)cc3)c2cc1OC',
  'COc1cc2ncnc(Nc3ccc(OCCN4CCCC4)cc3)c2cc1OC',
  'COc1cc2ncnc(Nc3ccc(OCCN4CCCCC4)cc3)c2cc1OC',
  'COc1cc2ncnc(Nc3ccc(OCCCN4CCOCC4)cc3)c2cc1OC',
  'COc1cc2ncnc(Nc3ccc(OCCCN4CCN(C)CC4)cc3)c2cc1OC',
  'COc1cc2ncnc(Nc3ccc(OCCN4CCSCC4)cc3)c2cc1OC',
  'COc1cc2ncnc(Nc3ccc(OCCN4CC(O)CC4)cc3)c2cc1OC',
  'COc1cc2ncnc(Nc3ccc(OCCN4CC(F)CC4)cc3)c2cc1OC',
  'COc1cc2ncnc(Nc3ccc(OCCNC4CCCCC4)cc3)c2cc1OC',
  'COc1cc2ncnc(Nc3cc(F)c(OCCN4CCOCC4)cc3)c2cc1OC',
  'COc1cc2ncnc(Nc3cc(Cl)c(OCCN4CCOCC4)cc3)c2cc1OC',
  'COc1cc2ncnc(Nc3cc(C)c(OCCN4CCOCC4)cc3)c2cc1OC',
  'COc1cc2ncnc(Nc3cc(OC)c(OCCN4CCOCC4)cc3)c2cc1OC',
  'COc1cc2ncnc(Nc3cc(F)c(OCCN4CCN(C)CC4)cc3)c2cc1OC',
  'COc1cc2ncnc(Nc3cc(Cl)c(OCCN4CCN(C)CC4)cc3)c2cc1OC',
  'COc1cc2ncnc(Nc3cc(F)c(OCCCN4CCOCC4)cc3)c2cc1OC',
  'COc1cc2ncnc(Nc3cc(Cl)c(OCCCN4CCOCC4)cc3)c2cc1OC',
  'COc1cc2ncnc(Nc3cc(F)c(OCCN4CCCC4)cc3)c2cc1OC',
  'COc1cc2ncnc(Nc3cc(Cl)c(OCCN4CCCC4)cc3)c2cc1OC',
  'CC1=CC(=C(C=C1N2CCC(CC2)N3CCN(CC3)C)OC)NC4=NC=C(C(=N4)NC5=C(C6=NC=CN=C6C=C5)P(=O)(C)C)Br',
  'C1CC1(C(=O)NC2=CC=C(C=C2)OC3=C4C=C(NC4=NC=C3)C(=O)NCCN5CCOCC5)C(=O)NC6=CC=C(C=C6)F',
];
const designSources = ['내 머리', '동료 머리', 'Patent', 'Paper', 'FBDD', 'ELN'];
const synthesisOwners = ['문태훈', '윤지수', '김서연', '박도현'];
const myBoardGroup4Cdxml = "<?xml version=\"1.0\" encoding=\"UTF-8\" ?>\n<!DOCTYPE CDXML SYSTEM \"http://www.cambridgesoft.com/xml/cdxml.dtd\" >\n<CDXML\n CreationProgram=\"ChemDraw JS 2.0.0.7\"\n Name=\"ACS Document 1996\"\n BoundingBox=\"145.19 96.40 422.81 192.27\"\n WindowPosition=\"0 0\"\n WindowSize=\"0 0\"\n FractionalWidths=\"yes\"\n InterpretChemically=\"yes\"\n ShowAtomQuery=\"yes\"\n ShowAtomStereo=\"no\"\n ShowAtomEnhancedStereo=\"yes\"\n ShowAtomNumber=\"no\"\n ShowResidueID=\"no\"\n ShowBondQuery=\"yes\"\n ShowBondRxn=\"yes\"\n ShowBondStereo=\"no\"\n ShowTerminalCarbonLabels=\"no\"\n ShowNonTerminalCarbonLabels=\"no\"\n HideImplicitHydrogens=\"no\"\n Magnification=\"666\"\n LabelFont=\"24\"\n LabelSize=\"10\"\n LabelFace=\"96\"\n CaptionFont=\"24\"\n CaptionSize=\"10\"\n HashSpacing=\"2.50\"\n MarginWidth=\"1.60\"\n LineWidth=\"0.60\"\n BoldWidth=\"2\"\n BondLength=\"14.40\"\n BondSpacing=\"18\"\n ChainAngle=\"120\"\n LabelJustification=\"Auto\"\n CaptionJustification=\"Left\"\n AminoAcidTermini=\"HOH\"\n ShowSequenceTermini=\"yes\"\n ShowSequenceBonds=\"yes\"\n ShowSequenceUnlinkedBranches=\"no\"\n ResidueWrapCount=\"40\"\n ResidueBlockCount=\"10\"\n ResidueZigZag=\"yes\"\n NumberResidueBlocks=\"no\"\n PrintMargins=\"36 36 36 36\"\n MacPrintInfo=\"0003000001200120000000000B6608A0FF84FF880BE309180367052703FC0002000001200120000000000B6608A0000100000064000000010001010100000001270F000100010000000000000000000000000002001901900000000000400000000000000000000100000000000000000000000000000000\"\n ChemPropName=\"\"\n ChemPropFormula=\"Chemical Formula: \"\n ChemPropExactMass=\"Exact Mass: \"\n ChemPropMolWt=\"Molecular Weight: \"\n ChemPropMOverZ=\"m/z: \"\n ChemPropAnalysis=\"Elemental Analysis: \"\n ChemPropBoilingPt=\"Boiling Point: \"\n ChemPropMeltingPt=\"Melting Point: \"\n ChemPropCritTemp=\"Critical Temp: \"\n ChemPropCritPres=\"Critical Pres: \"\n ChemPropCritVol=\"Critical Vol: \"\n ChemPropGibbs=\"Gibbs Energy: \"\n ChemPropLogP=\"Log P: \"\n ChemPropMR=\"MR: \"\n ChemPropHenry=\"Henry&apos;s Law: \"\n ChemPropEForm=\"Heat of Form: \"\n ChemProptPSA=\"tPSA: \"\n ChemPropID=\"\"\n ChemPropFragmentLabel=\"\"\n color=\"0\"\n bgcolor=\"1\"\n RxnAutonumberStart=\"1\"\n RxnAutonumberConditions=\"no\"\n RxnAutonumberStyle=\"Roman\"\n RxnAutonumberFormat=\"(#)\"\n><colortable>\n<color r=\"1\" g=\"1\" b=\"1\"/>\n<color r=\"0\" g=\"0\" b=\"0\"/>\n<color r=\"1\" g=\"0\" b=\"0\"/>\n<color r=\"1\" g=\"1\" b=\"0\"/>\n<color r=\"0\" g=\"1\" b=\"0\"/>\n<color r=\"0\" g=\"1\" b=\"1\"/>\n<color r=\"0\" g=\"0\" b=\"1\"/>\n<color r=\"1\" g=\"0\" b=\"1\"/>\n</colortable><fonttable>\n<font id=\"24\" charset=\"utf-8\" name=\"Arial\"/>\n</fonttable><page\n id=\"96\"\n BoundingBox=\"0 0 568 288.67\"\n Width=\"568\"\n Height=\"288.67\"\n HeaderPosition=\"36\"\n FooterPosition=\"36\"\n PageOverlap=\"0\"\n PrintTrimMarks=\"yes\"\n HeightPages=\"1\"\n WidthPages=\"1\"\n DrawingSpace=\"poster\"\n><fragment\n id=\"94\"\n BoundingBox=\"145.19 96.40 422.81 192.27\"\n Z=\"1\"\n><n\n id=\"1\"\n p=\"230.27 191.97\"\n Z=\"2\"\n AS=\"N\"\n/><n\n id=\"2\"\n p=\"215.87 191.97\"\n Z=\"3\"\n AS=\"N\"\n/><n\n id=\"3\"\n p=\"223.07 179.50\"\n Z=\"4\"\n AS=\"N\"\n/><n\n id=\"4\"\n p=\"235.54 172.30\"\n Z=\"5\"\n AS=\"N\"\n/><n\n id=\"5\"\n p=\"235.54 157.90\"\n Z=\"6\"\n Element=\"8\"\n NumHydrogens=\"0\"\n NeedsClean=\"yes\"\n AS=\"N\"\n><t\n p=\"231.65 161.51\"\n BoundingBox=\"231.65 152.88 239.43 161.51\"\n LabelJustification=\"Left\"\n><s font=\"24\" size=\"10\" color=\"0\" face=\"96\">O</s></t></n><n\n id=\"6\"\n p=\"248.01 179.50\"\n Z=\"7\"\n Element=\"7\"\n NumHydrogens=\"1\"\n NeedsClean=\"yes\"\n AS=\"N\"\n><t\n p=\"244.40 183.11\"\n BoundingBox=\"244.40 174.48 251.62 192.15\"\n LabelJustification=\"Left\"\n LabelAlignment=\"Below\"\n LineStarts=\"2 3\"\n><s font=\"24\" size=\"10\" color=\"0\" face=\"96\">NH</s></t></n><n\n id=\"7\"\n p=\"260.48 172.30\"\n Z=\"8\"\n AS=\"N\"\n/><n\n id=\"8\"\n p=\"260.48 157.90\"\n Z=\"9\"\n AS=\"N\"\n/><n\n id=\"9\"\n p=\"272.95 150.70\"\n Z=\"10\"\n AS=\"N\"\n/><n\n id=\"10\"\n p=\"285.42 157.90\"\n Z=\"11\"\n AS=\"N\"\n/><n\n id=\"11\"\n p=\"285.42 172.30\"\n Z=\"12\"\n AS=\"N\"\n/><n\n id=\"12\"\n p=\"272.95 179.50\"\n Z=\"13\"\n AS=\"N\"\n/><n\n id=\"13\"\n p=\"297.89 150.70\"\n Z=\"14\"\n Element=\"8\"\n NumHydrogens=\"0\"\n NeedsClean=\"yes\"\n AS=\"N\"\n><t\n p=\"294 154.31\"\n BoundingBox=\"294 145.68 301.78 154.31\"\n LabelJustification=\"Left\"\n><s font=\"24\" size=\"10\" color=\"0\" face=\"96\">O</s></t></n><n\n id=\"14\"\n p=\"297.89 136.30\"\n Z=\"15\"\n AS=\"N\"\n/><n\n id=\"15\"\n p=\"310.36 129.10\"\n Z=\"16\"\n AS=\"N\"\n/><n\n id=\"16\"\n p=\"324.06 133.55\"\n Z=\"17\"\n AS=\"N\"\n/><n\n id=\"17\"\n p=\"332.52 121.90\"\n Z=\"18\"\n AS=\"N\"\n/><n\n id=\"18\"\n p=\"324.06 110.25\"\n Z=\"19\"\n Element=\"7\"\n NumHydrogens=\"1\"\n NeedsClean=\"yes\"\n AS=\"N\"\n><t\n p=\"320.45 105.03\"\n BoundingBox=\"320.45 96.40 327.67 114.06\"\n LabelJustification=\"Left\"\n LabelAlignment=\"Above\"\n LineStarts=\"2 4\"\n><s font=\"24\" size=\"10\" color=\"0\" face=\"96\">NH</s></t></n><n\n id=\"19\"\n p=\"310.36 114.70\"\n Z=\"20\"\n AS=\"N\"\n/><n\n id=\"20\"\n p=\"297.89 107.50\"\n Z=\"21\"\n Element=\"7\"\n NumHydrogens=\"0\"\n NeedsClean=\"yes\"\n AS=\"N\"\n><t\n p=\"294.28 111.11\"\n BoundingBox=\"294.28 102.48 301.50 111.31\"\n LabelJustification=\"Left\"\n><s font=\"24\" size=\"10\" color=\"0\" face=\"96\">N</s></t></n><n\n id=\"21\"\n p=\"285.42 114.70\"\n Z=\"22\"\n AS=\"N\"\n/><n\n id=\"22\"\n p=\"285.42 129.10\"\n Z=\"23\"\n AS=\"N\"\n/><n\n id=\"23\"\n p=\"346.92 121.90\"\n Z=\"24\"\n AS=\"N\"\n/><n\n id=\"24\"\n p=\"354.12 109.43\"\n Z=\"25\"\n Element=\"8\"\n NumHydrogens=\"0\"\n NeedsClean=\"yes\"\n AS=\"N\"\n><t\n p=\"350.23 113.04\"\n BoundingBox=\"350.23 104.41 358.01 113.04\"\n LabelJustification=\"Left\"\n><s font=\"24\" size=\"10\" color=\"0\" face=\"96\">O</s></t></n><n\n id=\"25\"\n p=\"354.12 134.37\"\n Z=\"26\"\n Element=\"7\"\n NumHydrogens=\"1\"\n NeedsClean=\"yes\"\n AS=\"N\"\n><t\n p=\"357.73 137.98\"\n BoundingBox=\"343.29 129.35 357.73 138.18\"\n LabelJustification=\"Right\"\n Justification=\"Right\"\n LabelAlignment=\"Right\"\n><s font=\"24\" size=\"10\" color=\"0\" face=\"96\">NH</s></t></n><n\n id=\"26\"\n p=\"368.52 134.37\"\n Z=\"27\"\n AS=\"N\"\n/><n\n id=\"27\"\n p=\"375.72 146.84\"\n Z=\"28\"\n AS=\"N\"\n/><n\n id=\"28\"\n p=\"390.12 146.84\"\n Z=\"29\"\n Element=\"7\"\n NumHydrogens=\"0\"\n NeedsClean=\"yes\"\n AS=\"N\"\n><t\n p=\"386.51 150.45\"\n BoundingBox=\"386.51 141.82 393.73 150.65\"\n LabelJustification=\"Left\"\n><s font=\"24\" size=\"10\" color=\"0\" face=\"96\">N</s></t></n><n\n id=\"29\"\n p=\"397.32 134.37\"\n Z=\"30\"\n AS=\"N\"\n/><n\n id=\"30\"\n p=\"411.72 134.37\"\n Z=\"31\"\n AS=\"N\"\n/><n\n id=\"31\"\n p=\"418.92 146.84\"\n Z=\"32\"\n Element=\"8\"\n NumHydrogens=\"0\"\n NeedsClean=\"yes\"\n AS=\"N\"\n><t\n p=\"415.03 150.45\"\n BoundingBox=\"415.03 141.82 422.81 150.45\"\n LabelJustification=\"Left\"\n><s font=\"24\" size=\"10\" color=\"0\" face=\"96\">O</s></t></n><n\n id=\"32\"\n p=\"411.72 159.31\"\n Z=\"33\"\n AS=\"N\"\n/><n\n id=\"33\"\n p=\"397.32 159.31\"\n Z=\"34\"\n AS=\"N\"\n/><n\n id=\"34\"\n p=\"210.60 172.30\"\n Z=\"35\"\n AS=\"N\"\n/><n\n id=\"35\"\n p=\"210.60 157.90\"\n Z=\"36\"\n Element=\"8\"\n NumHydrogens=\"0\"\n NeedsClean=\"yes\"\n AS=\"N\"\n><t\n p=\"206.71 161.51\"\n BoundingBox=\"206.71 152.88 214.49 161.51\"\n LabelJustification=\"Left\"\n><s font=\"24\" size=\"10\" color=\"0\" face=\"96\">O</s></t></n><n\n id=\"36\"\n p=\"198.13 179.50\"\n Z=\"37\"\n Element=\"7\"\n NumHydrogens=\"1\"\n NeedsClean=\"yes\"\n AS=\"N\"\n><t\n p=\"194.52 183.11\"\n BoundingBox=\"194.52 174.48 201.74 192.15\"\n LabelJustification=\"Left\"\n LabelAlignment=\"Below\"\n LineStarts=\"2 3\"\n><s font=\"24\" size=\"10\" color=\"0\" face=\"96\">NH</s></t></n><n\n id=\"37\"\n p=\"185.66 172.30\"\n Z=\"38\"\n AS=\"N\"\n/><n\n id=\"38\"\n p=\"173.18 179.50\"\n Z=\"39\"\n AS=\"N\"\n/><n\n id=\"39\"\n p=\"160.71 172.30\"\n Z=\"40\"\n AS=\"N\"\n/><n\n id=\"40\"\n p=\"160.71 157.90\"\n Z=\"41\"\n AS=\"N\"\n/><n\n id=\"41\"\n p=\"173.18 150.70\"\n Z=\"42\"\n AS=\"N\"\n/><n\n id=\"42\"\n p=\"185.66 157.90\"\n Z=\"43\"\n AS=\"N\"\n/><n\n id=\"43\"\n p=\"148.24 150.70\"\n Z=\"44\"\n Element=\"9\"\n NumHydrogens=\"0\"\n NeedsClean=\"yes\"\n AS=\"N\"\n><t\n p=\"145.19 154.31\"\n BoundingBox=\"145.19 145.68 151.30 154.51\"\n LabelJustification=\"Left\"\n><s font=\"24\" size=\"10\" color=\"0\" face=\"96\">F</s></t></n><b\n id=\"45\"\n Z=\"45\"\n B=\"1\"\n E=\"2\"\n BS=\"N\"\n/><b\n id=\"46\"\n Z=\"46\"\n B=\"2\"\n E=\"3\"\n BS=\"N\"\n/><b\n id=\"47\"\n Z=\"47\"\n B=\"1\"\n E=\"3\"\n BS=\"N\"\n/><b\n id=\"48\"\n Z=\"48\"\n B=\"3\"\n E=\"4\"\n BS=\"N\"\n/><b\n id=\"49\"\n Z=\"49\"\n B=\"4\"\n E=\"5\"\n Order=\"2\"\n BS=\"N\"\n/><b\n id=\"50\"\n Z=\"50\"\n B=\"4\"\n E=\"6\"\n BS=\"N\"\n/><b\n id=\"51\"\n Z=\"51\"\n B=\"6\"\n E=\"7\"\n BS=\"N\"\n/><b\n id=\"52\"\n Z=\"52\"\n B=\"7\"\n E=\"8\"\n Order=\"2\"\n BS=\"N\"\n BondCircularOrdering=\"51 57 53 0\"\n/><b\n id=\"53\"\n Z=\"53\"\n B=\"8\"\n E=\"9\"\n BS=\"N\"\n/><b\n id=\"54\"\n Z=\"54\"\n B=\"9\"\n E=\"10\"\n Order=\"2\"\n BS=\"N\"\n BondCircularOrdering=\"0 53 55 58\"\n/><b\n id=\"55\"\n Z=\"55\"\n B=\"10\"\n E=\"11\"\n BS=\"N\"\n/><b\n id=\"56\"\n Z=\"56\"\n B=\"11\"\n E=\"12\"\n Order=\"2\"\n BS=\"N\"\n BondCircularOrdering=\"0 55 57 0\"\n/><b\n id=\"57\"\n Z=\"57\"\n B=\"7\"\n E=\"12\"\n BS=\"N\"\n/><b\n id=\"58\"\n Z=\"58\"\n B=\"10\"\n E=\"13\"\n BS=\"N\"\n/><b\n id=\"59\"\n Z=\"59\"\n B=\"13\"\n E=\"14\"\n BS=\"N\"\n/><b\n id=\"60\"\n Z=\"60\"\n B=\"14\"\n E=\"15\"\n Order=\"2\"\n BS=\"N\"\n BondCircularOrdering=\"69 59 61 65\"\n/><b\n id=\"61\"\n Z=\"61\"\n B=\"15\"\n E=\"16\"\n BS=\"N\"\n/><b\n id=\"62\"\n Z=\"62\"\n B=\"16\"\n E=\"17\"\n Order=\"2\"\n BS=\"N\"\n BondCircularOrdering=\"61 0 70 63\"\n/><b\n id=\"63\"\n Z=\"63\"\n B=\"17\"\n E=\"18\"\n BS=\"N\"\n/><b\n id=\"64\"\n Z=\"64\"\n B=\"18\"\n E=\"19\"\n BS=\"N\"\n/><b\n id=\"65\"\n Z=\"65\"\n B=\"15\"\n E=\"19\"\n BS=\"N\"\n/><b\n id=\"66\"\n Z=\"66\"\n B=\"19\"\n E=\"20\"\n Order=\"2\"\n BS=\"N\"\n BondCircularOrdering=\"65 64 0 67\"\n/><b\n id=\"67\"\n Z=\"67\"\n B=\"20\"\n E=\"21\"\n BS=\"N\"\n/><b\n id=\"68\"\n Z=\"68\"\n B=\"21\"\n E=\"22\"\n Order=\"2\"\n BS=\"N\"\n BondCircularOrdering=\"67 0 0 69\"\n/><b\n id=\"69\"\n Z=\"69\"\n B=\"14\"\n E=\"22\"\n BS=\"N\"\n/><b\n id=\"70\"\n Z=\"70\"\n B=\"17\"\n E=\"23\"\n BS=\"N\"\n/><b\n id=\"71\"\n Z=\"71\"\n B=\"23\"\n E=\"24\"\n Order=\"2\"\n BS=\"N\"\n/><b\n id=\"72\"\n Z=\"72\"\n B=\"23\"\n E=\"25\"\n BS=\"N\"\n/><b\n id=\"73\"\n Z=\"73\"\n B=\"25\"\n E=\"26\"\n BS=\"N\"\n/><b\n id=\"74\"\n Z=\"74\"\n B=\"26\"\n E=\"27\"\n BS=\"N\"\n/><b\n id=\"75\"\n Z=\"75\"\n B=\"27\"\n E=\"28\"\n BS=\"N\"\n/><b\n id=\"76\"\n Z=\"76\"\n B=\"28\"\n E=\"29\"\n BS=\"N\"\n/><b\n id=\"77\"\n Z=\"77\"\n B=\"29\"\n E=\"30\"\n BS=\"N\"\n/><b\n id=\"78\"\n Z=\"78\"\n B=\"30\"\n E=\"31\"\n BS=\"N\"\n/><b\n id=\"79\"\n Z=\"79\"\n B=\"31\"\n E=\"32\"\n BS=\"N\"\n/><b\n id=\"80\"\n Z=\"80\"\n B=\"32\"\n E=\"33\"\n BS=\"N\"\n/><b\n id=\"81\"\n Z=\"81\"\n B=\"28\"\n E=\"33\"\n BS=\"N\"\n/><b\n id=\"82\"\n Z=\"82\"\n B=\"3\"\n E=\"34\"\n BS=\"N\"\n/><b\n id=\"83\"\n Z=\"83\"\n B=\"34\"\n E=\"35\"\n Order=\"2\"\n BS=\"N\"\n/><b\n id=\"84\"\n Z=\"84\"\n B=\"34\"\n E=\"36\"\n BS=\"N\"\n/><b\n id=\"85\"\n Z=\"85\"\n B=\"36\"\n E=\"37\"\n BS=\"N\"\n/><b\n id=\"86\"\n Z=\"86\"\n B=\"37\"\n E=\"38\"\n Order=\"2\"\n BS=\"N\"\n BondCircularOrdering=\"85 91 87 0\"\n/><b\n id=\"87\"\n Z=\"87\"\n B=\"38\"\n E=\"39\"\n BS=\"N\"\n/><b\n id=\"88\"\n Z=\"88\"\n B=\"39\"\n E=\"40\"\n Order=\"2\"\n BS=\"N\"\n BondCircularOrdering=\"0 87 89 92\"\n/><b\n id=\"89\"\n Z=\"89\"\n B=\"40\"\n E=\"41\"\n BS=\"N\"\n/><b\n id=\"90\"\n Z=\"90\"\n B=\"41\"\n E=\"42\"\n Order=\"2\"\n BS=\"N\"\n BondCircularOrdering=\"0 89 91 0\"\n/><b\n id=\"91\"\n Z=\"91\"\n B=\"37\"\n E=\"42\"\n BS=\"N\"\n/><b\n id=\"92\"\n Z=\"92\"\n B=\"40\"\n E=\"43\"\n BS=\"N\"\n/></fragment></page></CDXML>";
const myBoardGroup5Cdxml = "<?xml version=\"1.0\" encoding=\"UTF-8\" ?>\n<!DOCTYPE CDXML SYSTEM \"http://www.cambridgesoft.com/xml/cdxml.dtd\" >\n<CDXML\n CreationProgram=\"ChemDraw JS 2.0.0.7\"\n Name=\"ACS Document 1996\"\n BoundingBox=\"165.30 94.85 402.70 193.82\"\n WindowPosition=\"0 0\"\n WindowSize=\"0 0\"\n FractionalWidths=\"yes\"\n InterpretChemically=\"yes\"\n ShowAtomQuery=\"yes\"\n ShowAtomStereo=\"no\"\n ShowAtomEnhancedStereo=\"yes\"\n ShowAtomNumber=\"no\"\n ShowResidueID=\"no\"\n ShowBondQuery=\"yes\"\n ShowBondRxn=\"yes\"\n ShowBondStereo=\"no\"\n ShowTerminalCarbonLabels=\"no\"\n ShowNonTerminalCarbonLabels=\"no\"\n HideImplicitHydrogens=\"no\"\n Magnification=\"666\"\n LabelFont=\"24\"\n LabelSize=\"10\"\n LabelFace=\"96\"\n CaptionFont=\"24\"\n CaptionSize=\"10\"\n HashSpacing=\"2.50\"\n MarginWidth=\"1.60\"\n LineWidth=\"0.60\"\n BoldWidth=\"2\"\n BondLength=\"14.40\"\n BondSpacing=\"18\"\n ChainAngle=\"120\"\n LabelJustification=\"Auto\"\n CaptionJustification=\"Left\"\n AminoAcidTermini=\"HOH\"\n ShowSequenceTermini=\"yes\"\n ShowSequenceBonds=\"yes\"\n ShowSequenceUnlinkedBranches=\"no\"\n ResidueWrapCount=\"40\"\n ResidueBlockCount=\"10\"\n ResidueZigZag=\"yes\"\n NumberResidueBlocks=\"no\"\n PrintMargins=\"36 36 36 36\"\n MacPrintInfo=\"0003000001200120000000000B6608A0FF84FF880BE309180367052703FC0002000001200120000000000B6608A0000100000064000000010001010100000001270F000100010000000000000000000000000002001901900000000000400000000000000000000100000000000000000000000000000000\"\n ChemPropName=\"\"\n ChemPropFormula=\"Chemical Formula: \"\n ChemPropExactMass=\"Exact Mass: \"\n ChemPropMolWt=\"Molecular Weight: \"\n ChemPropMOverZ=\"m/z: \"\n ChemPropAnalysis=\"Elemental Analysis: \"\n ChemPropBoilingPt=\"Boiling Point: \"\n ChemPropMeltingPt=\"Melting Point: \"\n ChemPropCritTemp=\"Critical Temp: \"\n ChemPropCritPres=\"Critical Pres: \"\n ChemPropCritVol=\"Critical Vol: \"\n ChemPropGibbs=\"Gibbs Energy: \"\n ChemPropLogP=\"Log P: \"\n ChemPropMR=\"MR: \"\n ChemPropHenry=\"Henry&apos;s Law: \"\n ChemPropEForm=\"Heat of Form: \"\n ChemProptPSA=\"tPSA: \"\n ChemPropID=\"\"\n ChemPropFragmentLabel=\"\"\n color=\"0\"\n bgcolor=\"1\"\n RxnAutonumberStart=\"1\"\n RxnAutonumberConditions=\"no\"\n RxnAutonumberStyle=\"Roman\"\n RxnAutonumberFormat=\"(#)\"\n><colortable>\n<color r=\"1\" g=\"1\" b=\"1\"/>\n<color r=\"0\" g=\"0\" b=\"0\"/>\n<color r=\"1\" g=\"0\" b=\"0\"/>\n<color r=\"1\" g=\"1\" b=\"0\"/>\n<color r=\"0\" g=\"1\" b=\"0\"/>\n<color r=\"0\" g=\"1\" b=\"1\"/>\n<color r=\"0\" g=\"0\" b=\"1\"/>\n<color r=\"1\" g=\"0\" b=\"1\"/>\n</colortable><fonttable>\n<font id=\"24\" charset=\"utf-8\" name=\"Arial\"/>\n</fonttable><page\n id=\"100\"\n BoundingBox=\"0 0 568 288.67\"\n Width=\"568\"\n Height=\"288.67\"\n HeaderPosition=\"36\"\n FooterPosition=\"36\"\n PageOverlap=\"0\"\n PrintTrimMarks=\"yes\"\n HeightPages=\"1\"\n WidthPages=\"1\"\n DrawingSpace=\"poster\"\n><fragment\n id=\"98\"\n BoundingBox=\"165.30 94.85 402.70 193.82\"\n Z=\"1\"\n><n\n id=\"1\"\n p=\"327.72 121.47\"\n Z=\"2\"\n AS=\"N\"\n/><n\n id=\"2\"\n p=\"315.25 128.67\"\n Z=\"3\"\n AS=\"N\"\n/><n\n id=\"3\"\n p=\"302.78 121.47\"\n Z=\"4\"\n AS=\"N\"\n/><n\n id=\"4\"\n p=\"290.31 128.67\"\n Z=\"5\"\n AS=\"N\"\n/><n\n id=\"5\"\n p=\"290.31 143.07\"\n Z=\"6\"\n AS=\"N\"\n/><n\n id=\"6\"\n p=\"302.78 150.27\"\n Z=\"7\"\n AS=\"N\"\n/><n\n id=\"7\"\n p=\"315.25 143.07\"\n Z=\"8\"\n AS=\"N\"\n/><n\n id=\"8\"\n p=\"327.72 150.27\"\n Z=\"9\"\n Element=\"7\"\n NumHydrogens=\"0\"\n NeedsClean=\"yes\"\n AS=\"N\"\n><t\n p=\"324.11 153.88\"\n BoundingBox=\"324.11 145.25 331.33 154.08\"\n LabelJustification=\"Left\"\n><s font=\"24\" size=\"10\" color=\"0\" face=\"96\">N</s></t></n><n\n id=\"9\"\n p=\"340.19 143.07\"\n Z=\"10\"\n AS=\"N\"\n/><n\n id=\"10\"\n p=\"352.66 150.27\"\n Z=\"11\"\n AS=\"N\"\n/><n\n id=\"11\"\n p=\"352.66 164.67\"\n Z=\"12\"\n AS=\"N\"\n/><n\n id=\"12\"\n p=\"340.19 171.87\"\n Z=\"13\"\n AS=\"N\"\n/><n\n id=\"13\"\n p=\"327.72 164.67\"\n Z=\"14\"\n AS=\"N\"\n/><n\n id=\"14\"\n p=\"365.13 171.87\"\n Z=\"15\"\n Element=\"7\"\n NumHydrogens=\"0\"\n NeedsClean=\"yes\"\n AS=\"N\"\n><t\n p=\"361.52 175.48\"\n BoundingBox=\"361.52 166.85 368.75 175.68\"\n LabelJustification=\"Left\"\n><s font=\"24\" size=\"10\" color=\"0\" face=\"96\">N</s></t></n><n\n id=\"15\"\n p=\"377.61 164.67\"\n Z=\"16\"\n AS=\"N\"\n/><n\n id=\"16\"\n p=\"390.08 171.87\"\n Z=\"17\"\n AS=\"N\"\n/><n\n id=\"17\"\n p=\"390.08 186.27\"\n Z=\"18\"\n Element=\"7\"\n NumHydrogens=\"0\"\n NeedsClean=\"yes\"\n AS=\"N\"\n><t\n p=\"386.47 189.88\"\n BoundingBox=\"386.47 181.25 393.69 190.08\"\n LabelJustification=\"Left\"\n><s font=\"24\" size=\"10\" color=\"0\" face=\"96\">N</s></t></n><n\n id=\"18\"\n p=\"377.61 193.47\"\n Z=\"19\"\n AS=\"N\"\n/><n\n id=\"19\"\n p=\"365.13 186.27\"\n Z=\"20\"\n AS=\"N\"\n/><n\n id=\"20\"\n p=\"402.55 193.47\"\n Z=\"21\"\n AS=\"N\"\n/><n\n id=\"21\"\n p=\"277.84 150.27\"\n Z=\"22\"\n Element=\"8\"\n NumHydrogens=\"0\"\n NeedsClean=\"yes\"\n AS=\"N\"\n><t\n p=\"273.95 153.88\"\n BoundingBox=\"273.95 145.25 281.73 153.88\"\n LabelJustification=\"Left\"\n><s font=\"24\" size=\"10\" color=\"0\" face=\"96\">O</s></t></n><n\n id=\"22\"\n p=\"277.84 164.67\"\n Z=\"23\"\n AS=\"N\"\n/><n\n id=\"23\"\n p=\"277.84 121.47\"\n Z=\"24\"\n Element=\"7\"\n NumHydrogens=\"1\"\n NeedsClean=\"yes\"\n AS=\"N\"\n><t\n p=\"274.23 116.25\"\n BoundingBox=\"274.23 107.62 281.45 125.28\"\n LabelJustification=\"Left\"\n LabelAlignment=\"Above\"\n LineStarts=\"2 4\"\n><s font=\"24\" size=\"10\" color=\"0\" face=\"96\">NH</s></t></n><n\n id=\"24\"\n p=\"265.37 128.67\"\n Z=\"25\"\n AS=\"N\"\n/><n\n id=\"25\"\n p=\"265.37 143.07\"\n Z=\"26\"\n Element=\"7\"\n NumHydrogens=\"0\"\n NeedsClean=\"yes\"\n AS=\"N\"\n><t\n p=\"261.76 146.68\"\n BoundingBox=\"261.76 138.05 268.98 146.88\"\n LabelJustification=\"Left\"\n><s font=\"24\" size=\"10\" color=\"0\" face=\"96\">N</s></t></n><n\n id=\"26\"\n p=\"252.90 150.27\"\n Z=\"27\"\n AS=\"N\"\n/><n\n id=\"27\"\n p=\"240.43 143.07\"\n Z=\"28\"\n AS=\"N\"\n/><n\n id=\"28\"\n p=\"240.43 128.67\"\n Z=\"29\"\n AS=\"N\"\n/><n\n id=\"29\"\n p=\"252.90 121.47\"\n Z=\"30\"\n Element=\"7\"\n NumHydrogens=\"0\"\n NeedsClean=\"yes\"\n AS=\"N\"\n><t\n p=\"249.29 125.08\"\n BoundingBox=\"249.29 116.45 256.51 125.28\"\n LabelJustification=\"Left\"\n><s font=\"24\" size=\"10\" color=\"0\" face=\"96\">N</s></t></n><n\n id=\"30\"\n p=\"227.96 121.47\"\n Z=\"31\"\n Element=\"7\"\n NumHydrogens=\"1\"\n NeedsClean=\"yes\"\n AS=\"N\"\n><t\n p=\"224.35 116.25\"\n BoundingBox=\"224.35 107.62 231.57 125.28\"\n LabelJustification=\"Left\"\n LabelAlignment=\"Above\"\n LineStarts=\"2 4\"\n><s font=\"24\" size=\"10\" color=\"0\" face=\"96\">NH</s></t></n><n\n id=\"31\"\n p=\"215.49 128.67\"\n Z=\"32\"\n AS=\"N\"\n/><n\n id=\"32\"\n p=\"203.02 121.47\"\n Z=\"33\"\n AS=\"N\"\n/><n\n id=\"33\"\n p=\"190.54 128.67\"\n Z=\"34\"\n AS=\"N\"\n/><n\n id=\"34\"\n p=\"178.07 121.47\"\n Z=\"35\"\n Element=\"7\"\n NumHydrogens=\"0\"\n NeedsClean=\"yes\"\n AS=\"N\"\n><t\n p=\"174.46 125.08\"\n BoundingBox=\"174.46 116.45 181.68 125.28\"\n LabelJustification=\"Left\"\n><s font=\"24\" size=\"10\" color=\"0\" face=\"96\">N</s></t></n><n\n id=\"35\"\n p=\"165.60 128.67\"\n Z=\"36\"\n AS=\"N\"\n/><n\n id=\"36\"\n p=\"165.60 143.07\"\n Z=\"37\"\n AS=\"N\"\n/><n\n id=\"37\"\n p=\"178.07 150.27\"\n Z=\"38\"\n Element=\"7\"\n NumHydrogens=\"0\"\n NeedsClean=\"yes\"\n AS=\"N\"\n><t\n p=\"174.46 153.88\"\n BoundingBox=\"174.46 145.25 181.68 154.08\"\n LabelJustification=\"Left\"\n><s font=\"24\" size=\"10\" color=\"0\" face=\"96\">N</s></t></n><n\n id=\"38\"\n p=\"190.54 143.07\"\n Z=\"39\"\n AS=\"N\"\n/><n\n id=\"39\"\n p=\"203.02 150.27\"\n Z=\"40\"\n AS=\"N\"\n/><n\n id=\"40\"\n p=\"215.49 143.07\"\n Z=\"41\"\n AS=\"N\"\n/><n\n id=\"41\"\n p=\"203.02 107.07\"\n Z=\"42\"\n Element=\"15\"\n NumHydrogens=\"0\"\n NeedsClean=\"yes\"\n AS=\"N\"\n><t\n p=\"199.68 110.68\"\n BoundingBox=\"199.68 102.05 206.35 110.88\"\n LabelJustification=\"Left\"\n><s font=\"24\" size=\"10\" color=\"0\" face=\"96\">P</s></t></n><n\n id=\"42\"\n p=\"190.54 99.87\"\n Z=\"43\"\n Element=\"8\"\n NumHydrogens=\"0\"\n NeedsClean=\"yes\"\n AS=\"N\"\n><t\n p=\"186.66 103.48\"\n BoundingBox=\"186.66 94.85 194.43 103.48\"\n LabelJustification=\"Left\"\n><s font=\"24\" size=\"10\" color=\"0\" face=\"96\">O</s></t></n><n\n id=\"43\"\n p=\"215.49 114.27\"\n Z=\"44\"\n AS=\"N\"\n/><n\n id=\"44\"\n p=\"215.49 99.87\"\n Z=\"45\"\n AS=\"N\"\n/><n\n id=\"45\"\n p=\"227.96 150.27\"\n Z=\"46\"\n Element=\"35\"\n NumHydrogens=\"0\"\n NeedsClean=\"yes\"\n AS=\"N\"\n><t\n p=\"229.62 153.88\"\n BoundingBox=\"219.62 145.25 229.62 154.08\"\n LabelJustification=\"Right\"\n Justification=\"Right\"\n LabelAlignment=\"Right\"\n><s font=\"24\" size=\"10\" color=\"0\" face=\"96\">Br</s></t></n><b\n id=\"47\"\n Z=\"47\"\n B=\"1\"\n E=\"2\"\n BS=\"N\"\n/><b\n id=\"48\"\n Z=\"48\"\n B=\"2\"\n E=\"3\"\n Order=\"2\"\n BS=\"N\"\n BondCircularOrdering=\"53 47 0 49\"\n/><b\n id=\"49\"\n Z=\"49\"\n B=\"3\"\n E=\"4\"\n BS=\"N\"\n/><b\n id=\"50\"\n Z=\"50\"\n B=\"4\"\n E=\"5\"\n Order=\"2\"\n BS=\"N\"\n BondCircularOrdering=\"49 71 69 51\"\n/><b\n id=\"51\"\n Z=\"51\"\n B=\"5\"\n E=\"6\"\n BS=\"N\"\n/><b\n id=\"52\"\n Z=\"52\"\n B=\"6\"\n E=\"7\"\n Order=\"2\"\n BS=\"N\"\n BondCircularOrdering=\"51 0 54 53\"\n/><b\n id=\"53\"\n Z=\"53\"\n B=\"2\"\n E=\"7\"\n BS=\"N\"\n/><b\n id=\"54\"\n Z=\"54\"\n B=\"7\"\n E=\"8\"\n BS=\"N\"\n/><b\n id=\"55\"\n Z=\"55\"\n B=\"8\"\n E=\"9\"\n BS=\"N\"\n/><b\n id=\"56\"\n Z=\"56\"\n B=\"9\"\n E=\"10\"\n BS=\"N\"\n/><b\n id=\"57\"\n Z=\"57\"\n B=\"10\"\n E=\"11\"\n BS=\"N\"\n/><b\n id=\"58\"\n Z=\"58\"\n B=\"11\"\n E=\"12\"\n BS=\"N\"\n/><b\n id=\"59\"\n Z=\"59\"\n B=\"12\"\n E=\"13\"\n BS=\"N\"\n/><b\n id=\"60\"\n Z=\"60\"\n B=\"8\"\n E=\"13\"\n BS=\"N\"\n/><b\n id=\"61\"\n Z=\"61\"\n B=\"11\"\n E=\"14\"\n BS=\"N\"\n/><b\n id=\"62\"\n Z=\"62\"\n B=\"14\"\n E=\"15\"\n BS=\"N\"\n/><b\n id=\"63\"\n Z=\"63\"\n B=\"15\"\n E=\"16\"\n BS=\"N\"\n/><b\n id=\"64\"\n Z=\"64\"\n B=\"16\"\n E=\"17\"\n BS=\"N\"\n/><b\n id=\"65\"\n Z=\"65\"\n B=\"17\"\n E=\"18\"\n BS=\"N\"\n/><b\n id=\"66\"\n Z=\"66\"\n B=\"18\"\n E=\"19\"\n BS=\"N\"\n/><b\n id=\"67\"\n Z=\"67\"\n B=\"14\"\n E=\"19\"\n BS=\"N\"\n/><b\n id=\"68\"\n Z=\"68\"\n B=\"17\"\n E=\"20\"\n BS=\"N\"\n/><b\n id=\"69\"\n Z=\"69\"\n B=\"5\"\n E=\"21\"\n BS=\"N\"\n/><b\n id=\"70\"\n Z=\"70\"\n B=\"21\"\n E=\"22\"\n BS=\"N\"\n/><b\n id=\"71\"\n Z=\"71\"\n B=\"4\"\n E=\"23\"\n BS=\"N\"\n/><b\n id=\"72\"\n Z=\"72\"\n B=\"23\"\n E=\"24\"\n BS=\"N\"\n/><b\n id=\"73\"\n Z=\"73\"\n B=\"24\"\n E=\"25\"\n Order=\"2\"\n BS=\"N\"\n BondCircularOrdering=\"72 78 74 0\"\n/><b\n id=\"74\"\n Z=\"74\"\n B=\"25\"\n E=\"26\"\n BS=\"N\"\n/><b\n id=\"75\"\n Z=\"75\"\n B=\"26\"\n E=\"27\"\n Order=\"2\"\n BS=\"N\"\n BondCircularOrdering=\"0 74 76 96\"\n/><b\n id=\"76\"\n Z=\"76\"\n B=\"27\"\n E=\"28\"\n BS=\"N\"\n/><b\n id=\"77\"\n Z=\"77\"\n B=\"28\"\n E=\"29\"\n Order=\"2\"\n BS=\"N\"\n BondCircularOrdering=\"79 76 78 0\"\n/><b\n id=\"78\"\n Z=\"78\"\n B=\"24\"\n E=\"29\"\n BS=\"N\"\n/><b\n id=\"79\"\n Z=\"79\"\n B=\"28\"\n E=\"30\"\n BS=\"N\"\n/><b\n id=\"80\"\n Z=\"80\"\n B=\"30\"\n E=\"31\"\n BS=\"N\"\n/><b\n id=\"81\"\n Z=\"81\"\n B=\"31\"\n E=\"32\"\n Order=\"2\"\n BS=\"N\"\n BondCircularOrdering=\"91 80 92 82\"\n/><b\n id=\"82\"\n Z=\"82\"\n B=\"32\"\n E=\"33\"\n BS=\"N\"\n/><b\n id=\"83\"\n Z=\"83\"\n B=\"33\"\n E=\"34\"\n Order=\"2\"\n BS=\"N\"\n BondCircularOrdering=\"88 82 0 84\"\n/><b\n id=\"84\"\n Z=\"84\"\n B=\"34\"\n E=\"35\"\n BS=\"N\"\n/><b\n id=\"85\"\n Z=\"85\"\n B=\"35\"\n E=\"36\"\n Order=\"2\"\n BS=\"N\"\n BondCircularOrdering=\"84 0 0 86\"\n/><b\n id=\"86\"\n Z=\"86\"\n B=\"36\"\n E=\"37\"\n BS=\"N\"\n/><b\n id=\"87\"\n Z=\"87\"\n B=\"37\"\n E=\"38\"\n Order=\"2\"\n BS=\"N\"\n BondCircularOrdering=\"86 0 89 88\"\n/><b\n id=\"88\"\n Z=\"88\"\n B=\"33\"\n E=\"38\"\n BS=\"N\"\n/><b\n id=\"89\"\n Z=\"89\"\n B=\"38\"\n E=\"39\"\n BS=\"N\"\n/><b\n id=\"90\"\n Z=\"90\"\n B=\"39\"\n E=\"40\"\n Order=\"2\"\n BS=\"N\"\n BondCircularOrdering=\"89 0 0 91\"\n/><b\n id=\"91\"\n Z=\"91\"\n B=\"31\"\n E=\"40\"\n BS=\"N\"\n/><b\n id=\"92\"\n Z=\"92\"\n B=\"32\"\n E=\"41\"\n BS=\"N\"\n/><b\n id=\"93\"\n Z=\"93\"\n B=\"41\"\n E=\"42\"\n Order=\"2\"\n BS=\"N\"\n/><b\n id=\"94\"\n Z=\"94\"\n B=\"41\"\n E=\"43\"\n BS=\"N\"\n/><b\n id=\"95\"\n Z=\"95\"\n B=\"41\"\n E=\"44\"\n BS=\"N\"\n/><b\n id=\"96\"\n Z=\"96\"\n B=\"27\"\n E=\"45\"\n BS=\"N\"\n/></fragment></page></CDXML>";

const createSarData = (seed: number): SARData => ({
  tsa_tm: Number((2.1 + (seed % 9) * 0.7).toFixed(1)),
  enzyme: {
    wt: Number((0.04 + (seed % 7) * 0.13).toFixed(2)),
    d1228n: Number((0.07 + (seed % 5) * 0.16).toFixed(2)),
    f1250k: Number((0.03 + (seed % 6) * 0.05).toFixed(2)),
    wt_f1250k: Number((0.4 + (seed % 8) * 2.7).toFixed(1)),
  },
  cell: {
    ebc1: Number((0.05 + (seed % 8) * 0.12).toFixed(2)),
    hs746t: Number((0.08 + (seed % 7) * 0.16).toFixed(2)),
    snu16: Number((0.03 + (seed % 9) * 0.1).toFixed(2)),
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
    '3a_m': 70 + (seed % 25),
    '3a_t': 55 + (seed % 28),
    '3a4': 70 + (seed % 25),
  },
  herg: Number((2 + (seed % 10) * 2.8).toFixed(1)),
  pk: {
    pe: Number((0.08 + (seed % 8) * 0.05).toFixed(2)),
    salt_form: seed % 2 === 0 ? 'Free' : 'HCl',
    dose: 10,
    plasma_1h: 520 + seed * 37,
    plasma_4h: 260 + seed * 24,
    lung_1h: 410 + seed * 31,
    lung_4h: 180 + seed * 19,
    brain_1h: 120 + seed * 16,
    brain_4h: 90 + seed * 13,
  },
});

const createKinomeProfilePoints = (seed: number): KinomeProfilePoint[] => {
  const offset = seed % 9;
  const basePoints: KinomeProfilePoint[] = [
    { gene: 'EGFR', family: 'TK', inhibition: 96 - offset },
    { gene: 'MET', family: 'TK', inhibition: 92 - (offset % 4) },
    { gene: 'FGFR3', family: 'TK', inhibition: 78 + (offset % 8) },
    { gene: 'KDR', family: 'TK', inhibition: 84 - (offset % 7) },
    { gene: 'FLT3', family: 'TK', inhibition: 72 + (offset % 9) },
    { gene: 'JAK2', family: 'TK', inhibition: 68 + (offset % 11) },
    { gene: 'SRC', family: 'TK', inhibition: 83 - (offset % 5) },
    { gene: 'ABL1', family: 'TK', inhibition: 74 + (offset % 8) },
    { gene: 'ALK', family: 'TK', inhibition: 63 + (offset % 12) },
    { gene: 'BTK', family: 'TK', inhibition: 57 + (offset % 14) },
    { gene: 'RAF1', family: 'TKL', inhibition: 76 + (offset % 6) },
    { gene: 'BRAF', family: 'TKL', inhibition: 52 + (offset % 13) },
    { gene: 'IRAK4', family: 'TKL', inhibition: 48 + (offset % 18) },
    { gene: 'PAK1', family: 'STE', inhibition: 49 + (offset % 18) },
    { gene: 'MAP2K1', family: 'STE', inhibition: 44 + (offset % 14) },
    { gene: 'CDK2', family: 'CMGC', inhibition: 72 - (offset % 6) },
    { gene: 'CDK5', family: 'CMGC', inhibition: 59 + (offset % 16) },
    { gene: 'GSK3B', family: 'CMGC', inhibition: 64 + (offset % 15) },
    { gene: 'MAPK14', family: 'CMGC', inhibition: 58 + (offset % 12) },
    { gene: 'AKT1', family: 'AGC', inhibition: 61 + (offset % 16) },
    { gene: 'PKCA', family: 'AGC', inhibition: 88 - (offset % 6) },
    { gene: 'SGK1', family: 'AGC', inhibition: 60 + (offset % 17) },
    { gene: 'CAMK2A', family: 'CAMK', inhibition: 46 + (offset % 18) },
    { gene: 'CHEK1', family: 'CAMK', inhibition: 55 + (offset % 16) },
    { gene: 'CSNK1D', family: 'CK1', inhibition: 51 + (offset % 15) },
    { gene: 'PLK1', family: 'Other', inhibition: 66 + (offset % 10) },
    { gene: 'RIOK1', family: 'Atypical', inhibition: 64 + (offset % 17) },
  ];

  return basePoints
    .filter((_, index) => (index + seed) % 3 !== 1)
    .slice(0, 18);
};

const createQuickViewerAssets = (seed: number, compoundId: string): CompoundQuickViewerAsset[] => {
  const assets: CompoundQuickViewerAsset[] = [];

  if (seed % 5 === 0 || seed % 4 === 1) {
    const layout: KinomeLayoutId = 'coral-basetree';

    assets.push({
      type: 'kp',
      label: 'KP',
      resultCount: 1 + (seed % 3),
      payload: {
        title: `${compoundId} kinase profiling`,
        assay: 'DiscoverX KINOMEscan, 1 uM',
        layout,
        points: createKinomeProfilePoints(seed),
        infoRows: [
          { label: 'Assay', value: 'KINOMEscan' },
          { label: 'Concentration', value: '1 uM' },
          { label: 'Coverage', value: `${260 + (seed % 6) * 12} kinases` },
          { label: 'Strong hits', value: `${3 + (seed % 4)} targets` },
        ],
      },
    });
  }

  if (seed % 4 === 0) {
    assets.push({
      type: 'pdb',
      label: 'PDB',
      resultCount: 2 + (seed % 3),
      payload: {
        title: `${compoundId} PDB 6LUB`,
        structureUrl: '/quick_viewer/6LUB.cif',
        structureFormat: 'mmcif',
        pdbId: '6LUB',
        sourceLabel: 'local sample',
      },
    });
  }

  if (seed % 2 === 0) {
    assets.push({ type: 'docking', label: 'Docking', resultCount: 4 + (seed % 5) });
  }

  if (seed % 3 === 0) {
    assets.push({ type: 'md', label: 'MD', resultCount: 1 + (seed % 2) });
  }

  return assets;
};

const createMockCompound = (
  seed: number,
  groupId: string,
  project: string,
  designNoPrefix: string,
  memoBase: string,
  compoundIdOverride?: string,
  smilesOverride?: string,
): Compound => {
  const dateDay = String((seed % 24) + 1).padStart(2, '0');
  const source = designSources[seed % designSources.length];
  const isCompleted = seed % 5 === 0;
  const compoundId = compoundIdOverride ?? `VNA240${String(140 + seed).padStart(3, '0')}`;
  const designName = `${designNoPrefix}-${String(seed).padStart(3, '0')}`;

  return {
    id: `c${seed}`,
    groupId,
    compoundId,
    name: compoundId || designName,
    source: 'Manual',
    smiles: smilesOverride ?? sampleSmiles[seed % sampleSmiles.length],
    structureSvg: structureSvgs[seed % structureSvgs.length],
    creDate: `2026.04.${dateDay}`,
    manager: synthesisOwners[seed % synthesisOwners.length],
    status: isCompleted ? '합성 완료' : seed % 3 === 0 ? '합성 중' : '디자인',
    project,
    shareStatus: seed % 4 === 0 ? '공유받음' : seed % 3 === 0 ? '공유함' : '내 물질',
    designSource: source,
    properties1: [45 + (seed % 5) * 8, 35 + (seed % 7) * 7, 50 + (seed % 6) * 6, 42 + (seed % 8) * 5],
    properties2: [52 + (seed % 6) * 6, 40 + (seed % 5) * 9, 48 + (seed % 7) * 6, 38 + (seed % 6) * 7],
    molecularWeight: Number((280 + (seed % 19) * 13.7).toFixed(2)),
    requiredCalcs: seed % 2 === 0 ? ['3D PSA QM', 'Solubility QM'] : ['Permeability MD', '특허성'],
    ideaNumber: designName,
    ideaMemo: `${memoBase} - ${source} 기반 ${seed % 2 === 0 ? '극성 조정' : '치환기 확장'} 후보`,
    requiredAmountMg: 10 + (seed % 5) * 5,
    assayPurpose: `${project} 활성 및 ADME profile 확인`,
    expectedEffect: seed % 2 === 0 ? '세포 활성 유지 및 용해도 개선' : 'selectivity 개선 및 hERG risk 감소',
    requestDate: `2026.05.${String((seed % 18) + 1).padStart(2, '0')}`,
    synthesisExpansionLevel: seed % 3 === 0 ? '상' : seed % 3 === 1 ? '중' : '하',
    requestMemo: seed % 2 === 0 ? '우선 합성 후보' : '후속 SAR 확인용',
    synthesisOwner: synthesisOwners[seed % synthesisOwners.length],
    synthesisStudyGroup: `합성 ${(seed % 3) + 1}그룹`,
    synthesisAcceptedDate: `2026.05.${String((seed % 18) + 2).padStart(2, '0')}`,
    synthesisTargetDate: `2026.06.${String((seed % 20) + 1).padStart(2, '0')}`,
    progressMemo: isCompleted ? '합성 완료, 분석 등록' : seed % 3 === 0 ? '중간체 확보' : 'route 검토 중',
    isCompleted,
    registeredDate: `2026.05.${String((seed % 18) + 2).padStart(2, '0')}`,
    researchNote: `ELN-2026-${String(60 + seed).padStart(3, '0')}`,
    reportData: isCompleted ? 'HPLC/NMR 확인' : '예상 MS 등록',
    synthesisEndReason: isCompleted ? '목표 물질 확보' : '-',
    experimentStage: (seed % 5) + 1,
    quickViewerAssets: createQuickViewerAssets(seed, compoundId || designName),
    sar: createSarData(seed),
  };
};

const legacyMockCompounds: Compound[] = [
  ...Array.from({ length: 11 }, (_, index) =>
    createMockCompound(index + 5, 'g1', 'FGFR', 'D-FGFR', 'FGFR hinge binder SAR')
  ),
  ...Array.from({ length: 17 }, (_, index) =>
    createMockCompound(index + 16, 'g2', 'HER2', 'D-HER2', 'HER2 활성 증가 scaffold')
  ),
  {
    id: 'c1', groupId: 'g3', compoundId: 'VNA240137', name: 'VNA240137', source: 'Manual', smiles: sampleSmiles[0], creDate: '2025.04.10', project: 'cMET', shareStatus: '내 물질', designSource: '내 머리',
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
    requiredCalcs: ['3D PSA QM', 'Solubility QM'],
    ideaNumber: 'D-cMET-001',
    ideaMemo: 'Tepotinib hinge binder 변형안',
    requiredAmountMg: 20,
    assayPurpose: 'cMET wt 활성 개선',
    expectedEffect: '세포 활성 2배 개선',
    requestDate: '2026.05.02',
    synthesisExpansionLevel: '중',
    requestMemo: '우선 합성 후보',
    synthesisOwner: '문태훈',
    synthesisStudyGroup: '합성 1그룹',
    synthesisAcceptedDate: '2026.05.03',
    synthesisTargetDate: '2026.05.24',
    progressMemo: '중간체 확보',
    isCompleted: false,
    registeredDate: '2026.05.03',
    researchNote: 'ELN-2026-051',
    reportData: 'LCMS 확인',
    synthesisEndReason: '-',
    experimentStage: 2,
    quickViewerAssets: createQuickViewerAssets(60, 'VNA240137')
  },
  {
    id: 'c2', groupId: 'g3', compoundId: 'VNA240138', name: 'VNA240138', source: 'Manual', smiles: sampleSmiles[1], creDate: '2025.03.21', project: 'cMET', shareStatus: '공유함', designSource: 'Patent',
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
    ideaNumber: 'D-cMET-002',
    ideaMemo: '특허 예시 구조 기반 극성 조정',
    requiredAmountMg: 15,
    assayPurpose: '용해도 개선 후 활성 유지',
    expectedEffect: 'Solubility risk 감소',
    requestDate: '2026.05.04',
    synthesisExpansionLevel: '하',
    requestMemo: '소량 스크리닝',
    synthesisOwner: '윤지수',
    synthesisStudyGroup: '합성 2그룹',
    synthesisAcceptedDate: '2026.05.05',
    synthesisTargetDate: '2026.05.21',
    progressMemo: 'route 검토 중',
    isCompleted: false,
    registeredDate: '2026.05.05',
    researchNote: 'ELN-2026-052',
    reportData: '예상 MS 등록',
    synthesisEndReason: '-',
    experimentStage: 1,
    quickViewerAssets: createQuickViewerAssets(22, 'VNA240138')
  },
  {
    id: 'c3', groupId: 'g3', compoundId: 'VNA240139', name: 'VNA240139', source: 'Manual', smiles: sampleSmiles[2], creDate: '2024.12.15', project: 'cMET', shareStatus: '공유받음', designSource: 'Paper',
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
    ideaNumber: 'D-cMET-003',
    ideaMemo: 'sulfonamide linker SAR 확인',
    requiredAmountMg: 30,
    assayPurpose: 'selectivity profile 확인',
    expectedEffect: 'off-target 감소',
    requestDate: '2026.05.06',
    synthesisExpansionLevel: '상',
    requestMemo: '유도체 확장 가능성 확인',
    synthesisOwner: '문태훈',
    synthesisStudyGroup: '합성 1그룹',
    synthesisAcceptedDate: '2026.05.07',
    synthesisTargetDate: '2026.05.29',
    progressMemo: '1단계 반응 완료',
    isCompleted: false,
    registeredDate: '2026.05.07',
    researchNote: 'ELN-2026-053',
    reportData: 'NMR 예정',
    synthesisEndReason: '-',
    experimentStage: 3,
    quickViewerAssets: createQuickViewerAssets(25, 'VNA240139')
  },
  {
    id: 'c4', groupId: 'g3', compoundId: 'VNA240140', name: 'VNA240140', source: 'Manual', smiles: sampleSmiles[3], creDate: '2025.01.28', project: 'cMET', shareStatus: '내 물질', designSource: 'FBDD',
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
    requiredCalcs: ['3D PSA QM', '합성기능성'],
    ideaNumber: 'D-cMET-004',
    ideaMemo: 'fragment merge 후보',
    requiredAmountMg: 10,
    assayPurpose: 'early FBDD hit validation',
    expectedEffect: 'binding efficiency 개선',
    requestDate: '2026.05.08',
    synthesisExpansionLevel: '중',
    requestMemo: '후속 docking 결과 대기',
    synthesisOwner: '윤지수',
    synthesisStudyGroup: '합성 2그룹',
    synthesisAcceptedDate: '2026.05.09',
    synthesisTargetDate: '2026.05.23',
    progressMemo: '합성 완료, 정제 중',
    isCompleted: true,
    registeredDate: '2026.05.09',
    researchNote: 'ELN-2026-054',
    reportData: 'HPLC purity 97%',
    synthesisEndReason: '목표 물질 확보',
    experimentStage: 5,
    quickViewerAssets: createQuickViewerAssets(12, 'VNA240140')
  },
  ...Array.from({ length: 3 }, (_, index) =>
    createMockCompound(index + 33, 'g3', 'cMET', 'D-cMET', 'Tepotinib 변형 SAR')
  ),
  {
    id: 'c-g4-1',
    groupId: 'g4',
    compoundId: 'VNA260601001',
    name: 'VNA260601001',
    source: 'Manual',
    smiles: sampleSmiles[21],
    structureSvg: myBoardGroup4Svg,
    draw: myBoardGroup4Cdxml,
    creDate: '2026.06.01',
    manager: '문태훈',
    status: '디자인',
    project: 'Unassigned',
    shareStatus: '내 물질',
    designSource: '내 머리',
    properties1: [62, 48, 71, 54],
    properties2: [58, 45, 69, 51],
    requiredCalcs: ['3D PSA QM', '특허성'],
    ideaNumber: 'D-MB-001',
    ideaMemo: 'C1CC1(C(=O)NC2=CC=C(C=C2)OC3=C4C=C(NC4=NC=C3)C(=O)NCCN5CCOCC5)C(=O)NC6=CC=C(C=C6)F',
    requiredAmountMg: 10,
    assayPurpose: '그룹 리스트 및 대표 구조 확인',
    expectedEffect: '목록 렌더링 확인용',
    requestDate: '2026.06.01',
    synthesisExpansionLevel: '하',
    requestMemo: 'mock group seed',
    synthesisOwner: '문태훈',
    synthesisStudyGroup: '합성 1그룹',
    synthesisAcceptedDate: '2026.06.01',
    synthesisTargetDate: '2026.06.15',
    progressMemo: 'mock 등록',
    isCompleted: false,
    registeredDate: '2026.06.01',
    researchNote: 'ELN-2026-201',
    reportData: 'mock only',
    synthesisEndReason: '-',
    experimentStage: 1,
    quickViewerAssets: createQuickViewerAssets(45, 'VNA260601001'),
    sar: createSarData(41),
  },
  {
    id: 'c-g5-1',
    groupId: 'g5',
    compoundId: 'VNA260601002',
    name: 'VNA260601002',
    source: 'Manual',
    smiles: sampleSmiles[20],
    structureSvg: myBoardGroup5Svg,
    draw: myBoardGroup5Cdxml,
    creDate: '2026.06.01',
    manager: '윤지수',
    status: '디자인',
    project: 'Unassigned',
    shareStatus: '내 물질',
    designSource: 'Patent',
    properties1: [57, 52, 66, 49],
    properties2: [61, 47, 64, 53],
    requiredCalcs: ['Permeability MD', '특허성'],
    ideaNumber: 'D-MB-002',
    ideaMemo: 'CC1=CC(=C(C=C1N2CCC(CC2)N3CCN(CC3)C)OC)NC4=NC=C(C(=N4)NC5=C(C6=NC=CN=C6C=C5)P(=O)(C)C)Br',
    requiredAmountMg: 10,
    assayPurpose: '그룹 리스트 및 대표 구조 확인',
    expectedEffect: '목록 렌더링 확인용',
    requestDate: '2026.06.01',
    synthesisExpansionLevel: '하',
    requestMemo: 'mock group seed',
    synthesisOwner: '윤지수',
    synthesisStudyGroup: '합성 2그룹',
    synthesisAcceptedDate: '2026.06.01',
    synthesisTargetDate: '2026.06.15',
    progressMemo: 'mock 등록',
    isCompleted: false,
    registeredDate: '2026.06.01',
    researchNote: 'ELN-2026-202',
    reportData: 'mock only',
    synthesisEndReason: '-',
    experimentStage: 1,
    quickViewerAssets: createQuickViewerAssets(44, 'VNA260601002'),
    sar: createSarData(42),
  },
];

export const mockCompounds: Compound[] = exampleCompoundRows.map((row, rowIndex) => {
  const seed = rowIndex + 1;
  const project = getExampleGroupProject(row.group);
  const requestStatusBySeed: Record<number, Compound['synthesisRequestStatus']> = {
    2: 'requested',
    3: 'accepted',
    4: 'synthesizing',
    5: 'vnaIssued',
  };
  const synthesisRequestStatus = requestStatusBySeed[seed % 12];
  const compoundId = seed % 6 === 0 || synthesisRequestStatus === 'vnaIssued'
    ? getExampleCompoundId(row)
    : '';

  return {
    ...createMockCompound(
      seed,
      getExampleGroupId(row.group),
      project,
      `D-${row.group}`,
      `${row.group} ${project} SAR`,
      compoundId,
      row.smiles
    ),
    ...(synthesisRequestStatus
      ? {
        synthesisRequestStatus,
        synthesisRequestType: seed % 2 === 0 ? '신규 합성' : '재합성',
        synthesisStep: `${(seed % 4) + 1}단계`,
      }
      : {}),
  };
});
