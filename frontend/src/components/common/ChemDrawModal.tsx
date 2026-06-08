import React, { useEffect, useState } from 'react';
import { Modal, Button, Space, Tooltip, Typography, theme } from 'antd';
import { ArrowLeftRight, ArrowUpDown, Info } from 'lucide-react';
import { CHEMDRAW_CONFIG } from '../../config/chemdraw';
import { installChemDrawKoreanKeyboardBridge } from '../../utils/chemdrawKeyboard';
import { commitChemDrawActiveInput, waitForChemDrawEditorReady } from '../../utils/chemdrawCommit';
import { applyChemDrawFlip } from '../../utils/chemdrawTransform';
import type { ChemDrawFlipAxis } from '../../utils/chemdrawTransform';
import { installCanvasReadbackPatch } from '../../utils/canvasReadback';
import { installPassiveWheelListenerPatch } from '../../utils/passiveWheelListenerPatch';

const { Text } = Typography;

export interface ChemDrawStructureData {
  smiles: string;
  svg: string | null;
  sourceSvg?: string | null;
  rdkitSvg?: string | null;
  cdxml?: string;
  molfile?: string;
  molV2000?: string;
  molV3000?: string;
}

interface ChemDrawModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: (data: ChemDrawStructureData) => void;
  title?: string;
  confirmText?: string;
  initialCdxml?: string;
  initialSmiles?: string;
  initialMolblock?: string;
}

