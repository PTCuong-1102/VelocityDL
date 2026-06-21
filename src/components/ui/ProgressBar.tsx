import React from 'react';

interface ProgressBarProps {
  percent: number;
  variant?: 'primary' | 'secondary' | 'muted';
  size?: 'sm' | 'md' | 'lg';
  shimmer?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percent,
  variant = 'primary',
  size = 'md',
  shimmer = false
}) => {
  const boundedPercent = Math.max(0, Math.min(100, percent));

  return (
    <div className={`progress-container ${size}`}>
      <div
        className={`progress-bar ${variant} ${shimmer ? 'progress-shimmer' : ''}`}
        style={{ width: `${boundedPercent}%` }}
      />
    </div>
  );
};

export default ProgressBar;
