import { CHEMDRAW_CONFIG } from '../config/chemdraw';
import { waitForChemDrawEditorReady } from '../utils/chemdrawCommit';
import { installCanvasReadbackPatch } from '../utils/canvasReadback';
import { installPassiveWheelListenerPatch } from '../utils/passiveWheelListenerPatch';

const smilesToMolBlockCache = new Map<string, string>();
const smilesToMolBlockInFlight = new Map<string, Promise<string>>();
const rdkitSvgCache = new Map<string, string>();
const rdkitSvgRequestCache = new Map<string, Promise<{ molBlock: string; svg: string; cacheKey: string }>>();
const rdkitClusterCache = new Map<string, RdkitClusterResult>();
const rdkitClusterRequestCache = new Map<string, Promise<RdkitClusterResult>>();
let molBlockConversionQueue = Promise.resolve();

const loadChemDrawScript = (() => {
  let promise: Promise<void> | null = null;

  return () => {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('Window is not available'));
    }

    if ((window as any).perkinelmer?.ChemdrawWebManager) {
      return Promise.resolve();
    }

    if (!promise) {
      promise = new Promise<void>((resolve, reject) => {
        const existingScript = document.querySelector<HTMLScriptElement>(
          `script[src="${CHEMDRAW_CONFIG.SCRIPT_PATH}"]`
        );

        if (existingScript) {
          existingScript.addEventListener('load', () => resolve(), { once: true });
          existingScript.addEventListener('error', () => reject(new Error('Failed to load ChemDraw')), { once: true });
          return;
        }

        const script = document.createElement('script');
        script.src = CHEMDRAW_CONFIG.SCRIPT_PATH;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load ChemDraw'));
        document.body.appendChild(script);
      });
    }

    return promise;
  };
})();

const getCallbackMethodData = (editor: any, methodName: string) => {
  const method = editor?.[methodName];
  if (typeof method !== 'function') return Promise.resolve('');

  return new Promise<string>((resolve) => {
    let resolved = false;
    const finish = (value: string) => {
      if (resolved) return;
      resolved = true;
      resolve(value || '');
    };

    try {
      const result = method.call(editor, (value: string | undefined, error: unknown) => {
        finish(error ? '' : value || '');
      });
      if (typeof result === 'string') finish(result);
    } catch {
      finish('');
    }

    window.setTimeout(() => finish(''), 1000);
  });
};

const getMolBlockFromEditor = async (editor: any) => {
  const formats = (window as any).perkinelmer?.DataFormats;

  if (editor?.getData) {
    for (const format of [formats?.MOLV2000, formats?.MOLFILE, 'chemical/x-mdl-molfile']) {
      if (!format) continue;
      try {
        const value = editor.getData(format);
        if (typeof value === 'string' && value.trim()) return value;
      } catch {
        // Try the next format.
      }
    }
  }

  return await getCallbackMethodData(editor, 'getMOL');
};

