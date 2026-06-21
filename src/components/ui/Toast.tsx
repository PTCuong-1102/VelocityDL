import React, { useEffect, useState } from 'react';
import { useToastStore, ToastItem, ToastType } from '../../stores/toastStore';

// Icon map per type
const ICONS: Record<ToastType, string> = {
  success: 'check_circle',
  error: 'error',
  info: 'info',
  warning: 'warning',
};

const COLORS: Record<ToastType, { border: string; icon: string; bg: string }> = {
  success: {
    border: 'rgba(107, 216, 203, 0.35)',
    icon: '#6bd8cb',
    bg: 'rgba(107, 216, 203, 0.08)',
  },
  error: {
    border: 'rgba(255, 180, 171, 0.35)',
    icon: '#ffb4ab',
    bg: 'rgba(255, 180, 171, 0.08)',
  },
  info: {
    border: 'rgba(195, 192, 255, 0.35)',
    icon: '#c3c0ff',
    bg: 'rgba(195, 192, 255, 0.08)',
  },
  warning: {
    border: 'rgba(255, 185, 95, 0.35)',
    icon: '#ffb95f',
    bg: 'rgba(255, 185, 95, 0.08)',
  },
};

interface ToastProps {
  item: ToastItem;
  onRemove: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ item, onRemove }) => {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const colors = COLORS[item.type];

  useEffect(() => {
    // Trigger enter animation
    const enterTimer = setTimeout(() => setVisible(true), 10);

    // Trigger leave animation slightly before removal
    const leaveTimer = setTimeout(() => {
      setLeaving(true);
    }, (item.duration || 4000) - 350);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(leaveTimer);
    };
  }, [item.duration]);

  const handleClose = () => {
    setLeaving(true);
    setTimeout(() => onRemove(item.id), 320);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '12px 14px',
        borderRadius: '12px',
        border: `1px solid ${colors.border}`,
        background: `rgba(23, 31, 51, 0.92) ${colors.bg}`,
        backdropFilter: 'blur(16px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        minWidth: '280px',
        maxWidth: '380px',
        cursor: 'default',
        transform: visible && !leaving ? 'translateX(0) scale(1)' : 'translateX(24px) scale(0.95)',
        opacity: visible && !leaving ? 1 : 0,
        transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease',
        willChange: 'transform, opacity',
      }}
    >
      {/* Icon */}
      <span
        className="icon"
        style={{
          fontSize: '18px',
          color: colors.icon,
          flexShrink: 0,
          marginTop: '1px',
          fontVariationSettings: "'FILL' 1",
        }}
      >
        {ICONS[item.type]}
      </span>

      {/* Message */}
      <span
        style={{
          flex: 1,
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--on-surface)',
          lineHeight: '1.5',
          wordBreak: 'break-word',
        }}
      >
        {item.message}
      </span>

      {/* Close button */}
      <button
        onClick={handleClose}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0',
          color: 'var(--on-surface-variant)',
          opacity: 0.6,
          flexShrink: 0,
          marginTop: '1px',
          display: 'flex',
          alignItems: 'center',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
      >
        <span className="icon" style={{ fontSize: '16px' }}>close</span>
      </button>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <div key={toast.id} style={{ pointerEvents: 'auto' }}>
          <Toast item={toast} onRemove={removeToast} />
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
