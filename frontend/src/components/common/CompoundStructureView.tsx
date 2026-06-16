import React, { useEffect, useMemo, useState } from 'react';
import { App, Button, Skeleton, Tooltip, theme } from 'antd';
import type { ButtonProps } from 'antd';
import { Copy, Image as ImageIcon, Search } from 'lucide-react';
import BenzeneIcon from './BenzeneIcon';
import { CHEMDRAW_CONFIG } from '../../config/chemdraw';
import { createRdkitSvgCacheKey, renderRdkitSvg } from '../../services/structureRendering';
import { installCanvasReadbackPatch } from '../../utils/canvasReadback';
import { installPassiveWheelListenerPatch } from '../../utils/passiveWheelListenerPatch';

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
  showCopyImageAction?: boolean;
  onPreview?: (svg?: string) => void;
  actionPlacement?: 'rail' | 'overlay';
  actionOverlayAnchor?: 'frame' | 'container';
  actionOverlayPlacement?: 'top-right' | 'bottom-right';
  actions?: CompoundStructureAction[];
  onClick?: React.MouseEventHandler<HTMLDivElement>;
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

const getSvgImageSize = (svg: string) => {
  const fallback = { width: 512, height: 512 };

  try {
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const root = doc.documentElement;
    const width = Number.parseFloat(root.getAttribute('width') || '');
    const height = Number.parseFloat(root.getAttribute('height') || '');

    if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
      return { width: Math.ceil(width), height: Math.ceil(height) };
    }

    const viewBox = root.getAttribute('viewBox')?.trim().split(/\s+/).map(Number);
    if (viewBox && viewBox.length === 4) {
      const [, , viewBoxWidth, viewBoxHeight] = viewBox;
      if (Number.isFinite(viewBoxWidth) && viewBoxWidth > 0 && Number.isFinite(viewBoxHeight) && viewBoxHeight > 0) {
        return { width: Math.ceil(viewBoxWidth), height: Math.ceil(viewBoxHeight) };
      }
    }
  } catch {
    return fallback;
  }

  return fallback;
};

const isWhiteLikeFill = (fill: string | null) => {
  const normalized = (fill || '').trim().toLowerCase();
  return normalized === 'white'
    || normalized === '#fff'
    || normalized === '#ffffff'
    || normalized === 'rgb(255,255,255)'
    || normalized === 'rgb(255, 255, 255)';
};

const getSvgViewBoxSize = (root: Element) => {
  const viewBox = root.getAttribute('viewBox')?.trim().split(/\s+/).map(Number);
  if (viewBox && viewBox.length === 4) {
    const [x, y, width, height] = viewBox;
    return { x, y, width, height };
  }

  return {
    x: 0,
    y: 0,
    width: Number.parseFloat(root.getAttribute('width') || ''),
    height: Number.parseFloat(root.getAttribute('height') || ''),
  };
};

const stripSvgBackground = (svg: string) => {
  try {
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const root = doc.documentElement;
    if (!root || root.nodeName.toLowerCase() !== 'svg') return svg;

    root.removeAttribute('background');
    root.removeAttribute('background-color');

    const style = root.getAttribute('style');
    if (style) {
      const nextStyle = style
        .split(';')
        .map((rule) => rule.trim())
        .filter((rule) => rule && !/^background(?:-color)?\s*:/i.test(rule))
        .join('; ');
      if (nextStyle) root.setAttribute('style', nextStyle);
      else root.removeAttribute('style');
    }

    const viewBox = getSvgViewBoxSize(root);
    const rects = Array.from(root.querySelectorAll('rect'));
    rects.forEach((rect) => {
      const fill = rect.getAttribute('fill') || rect.style.fill;
      if (!isWhiteLikeFill(fill)) return;

      const x = Number.parseFloat(rect.getAttribute('x') || '0');
      const y = Number.parseFloat(rect.getAttribute('y') || '0');
      const width = Number.parseFloat(rect.getAttribute('width') || '');
      const height = Number.parseFloat(rect.getAttribute('height') || '');
      const stroke = (rect.getAttribute('stroke') || rect.style.stroke || '').trim().toLowerCase();
      const hasStroke = stroke && stroke !== 'none' && stroke !== 'transparent';
      const coversCanvas = Number.isFinite(width)
        && Number.isFinite(height)
        && Math.abs(x - viewBox.x) <= 1
        && Math.abs(y - viewBox.y) <= 1
        && Math.abs(width - viewBox.width) <= 2
        && Math.abs(height - viewBox.height) <= 2;

      if (coversCanvas && !hasStroke) rect.remove();
    });

    return new XMLSerializer().serializeToString(root);
  } catch {
    return svg;
  }
};

