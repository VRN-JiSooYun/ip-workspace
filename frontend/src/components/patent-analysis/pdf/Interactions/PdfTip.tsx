import React, { useState } from 'react';
import { Button, Input, Space, Card } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';

interface PdfTipProps {
  onConfirm: (comment: string) => void;
  onOpen: () => void;
}

const PdfTip: React.FC<PdfTipProps> = ({ onConfirm, onOpen }) => {
  const [compact, setCompact] = useState(true);
  const [text, setText] = useState('');

  return (
    <div
      className="pdf-tip"
      onMouseEnter={onOpen}
      style={{
        zIndex: 1000,
        pointerEvents: 'auto',
      }}
    >
      {compact ? (
        <Button
          type="primary"
          size="small"
          onClick={() => setCompact(false)}
          style={{ borderRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
        >
          Add Highlight
        </Button>
      ) : (
        <Card
          size="small"
          styles={{ body: { padding: '8px' } }}
          style={{
            width: 200,
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Input
              placeholder="Add a comment..."
              size="small"
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
              <Button
                size="small"
                icon={<CloseOutlined />}
                onClick={() => setCompact(true)}
              />
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => onConfirm(text)}
              >
                Save
              </Button>
            </div>
          </Space>
        </Card>
      )}
    </div>
  );
};

export default PdfTip;
