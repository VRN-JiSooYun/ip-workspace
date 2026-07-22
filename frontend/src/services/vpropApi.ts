import { notifyIfAuthRequired } from './authApi';

type RuntimeWindow = Window & { _env_?: { VITE_API_URL?: string } };

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

export type VpropPredictResponse = { result: VpropResult };

const getApiBaseUrl = () => {
  const runtimeValue = typeof window !== 'undefined'
    ? (window as RuntimeWindow)._env_?.VITE_API_URL
    : undefined;
  const value = runtimeValue || import.meta.env.VITE_API_URL || '/api';
  return value.includes('${') ? '/api' : value.replace(/\/$/, '');
};

const buildApiUrl = (path: string) =>
  new URL(`${getApiBaseUrl()}${path}`, window.location.origin).toString();

const parseError = async (response: Response) => {
  const body = await response.json().catch(() => null);
  const message = body?.message;
  if (Array.isArray(message)) return message.join(', ');
  return typeof message === 'string' && message.trim()
    ? message
    : `API request failed: ${response.status}`;
};

export const vpropApi = {
  async predict(smiles: string): Promise<VpropPredictResponse> {
    const response = await fetch(buildApiUrl('/calculations/vprop/predict'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ smiles }),
    });
    notifyIfAuthRequired(response);
    if (!response.ok) throw new Error(await parseError(response));
    return response.json() as Promise<VpropPredictResponse>;
  },
};