type CopySvgImageOptions = {
  scale?: number;
  imageFilter?: string;
};

const svgToPngBlob = (svg: string, options: CopySvgImageOptions = {}) => new Promise<Blob>((resolve, reject) => {
  if (typeof window === 'undefined') {
    reject(new Error('Window is not available'));
    return;
  }

  const transparentSvg = stripSvgBackground(svg);
  const { width, height } = getSvgImageSize(transparentSvg);
  const canvas = document.createElement('canvas');
  const scale = Number.isFinite(options.scale) && options.scale && options.scale > 0 ? options.scale : 2;
  canvas.width = Math.max(1, Math.ceil(width * scale));
  canvas.height = Math.max(1, Math.ceil(height * scale));

  const context = canvas.getContext('2d');
  if (!context) {
    reject(new Error('Canvas context is not available'));
    return;
  }

  const image = new window.Image();
  const svgBlob = new Blob([transparentSvg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  image.onload = () => {
    try {
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (options.imageFilter) {
        context.filter = options.imageFilter;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      context.filter = 'none';
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('PNG image creation failed'));
        }
      }, 'image/png');
    } catch (error) {
      URL.revokeObjectURL(url);
      reject(error);
    }
  };

  image.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error('SVG image loading failed'));
  };
  image.src = url;
});

export const copySvgImageToClipboard = async (svg: string, options: CopySvgImageOptions = {}) => {
  const ClipboardItemConstructor = (window as any).ClipboardItem;

  if (!navigator.clipboard?.write || !ClipboardItemConstructor) {
    throw new Error('이미지 클립보드를 지원하지 않는 브라우저입니다.');
  }

  const pngBlob = await svgToPngBlob(svg, options);
  await navigator.clipboard.write([
    new ClipboardItemConstructor({ 'image/png': pngBlob }),
  ]);
};

export const getStructureImageCopyFilter = (token: any) => {
  const documentTheme = typeof document !== 'undefined'
    ? document.body.getAttribute('data-theme') || document.documentElement.getAttribute('data-theme')
    : null;
  if (documentTheme === 'dark') {
    return 'invert(0.88) hue-rotate(180deg)';
  }

  const darkBackgrounds = new Set(['#141414', '#1f1f1f', '#000000']);
  const normalizedBg = typeof token?.colorBgContainer === 'string'
    ? token.colorBgContainer.trim().toLowerCase()
    : '';

  return darkBackgrounds.has(normalizedBg) ? 'invert(0.88) hue-rotate(180deg)' : undefined;
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
    const restorePassiveWheelPatch = installPassiveWheelListenerPatch();

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
      restorePassiveWheelPatch();
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
  showCopyImageAction,
  onPreview,
  actionPlacement = 'rail',
  actionOverlayAnchor = 'frame',
  actionOverlayPlacement = 'bottom-right',
  actions = [],
  onClick,
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
  const structureImageCopyFilter = getStructureImageCopyFilter(token);
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
  const shouldShowCopyImageAction = showCopyImageAction ?? showCopyAction;
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
  const copyImageAction: CompoundStructureAction[] = shouldShowCopyImageAction && displaySvg ? [{
      key: 'copy-image',
      title: '이미지 복사',
      icon: <ImageIcon size={13} />,
      onClick: (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        void copySvgImageToClipboard(displaySvg, { imageFilter: structureImageCopyFilter })
          .then(() => {
            void message.success('구조 이미지 복사 완료');
          })
          .catch((error) => {
            const errorMessage = error instanceof Error ? error.message : '이미지 복사 실패';
            void message.error(errorMessage);
          });
      },
    }] : [];
  const allActions = [...previewAction, ...copyImageAction, ...copyAction, ...actions];
  const overlayActions = actionPlacement === 'overlay' && allActions.length > 0 ? (
    <div className={`compound-structure-actions-overlay compound-structure-actions-overlay-${actionOverlayPlacement}`}>
      {allActions.map((action) => (
        <Tooltip key={action.key} title={action.title}>
          <Button
            {...action.buttonProps}
            className={`svg-action-btn compound-structure-action-button${action.buttonProps?.className ? ` ${action.buttonProps.className}` : ''}`}
            size="small"
            type="text"
            icon={action.icon}
            disabled={action.disabled}
            onClick={(event) => {
              const clickedButton = event.currentTarget;
              const shouldBlurAfterClick = event.detail > 0;

              action.onClick(event);

              if (shouldBlurAfterClick) {
                clickedButton.blur();
              }
            }}
          />
        </Tooltip>
      ))}
    </div>
  ) : null;

  return (
    <div
      className={`compound-structure-view${className ? ` ${className}` : ''}`}
      onClick={onClick}
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
