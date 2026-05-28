import React from 'react';
import { List, Typography, Button, Empty, Tag } from 'antd';
import { DeleteOutlined, AimOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface PdfSidebarProps {
  highlights: any[];
  onScrollToHighlight: (highlight: any) => void;
  onDeleteHighlight: (id: string) => void;
  backgroundColor?: string;
  borderColor?: string;
}

const PdfSidebar: React.FC<PdfSidebarProps> = ({
  highlights,
  onScrollToHighlight,
  onDeleteHighlight,
  backgroundColor = '#fff',
  borderColor = '#f0f0f0',
}) => {
  return (
    <div
      style={{
        width: '300px',
        height: '100%',
        background: backgroundColor,
        borderLeft: `1px solid ${borderColor}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '16px', borderBottom: `1px solid ${borderColor}` }}>
        <Typography.Title level={5} style={{ margin: 0 }}>
          Annotations ({highlights.length})
        </Typography.Title>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {highlights.length === 0 ? (
          <Empty description="No highlights yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            dataSource={highlights}
            renderItem={(item: any) => (
              <List.Item
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  background: '#fafafa',
                  cursor: 'pointer',
                  display: 'block',
                }}
                onClick={() => onScrollToHighlight(item)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <Tag color="blue">Page {item.position.pageNumber}</Tag>
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteHighlight(item.id);
                    }}
                  />
                </div>
                {item.content?.text && (
                  <div
                    style={{
                      fontStyle: 'italic',
                      fontSize: '11px',
                      color: '#555',
                      marginBottom: '8px',
                      borderLeft: '2px solid #ddd',
                      paddingLeft: '8px',
                    }}
                  >
                    "{item.content.text.length > 100 ? item.content.text.slice(0, 100) + '...' : item.content.text}"
                  </div>
                )}
                {item.comment && (
                  <Text strong style={{ fontSize: '12px' }}>
                    {typeof item.comment === 'string' ? item.comment : item.comment.text}
                  </Text>
                )}
              </List.Item>
            )}
          />
        )}
      </div>
    </div>
  );
};

export default PdfSidebar;
