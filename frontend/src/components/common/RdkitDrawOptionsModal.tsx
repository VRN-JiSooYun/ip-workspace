import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Divider, Input, InputNumber, Modal, Segmented, Slider, Space, Spin, Switch, Typography, theme } from 'antd';
import {
  DEFAULT_RDKIT_DRAW_OPTIONS,
  createRdkitDrawOptionPayload,
  readRdkitDrawOptions,
  resetRdkitDrawOptions,
  writeRdkitDrawOptions,
  type RdkitDrawGlobalOptions,
} from '../../services/rdkitDrawOptions';
import { DEFAULT_RDKIT_API_BASE_PATH } from '../../config/basePath';

const { Text } = Typography;

const DEFAULT_PREVIEW_SMILES = 'Nc1ncc(Nc2ccccc2)nc1';

const getRdkitApiBaseUrl = () => {
  return (import.meta.env.VITE_RDKIT_API_URL || DEFAULT_RDKIT_API_BASE_PATH).replace(/\/$/, '');
};

type OptionNumberProps = {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
};

const OptionNumber: React.FC<OptionNumberProps> = ({ label, min, max, step, value, onChange }) => (
  <div className="rdkit-draw-option-number">
    <Text strong className="rdkit-draw-option-label">{label}</Text>
    <div className="rdkit-draw-option-control">
      <Slider
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(nextValue) => {
          if (typeof nextValue === 'number') onChange(nextValue);
        }}
        style={{ flex: 1, margin: 0 }}
      />
      <InputNumber
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(nextValue) => {
          if (typeof nextValue === 'number') onChange(nextValue);
        }}
        style={{ width: 82 }}
      />
    </div>
  </div>
);

interface RdkitDrawOptionsModalProps {
  open: boolean;
  onCancel: () => void;
}

