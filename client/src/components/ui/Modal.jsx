import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal shell: renders in a portal, traps Tab, closes on Escape or
 * backdrop click (unless `busy`), and returns focus to the trigger on close.
 * `initialFocusRef` chooses what gets focus when it opens.
 */
export default function Modal({ open, onClose, busy = false, initialFocusRef, role = 'dialog', labelledBy, describedBy, size = 'sm', children }) {
  const dialogRef = useRef(null);
  // Latest values without re-running the open/close effect.
  const latest = useRef({ busy, onClose });
  latest.current = { busy, onClose };

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    (initialFocusRef?.current || dialogRef.current.querySelector(FOCUSABLE))?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !latest.current.busy) {
        e.preventDefault();
        latest.current.onClose();
      }
      if (e.key === 'Tab') {
        const items = [...dialogRef.current.querySelectorAll(FOCUSABLE)];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div
        ref={dialogRef}
        className={`dialog dialog--${size}`}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

export const useModalIds = () => {
  const titleId = useId();
  const descId = useId();
  return { titleId, descId };
};
