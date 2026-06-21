import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: string;
  mono?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ icon, mono = false, style, className = '', ...props }, ref) => {
    return (
      <div 
        className="flex-row w-full" 
        style={{ 
          position: 'relative', 
          alignItems: 'center' 
        }}
      >
        {icon && (
          <span 
            className="icon text-muted" 
            style={{ 
              position: 'absolute', 
              left: '12px',
              pointerEvents: 'none'
            }}
          >
            {icon}
          </span>
        )}
        <input
          ref={ref}
          className={`input-dark ${mono ? 'mono' : ''} ${className}`}
          style={{
            paddingLeft: icon ? '38px' : '12px',
            ...style
          }}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
