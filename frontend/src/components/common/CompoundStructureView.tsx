import React, { useEffect, useMemo, useState } from 'react';
import { App, Button, Tooltip, theme } from 'antd';
import type { ButtonProps } from 'antd';
import { Copy, Search } from 'lucide-react';
import BenzeneIcon from './BenzeneIcon';
import { CHEMDRAW_CONFIG } from '../../config/chemdraw';

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
  fullWidth?: boolean;
  showPreviewAction?: boolean;
  showCopyAction?: boolean;
  onPreview?: () => void;
  actions?: CompoundStructureAction[];
}

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
    };
  }, [cdxml, containerId, molBlock, smiles, structureKey]);

  if (renderFailed) {
    return null;
  }

  return <div id={containerId} style={{ width: '100%', height: '100%' }} />;
};

const CompoundStructureView: React.FC<CompoundStructureViewProps> = ({
  svg,
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
  fullWidth = false,
  showPreviewAction = true,
  showCopyAction = true,
  onPreview,
  actions = [],
}) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const copyText = getCompoundStructureCopyText({ smiles, molBlock, cdxml, svg });
  const hasRenderableChemData = !!(cdxml || molBlock || smiles);

  const previewAction: CompoundStructureAction[] = showPreviewAction && svg && onPreview ? [{
    key: 'preview',
    title: '크게 보기',
    icon: <Search size={14} />,
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      event.stopPropagation();
      onPreview();
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

  return (
    <div
      className={`compound-structure-view${className ? ` ${className}` : ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap,
        width: fullWidth ? '100%' : 'fit-content',
        margin: fullWidth ? undefined : '0 auto',
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
          ...frameStyle,
        }}
        >
        {svg ? (
          <div
            className={`compound-structure-svg${svgClassName ? ` ${svgClassName}` : ''}`}
            style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : hasRenderableChemData ? (
          <ChemDrawStructurePreview cdxml={cdxml} molBlock={molBlock} smiles={smiles} />
        ) : (
          <BenzeneIcon
            size={iconSize ?? (typeof width === 'number' && typeof height === 'number' ? Math.min(width, height) * 0.42 : 28)}
            color={token.colorTextTertiary}
          />
        )}
      </div>
      {allActions.length > 0 ? (
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