export const convertSmilesToMolBlock = async (smiles: string) => {
  const normalizedSmiles = smiles.trim();
  if (!normalizedSmiles) return '';

  const cached = smilesToMolBlockCache.get(normalizedSmiles);
  if (cached) return cached;

  const inFlight = smilesToMolBlockInFlight.get(normalizedSmiles);
  if (inFlight) return inFlight;

  const runConversion = async () => {
    const queuedCached = smilesToMolBlockCache.get(normalizedSmiles);
    if (queuedCached) return queuedCached;

    const restoreReadbackPatch = installCanvasReadbackPatch();
    const restorePassiveWheelPatch = installPassiveWheelListenerPatch();
    let container: HTMLDivElement | null = null;

    try {
      await loadChemDrawScript();

      const manager = (window as any).perkinelmer?.ChemdrawWebManager;
      const formats = (window as any).perkinelmer?.DataFormats;
      if (!manager) throw new Error('ChemDraw manager is not available');

      const containerId = `structure-render-${Math.random().toString(36).slice(2, 11)}`;
      container = document.createElement('div');
      container.id = containerId;
      container.style.position = 'fixed';
      container.style.left = '-10000px';
      container.style.top = '-10000px';
      container.style.width = '320px';
      container.style.height = '240px';
      container.style.opacity = '0';
      container.style.pointerEvents = 'none';
      document.body.appendChild(container);

      const editor = await new Promise<any>((resolve, reject) => {
        let settled = false;
        const timer = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(new Error('ChemDraw attach timeout'));
        }, 3000);

        manager.attach({
          id: containerId,
          license: CHEMDRAW_CONFIG.LICENSE_XML,
          viewOnly: true,
          callback: (attachedEditor: any) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timer);
            resolve(attachedEditor);
          },
        });
      });

      await waitForChemDrawEditorReady(containerId, editor);

      if (editor.loadSMILES) {
        editor.loadSMILES(normalizedSmiles);
      } else if (editor.setData) {
        editor.setData(formats?.SMILES || 'chemical/x-daylight-smiles', normalizedSmiles);
      } else if (editor.setMolecule) {
        editor.setMolecule(normalizedSmiles);
      }

      await new Promise((resolve) => window.setTimeout(resolve, 250));

      const molBlock = (await getMolBlockFromEditor(editor)).trim();
      if (!molBlock) throw new Error('MOL block conversion failed');

      smilesToMolBlockCache.set(normalizedSmiles, molBlock);
      return molBlock;
    } finally {
      container?.remove();
      restoreReadbackPatch();
      restorePassiveWheelPatch();
    }
  };

  const queuedConversion = molBlockConversionQueue.then(runConversion, runConversion);
  smilesToMolBlockInFlight.set(normalizedSmiles, queuedConversion);
  molBlockConversionQueue = queuedConversion.then(() => undefined, () => undefined);
  void queuedConversion.finally(() => {
    if (smilesToMolBlockInFlight.get(normalizedSmiles) === queuedConversion) {
      smilesToMolBlockInFlight.delete(normalizedSmiles);
    }
  });
  return queuedConversion;
};

export interface RdkitDrawOptions {
  molBlock?: string | null;
  smiles?: string | null;
  angleDeg?: number;
  scalePercent?: number;
  minSize?: [number, number];
}

export type RdkitClusterHighlightMode = 'com' | 'diff';

export interface RdkitClusterCompoundInput {
  id: string;
  compoundId?: string;
  name?: string;
  molBlock?: string | null;
  smiles?: string | null;
}

export interface RdkitClusterRenderedCompound {
  id: string;
  svg: string;
  clusterId?: string | number | null;
  highlightAtoms?: number[];
  substructure?: string | null;
  highlightColor?: string | null;
}

export interface RdkitClusterResult {
  cacheKey: string;
  compounds: RdkitClusterRenderedCompound[];
}

const normalizeMinSize = (minSize?: [number, number]): [number, number] | undefined => {
  if (!minSize) return undefined;

  return [
    Math.max(1, Math.round(minSize[0])),
    Math.max(1, Math.round(minSize[1])),
  ];
};

const isLikelyMolBlock = (value: string) => {
  const lines = value.split(/\r?\n/);
  if (lines.length < 4) return false;

  return /^\s*\d+\s+\d+\s+/.test(lines[3]) && /M\s+END\b/.test(value);
};

export const createRdkitSvgCacheKey = ({
  molBlock,
  angleDeg = 0,
  scalePercent = 100,
  minSize,
}: Omit<RdkitDrawOptions, 'smiles'> & { molBlock: string }) => {
  const normalizedAngle = ((Math.round(angleDeg) % 360) + 360) % 360;
  const normalizedScale = Math.max(40, Math.min(180, Math.round(scalePercent)));
  const normalizedMinSize = normalizeMinSize(minSize);

  return JSON.stringify({
    molBlock,
    angle: normalizedAngle,
    scale: normalizedScale,
    minSize: normalizedMinSize,
  });
};