const RdkitDrawOptionsModal: React.FC<RdkitDrawOptionsModalProps> = ({ open, onCancel }) => {
  const { token } = theme.useToken();
  const [options, setOptions] = useState<RdkitDrawGlobalOptions>(() => readRdkitDrawOptions());
  const [previewSmiles, setPreviewSmiles] = useState(DEFAULT_PREVIEW_SMILES);
  const [previewSvg, setPreviewSvg] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const previewPayload = useMemo(() => ({
    smiles: previewSmiles.trim(),
    ...createRdkitDrawOptionPayload(options),
  }), [options, previewSmiles]);

  useEffect(() => {
    if (!open) return;

    const smiles = previewPayload.smiles;
    if (!smiles) {
      setPreviewSvg(null);
      setPreviewError('Preview에 사용할 SMILES를 입력해주세요.');
      return;
    }

    const abortController = new AbortController();
    const timer = window.setTimeout(() => {
      setIsPreviewLoading(true);
      setPreviewError(null);

      fetch(`${getRdkitApiBaseUrl()}/draw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(previewPayload),
        signal: abortController.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error(`RDKit API 요청 실패 (${response.status})`);
          const result = await response.json();
          if (!result.svg_text) throw new Error(result.error || 'Preview SVG 생성에 실패했습니다.');
          setPreviewSvg(result.svg_text);
        })
        .catch((error) => {
          if (error?.name === 'AbortError') return;
          setPreviewSvg(null);
          setPreviewError(error instanceof Error ? error.message : 'Preview 요청에 실패했습니다.');
        })
        .finally(() => {
          if (!abortController.signal.aborted) setIsPreviewLoading(false);
        });
    }, 300);

    return () => {
      window.clearTimeout(timer);
      abortController.abort();
    };
  }, [open, previewPayload]);

  const updateOption = <K extends keyof RdkitDrawGlobalOptions>(key: K, value: RdkitDrawGlobalOptions[K]) => {
    setOptions((current) => ({ ...current, [key]: value }));
  };

  const handleSave = () => {
    writeRdkitDrawOptions(options);
    onCancel();
  };

  const handleReset = () => {
    setOptions(DEFAULT_RDKIT_DRAW_OPTIONS);
    resetRdkitDrawOptions();
  };

  return (
    <Modal
      title="RDKit Draw 설정"
      open={open}
      onCancel={onCancel}
      width={980}
      destroyOnHidden
      footer={[
        <Button key="reset" onClick={handleReset}>기본값으로 되돌리기</Button>,
        <Button key="cancel" onClick={onCancel}>취소</Button>,
        <Button key="save" type="primary" onClick={handleSave}>저장</Button>,
      ]}
    >
      <div className="rdkit-draw-options-layout">
        <div className="rdkit-draw-options-panel">
          <Text strong>대표 SMILES</Text>
          <Input
            value={previewSmiles}
            onChange={(event) => setPreviewSmiles(event.target.value)}
            style={{ marginTop: 6 }}
          />

          <Divider style={{ margin: '14px 0' }} />

          <div className="rdkit-draw-option-grid">
            <label className="rdkit-draw-switch-row">
              <Text>Atom label black</Text>
              <Switch checked={options.atomLabelBlock} onChange={(checked) => updateOption('atomLabelBlock', checked)} />
            </label>
            <label className="rdkit-draw-switch-row">
              <Text>Transparent BG</Text>
              <Switch checked={options.transparentBg} onChange={(checked) => updateOption('transparentBg', checked)} />
            </label>
            <label className="rdkit-draw-switch-row">
              <Text>Kekulize</Text>
              <Switch checked={options.kekulize} onChange={(checked) => updateOption('kekulize', checked)} />
            </label>
            <label className="rdkit-draw-switch-row">
              <Text>Bold font</Text>
              <Switch checked={options.boldfont} onChange={(checked) => updateOption('boldfont', checked)} />
            </label>
            <label className="rdkit-draw-switch-row">
              <Text>Stereo annotation</Text>
              <Switch checked={options.addStereoAnnotation} onChange={(checked) => updateOption('addStereoAnnotation', checked)} />
            </label>
          </div>

          <div style={{ marginTop: 14 }}>
            <Text strong className="rdkit-draw-option-label">Abbreviation</Text>
            <Segmented
              size="small"
              value={options.abbrevOption}
              onChange={(value) => updateOption('abbrevOption', value as 0 | 1 | 2)}
              options={[
                { label: 'Off', value: 0 },
                { label: 'Keep', value: 1 },
                { label: 'All', value: 2 },
              ]}
              style={{ marginTop: 6 }}
            />
          </div>

          <Divider style={{ margin: '14px 0' }} />

          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <OptionNumber label="Bond length" min={18} max={80} step={1} value={options.fixedBondLength} onChange={(value) => updateOption('fixedBondLength', value)} />
            <OptionNumber label="Font size" min={6} max={30} step={1} value={options.fontSize} onChange={(value) => updateOption('fontSize', value)} />
            <OptionNumber label="Fixed font" min={6} max={30} step={1} value={options.fixedFontSize} onChange={(value) => updateOption('fixedFontSize', value)} />
            <OptionNumber label="Line width" min={1} max={10} step={0.1} value={options.lineWidth} onChange={(value) => updateOption('lineWidth', value)} />
            <OptionNumber label="Padding" min={0} max={0.2} step={0.01} value={options.padding} onChange={(value) => updateOption('padding', value)} />
            <OptionNumber label="Bond offset" min={0.05} max={0.5} step={0.01} value={options.multipleBondOffset} onChange={(value) => updateOption('multipleBondOffset', value)} />
            <OptionNumber label="Max abbrev coverage" min={0.1} max={1} step={0.05} value={options.maxAbbrevCoverage} onChange={(value) => updateOption('maxAbbrevCoverage', value)} />
          </Space>
        </div>

        <div className="rdkit-draw-preview-panel">
          <div className="rdkit-draw-preview-header">
            <Text strong>Preview</Text>
            {isPreviewLoading ? <Spin size="small" /> : null}
          </div>
          <div className="rdkit-draw-preview-canvas">
            {previewError ? (
              <Alert type="error" showIcon message="Preview 실패" description={previewError} />
            ) : previewSvg ? (
              <div
                className="rdkit-draw-preview-svg"
                dangerouslySetInnerHTML={{ __html: previewSvg }}
              />
            ) : (
              <Text type="secondary">Preview를 준비 중입니다.</Text>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .rdkit-draw-options-layout {
          display: grid;
          grid-template-columns: minmax(360px, 1fr) minmax(320px, 0.9fr);
          gap: 18px;
        }
        .rdkit-draw-options-panel,
        .rdkit-draw-preview-panel {
          border: 1px solid ${token.colorBorderSecondary};
          border-radius: 8px;
          padding: 14px;
          background: ${token.colorBgContainer};
        }
        .rdkit-draw-option-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .rdkit-draw-switch-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          min-height: 24px;
        }
        .rdkit-draw-option-label {
          display: block;
          font-size: 12px;
        }
        .rdkit-draw-option-number {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .rdkit-draw-option-control {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .rdkit-draw-preview-panel {
          min-height: 520px;
          display: flex;
          flex-direction: column;
        }
        .rdkit-draw-preview-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .rdkit-draw-preview-canvas {
          flex: 1;
          min-height: 440px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px dashed ${token.colorBorderSecondary};
          border-radius: 8px;
          background: ${token.colorBgLayout};
          overflow: auto;
          padding: 16px;
        }
        .rdkit-draw-preview-svg svg {
          max-width: 100%;
          max-height: 400px;
          display: block;
        }
        @media (max-width: 860px) {
          .rdkit-draw-options-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </Modal>
  );
};

export default RdkitDrawOptionsModal;
