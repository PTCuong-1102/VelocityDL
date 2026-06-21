import React from 'react';

interface GlassPanelProps {
  children: React.ReactNode;
  hoverable?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({
  children,
  hoverable = false,
  className = '',
  style,
  onClick
}) => {
  return (
    <div
      className={`glass-panel ${hoverable ? 'glass-panel-hoverable' : ''} ${className}`}
      style={{
        padding: '24px',
        ...style
      }}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default GlassPanel;
