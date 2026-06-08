import React, { useEffect, useRef, useState } from 'react';
import { Button, Space, Tooltip, Typography, theme } from 'antd';
import { ArrowLeftRight, ArrowUpDown, Info } from 'lucide-react';
import { CHEMDRAW_CONFIG } from '../../config/chemdraw';
import { installChemDrawKoreanKeyboardBridge } from '../../utils/chemdrawKeyboard';
import { commitChemDrawActiveInput, waitForChemDrawEditorReady } from '../../utils/chemdrawCommit';
import { applyChemDrawFlip } from '../../utils/chemdrawTransform';
import type { ChemDrawFlipAxis } from '../../utils/chemdrawTransform';
import { installCanvasReadbackPatch } from '../../utils/canvasReadback';
import { installPassiveWheelListenerPatch } from '../../utils/passiveWheelListenerPatch';

const { Text } = Typography;

interface ChemDrawEditorProps {
  active: boolean;
  height?: number;
  initialCdxml?: string;
  initialSmiles?: string;
  initialMolblock?: string;
  smilesValue?: string;
  onSmilesChange?: (smiles: string) => void;
  onReady?: (editor: any) => void;
  flipControlsPlacement?: 'top' | 'left';
}

const ChemDrawEditor: React.FC<ChemDrawEditorProps> = ({
  active,
  height = 500,
  initialCdxml,
  initialSmiles,
  initialMolblock,
  smilesValue,
  onSmilesChange,
  onReady,
  flipControlsPlacement = 'top'
}) => {
  const { token } = theme.useToken();
  const [containerId] = useState(`chemdraw-${Math.random().toString(36).slice(2, 11)}`);
  const [editorInstance, setEditorInstance] = useState<any>(null);
  const lastEmittedSmilesRef = useRef('');
  const lastLoadedSmilesRef = useRef('');

  const getEditorSmiles = async (editor: any): Promise<string> => {
    if (!editor) return '';
    const formats = (window as any).perkinelmer?.DataFormats;

    if (editor.getData) {
      try {
        const smiles = editor.getData(formats?.SMILES || 'chemical/x-daylight-smiles');
        if (typeof smiles === 'string') return smiles;
      } catch {
        // Continue with method fallback.
      }
    }

    if (typeof editor.getSMILES === 'function') {
      return new Promise<string>((resolve) => {
        let resolved = false;
        const finish = (value: string) => {
          if (resolved) return;
          resolved = true;
          resolve(value || '');
        };

        try {
          const result = editor.getSMILES((value: string | undefined, error: unknown) => {
            finish(error ? '' : value || '');
          });
          if (typeof result === 'string') finish(result);
        } catch {
          finish('');
        }

        window.setTimeout(() => finish(''), 700);
      });
    }

    return '';
  };

  const loadSmilesIntoEditor = (editor: any, smiles: string) => {
    if (!editor) return;

    try {
      const formats = (window as any).perkinelmer?.DataFormats;
      if (!smiles.trim()) {
        if (editor.clear) editor.clear();
        else if (editor.setData) editor.setData(formats?.SMILES || 'chemical/x-daylight-smiles', '');
        else if (editor.setMolecule) editor.setMolecule('');
      } else if (editor.loadSMILES) {
        editor.loadSMILES(smiles);
      } else if (editor.setData) {
        editor.setData(formats?.SMILES || 'chemical/x-daylight-smiles', smiles);
      } else if (editor.setMolecule) {
        editor.setMolecule(smiles);
      }
      lastLoadedSmilesRef.current = smiles;
      lastEmittedSmilesRef.current = smiles;
    } catch (error) {
      console.warn('Failed to load SMILES into ChemDraw editor:', error);
    }
  };

  const flushPendingInput = async (editor = editorInstance) => {
    if (!editor) return '';

    await commitChemDrawActiveInput(containerId, editor);

    const smiles = await getEditorSmiles(editor);
    lastEmittedSmilesRef.current = smiles;
    onSmilesChange?.(smiles);
    return smiles;
  };

  useEffect(() => {
    if (!active) {
      setEditorInstance(null);
      onReady?.(null);
      return;
    }

    const restoreReadbackPatch = installCanvasReadbackPatch();
    const restorePassiveWheelPatch = installPassiveWheelListenerPatch();
    let isDisposed = false;

    const loadStructure = (editor: any) => {
      if (!editor) return;

      try {
        const formats = (window as any).perkinelmer?.DataFormats;
        if (initialCdxml) {
          if (editor.loadCDXML) editor.loadCDXML(initialCdxml);
          else if (editor.setData) editor.setData(formats?.CDXML || 'CDXML', initialCdxml);
          else if (editor.setMolecule) editor.setMolecule(initialCdxml);
        } else if (initialMolblock) {
          if (editor.loadMOL) editor.loadMOL(initialMolblock);
          else if (editor.setData) editor.setData(formats?.MOLV2000 || formats?.MOLFILE || 'chemical/x-mdl-molfile', initialMolblock);
          else if (editor.setMolecule) editor.setMolecule(initialMolblock);
        } else if (initialSmiles) {
          if (editor.loadSMILES) editor.loadSMILES(initialSmiles);
          else if (editor.setData) editor.setData(formats?.SMILES || 'chemical/x-daylight-smiles', initialSmiles);
          else if (editor.setMolecule) editor.setMolecule(initialSmiles);
        }
      } catch (error) {
        console.warn('Failed to load structure into ChemDraw editor:', error);
      }
    };

    const initializeEditor = () => {
      try {
        const manager = (window as any).perkinelmer?.ChemdrawWebManager;
        if (!manager) return;

        window.setTimeout(() => {
          if (isDisposed) return;
          const container = document.getElementById(containerId);
          if (!container) return;

          manager.attach({
            id: containerId,
            license: CHEMDRAW_CONFIG.LICENSE_XML,
            viewOnly: false,
            callback: (editor: any) => {
              if (isDisposed) return;
              editor.__flushPendingInput = () => flushPendingInput(editor);
              window.setTimeout(() => loadStructure(editor), 500);
              void waitForChemDrawEditorReady(containerId, editor).then(() => {
                if (isDisposed) return;
                setEditorInstance(editor);
                onReady?.(editor);
              });
            }
          });
        }, 300);
      } catch (error) {
        console.error('Failed to initialize ChemDraw JS:', error);
      }
    };

    const loadChemDraw = () => {
      if ((window as any).perkinelmer?.ChemdrawWebManager) {
        initializeEditor();
        return;
      }

      const script = document.createElement('script');
      script.src = CHEMDRAW_CONFIG.SCRIPT_PATH;
      script.async = true;
      script.onload = () => {
        if (!isDisposed) initializeEditor();
      };
      document.body.appendChild(script);
    };

    loadChemDraw();

    return () => {
      isDisposed = true;
      setEditorInstance(null);
      onReady?.(null);
      restoreReadbackPatch();
      restorePassiveWheelPatch();
    };
  }, [active, containerId, initialCdxml, initialSmiles, initialMolblock, onReady]);

  useEffect(() => {
    if (!active || !editorInstance || !onSmilesChange) return;

    let isDisposed = false;
    const intervalId = window.setInterval(async () => {
      const smiles = await getEditorSmiles(editorInstance);
      if (isDisposed) return;

      if (smiles !== lastEmittedSmilesRef.current && smiles !== lastLoadedSmilesRef.current) {
        lastEmittedSmilesRef.current = smiles;
        onSmilesChange(smiles);
      }
    }, 500);

    return () => {
      isDisposed = true;
      window.clearInterval(intervalId);
    };
  }, [active, editorInstance, onSmilesChange]);

  useEffect(() => {
    if (!active || !editorInstance || smilesValue === undefined) return;

    const nextSmiles = smilesValue.trim();
    if (nextSmiles === lastEmittedSmilesRef.current || nextSmiles === lastLoadedSmilesRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      loadSmilesIntoEditor(editorInstance, nextSmiles);
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [active, editorInstance, smilesValue]);

  useEffect(() => {
    if (!active || !editorInstance) return;

    const container = document.getElementById(containerId);
    if (!container) return;

    return installChemDrawKoreanKeyboardBridge(container);
  }, [active, editorInstance, containerId]);

  const handleFlip = (axis: ChemDrawFlipAxis) => {
    applyChemDrawFlip(editorInstance, axis);
  };

  const flipControls = (
    <Space
      direction={flipControlsPlacement === 'left' ? 'vertical' : 'horizontal'}
      style={flipControlsPlacement === 'top' ? { marginBottom: 8 } : undefined}
    >
      <Tooltip title="선택 구조 좌우 반전" placement="left">
        <Button
          icon={<ArrowLeftRight size={16} />}
          onClick={() => handleFlip('horizontal')}
          disabled={!editorInstance}
        />
      </Tooltip>
      <Tooltip title="선택 구조 상하 반전" placement="left">
        <Button
          icon={<ArrowUpDown size={16} />}
          onClick={() => handleFlip('vertical')}
          disabled={!editorInstance}
        />
      </Tooltip>
    </Space>
  );

  const editorCanvas = (
    <div
      id={containerId}
      style={{
        height,
        width: '100%',
        minWidth: 0,
        background: token.colorBgLayout,
        borderRadius: 8,
        border: `1px solid ${token.colorBorderSecondary}`,
        overflow: 'hidden'
      }}
    />
  );

  return (
    <>
      {flipControlsPlacement === 'left' ? (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
          {flipControls}
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            {editorCanvas}
          </div>
        </div>
      ) : (
        <>
          {flipControls}
          {editorCanvas}
        </>
      )}
      <div style={{ marginTop: 8 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          <Info size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          ChemDraw editor에서 구조를 그린 뒤 등록을 진행하세요.
        </Text>
      </div>
    </>
  );
};

export default ChemDrawEditor;
