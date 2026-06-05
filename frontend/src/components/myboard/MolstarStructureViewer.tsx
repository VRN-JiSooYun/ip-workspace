import React from 'react';
import { Alert, Spin } from 'antd';

export type MolstarStructureFormat = 'mmcif' | 'pdb';

interface MolstarStructureViewerProps {
  structureUrl: string;
  format: MolstarStructureFormat;
  title?: string;
  className?: string;
}

interface MolstarHoverInfo {
  label: string;
  x: number;
  y: number;
}

const POLYMER_GAP_MARKERS = ['polymer-gap', 'polymer gap', 'polymer_gap'];
const POLYMER_TRACE_ONLY_VISUALS = ['polymer-trace'];

const buildStructureRepresentation = async (
  plugin: any,
  component: any,
  params: Record<string, unknown>,
  tag: string
) => {
  const update = plugin.state.data.build();
  plugin.builders.structure.representation.buildRepresentation(
    update,
    component,
    params,
    { tag }
  );
  await update.commit();
};

const getMolstarStateSearchText = (candidate: any): string => {
  const values = [
    candidate?.label,
    candidate?.tags,
    candidate?.transformer?.id,
    candidate?.transformer?.definition?.name,
    candidate?.transformer?.definition?.display?.name,
    candidate?.params?.type?.name,
    candidate?.params?.values?.type?.name,
    candidate?.params?.values?.type?.params?.visuals,
    candidate?.params?.values?.type?.params?.visuals?.name,
  ];

  return values
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value) => value !== undefined && value !== null)
    .join(' ')
    .toLowerCase();
};

const disablePolymerGapRepresentations = async (plugin: any) => {
  try {
    const state = plugin?.state?.data;
    if (!state) return;

    const refs = new Set<string>();
    const collectRef = (ref: unknown, candidate: any) => {
      if (typeof ref !== 'string') return;

      const searchText = getMolstarStateSearchText(candidate);
      if (POLYMER_GAP_MARKERS.some((marker) => searchText.includes(marker))) {
        refs.add(ref);
      }
    };

    const transforms = state.tree?.transforms;
    if (transforms && typeof transforms.forEach === 'function') {
      transforms.forEach((transform: any, ref: string) => {
        collectRef(ref ?? transform?.ref, transform);
      });
    } else if (transforms && typeof transforms === 'object') {
      Object.entries(transforms).forEach(([ref, transform]) => {
        collectRef(ref, transform);
      });
    }

    const cells = state.cells;
    if (cells && typeof cells.forEach === 'function') {
      cells.forEach((cell: any, ref: string) => {
        collectRef(ref ?? cell?.transform?.ref, cell?.transform ?? cell);
      });
    } else if (cells && typeof cells === 'object') {
      Object.entries(cells).forEach(([ref, cell]: [string, any]) => {
        collectRef(ref, cell?.transform ?? cell);
      });
    }

    if (refs.size === 0) return;

    const update = state.build();
    refs.forEach((ref) => update.delete(ref));
    await update.commit();
  } catch {
    // Polymer gap cleanup is optional and should not block structure loading.
  }
};

const getPointValue = (point: any, index: number): number | null => {
  const value = Array.isArray(point) ? point[index] : index === 0 ? point?.x : point?.y;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const normalizeMolstarLabel = (label: string) => label
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]*>/g, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const setupHoverTooltip = async (
  plugin: any,
  parent: HTMLDivElement,
  setHoverInfo: React.Dispatch<React.SetStateAction<MolstarHoverInfo | null>>
) => {
  const [{ lociLabel }, { Loci }] = await Promise.all([
    import('molstar/lib/mol-theme/label'),
    import('molstar/lib/mol-model/loci'),
  ]);

  return plugin.behaviors.interaction.hover.subscribe((event: any) => {
    const loci = event?.current?.loci;
    if (!loci || Loci.isEmpty(loci)) {
      setHoverInfo(null);
      return;
    }

    const pageX = getPointValue(event.page, 0);
    const pageY = getPointValue(event.page, 1);
    if (pageX === null || pageY === null) {
      setHoverInfo(null);
      return;
    }

    const rect = parent.getBoundingClientRect();
    const residueGranularity = (Loci as unknown as {
      Granularity?: { residue?: (loci: unknown) => unknown };
    }).Granularity?.residue;
    const residueLoci = typeof residueGranularity === 'function'
      ? residueGranularity(loci)
      : loci;
    const label = normalizeMolstarLabel(lociLabel(residueLoci, {
      granularity: 'residue',
      condensed: false,
      htmlStyling: false,
    }));

    if (!label) {
      setHoverInfo(null);
      return;
    }

    setHoverInfo({
      label,
      x: Math.min(Math.max(pageX - rect.left - window.scrollX + 14, 8), rect.width - 16),
      y: Math.min(Math.max(pageY - rect.top - window.scrollY + 14, 8), rect.height - 16),
    });
  });
};

