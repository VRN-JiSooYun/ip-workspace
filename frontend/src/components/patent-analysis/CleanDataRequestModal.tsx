import React from 'react';
import { Modal, Select, Space, Typography } from 'antd';

const { Text } = Typography;

export type CleanDataQuality = 0 | 30 | 50 | 70 | 100;

type Props = {
  open: boolean;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (quality: CleanDataQuality) => void;
};

const QUALITY_OPTIONS: CleanDataQuality[] = [0, 30, 50, 70, 100];

const CleanDataRequestModal: React.FC<Props> = ({
  open,
  loading,
  onCancel,
  onSubmit,
}) => {
  const [quality, setQuality] = React.useState<CleanDataQuality>(0);

  React.useEffect(() => {
    if (open) setQuality(0);
  }, [open]);

  return (
    <Modal
      open={open}
      title="Bioactivity Clean data 요청"
      okText="수정 요청"
      cancelText="취소"
      confirmLoading={loading}
      closable={!loading}
      maskClosable={!loading}
      cancelButtonProps={{ disabled: loading }}
      onCancel={onCancel}
      onOk={() => onSubmit(quality)}
    >
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Text strong>전체 데이터 퀄리티를 알려주세요.</Text>
        <Select
          value={quality}
          style={{ width: '100%' }}
          disabled={loading}
          onChange={(value) => setQuality(value)}
          options={QUALITY_OPTIONS.map((value) => ({
            value,
            label: `${value}%`,
          }))}
        />
      </Space>
    </Modal>
  );
};

export default CleanDataRequestModal;
