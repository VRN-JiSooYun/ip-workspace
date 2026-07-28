import React from 'react';
import { Breadcrumb, Typography } from 'antd';
import { ChevronRight } from 'lucide-react';

const { Text } = Typography;

interface BreadcrumbItem {
  label: React.ReactNode;
  onClick?: () => void;
}

interface PageHeaderBreadcrumbProps {
  items: BreadcrumbItem[];
}

const PageHeaderBreadcrumb: React.FC<PageHeaderBreadcrumbProps> = ({ items }) => {
  const breadcrumbItems = items.map((item, index) => ({
    title: item.onClick ? (
      <a 
        onClick={(e) => {
          e.preventDefault();
          item.onClick?.();
        }}
        style={{ 
          color: index === items.length - 1 ? 'inherit' : undefined,
          fontWeight: index === items.length - 1 ? 600 : 400,
          fontSize: '14px'
        }}
      >
        {item.label}
      </a>
    ) : (
      <Text 
        strong={index === items.length - 1}
        style={{ fontSize: '14px' }}
      >
        {item.label}
      </Text>
    )
  }));

  return (
    <Breadcrumb 
      separator={<ChevronRight size={14} style={{ marginTop: 4 }} />}
      style={{ display: 'flex', alignItems: 'center' }}
      items={breadcrumbItems}
    />
  );
};

export default PageHeaderBreadcrumb;
