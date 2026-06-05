import React, { useEffect, useMemo, useState } from 'react';
import { App, Button, Skeleton, Tooltip, theme } from 'antd';
import type { ButtonProps } from 'antd';
import { Copy, Search } from 'lucide-react';
import BenzeneIcon from './BenzeneIcon';
import { CHEMDRAW_CONFIG } from '../../config/chemdraw';
import { createRdkitSvgCacheKey, renderRdkitSvg } from '../../services/structureRendering';
import { installCanvasReadbackPatch } from '../../utils/canvasReadback';

export interface CompoundStructureAction {
  key: string;
  title: string;
  icon: React.ReactNode;
  onClick: (event: React.MouseEvent<HTMLElement>) => void;
  disabled?: boolean;
  buttonProps?: Omit<ButtonProps, 'icon' | 'onClick' | 'disabled' | 'type' | 'size'>;
}

export interface CompoundStructureViewProps {
  svg?: string | null;
  renderedSvgOverride?: string | null;
  rdkitSvg?: string | null;
  rdkitSvgCache?: Record<string, string> | null;
  title?: string;
  smiles?: string | null;
  molBlock?: string | null;
  cdxml?: string | null;
  width: number | string;
  height: number | string;
  iconSize?: number;
  actionRailHeight?: number;
  gap?: number;
  className?: string;
  frameClassName?: string;
  frameStyle?: React.CSSProperties;
  svgClassName?: string;
  structureStyle?: React.CSSProperties;
  structureFitMode?: 'stretch' | 'contain';
  fullWidth?: boolean;
  showPreviewAction?: boolean;
  showCopyAction?: boolean;
  onPreview?: (svg?: string) => void;
  actionPlacement?: 'rail' | 'overlay';
  actionOverlayAnchor?: 'frame' | 'container';
  actions?: CompoundStructureAction[];
  rotationDeg?: number;
  fitRotatedBounds?: boolean;
  frameless?: boolean;
  containerStyle?: React.CSSProperties;
  preferRdkitSvg?: boolean;
  rdkitAngleDeg?: number;
  rdkitScalePercent?: number;
  rdkitMinSize?: [number, number];
  onStructureGenerated?: (data: { molBlock: string; svg: string; cacheKey: string }) => void;
}

export const getRotatedStructureBounds = (width: number, height: number, rotationDeg: number) => {
  const normalizedDeg = ((rotationDeg % 180) + 180) % 180;
  const radians = normalizedDeg * Math.PI / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));

  return {
    width: Math.ceil(width * cos + height * sin),
    height: Math.ceil(width * sin + height * cos),
  };
};

export const getCompoundStructureCopyText = (params: {
  smiles?: string | null;
  molBlock?: string | null;
  mol_block?: string | null;
  molblock?: string | null;
  cdxml?: string | null;
  svg?: string | null;
}) => {
  const smiles = typeof params.smiles === 'string' ? params.smiles.trim() : '';
  const molBlockSource = params.molBlock ?? params.mol_block ?? params.molblock;
  const molBlock = typeof molBlockSource === 'string' ? molBlockSource.trim() : '';
  const cdxml = typeof params.cdxml === 'string' ? params.cdxml.trim() : '';
  const svg = typeof params.svg === 'string' ? params.svg.trim() : '';

  return smiles || molBlock || cdxml || svg;
};

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

