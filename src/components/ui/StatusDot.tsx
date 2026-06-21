import React from 'react';
import { DownloadStatus } from '../../types/download';

interface StatusDotProps {
  status: DownloadStatus;
}

export const StatusDot: React.FC<StatusDotProps> = ({ status }) => {
  if (status === 'finished') {
    return (
      <span 
        className="icon text-secondary-color" 
        style={{ 
          fontSize: '16px', 
          color: '#4caf50',
          fontVariationSettings: '"FILL" 1, "wght" 600'
        }}
      >
        check_circle
      </span>
    );
  }

  return <span className={`status-dot ${status}`} />;
};

export default StatusDot;
