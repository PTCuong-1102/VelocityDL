import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number; // ms, default 4000
  /** Optional inline action buttons (e.g. Retry, Open folder). */
  actions?: ToastAction[];
}

/** Third argument of addToast: plain duration (legacy) or an options object. */
export type ToastOptions = number | {
  duration?: number;
  actions?: ToastAction[];
};

function normalizeOptions(options?: ToastOptions): { duration: number; actions?: ToastAction[] } {
  if (typeof options === 'number') return { duration: options };
  return { duration: options?.duration ?? 4000, actions: options?.actions };
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (type: ToastType, message: string, options?: ToastOptions) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (type, message, options) => {
    const { duration, actions } = normalizeOptions(options);
    // Inline action buttons need reading time: 4s is too quick to reach
    // and click them, so default such toasts to 6s.
    const effectiveDuration = actions && actions.length > 0 && options === undefined
      ? 6000
      : duration;
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;
    set((state) => {
      const nextToasts = [...state.toasts, { id, type, message, duration, actions }];
      // Limit to max 5 toasts on screen to prevent rendering overhead/lag
      return { toasts: nextToasts.slice(-5) };
    });
    // Auto-remove after duration
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, effectiveDuration);
  },

  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export default useToastStore;
