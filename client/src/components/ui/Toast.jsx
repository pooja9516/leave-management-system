import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);
const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };
const DURATION = 4500;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (variant, title, description) => {
      idRef.current += 1;
      const id = idRef.current;
      setToasts((list) => [...list.slice(-2), { id, variant, title, description }]);
      setTimeout(() => dismiss(id), DURATION);
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      success: (title, description) => show('success', title, description),
      error: (title, description) => show('error', title, description),
      info: (title, description) => show('info', title, description),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" aria-live="polite" aria-relevant="additions">
        {toasts.map(({ id, variant, title, description }) => {
          const Icon = ICONS[variant];
          return (
            <div key={id} className={`toast toast--${variant}`} role={variant === 'error' ? 'alert' : 'status'}>
              <Icon className="toast__icon" aria-hidden="true" />
              <div className="toast__body">
                <p className="toast__title">{title}</p>
                {description && <p className="toast__text">{description}</p>}
              </div>
              <button type="button" className="toast__close" onClick={() => dismiss(id)} aria-label="Dismiss notification">
                <X aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
