import React from 'react';
import { Descriptions, Modal, Space, Tag, Typography } from 'antd';
import type { Compound } from '../../mocks/compounds';
import { formatDisplayDate, formatNumberWithComma } from '../../utils/displayFormat';

const { Text } = Typography;

type ChemaxonDataModalProps = {
  compound: Compound | null;
  onClose: () => void;
};

const formatValue = (value: number) => formatNumberWithComma(value);

const ChemaxonDataModal: React.FC<ChemaxonDataModalProps> = ({ compound, onClose }) => {
  const calculation = compound?.chemaxonCalculation;
  const data = calculation?.data;

  const items = data ? [
    { key: 'chemical_formula', label: 'Chemical formula', children: data.chemical_formula },
    { key: 'molecular_weight', label: 'Molecular weight', children: formatValue(data.molecular_weight) },
    { key: 'exact_mass', label: 'Exact mass', children: formatValue(data.exact_mass) },
    { key: 'heavy_atom_count', label: 'Heavy atom count', children: formatValue(data.heavy_atom_count) },
    { key: 'fsp3', label: 'Fsp3', children: formatValue(data.fsp3) },
    { key: 'num_rotatable_bonds', label: 'Rotatable bonds', children: formatValue(data.num_rotatable_bonds) },
    { key: 'log_s', label: 'LogS', children: formatValue(data.log_s) },
    { key: 'log_p', label: 'LogP', children: formatValue(data.log_p) },
    { key: 'log_d', label: 'LogD', children: formatValue(data.log_d) },
    { key: 'pka', label: 'pKa', children: formatValue(data.pka) },
    { key: 'cns_mpo_score', label: 'CNS MPO score', children: formatValue(data.cns_mpo_score) },
    {
      key: 'topological_polar_surface_area',
      label: 'Topological polar surface area',
      children: formatValue(data.topological_polar_surface_area),
    },
    { key: 'num_h_bond_donors', label: 'H-bond donors', children: formatValue(data.num_h_bond_donors) },
    { key: 'num_h_bond_acceptors', label: 'H-bond acceptors', children: formatValue(data.num_h_bond_acceptors) },
    { key: 'num_h_bond_donors_site', label: 'H-bond donor sites', children: formatValue(data.num_h_bond_donors_site) },
    { key: 'num_h_bond_acceptors_site', label: 'H-bond acceptor sites', children: formatValue(data.num_h_bond_acceptors_site) },
    {
      key: 'num_rule_of_5_violations',
      label: 'Rule of 5 violations',
      children: formatValue(data.num_rule_of_5_violations),
    },
    {
      key: 'composition',
      label: 'Composition',
      span: 2,
      children: (
        <Space size={[4, 6]} wrap>
          {Object.entries(data.composition).map(([element, percentage]) => (
            <Tag key={element} style={{ marginInlineEnd: 0 }}>{element} {percentage}</Tag>
          ))}
        </Space>
      ),
    },
  ] : [];

  return (
    <Modal
      title="Chemaxon 데이터"
      open={Boolean(compound && calculation)}
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
          <Descriptions size="small" bordered column={2} items={items} />
        </Space>
      ) : null}
    </Modal>
  );
};

export default ChemaxonDataModal;
