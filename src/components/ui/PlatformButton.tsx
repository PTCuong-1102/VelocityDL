import React from 'react';
import { Platform } from '../../types/download';
import { getPlatformIcon, getPlatformColor } from '../../utils/platform';

interface PlatformButtonProps {
  platform: Platform;
  label: string;
  onClick?: (platform: Platform) => void;
}

export const PlatformButton: React.FC<PlatformButtonProps> = ({
  platform,
  label,
  onClick
}) => {
  const color = getPlatformColor(platform);
  const icon = getPlatformIcon(platform);

  return (
    <button
      className="glass-panel glass-panel-hoverable"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        gap: '12px',
        cursor: 'pointer',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(23, 31, 51, 0.4)',
        width: '100%',
        height: '110px'
      }}
      onClick={() => onClick && onClick(platform)}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          backgroundColor: `${color}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `1px solid ${color}33`,
          transition: 'transform 0.2s ease'
        }}
        className="platform-btn-icon-wrapper"
      >
        <span className="icon" style={{ fontSize: '22px', color: color }}>
          {icon}
        </span>
      </div>
      <span style={{ fontWeight: 500, fontSize: '13px', color: 'var(--on-surface)' }}>
        {label}
      </span>
    </button>
  );
};

export default PlatformButton;
