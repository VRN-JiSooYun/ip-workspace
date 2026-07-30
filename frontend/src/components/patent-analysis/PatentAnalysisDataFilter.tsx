import React from 'react';
import {
  Button,
  Col,
  Form,
  InputNumber,
  Modal,
  Row,
  Select,
} from 'antd';
import type { PatentDataFilterValue } from '../../services/patentAnalysisApi';

type FilterFormValue = {
  humanKeyCompound?: 'yes' | 'no';
  rankingMin?: number;
  rankingMax?: number;
  scaffoldRanking?: number;
  pageNumber?: number;
  bioactivityKey?: string;
  bioactivityMin?: number;
  bioactivityMax?: number;
};

type Props = {
  open: boolean;
  dataset: 'raw' | 'clean';
  initialValue: PatentDataFilterValue;
  bioactivityOptions: string[];
  scaffoldRanks: number[];
  onCancel: () => void;
  onApply: (value: PatentDataFilterValue) => void;
};

export const countPatentDataFilters = (value: PatentDataFilterValue): number => (
  Number(value.humanKeyCompound !== undefined)
  + Number(value.rankingMin !== undefined || value.rankingMax !== undefined)
  + Number(value.scaffoldRanking !== undefined)
  + Number(value.pageNumber !== undefined)
  + Number(Boolean(value.bioactivity))
);

const PatentAnalysisDataFilter: React.FC<Props> = ({
  open,
  dataset,
  initialValue,
  bioactivityOptions,
  scaffoldRanks,
  onCancel,
  onApply,
}) => {
  const [form] = Form.useForm<FilterFormValue>();

  React.useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      humanKeyCompound: initialValue.humanKeyCompound === undefined
        ? undefined
        : initialValue.humanKeyCompound ? 'yes' : 'no',
      rankingMin: initialValue.rankingMin,
      rankingMax: initialValue.rankingMax,
      scaffoldRanking: initialValue.scaffoldRanking,
      pageNumber: initialValue.pageNumber,
      bioactivityKey: initialValue.bioactivity?.key,
      bioactivityMin: initialValue.bioactivity?.min,
      bioactivityMax: initialValue.bioactivity?.max,
    });
  }, [form, initialValue, open]);

  const handleFinish = (values: FilterFormValue) => {
    if (
      values.rankingMin !== undefined
      && values.rankingMax !== undefined
      && values.rankingMin > values.rankingMax
    ) {
      form.setFields([{ name: 'rankingMax', errors: ['최대값은 최소값 이상이어야 합니다.'] }]);
      return;
    }

    const hasBioactivityRange = (
      values.bioactivityMin !== undefined || values.bioactivityMax !== undefined
    );
    if (hasBioactivityRange && !values.bioactivityKey) {
      form.setFields([{ name: 'bioactivityKey', errors: ['Bioactivity 항목을 선택해 주세요.'] }]);
      return;
    }
    if (values.bioactivityKey && !hasBioactivityRange) {
      form.setFields([{ name: 'bioactivityMin', errors: ['최소값 또는 최대값을 입력해 주세요.'] }]);
      return;
    }
    if (
      values.bioactivityMin !== undefined
      && values.bioactivityMax !== undefined
      && values.bioactivityMin > values.bioactivityMax
    ) {
      form.setFields([{ name: 'bioactivityMax', errors: ['최대값은 최소값 이상이어야 합니다.'] }]);
      return;
    }

    onApply({
      ...(values.humanKeyCompound !== undefined
        ? { humanKeyCompound: values.humanKeyCompound === 'yes' }
        : {}),
      ...(values.rankingMin !== undefined ? { rankingMin: values.rankingMin } : {}),
      ...(values.rankingMax !== undefined ? { rankingMax: values.rankingMax } : {}),
      ...(values.scaffoldRanking !== undefined
        ? { scaffoldRanking: values.scaffoldRanking }
        : {}),
      ...(values.pageNumber !== undefined ? { pageNumber: values.pageNumber } : {}),
      ...(values.bioactivityKey && hasBioactivityRange
        ? {
            bioactivity: {
              key: values.bioactivityKey,
              ...(values.bioactivityMin !== undefined ? { min: values.bioactivityMin } : {}),
              ...(values.bioactivityMax !== undefined ? { max: values.bioactivityMax } : {}),
            },
          }
        : {}),
    });
  };

  const handleReset = () => {
    form.resetFields();
    onApply({});
  };

  return (
    <Modal
      open={open}
      title={`${dataset === 'raw' ? 'Raw' : 'Clean'} data Filter`}
      onCancel={onCancel}
      afterClose={() => form.resetFields()}
      footer={[
        <Button key="reset" onClick={handleReset}>초기화</Button>,
        <Button key="cancel" onClick={onCancel}>닫기</Button>,
        <Button key="apply" type="primary" onClick={() => form.submit()}>적용</Button>,
      ]}
    >
      <Form<FilterFormValue>
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        preserve={false}
      >
        <Form.Item label="Human key compound" name="humanKeyCompound">
          <Select
            allowClear
            placeholder="전체"
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ]}
          />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="Ranking 최소" name="rankingMin">
              <InputNumber min={0} precision={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Ranking 최대" name="rankingMax">
              <InputNumber min={0} precision={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="Scaffold ranking" name="scaffoldRanking">
              <Select
                allowClear
                placeholder="전체"
                options={scaffoldRanks.map((rank) => ({ value: rank, label: `Rank ${rank}` }))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Page 번호" name="pageNumber">
              <InputNumber min={1} precision={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="Bioactivity assay" name="bioactivityKey">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="항목 선택"
            options={bioactivityOptions.map((key) => ({ value: key, label: key }))}
          />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="Bioactivity 최소" name="bioactivityMin">
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Bioactivity 최대" name="bioactivityMax">
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};

export default PatentAnalysisDataFilter;
