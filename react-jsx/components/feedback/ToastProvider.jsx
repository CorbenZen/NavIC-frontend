import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { cx } from '../common/cx';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message, options = {}) => {
      const id = ++idRef.current;
      const toast = {
        id,
        title: options.title || (options.variant === 'error' ? 'Action failed' : options.variant === 'warning' ? 'Notice' : 'Done'),
        message,
        variant: options.variant || 'success',
        duration: options.duration ?? 4600,
      };
      setToasts((current) => [...current.slice(-3), toast]);
      if (toast.duration > 0) {
        window.setTimeout(() => dismiss(id), toast.duration);
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      push,
      success: (message, options) => push(message, { ...options, variant: 'success' }),
      error: (message, options) => push(message, { ...options, variant: 'error' }),
      warning: (message, options) => push(message, { ...options, variant: 'warning' }),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="region" aria-label="Notifications">
        {toasts.map((toast) => {
          const Icon = toast.variant === 'error' ? AlertCircle : toast.variant === 'warning' ? AlertTriangle : CheckCircle2;
          return (
            <div className={cx('toast', toast.variant)} key={toast.id} role="status">
              <Icon />
              <div>
                <b>{toast.title}</b>
                {toast.message}
              </div>
              <button type="button" onClick={() => dismiss(toast.id)} aria-label="Dismiss notification">
                ×
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
