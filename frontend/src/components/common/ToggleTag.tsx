import React from 'react';
import { Tag } from 'antd';

interface ToggleTagProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const ToggleTag: React.FC<ToggleTagProps> = ({
  checked,
  onChange,
  children,
  disabled = false,
  className,
  style,
}) => {
  return (
    <Tag.CheckableTag
      checked={checked}
      onChange={(nextChecked) => {
        if (!disabled) {
          onChange(nextChecked);
        }
      }}
      className={className || 'v-project-tag'}
      style={{
        marginInlineEnd: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        userSelect: 'none',
        ...style,
      }}
    >
      {children}
    </Tag.CheckableTag>
  );
};

export default ToggleTag;
