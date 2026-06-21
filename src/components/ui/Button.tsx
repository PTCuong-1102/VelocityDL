import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  fullWidth = false,
  className = '',
  style,
  ...props
}) => {
  const getPadding = () => {
    switch (size) {
      case 'sm':
        return '6px 12px';
      case 'lg':
        return '12px 24px';
      default:
        return '8px 16px';
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'sm':
        return '12px';
      case 'lg':
        return '15px';
      default:
        return '14px';
    }
  };

  return (
    <button
      className={`btn btn-${variant} ${className}`}
      style={{
        padding: getPadding(),
        fontSize: getFontSize(),
        width: fullWidth ? '100%' : 'auto',
        ...style
      }}
      {...props}
    >
      {icon && <span className="icon" style={{ fontSize: size === 'sm' ? '16px' : '20px' }}>{icon}</span>}
      {children}
    </button>
  );
};

export default Button;
