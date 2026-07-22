export interface CompoundSearchItem {
  compound_code: string;
}

export interface CompoundDataItem {
  compound_code: string;
  smiles: string;
}

export interface GetCompoundsResponse {
  compounds: CompoundDataItem[];
}

export type CompoundSarDataRow = Record<string, string | number | null>;

export interface GroupedCompoundSarData {
  compound_code: string;
  rows: CompoundSarDataRow[];
}

export interface CompoundCalculateData {
  heavy_atom_count: number;
  fsp3: number;
  num_rotatable_bonds: number;
  log_s: number;
  cns_mpo_score: number;
  log_p: number;
  log_d: number;
  molecular_weight: number;
  topological_polar_surface_area: number;
  num_h_bond_donors: number;
  pka: number;
  exact_mass: number;
  chemical_formula: string;
  composition: Record<string, string>;
  num_h_bond_acceptors: number;
  num_h_bond_donors_site: number;
  num_h_bond_acceptors_site: number;
  num_rule_of_5_violations: number;
}

export interface GetCompoundCalculateResponse {
  result: boolean;
  data: CompoundCalculateData;
}
