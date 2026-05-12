import React, { useEffect, useState } from 'react';
import { Modal, Button, Typography, theme } from 'antd';
import { Info } from 'lucide-react';
import { CHEMDRAW_CONFIG } from '../../config/chemdraw';

const { Text } = Typography;

interface ChemDrawModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: (data: { smiles: string; svg: string | null }) => void;
  title?: string;
  confirmText?: string;
  initialSmiles?: string;
  initialMolblock?: string;
}

const ChemDrawModal: React.FC<ChemDrawModalProps> = ({ 
  open, 
  onCancel, 
  onConfirm,
  title = "구조 편집 (ChemDraw JS)",
  confirmText = "확인",
  initialSmiles,
  initialMolblock
}) => {
  const { token } = theme.useToken();
  const [cdjsInstance, setCdjsInstance] = useState<any>(null);
  const [containerId] = useState(`chemdraw-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    if (open) {
      const loadChemDraw = () => {
        if ((window as any).perkinelmer && (window as any).perkinelmer.ChemdrawWebManager) {
          initializeEditor();
          return;
        }

        const script = document.createElement('script');
        script.src = CHEMDRAW_CONFIG.SCRIPT_PATH;
        script.async = true;
        script.onload = () => {
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
            const container = document.getElementById(containerId);
            if (!container) return;

            manager.attach({
              id: containerId,
              license: CHEMDRAW_CONFIG.LICENSE_XML,
              viewOnly: false,
              callback: (editor: any) => {
                setCdjsInstance(editor);
                // initialMolblock 또는 initialSmiles를 에디터에 로드
                const loadStructure = () => {
                  if (!editor) return;
                  try {
                    if (initialMolblock) {
                      // ChemDraw JS: MOL V2000 로드
                      if (editor.loadMOL) {
                        editor.loadMOL(initialMolblock);
                      } else if (editor.setData) {
                        // 가능한 format key들 시도
                        const formats = (window as any).perkinelmer?.DataFormats;
                        const molFormat = formats?.MOLV2000 || formats?.MOL || formats?.mol || 'chemical/x-mdl-molfile';
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
              }
            });
          }, 300);
        } catch (error) {
          console.error('Failed to initialize ChemDraw JS:', error);
        }
      };

      loadChemDraw();
    }

    return () => {
      // Cleanup: ChemDraw JS doesn't always have a public destroy() method, 
      // but we reset the state to trigger re-init next time.
      if (!open) {
        setCdjsInstance(null);
      }
    };
  }, [open, containerId, initialSmiles, initialMolblock]);

  const handleCancel = () => {
    setCdjsInstance(null);
    onCancel();
  };

  const handleConfirm = () => {
    if (cdjsInstance) {
      const formats = (window as any).perkinelmer.DataFormats;
      let smiles = '';
      let svg = null;

      try {
        if (cdjsInstance.getData) {
          smiles = cdjsInstance.getData(formats.SMILES);
          svg = cdjsInstance.getData(formats.SVG);
        } else {
          smiles = cdjsInstance.getSmiles?.() || '';
          svg = cdjsInstance.getSVG?.() || null;
        }
      } catch (e) {
        console.error('Error extracting data:', e);
      }

      onConfirm({ smiles, svg });
      setCdjsInstance(null); // Reset after confirm
    }
  };

  return (
    <Modal 
      title={title} 
      open={open} 
      onCancel={handleCancel} 
      width={900}
      destroyOnHidden
      footer={[
        <Button key="cancel" onClick={handleCancel}>취소</Button>,
        <Button 
          key="confirm" 
          type="primary" 
          onClick={handleConfirm}
          disabled={!cdjsInstance}
          style={{ background: token.colorPrimary, borderColor: token.colorPrimary }}
        >
          {confirmText}
        </Button>
      ]}
    >
      <div 
        id={containerId} 
        style={{ 
          height: 500, 
          width: '100%',
          background: token.colorBgLayout, 
          borderRadius: 8, 
          border: `1px solid ${token.colorBorderSecondary}`,
          overflow: 'hidden'
        }} 
      />
      <div style={{ marginTop: 12 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          <Info size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          구조를 완성한 후 '{confirmText}' 버튼을 눌러주세요.
        </Text>
      </div>
    </Modal>
  );
};

export default ChemDrawModal;
