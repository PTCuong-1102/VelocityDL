import React from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel
}) => {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        animation: 'fadeInUp 0.15s ease-out'
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)'
        }}
        onClick={onCancel}
      />

      {/* Dialog */}
      <div
        className="glass-panel flex-col gap-md"
        style={{
          position: 'relative',
          padding: '24px',
          minWidth: '340px',
          maxWidth: '420px',
          boxShadow: 'var(--shadow-lg), var(--glow-primary)'
        }}
      >
        {/* Header */}
        <div className="flex-row gap-sm" style={{ alignItems: 'center' }}>
          <span
            className="icon"
            style={{
              fontSize: '24px',
              color: variant === 'danger' ? 'var(--error)' : 'var(--primary)'
            }}
          >
            {variant === 'danger' ? 'warning' : 'help_outline'}
          </span>
          <h3 style={{ fontSize: '16px', fontWeight: 600 }}>{title}</h3>
        </div>

        {/* Message */}
        <p className="text-muted" style={{ fontSize: '13px', lineHeight: 1.6 }}>
          {message}
        </p>

        {/* Actions */}
        <div className="flex-row gap-sm" style={{ justifyContent: 'flex-end', marginTop: '4px' }}>
          <button
            className="btn btn-ghost"
            style={{ height: '36px', padding: '0 16px', fontSize: '13px' }}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            className={`btn ${variant === 'danger' ? 'btn-primary' : 'btn-primary'}`}
            style={{
              height: '36px',
              padding: '0 16px',
              fontSize: '13px',
              backgroundColor: variant === 'danger' ? 'var(--error-container)' : undefined,
              color: variant === 'danger' ? 'var(--error)' : undefined,
              border: variant === 'danger' ? '1px solid rgba(255, 180, 171, 0.3)' : undefined
            }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
