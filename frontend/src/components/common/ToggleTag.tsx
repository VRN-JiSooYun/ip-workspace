import React from 'react';
import { Tag, theme } from 'antd';

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
  const { token } = theme.useToken();

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
        border: `1px solid ${checked ? token.colorPrimary : token.colorBorder}`,
        background: checked ? token.colorPrimaryBg : 'transparent',
        color: checked ? token.colorPrimary : token.colorTextSecondary,
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
