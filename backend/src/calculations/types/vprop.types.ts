export type VpropAtomValue = {
  atomIndex: number;
  value: number;
};

export type VpropPhValue = {
  pH: number;
  value: number;
};

export type VpropSolubility = {
  intrinsicSolubility: number;
  unit: string;
  phDependentSolubilities: VpropPhValue[];
  logS_pH74: number;
  uM_pH74: number;
  mg_per_ml_pH74: number;
};

export type VpropResult = {
  info: {
    pkaValuesByAtom: VpropAtomValue[];
    basicValuesByAtom: VpropAtomValue[];
    acidicValuesByAtom: VpropAtomValue[];
    minAcidicValue: number | null;
    maxBasicValue: number | null;
    structure: string;
  };
  logP: number;
  logDByPh: VpropPhValue[];
  solubilities: Record<string, VpropSolubility>;
  svg_img: string;
  distribution: {
    structures: string[];
    structureDistributionsByPh: Array<{ pH: number; percentages: number[] }>;
  };
  distribution_smiles: string[];
  distribution_svg_imgs: string[];
};

export type VpropPredictResponse = {
  result: VpropResult;
};