const ChemDrawStructurePreview: React.FC<{
  cdxml?: string | null;
  molBlock?: string | null;
  smiles?: string | null;
}> = ({ cdxml, molBlock, smiles }) => {
  const [containerId] = useState(() => `compound-structure-${Math.random().toString(36).slice(2, 11)}`);
  const [renderFailed, setRenderFailed] = useState(false);
  const structureKey = useMemo(
    () => `${cdxml ?? ''}__${molBlock ?? ''}__${smiles ?? ''}`,
    [cdxml, molBlock, smiles]
  );

  useEffect(() => {
    let isDisposed = false;
    const restoreReadbackPatch = installCanvasReadbackPatch();

    const attachPreview = async () => {
      try {
        await loadChemDrawScript();
        if (isDisposed) return;

        const manager = (window as any).perkinelmer?.ChemdrawWebManager;
        const formats = (window as any).perkinelmer?.DataFormats;
        if (!manager) {
          setRenderFailed(true);
          return;
        }

        manager.attach({
          id: containerId,
          license: CHEMDRAW_CONFIG.LICENSE_XML,
          viewOnly: true,
          callback: (editor: any) => {
            if (isDisposed || !editor) return;

            try {
              if (cdxml) {
                if (editor.loadCDXML) editor.loadCDXML(cdxml);
                else if (editor.setData) editor.setData(formats?.CDXML || 'CDXML', cdxml);
              } else if (molBlock) {
                if (editor.loadMOL) editor.loadMOL(molBlock);
                else if (editor.setData) editor.setData(formats?.MOLV2000 || formats?.MOLFILE || 'chemical/x-mdl-molfile', molBlock);
              } else if (smiles) {
                if (editor.loadSMILES) editor.loadSMILES(smiles);
                else if (editor.setData) editor.setData(formats?.SMILES || 'chemical/x-daylight-smiles', smiles);
              }
            } catch {
              setRenderFailed(true);
            }
          },
        });
      } catch {
        if (!isDisposed) setRenderFailed(true);
      }
    };

    void attachPreview();

    return () => {
      isDisposed = true;
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = '';
      }
      restoreReadbackPatch();
    };
  }, [cdxml, containerId, molBlock, smiles, structureKey]);

  if (renderFailed) {
    return null;
  }

  return <div id={containerId} style={{ width: '100%', height: '100%' }} />;
};

