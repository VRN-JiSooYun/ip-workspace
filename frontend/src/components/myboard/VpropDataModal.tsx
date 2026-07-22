import React from 'react';
import { Descriptions, Modal, Space, Tag, Typography } from 'antd';
import type { Compound } from '../../mocks/compounds';
import { formatDisplayDate, formatNumberWithComma } from '../../utils/displayFormat';

const { Text } = Typography;

type VpropDataModalProps = {
  compound: Compound | null;
  onClose: () => void;
};

const formatValue = (value: number | null | undefined) => (
  typeof value === 'number' && Number.isFinite(value) ? formatNumberWithComma(value) : '-'
);

const VpropDataModal: React.FC<VpropDataModalProps> = ({ compound, onClose }) => {
  const calculation = compound?.vpropCalculation;
  const data = calculation?.data;
  const logDPh74 = data?.logDByPh.find((item) => Math.abs(item.pH - 7.4) < 0.001)?.value;
  const solubility = data?.solubilities.soraby ?? Object.values(data?.solubilities ?? {})[0];
  const pkaValues = data?.info.pkaValuesByAtom ?? [];

  return (
    <Modal
      title="Vprop 데이터"
      open={Boolean(compound && calculation && data)}
      onCancel={onClose}
      footer={null}
      width={760}
      destroyOnHidden
    >
      {compound && calculation && data ? (
        <Space direction="vertical" size={16} style={{ width: '100%', marginTop: 8 }}>
          <Descriptions
            size="small"
            bordered
            column={2}
            items={[
              { key: 'ideaNumber', label: '아이디어 번호', children: compound.designNo || compound.name || '-' },
              { key: 'calculatedAt', label: '계산 일시', children: formatDisplayDate(calculation.calculatedAt) },
              {
                key: 'smiles',
                label: 'SMILES',
                span: 2,
                children: <Text copyable={{ text: calculation.smiles }}>{calculation.smiles}</Text>,
              },
            ]}
          />
          <Descriptions
            size="small"
            bordered
            column={2}
            items={[
              { key: 'logP', label: 'logP', children: formatValue(data.logP) },
              { key: 'logDPh74', label: 'logD (pH 7.4)', children: formatValue(logDPh74) },
              { key: 'maxBasicValue', label: 'Max basic pKa', children: formatValue(data.info.maxBasicValue) },
              { key: 'minAcidicValue', label: 'Min acidic pKa', children: formatValue(data.info.minAcidicValue) },
              {
                key: 'pkaSites',
                label: 'pKa sites',
                span: 2,
                children: pkaValues.length > 0 ? (
                  <Space size={[4, 6]} wrap>
                    {pkaValues.map((item) => (
                      <Tag key={`${item.atomIndex}-${item.value}`} style={{ marginInlineEnd: 0 }}>
                        Atom {item.atomIndex}: {formatValue(item.value)}
                      </Tag>
                    ))}
                  </Space>
                ) : '-',
              },
              {
                key: 'intrinsicSolubility',
                label: `Intrinsic solubility${solubility?.unit ? ` (${solubility.unit})` : ''}`,
                children: formatValue(solubility?.intrinsicSolubility),
              },
              { key: 'logSPh74', label: 'logS (pH 7.4)', children: formatValue(solubility?.logS_pH74) },
              { key: 'uMPh74', label: 'Solubility (µM, pH 7.4)', children: formatValue(solubility?.uM_pH74) },
              {
                key: 'mgPerMlPh74',
                label: 'Solubility (mg/mL, pH 7.4)',
                children: formatValue(solubility?.mg_per_ml_pH74),
              },
            ]}
          />
        </Space>
      ) : null}
    </Modal>
  );
};

export default VpropDataModal;
