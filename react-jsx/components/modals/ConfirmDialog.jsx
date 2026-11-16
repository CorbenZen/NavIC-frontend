import { Loader2 } from 'lucide-react';
import { Modal } from './Modal';

export function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', busy = false, onCancel, onConfirm }) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? <Loader2 /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="small" style={{ lineHeight: 1.65 }}>
        {message}
      </p>
    </Modal>
  );
}