const CompoundStructureView: React.FC<CompoundStructureViewProps> = ({
  svg,
  renderedSvgOverride,
  rdkitSvg,
  rdkitSvgCache,
  title = 'Structure',
  smiles,
  molBlock,
  cdxml,
  width,
  height,
  iconSize,
  actionRailHeight,
  gap = 6,
  className,
  frameClassName,
  frameStyle,
  svgClassName,
  structureStyle,
  structureFitMode = 'stretch',
  fullWidth = false,
  showPreviewAction = true,
  showCopyAction = true,
  onPreview,
  actionPlacement = 'rail',
  actionOverlayAnchor = 'frame',
  actions = [],
  rotationDeg,
  fitRotatedBounds = false,
  frameless = false,
  containerStyle,
  preferRdkitSvg = false,
  rdkitAngleDeg = 0,
  rdkitScalePercent = 100,
  rdkitMinSize,
  onStructureGenerated,
}) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [generatedStructure, setGeneratedStructure] = useState<{ molBlock: string; svg: string; cacheKey: string } | null>(null);
  const [isRdkitLoading, setIsRdkitLoading] = useState(false);
  const [hasRdkitRenderFailed, setHasRdkitRenderFailed] = useState(false);
  const onStructureGeneratedRef = React.useRef(onStructureGenerated);
  const displayMolBlock = generatedStructure?.molBlock || molBlock;
  const normalizedSmiles = smiles?.trim() || '';
  const rdkitMinSizeWidth = rdkitMinSize?.[0];
  const rdkitMinSizeHeight = rdkitMinSize?.[1];
  const expectedRdkitSourceKey = displayMolBlock?.trim() || (normalizedSmiles ? `SMILES:${normalizedSmiles}` : '');
  const expectedRdkitSvgKey = expectedRdkitSourceKey
    ? createRdkitSvgCacheKey({
      molBlock: expectedRdkitSourceKey,
      angleDeg: rdkitAngleDeg,
      scalePercent: rdkitScalePercent,
      minSize: rdkitMinSizeWidth != null && rdkitMinSizeHeight != null ? [rdkitMinSizeWidth, rdkitMinSizeHeight] : undefined,
    })
    : '';
  const cachedRdkitSvg = expectedRdkitSvgKey ? rdkitSvgCache?.[expectedRdkitSvgKey] : undefined;
  const generatedSvg = generatedStructure?.cacheKey === expectedRdkitSvgKey ? generatedStructure.svg : null;
  const displaySvg = renderedSvgOverride || (preferRdkitSvg
    ? generatedSvg || cachedRdkitSvg || null
    : generatedStructure?.svg || cachedRdkitSvg || rdkitSvg || svg);
  const copyText = getCompoundStructureCopyText({ smiles, molBlock: displayMolBlock, cdxml, svg: displaySvg });
  const hasRenderableChemData = preferRdkitSvg ? false : !!(cdxml || displayMolBlock || smiles);
  const shouldShowRdkitSkeleton = preferRdkitSvg && isRdkitLoading && !displaySvg;
  const shouldFitRotatedBounds = fitRotatedBounds && typeof width === 'number' && typeof height === 'number';
  const rotatedBounds = shouldFitRotatedBounds
    ? getRotatedStructureBounds(width, height, rotationDeg ?? 0)
    : null;
  const mergedFrameStyle: React.CSSProperties = {
    ...(frameless ? { border: 0, background: 'transparent', boxShadow: 'none', overflow: 'visible' } : {}),
    ...frameStyle,
  };
  const mergedStructureStyle: React.CSSProperties = {
    ...(rotationDeg == null ? {} : { transform: `rotate(${rotationDeg}deg)` }),
    ...structureStyle,
  };
  const structureSvgClassName = [
    'compound-structure-svg',
    structureFitMode === 'contain' ? 'compound-structure-svg-contain' : '',
    svgClassName ?? '',
  ].filter(Boolean).join(' ');
  const rdkitRenderKey = useMemo(
    () => JSON.stringify({
      preferRdkitSvg,
      renderedSvgOverride: renderedSvgOverride?.trim() ? 'override' : '',
      smiles: smiles?.trim() || '',
      molBlock: molBlock?.trim() || '',
      angle: rdkitAngleDeg,
      scale: rdkitScalePercent,
      minSize: rdkitMinSizeWidth != null && rdkitMinSizeHeight != null ? [rdkitMinSizeWidth, rdkitMinSizeHeight] : undefined,
    }),
    [molBlock, preferRdkitSvg, rdkitAngleDeg, rdkitMinSizeHeight, rdkitMinSizeWidth, rdkitScalePercent, renderedSvgOverride, smiles]
  );

  useEffect(() => {
    onStructureGeneratedRef.current = onStructureGenerated;
  }, [onStructureGenerated]);

  useEffect(() => {
    if (renderedSvgOverride || !preferRdkitSvg || !(smiles?.trim() || molBlock?.trim())) {
      setGeneratedStructure(null);
      setIsRdkitLoading(false);
      setHasRdkitRenderFailed(false);
      return;
    }
    if (cachedRdkitSvg) {
      setGeneratedStructure(null);
      setIsRdkitLoading(false);
      setHasRdkitRenderFailed(false);
      return;
    }

    let isDisposed = false;
    setIsRdkitLoading(true);
    setHasRdkitRenderFailed(false);
    setGeneratedStructure(null);

    void renderRdkitSvg({
      smiles,
      molBlock,
      angleDeg: rdkitAngleDeg,
      scalePercent: rdkitScalePercent,
      minSize: rdkitMinSizeWidth != null && rdkitMinSizeHeight != null ? [rdkitMinSizeWidth, rdkitMinSizeHeight] : undefined,
    })
      .then((data) => {
        if (isDisposed) return;
        setGeneratedStructure(data);
        setIsRdkitLoading(false);
        setHasRdkitRenderFailed(false);
        onStructureGeneratedRef.current?.(data);
      })
      .catch(() => {
        if (!isDisposed) {
          setGeneratedStructure(null);
          setIsRdkitLoading(false);
          setHasRdkitRenderFailed(true);
        }
      });

    return () => {
      isDisposed = true;
    };
  }, [cachedRdkitSvg, molBlock, preferRdkitSvg, rdkitAngleDeg, rdkitMinSizeHeight, rdkitMinSizeWidth, rdkitRenderKey, rdkitScalePercent, renderedSvgOverride, smiles]);

  const previewAction: CompoundStructureAction[] = showPreviewAction && displaySvg && onPreview ? [{
    key: 'preview',
    title: '크게 보기',
    icon: <Search size={14} />,
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      event.stopPropagation();
      onPreview(displaySvg || undefined);
    },
  }] : [];
  const copyAction: CompoundStructureAction[] = showCopyAction && copyText ? [{
      key: 'copy',
      title: '구조 데이터 복사',
      icon: <Copy size={13} />,
      onClick: (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        const writePromise = navigator.clipboard?.writeText(copyText);
        if (writePromise) {
          void writePromise
            .then(() => {
              void message.success('구조 데이터 복사 완료');
            })
            .catch(() => {
              void message.error('복사 실패');
            });
        }
      },
    }] : [];
  const allActions = [...previewAction, ...copyAction, ...actions];
  const overlayActions = actionPlacement === 'overlay' && allActions.length > 0 ? (
    <div className="compound-structure-actions-overlay">
      {allActions.map((action) => (
        <Tooltip key={action.key} title={action.title}>
          <Button
            {...action.buttonProps}
            className={`svg-action-btn compound-structure-action-button${action.buttonProps?.className ? ` ${action.buttonProps.className}` : ''}`}
            size="small"
            type="text"
            icon={action.icon}
            disabled={action.disabled}
            onClick={action.onClick}
          />
        </Tooltip>
      ))}
    </div>
  ) : null;

  return (
    <div
      className={`compound-structure-view${className ? ` ${className}` : ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap,
        ...(actionOverlayAnchor === 'container' ? { position: 'relative' } : {}),
        width: fullWidth ? '100%' : 'fit-content',
        margin: fullWidth ? undefined : '0 auto',
        ...(rotatedBounds ? { width: rotatedBounds.width, minHeight: rotatedBounds.height } : {}),
        ...containerStyle,
      }}
    >
      <div
        className={`compound-structure-frame${frameClassName ? ` ${frameClassName}` : ''}`}
        aria-label={title}
        style={{
          width,
          height,
          background: token.colorBgLayout,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 4,
          border: `1px solid ${token.colorBorderSecondary}`,
          overflow: 'hidden',
          position: 'relative',
          ...mergedFrameStyle,
        }}
        >
        {displaySvg ? (
          <div
            className={structureSvgClassName}
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transformOrigin: 'center',
              ...mergedStructureStyle,
            }}
            dangerouslySetInnerHTML={{ __html: displaySvg }}
          />
        ) : shouldShowRdkitSkeleton ? (
          <div
            className="compound-structure-skeleton"
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 8,
              boxSizing: 'border-box',
            }}
          >
            <Skeleton.Node
              active
              style={{
                width: '100%',
                height: '100%',
                minWidth: 0,
              }}
            />
          </div>
        ) : hasRenderableChemData ? (
          <div style={{ width: '100%', height: '100%', transformOrigin: 'center', ...mergedStructureStyle }}>
            <ChemDrawStructurePreview cdxml={cdxml} molBlock={molBlock} smiles={smiles} />
          </div>
        ) : preferRdkitSvg && hasRdkitRenderFailed ? (
          <BenzeneIcon
            size={iconSize ?? (typeof width === 'number' && typeof height === 'number' ? Math.min(width, height) * 0.34 : 24)}
            color={token.colorTextQuaternary}
          />
        ) : (
          <BenzeneIcon
            size={iconSize ?? (typeof width === 'number' && typeof height === 'number' ? Math.min(width, height) * 0.42 : 28)}
            color={token.colorTextTertiary}
          />
        )}
        {actionOverlayAnchor === 'frame' ? overlayActions : null}
      </div>
      {actionOverlayAnchor === 'container' ? overlayActions : null}
      {actionPlacement === 'rail' && allActions.length > 0 ? (
        <div className="compound-structure-actions" style={{ height: actionRailHeight ?? height }}>
          {allActions.map((action) => (
            <Tooltip key={action.key} title={action.title}>
              <Button
                {...action.buttonProps}
                className={`svg-action-btn compound-structure-action-button${action.buttonProps?.className ? ` ${action.buttonProps.className}` : ''}`}
                size="small"
                type="text"
                icon={action.icon}
                disabled={action.disabled}
                onClick={action.onClick}
              />
            </Tooltip>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default CompoundStructureView;
