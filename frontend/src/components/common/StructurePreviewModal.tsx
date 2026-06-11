import React from 'react';
import { App, Button, Modal, Space, Tooltip, theme } from 'antd';
import { Copy, Image as ImageIcon } from 'lucide-react';
import {
  copySvgImageToClipboard,
  getCompoundStructureCopyText,
} from './CompoundStructureView';

type StructurePreviewModalProps = {
  open: boolean;
  title?: string;
  svg?: string | null;
  className?: string;
  onCancel: () => void;
  width?: string | number;
  smiles?: string | null;
  molblock?: string | null;
  cdxml?: string | null;
  imageCopyScale?: number;
};

const StructurePreviewModal: React.FC<StructurePreviewModalProps> = ({
  open,
  title = 'Structure',
  svg,
  className,
  onCancel,
  width = 'min(1200px, calc(100vw - 48px))',
  smiles,
  molblock,
  cdxml,
  imageCopyScale = 4,
}) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const copyText = getCompoundStructureCopyText({
    smiles,
    molBlock: molblock,
    cdxml,
    svg,
  });

  const handleCopyImage = () => {
    if (!svg) return;

    void copySvgImageToClipboard(svg, { scale: imageCopyScale })
      .then(() => {
        void message.success('구조 이미지 복사 완료');
      })
      .catch((error) => {
        const errorMessage = error instanceof Error ? error.message : '이미지 복사 실패';
        void message.error(errorMessage);
      });
  };

  const handleCopyData = () => {
    if (!copyText) return;

    const writePromise = navigator.clipboard?.writeText(copyText);
    if (!writePromise) {
      void message.error('클립보드를 지원하지 않는 브라우저입니다.');
      return;
    }

    void writePromise
      .then(() => {
        void message.success('구조 데이터 복사 완료');
      })
      .catch(() => {
        void message.error('복사 실패');
      });
  };

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      footer={null}
      width={width}
      centered
    >
      {svg ? (
        <div
          className={className}
          style={{
            width: '100%',
            height: 'min(720px, calc(100vh - 180px))',
            background: token.colorBgContainer,
            borderRadius: 8,
            border: `1px solid ${token.colorBorderSecondary}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            className="structure-preview-modal-svg-host"
            style={{
              width: 'calc(100% - 32px)',
              height: 'calc(100% - 32px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 0,
              minHeight: 0,
              overflow: 'hidden',
              contain: 'paint',
            }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <Space
            size={6}
            style={{
              position: 'absolute',
              right: 16,
              bottom: 16,
              zIndex: 5,
              padding: 6,
              borderRadius: 999,
              border: `1px solid ${token.colorBorderSecondary}`,
              background: token.colorBgElevated,
              boxShadow: token.boxShadowSecondary,
            }}
          >
            <Tooltip title="이미지 복사">
              <Button
                className="svg-action-btn compound-structure-action-button"
                size="small"
                type="text"
                icon={<ImageIcon size={13} />}
                onClick={handleCopyImage}
              />
            </Tooltip>
            {copyText ? (
              <Tooltip title="구조 데이터 복사">
                <Button
                  className="svg-action-btn compound-structure-action-button"
                  size="small"
                  type="text"
                  icon={<Copy size={13} />}
                  onClick={handleCopyData}
                />
              </Tooltip>
            ) : null}
          </Space>
          <style>{`
            .structure-preview-modal-svg-host > svg,
            .structure-preview-modal-svg-host svg {
              width: 100% !important;
              height: 100% !important;
              max-width: 100% !important;
              max-height: 100% !important;
              display: block !important;
              object-fit: contain !important;
              overflow: hidden !important;
              transform: none !important;
            }
          `}</style>
        </div>
      ) : null}
    </Modal>
  );
};

export default StructurePreviewModal;