const applyPolymerTraceOnlyRepresentation = async (plugin: any, trajectory: any): Promise<boolean> => {
  try {
    const hierarchy = await plugin.builders.structure.hierarchy.applyPreset(
      trajectory,
      'default',
      { representationPreset: 'empty' } as any
    );
    const structure = hierarchy?.structureProperties ?? hierarchy?.structure;
    if (!structure) return false;

    const polymer = await plugin.builders.structure.tryCreateComponentStatic(structure, 'polymer');
    if (!polymer) return false;

    await buildStructureRepresentation(
      plugin,
      polymer,
      {
        type: 'cartoon',
        typeParams: {
          visuals: POLYMER_TRACE_ONLY_VISUALS,
        },
        color: 'uniform',
        colorParams: {
          value: 0x00FF00,
        },
      },
      'quick-viewer-polymer-trace-only'
    );

    const ligand = await plugin.builders.structure.tryCreateComponentStatic(structure, 'ligand');
    if (ligand) {
      await buildStructureRepresentation(
        plugin,
        ligand,
        {
          type: 'ball-and-stick',
          color: 'element-symbol',
        },
        'quick-viewer-ligand'
      );
    }

    return true;
  } catch {
    return false;
  }
};

const MolstarStructureViewer: React.FC<MolstarStructureViewerProps> = ({
  structureUrl,
  format,
  title,
  className,
}) => {
  const parentRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const pluginRef = React.useRef<any>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = React.useState<MolstarHoverInfo | null>(null);

  React.useEffect(() => {
    let disposed = false;
    let localPlugin: any = null;
    let hoverSubscription: { unsubscribe?: () => void } | null = null;

    const initViewer = async () => {
      const parent = parentRef.current;
      const canvas = canvasRef.current;
      if (!parent || !canvas || !structureUrl) return;

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [{ PluginContext }, { DefaultPluginSpec }, { PluginConfig }] = await Promise.all([
          import('molstar/lib/mol-plugin/context'),
          import('molstar/lib/mol-plugin/spec'),
          import('molstar/lib/mol-plugin/config'),
        ]);

        if (disposed) return;

        const spec = {
          ...DefaultPluginSpec(),
          config: [
            [PluginConfig.VolumeStreaming.Enabled, false],
          ],
        };
        const plugin = new PluginContext(spec as any);
        localPlugin = plugin;
        pluginRef.current = plugin;

        await plugin.init();
        if (disposed) return;

        const initialized = await plugin.initViewerAsync(canvas, parent);
        if (!initialized) {
          throw new Error('Failed to initialize Mol* viewer.');
        }

        if (disposed) return;

        hoverSubscription = await setupHoverTooltip(plugin, parent, setHoverInfo);
        if (disposed) {
          hoverSubscription?.unsubscribe?.();
          return;
        }

        const data = await plugin.builders.data.download(
          { url: structureUrl },
          { state: { isGhost: true } }
        );
        const trajectory = await plugin.builders.structure.parseTrajectory(data, format);
        const hasTraceOnlyRepresentation = await applyPolymerTraceOnlyRepresentation(plugin, trajectory);
        if (!hasTraceOnlyRepresentation) {
          await plugin.builders.structure.hierarchy.applyPreset(trajectory, 'default');
          await disablePolymerGapRepresentations(plugin);
        }

        if (!disposed) {
          plugin.canvas3d?.requestCameraReset?.();
        }
      } catch (error) {
        if (!disposed) {
          setErrorMessage(error instanceof Error ? error.message : 'Mol* 구조 viewer를 초기화하지 못했습니다.');
        }
      } finally {
        if (!disposed) {
          setIsLoading(false);
        }
      }
    };

    void initViewer();

    return () => {
      disposed = true;
      try {
        hoverSubscription?.unsubscribe?.();
        const plugin = localPlugin ?? pluginRef.current;
        plugin?.dispose?.();
      } catch {
        // Mol* cleanup should never block React unmount.
      } finally {
        pluginRef.current = null;
      }
    };
  }, [format, structureUrl]);

  React.useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return undefined;

    const resizeObserver = new ResizeObserver(() => {
      pluginRef.current?.canvas3d?.requestResize?.();
    });
    resizeObserver.observe(parent);

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div className={className ?? 'quick-viewer-molstar-stage'} ref={parentRef} aria-label={title}>
      <canvas ref={canvasRef} className="quick-viewer-molstar-canvas" />
      {isLoading && (
        <div className="quick-viewer-molstar-overlay">
          <div className="quick-viewer-molstar-loading">
            <Spin />
            <span>3D 구조를 불러오는 중입니다.</span>
          </div>
        </div>
      )}
      {errorMessage && (
        <div className="quick-viewer-molstar-overlay quick-viewer-molstar-overlay-error">
          <Alert type="error" showIcon message="3D 구조 로드 실패" description={errorMessage} />
        </div>
      )}
      {hoverInfo && !isLoading && !errorMessage && (
        <div
          className="quick-viewer-molstar-tooltip"
          style={{
            left: hoverInfo.x,
            top: hoverInfo.y,
          }}
        >
          {hoverInfo.label}
        </div>
      )}
    </div>
  );
};

export default MolstarStructureViewer;
