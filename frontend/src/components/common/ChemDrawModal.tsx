import React, { useRef, useState } from 'react';
import { Modal, Button, Space, theme } from 'antd';
import ChemDrawCanvasCore, {
  extractChemDrawStructureData,
  type ChemDrawCanvasCoreHandle,
  type ChemDrawStructureData,
} from './ChemDrawCanvasCore';

export type { ChemDrawStructureData } from './ChemDrawCanvasCore';

interface ChemDrawModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: (data: ChemDrawStructureData) => void;
  onEditorInteraction?: () => void;
  extraContent?: React.ReactNode;
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
  onEditorInteraction,
  extraContent,
  title = '구조 검색',
  confirmText = '확인',
  initialCdxml,
  initialSmiles,
  initialMolblock,
}) => {
  const { token } = theme.useToken();
  const coreRef = useRef<ChemDrawCanvasCoreHandle>(null);
  const [editorInstance, setEditorInstance] = useState<any>(null);

  const handleCancel = () => {
    setEditorInstance(null);
    onCancel();
  };

  const handleConfirm = async () => {
    const editor = coreRef.current?.getEditor();
    if (!editor) return;

    await coreRef.current?.flushPendingInput();
    const data = await extractChemDrawStructureData(editor);
    onConfirm(data);
    setEditorInstance(null);
  };

  const handleConfirmMouseDown = (event: React.MouseEvent<HTMLElement>) => {
    if (!editorInstance) return;
    event.preventDefault();
    void coreRef.current?.flushPendingInput();
  };

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
              disabled={!editorInstance}
              style={{ background: token.colorPrimary, borderColor: token.colorPrimary }}
            >
              {confirmText}
            </Button>
          </Space>
        </div>
      }
    >
      <ChemDrawCanvasCore
        ref={coreRef}
        active={open}
        height={500}
        initialCdxml={initialCdxml}
        initialSmiles={initialSmiles}
        initialMolblock={initialMolblock}
        onReady={setEditorInstance}
        onEditorInteraction={onEditorInteraction}
        controlsPlacement="left"
        helperText={<>구조를 완성한 후 '{confirmText}' 버튼을 눌러주세요.</>}
      />
      {extraContent ? (
        <div style={{ marginTop: 12 }}>
          {extraContent}
        </div>
      ) : null}
    </Modal>
  );
};

export default ChemDrawModal;