const createRdkitClusterCacheKey = ({
  compounds,
  mode,
  angleDeg = 0,
  scalePercent = 100,
  minSize,
}: {
  compounds: RdkitClusterCompoundInput[];
  mode: RdkitClusterHighlightMode;
  angleDeg?: number;
  scalePercent?: number;
  minSize?: [number, number];
}) => {
  const normalizedAngle = ((Math.round(angleDeg) % 360) + 360) % 360;
  const normalizedScale = Math.max(40, Math.min(180, Math.round(scalePercent)));
  const normalizedMinSize = normalizeMinSize(minSize);

  return JSON.stringify({
    mode,
    angle: normalizedAngle,
    scale: normalizedScale,
    minSize: normalizedMinSize,
    compounds: compounds.map((compound) => ({
      id: compound.id,
      source: compound.molBlock?.trim() || (compound.smiles?.trim() ? `SMILES:${compound.smiles.trim()}` : ''),
    })),
  });
};

const getRdkitApiBaseUrl = () => {
  return (import.meta.env.VITE_RDKIT_API_URL || '/rdkit-api').replace(/\/$/, '');
};

export const renderRdkitSvg = async ({
  molBlock,
  smiles,
  angleDeg = 0,
  scalePercent = 100,
  minSize,
}: RdkitDrawOptions) => {
  const normalizedMolBlock = molBlock?.trim() || '';
  const normalizedSmiles = smiles?.trim() || '';
  const requestMolBlock = normalizedMolBlock && isLikelyMolBlock(normalizedMolBlock) ? normalizedMolBlock : '';
  const cachedMolBlock = !requestMolBlock && normalizedSmiles
    ? smilesToMolBlockCache.get(normalizedSmiles) || ''
    : '';
  const validCachedMolBlock = cachedMolBlock && isLikelyMolBlock(cachedMolBlock) ? cachedMolBlock : '';
  const sourceMolBlock = requestMolBlock || validCachedMolBlock;
  const renderSourceKey = requestMolBlock || (normalizedSmiles ? `SMILES:${normalizedSmiles}` : '');
  if (!renderSourceKey) throw new Error('RDKit 렌더링에 사용할 구조 데이터가 없습니다.');

  const normalizedAngle = ((Math.round(angleDeg) % 360) + 360) % 360;
  const normalizedScale = Math.max(40, Math.min(180, Math.round(scalePercent)));
  const normalizedMinSize = normalizeMinSize(minSize);
  const fixedBondLength = Math.max(18, Math.round(42 * (normalizedScale / 100)));
  const cacheKey = createRdkitSvgCacheKey({
    molBlock: renderSourceKey,
    angleDeg: normalizedAngle,
    scalePercent: normalizedScale,
    minSize: normalizedMinSize,
  });

  const cachedSvg = rdkitSvgCache.get(cacheKey);
  if (cachedSvg) {
    return { molBlock: sourceMolBlock, svg: cachedSvg, cacheKey };
  }

  const pendingRequest = rdkitSvgRequestCache.get(cacheKey);
  if (pendingRequest) return pendingRequest;

  const requestPromise = fetch(`${getRdkitApiBaseUrl()}/draw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(requestMolBlock ? { molblock: requestMolBlock } : { smiles: normalizedSmiles }),
      angle: normalizedAngle,
      fixed_bond_length: fixedBondLength,
      min_size: normalizedMinSize,
      transparent_bg: true,
      abbrev_option: 1,
    }),
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`RDKit API 요청 실패 (${response.status})`);
      }

      const result = await response.json();
      if (!result.svg_text) {
        throw new Error(result.error || 'RDKit SVG 생성에 실패했습니다.');
      }

      const svg = result.svg_text as string;
      rdkitSvgCache.set(cacheKey, svg);

      if (!sourceMolBlock && normalizedSmiles) {
        void convertSmilesToMolBlock(normalizedSmiles).catch(() => '');
      }

      return { molBlock: sourceMolBlock, svg, cacheKey };
    })
    .finally(() => {
      if (rdkitSvgRequestCache.get(cacheKey) === requestPromise) {
        rdkitSvgRequestCache.delete(cacheKey);
      }
    });

  rdkitSvgRequestCache.set(cacheKey, requestPromise);
  return requestPromise;
};

export const renderRdkitClusterSvgs = async ({
  compounds,
  mode,
  angleDeg = 0,
  scalePercent = 100,
  minSize,
}: {
  compounds: RdkitClusterCompoundInput[];
  mode: RdkitClusterHighlightMode;
  angleDeg?: number;
  scalePercent?: number;
  minSize?: [number, number];
}) => {
  const normalizedCompounds = compounds
    .map((compound) => {
      const normalizedMolBlock = compound.molBlock?.trim() || '';
      const normalizedSmiles = compound.smiles?.trim() || '';
      const requestMolBlock = normalizedMolBlock && isLikelyMolBlock(normalizedMolBlock) ? normalizedMolBlock : '';

      return {
        ...compound,
        molBlock: requestMolBlock,
        smiles: normalizedSmiles,
      };
    })
    .filter((compound) => compound.molBlock || compound.smiles);

  if (normalizedCompounds.length === 0) {
    throw new Error('RDKit cluster 요청에 사용할 구조 데이터가 없습니다.');
  }

  const cacheKey = createRdkitClusterCacheKey({
    compounds: normalizedCompounds,
    mode,
    angleDeg,
    scalePercent,
    minSize,
  });
  const cached = rdkitClusterCache.get(cacheKey);
  if (cached) return cached;

  const pendingRequest = rdkitClusterRequestCache.get(cacheKey);
  if (pendingRequest) return pendingRequest;

  const normalizedAngle = ((Math.round(angleDeg) % 360) + 360) % 360;
  const normalizedScale = Math.max(40, Math.min(180, Math.round(scalePercent)));
  const normalizedMinSize = normalizeMinSize(minSize);
  const fixedBondLength = Math.max(18, Math.round(42 * (normalizedScale / 100)));
  const requestPromise = fetch(`${getRdkitApiBaseUrl()}/cluster_v1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: normalizedCompounds.map((compound) => ({
        id: compound.id,
        compound_id: compound.compoundId,
        name: compound.name,
        ...(compound.molBlock ? { molblock: compound.molBlock } : { SMILES: compound.smiles }),
      })),
      scaffold_align: false,
      reverse_highlighting: mode === 'diff',
      highlight_alpha: mode === 'diff' ? 0.62 : 0.48,
      group_by: 'cluster_id',
      angle: normalizedAngle,
      fixed_bond_length: fixedBondLength,
      min_size: normalizedMinSize,
      transparent_bg: true,
      abbrev_option: 1,
    }),
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`RDKit cluster API 요청 실패 (${response.status})`);
      }

      const result = await response.json();
      if (result.error) {
        throw new Error(result.error);
      }
      if (!result.groups || typeof result.groups !== 'object') {
        throw new Error('RDKit cluster 결과가 비어 있습니다.');
      }

      const compounds = Object.values(result.groups)
        .flatMap((items) => Array.isArray(items) ? items : [])
        .map((item: any): RdkitClusterRenderedCompound | null => {
          const id = typeof item.id === 'string' ? item.id : '';
          const svg = typeof item.svg === 'string' ? item.svg : '';
          if (!id || !svg) return null;

          return {
            id,
            svg,
            clusterId: item.cluster_id,
            highlightAtoms: Array.isArray(item.highlight_atoms) ? item.highlight_atoms : undefined,
            substructure: typeof item.substructure === 'string' ? item.substructure : null,
            highlightColor: typeof item.highlight_color === 'string' ? item.highlight_color : null,
          };
        })
        .filter((item): item is RdkitClusterRenderedCompound => item !== null);

      const clusterResult = { cacheKey, compounds };
      rdkitClusterCache.set(cacheKey, clusterResult);
      return clusterResult;
    })
    .finally(() => {
      if (rdkitClusterRequestCache.get(cacheKey) === requestPromise) {
        rdkitClusterRequestCache.delete(cacheKey);
      }
    });

  rdkitClusterRequestCache.set(cacheKey, requestPromise);
  return requestPromise;
};
