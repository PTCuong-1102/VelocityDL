import React from 'react';

interface NumberStepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}

export const NumberStepper: React.FC<NumberStepperProps> = ({
  value,
  min = 1,
  max = 10,
  onChange
}) => {
  const handleDecrement = () => {
    if (value > min) {
      onChange(value - 1);
    }
  };

  const handleIncrement = () => {
    if (value < max) {
      onChange(value + 1);
    }
  };

  return (
    <div 
      className="flex-row" 
      style={{ 
        alignItems: 'center', 
        backgroundColor: 'var(--surface-container-lowest)',
        border: '1px solid var(--outline-variant)',
        borderRadius: 'var(--radius-md)',
        padding: '2px',
        width: '120px',
        justifyContent: 'space-between',
        height: '38px'
      }}
    >
      <button
        className="btn btn-ghost flex-center"
        style={{
          border: 'none',
          padding: '0',
          width: '32px',
          height: '32px',
          borderRadius: 'var(--radius-sm)'
        }}
        onClick={handleDecrement}
        disabled={value <= min}
      >
        <span className="icon" style={{ fontSize: '18px' }}>remove</span>
      </button>

      <span 
        className="mono" 
        style={{ 
          fontSize: '14px', 
          fontWeight: 600,
          color: 'var(--on-surface)' 
        }}
      >
        {value}
      </span>

      <button
        className="btn btn-ghost flex-center"
        style={{
          border: 'none',
          padding: '0',
          width: '32px',
          height: '32px',
          borderRadius: 'var(--radius-sm)'
        }}
        onClick={handleIncrement}
        disabled={value >= max}
      >
        <span className="icon" style={{ fontSize: '18px' }}>add</span>
      </button>
    </div>
  );
};

export default NumberStepper;
