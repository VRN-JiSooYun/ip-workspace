import React from 'react';
import { Alert, App, Button, Modal, Space, Spin, Tooltip, theme } from 'antd';
import { Box, Copy, Image as ImageIcon, Square } from 'lucide-react';
import {
  copySvgImageToClipboard,
  getCompoundStructureCopyText,
  getStructureImageCopyFilter,
} from './CompoundStructureView';
import MolstarStructureViewer from '../myboard/MolstarStructureViewer';
import { conformerApi } from '../../services/conformerApi';

type StructurePreviewMode = '2d' | '3d';

const ligandConformerCache = new Map<string, string>();

export type StructurePreviewModalAction = {
  key: React.Key;
  title: string;
  icon: React.ReactNode;
  disabled?: boolean;
  onClick: React.MouseEventHandler<HTMLElement>;
};

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
  enableLigand3d?: boolean;
  extraActions?: StructurePreviewModalAction[];
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
  enableLigand3d = true,
  extraActions = [],
}) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [previewMode, setPreviewMode] = React.useState<StructurePreviewMode>('2d');
  const [ligandStructureData, setLigandStructureData] = React.useState<string | null>(null);
  const [isLigandLoading, setIsLigandLoading] = React.useState(false);
  const [ligandErrorMessage, setLigandErrorMessage] = React.useState<string | null>(null);
  const ligandRequestRef = React.useRef<AbortController | null>(null);
  const structureImageCopyFilter = getStructureImageCopyFilter(token);
  const normalizedSmiles = smiles?.trim() ?? '';
  const ligandViewerTitle = `${title} ligand conformer`;
  const ligandViewerKey = normalizedSmiles;
  const canShowLigand3d = enableLigand3d && Boolean(normalizedSmiles);
  const copyText = getCompoundStructureCopyText({
    smiles,
    molBlock: molblock,
    cdxml,
    svg,
  });

  React.useEffect(() => {
    ligandRequestRef.current?.abort();
    ligandRequestRef.current = null;
    if (!open) return;
    setPreviewMode('2d');
    setLigandStructureData(null);
    setIsLigandLoading(false);
    setLigandErrorMessage(null);
  }, [open, normalizedSmiles, svg]);

  React.useEffect(() => () => {
    ligandRequestRef.current?.abort();
  }, []);

  React.useEffect(() => {
    if (enableLigand3d) return;
    ligandRequestRef.current?.abort();
    ligandRequestRef.current = null;
    setPreviewMode('2d');
    setLigandStructureData(null);
    setIsLigandLoading(false);
    setLigandErrorMessage(null);
  }, [enableLigand3d]);

  const handleOpenLigand3d = () => {
    if (!enableLigand3d) return;

    if (!normalizedSmiles) {
      void message.warning('Ligand 3D 생성에 사용할 SMILES가 없습니다.');
      return;
    }

    setPreviewMode('3d');
    setLigandErrorMessage(null);

    const cached = ligandConformerCache.get(normalizedSmiles);
    if (cached) {
      setLigandStructureData(cached);
      setIsLigandLoading(false);
      return;
    }

    setLigandStructureData(null);
    setIsLigandLoading(true);
    ligandRequestRef.current?.abort();
    const controller = new AbortController();
    ligandRequestRef.current = controller;

    void conformerApi.generate3dConformer({ smiles: normalizedSmiles }, controller.signal)
      .then((data) => {
        if (controller.signal.aborted || ligandRequestRef.current !== controller) return;
        ligandConformerCache.set(normalizedSmiles, data.conformer);
        setLigandStructureData(data.conformer);
      })
      .catch((error) => {
        if (controller.signal.aborted || ligandRequestRef.current !== controller) return;
        setLigandErrorMessage(error instanceof Error ? error.message : 'Ligand conformer 생성에 실패했습니다.');
      })
      .finally(() => {
        if (controller.signal.aborted || ligandRequestRef.current !== controller) return;
        ligandRequestRef.current = null;
        setIsLigandLoading(false);
      });
  };

  const handleCopyImage = () => {
    if (!svg) return;

    void copySvgImageToClipboard(svg, { scale: imageCopyScale, imageFilter: structureImageCopyFilter })
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
    <>
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
            {previewMode === '3d' ? (
              ligandStructureData ? (
                <MolstarStructureViewer
                  key={`structure-preview-ligand:${ligandViewerKey}`}
                  structureData={ligandStructureData}
                  format="sdf"
                  title={ligandViewerTitle}
                  className="structure-preview-modal-molstar"
                  showHydrogens={false}
                />
              ) : (
                <div className="structure-preview-modal-state">
                  {isLigandLoading ? (
                    <>
                      <Spin />
                      <span>Ligand conformer를 생성하는 중입니다.</span>
                    </>
                  ) : ligandErrorMessage ? (
                    <Alert type="error" showIcon message="Ligand 로드 실패" description={ligandErrorMessage} />
                  ) : null}
                </div>
              )
            ) : (
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
                  filter: structureImageCopyFilter,
                }}
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            )}
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
              {previewMode === '3d' ? (
                <Tooltip title="2D 구조 보기">
                  <Button
                    className="svg-action-btn compound-structure-action-button"
                    size="small"
                    type="text"
                    icon={<Square size={13} />}
                    onClick={() => setPreviewMode('2d')}
                  />
                </Tooltip>
              ) : canShowLigand3d ? (
                <Tooltip title="Ligand 3D 보기">
                  <Button
                    className="svg-action-btn compound-structure-action-button"
                    size="small"
                    type="text"
                    icon={<Box size={13} />}
                    disabled={isLigandLoading}
                    loading={isLigandLoading}
                    onClick={handleOpenLigand3d}
                  />
                </Tooltip>
              ) : null}
              <Tooltip title="이미지 복사">
                <Button
                  className="svg-action-btn compound-structure-action-button"
                  size="small"
                  type="text"
                  icon={<ImageIcon size={13} />}
                  disabled={previewMode !== '2d'}
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
                    disabled={previewMode !== '2d'}
                    onClick={handleCopyData}
                  />
                </Tooltip>
              ) : null}
              {extraActions.map(action => (
                <Tooltip title={action.title} key={action.key}>
                  <Button
                    className="svg-action-btn compound-structure-action-button"
                    size="small"
                    type="text"
                    icon={action.icon}
                    disabled={previewMode !== '2d' || action.disabled}
                    onClick={action.onClick}
                  />
                </Tooltip>
              ))}
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
            .structure-preview-modal-molstar {
              position: absolute;
              inset: 0;
              width: 100%;
              height: 100%;
              background: #05070A;
            }
            .structure-preview-modal-state {
              width: 100%;
              height: 100%;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              gap: 10px;
              padding: 24px;
              color: ${token.colorTextSecondary};
              font-size: 13px;
              font-weight: 600;
              text-align: center;
              box-sizing: border-box;
            }
          `}</style>
          </div>
        ) : null}
      </Modal>
    </>
  );
};

export default StructurePreviewModal;
