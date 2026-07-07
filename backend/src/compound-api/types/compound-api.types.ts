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
