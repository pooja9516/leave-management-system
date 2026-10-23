import { useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import Button from './Button';
import Modal, { useModalIds } from './Modal';

/** Confirmation for destructive actions; focus starts on the safe (cancel) button. */
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Go back',
  tone = 'danger',
  loading = false,
  onConfirm,
  onClose,
}) {
  const cancelRef = useRef(null);
  const { titleId, descId } = useModalIds();

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={loading}
      initialFocusRef={cancelRef}
      role="alertdialog"
      labelledBy={titleId}
      describedBy={descId}
    >
      <div className="dialog__body">
        <span className={`dialog__icon dialog__icon--${tone}`}>
          <AlertTriangle aria-hidden="true" />
        </span>
        <div className="dialog__content">
          <h2 id={titleId} className="dialog__title">
            {title}
          </h2>
          <div id={descId} className="dialog__text">
            {children}
          </div>
        </div>
      </div>
      <div className="dialog__actions">
        <Button ref={cancelRef} variant="secondary" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
