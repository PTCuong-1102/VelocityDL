import React from 'react';

interface ToggleProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export const Toggle: React.FC<ToggleProps> = ({ label, checked, onChange, ...props }) => {
  return (
    <label className="switch-container">
      <input
        type="checkbox"
        style={{ display: 'none' }}
        checked={checked}
        onChange={onChange}
        {...props}
      />
      <div className="switch-control">
        <div className="switch-thumb"></div>
      </div>
      {label && <span style={{ fontSize: '13px', color: 'var(--on-surface-variant)' }}>{label}</span>}
    </label>
  );
};

export default Toggle;