const ChemDrawModal: React.FC<ChemDrawModalProps> = ({ 
  open, 
  onCancel, 
  onConfirm,
  title = "구조 검색",
  confirmText = "확인",
  initialCdxml,
  initialSmiles,
  initialMolblock
}) => {
  const { token } = theme.useToken();
  const [cdjsInstance, setCdjsInstance] = useState<any>(null);
  const [containerId] = useState(`chemdraw-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    if (!open) {
      setCdjsInstance(null);
      return;
    }

    const restoreReadbackPatch = installCanvasReadbackPatch();
    const restorePassiveWheelPatch = installPassiveWheelListenerPatch();
    let isDisposed = false;

    const loadChemDraw = () => {
      if ((window as any).perkinelmer && (window as any).perkinelmer.ChemdrawWebManager) {
        initializeEditor();
        return;
      }

      const script = document.createElement('script');
      script.src = CHEMDRAW_CONFIG.SCRIPT_PATH;
      script.async = true;
      script.onload = () => {
        if (isDisposed) return;
        initializeEditor();
      };
      document.body.appendChild(script);
    };

    const initializeEditor = async () => {
      try {
        const manager = (window as any).perkinelmer.ChemdrawWebManager;
        if (!manager) return;

        // Short delay to ensure DOM is ready
        setTimeout(() => {
          if (isDisposed) return;
          const container = document.getElementById(containerId);
          if (!container) return;

          manager.attach({
            id: containerId,
            license: CHEMDRAW_CONFIG.LICENSE_XML,
            viewOnly: false,
            callback: (editor: any) => {
              // initialCdxml, initialMolblock 또는 initialSmiles를 에디터에 로드
              const loadStructure = () => {
                if (!editor) return;
                try {
                  const formats = (window as any).perkinelmer?.DataFormats;
                  if (initialCdxml) {
                    if (editor.loadCDXML) {
                      editor.loadCDXML(initialCdxml);
                    } else if (editor.setData) {
                      editor.setData(formats?.CDXML || 'CDXML', initialCdxml);
                    } else if (editor.setMolecule) {
                      editor.setMolecule(initialCdxml);
                    }
                  } else if (initialMolblock) {
                    // ChemDraw JS: MOL V2000 로드
                    if (editor.loadMOL) {
                      editor.loadMOL(initialMolblock);
                    } else if (editor.setData) {
                      // 가능한 format key들 시도
                      const molFormat = formats?.MOLV2000 || formats?.MOLFILE || 'chemical/x-mdl-molfile';
                      editor.setData(molFormat, initialMolblock);
                    } else if (editor.setMolecule) {
                      editor.setMolecule(initialMolblock);
                    }
                  } else if (initialSmiles) {
                    if (editor.loadSMILES) {
                      editor.loadSMILES(initialSmiles);
                    } else if (editor.setData) {
                      const formats = (window as any).perkinelmer?.DataFormats;
                      editor.setData(formats?.SMILES || 'chemical/x-daylight-smiles', initialSmiles);
                    } else if (editor.setMolecule) {
                      editor.setMolecule(initialSmiles);
                    }
                  }
                } catch (e) {
                  console.warn('Failed to load structure into editor:', e);
                }
              };
              // 에디터 초기화 직후에는 준비 안 될 수 있으므로 약간의 딜레이
              setTimeout(loadStructure, 500);
              void waitForChemDrawEditorReady(containerId, editor).then(() => {
                if (isDisposed) return;
                setCdjsInstance(editor);
              });
            }
          });
        }, 300);
      } catch (error) {
        console.error('Failed to initialize ChemDraw JS:', error);
      }
    };

    loadChemDraw();

    return () => {
      // Cleanup: ChemDraw JS doesn't always have a public destroy() method, 
      // but we reset the state to trigger re-init next time.
      isDisposed = true;
      setCdjsInstance(null);
      restoreReadbackPatch();
      restorePassiveWheelPatch();
    };
  }, [open, containerId, initialCdxml, initialSmiles, initialMolblock]);

  useEffect(() => {
    if (!open || !cdjsInstance) return;

    const container = document.getElementById(containerId);
    if (!container) return;

    return installChemDrawKoreanKeyboardBridge(container);
  }, [open, cdjsInstance, containerId]);

  const handleCancel = () => {
    setCdjsInstance(null);
    onCancel();
  };

  const handleFlip = (axis: ChemDrawFlipAxis) => {
    applyChemDrawFlip(cdjsInstance, axis);
  };

  const flushActiveEditorInput = async () => {
    await commitChemDrawActiveInput(containerId, cdjsInstance);
  };

  const handleConfirm = async () => {
    if (cdjsInstance) {
      await flushActiveEditorInput();
      const formats = (window as any).perkinelmer?.DataFormats;
      const data: ChemDrawStructureData = {
        smiles: '',
        svg: null,
      };

      const getFormatData = (format: string | undefined) => {
        if (!format || !cdjsInstance.getData) return '';
        try {
          return cdjsInstance.getData(format) || '';
        } catch {
          return '';
        }
      };

      const getStringMethodData = (methodName: string) => {
        const method = cdjsInstance[methodName];
        if (typeof method !== 'function') return '';
        try {
          const result = method.call(cdjsInstance);
          return typeof result === 'string' ? result : '';
        } catch {
          return '';
        }
      };

      const getCallbackMethodData = (methodName: string) => {
        const method = cdjsInstance[methodName];
        if (typeof method !== 'function') return Promise.resolve('');

        return new Promise<string>((resolve) => {
          let resolved = false;
          const finish = (value: string) => {
            if (resolved) return;
            resolved = true;
            resolve(value || '');
          };

          try {
            const result = method.call(cdjsInstance, (value: string | undefined, error: unknown) => {
              finish(error ? '' : value || '');
            });

            if (typeof result === 'string') {
              finish(result);
            }
          } catch {
            finish('');
          }

          window.setTimeout(() => finish(''), 1000);
        });
      };

      try {
        if (cdjsInstance.getData) {
          data.smiles = getFormatData(formats?.SMILES);
          data.svg = getFormatData(formats?.SVG) || null;
          data.cdxml = getFormatData(formats?.CDXML);
          data.molfile = getFormatData(formats?.MOLFILE);
          data.molV2000 = getFormatData(formats?.MOLV2000);
          data.molV3000 = getFormatData(formats?.MOLV3000);
        }

        data.cdxml = data.cdxml || getStringMethodData('getCDXML');
        data.svg = data.svg || getStringMethodData('getSVG') || null;
        data.molV2000 = data.molV2000 || await getCallbackMethodData('getMOL');
        data.molV3000 = data.molV3000 || await getCallbackMethodData('getMOLV3000');
        data.smiles = data.smiles || await getCallbackMethodData('getSMILES');
      } catch (e) {
        console.error('Error extracting data:', e);
      }

      onConfirm(data);
      setCdjsInstance(null); // Reset after confirm
    }
  };

  const handleConfirmMouseDown = (event: React.MouseEvent<HTMLElement>) => {
    if (!cdjsInstance) return;
    event.preventDefault();
    void flushActiveEditorInput();
  };

  const flipControls = (
    <Space direction="vertical">
      <Tooltip title="선택 구조 좌우 반전" placement="left">
        <Button
          icon={<ArrowLeftRight size={16} />}
          onClick={() => handleFlip('horizontal')}
          disabled={!cdjsInstance}
        />
      </Tooltip>
      <Tooltip title="선택 구조 상하 반전" placement="left">
        <Button
          icon={<ArrowUpDown size={16} />}
          onClick={() => handleFlip('vertical')}
          disabled={!cdjsInstance}
        />
      </Tooltip>
    </Space>
  );

  return (
    <Modal 
      title={title} 
      open={open} 
      onCancel={handleCancel} 
      width={900}
      destroyOnHidden
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
          <Space>
            <Button onClick={handleCancel}>취소</Button>
            <Button
              type="primary"
              onMouseDown={handleConfirmMouseDown}
              onClick={handleConfirm}
              disabled={!cdjsInstance}
              style={{ background: token.colorPrimary, borderColor: token.colorPrimary }}
            >
              {confirmText}
            </Button>
          </Space>
        </div>
      }
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
        {flipControls}
        <div
          id={containerId}
          style={{
            height: 500,
            width: '100%',
            minWidth: 0,
            background: token.colorBgLayout,
            borderRadius: 8,
            border: `1px solid ${token.colorBorderSecondary}`,
            overflow: 'hidden'
          }}
        />
      </div>
      <div style={{ marginTop: 12 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          <Info size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          구조를 완성한 후 '{confirmText}' 버튼을 눌러주세요.
        </Text>
      </div>
    </Modal>
  );
};

const styles = `
  .CDW_Logo, 
  .cdd-logo, 
  .cdd-clipboard-icon-row-container {
    display: none !important;
  }
`;

if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}

export default ChemDrawModal;
