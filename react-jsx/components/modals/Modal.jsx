import { X } from 'lucide-react';
import { useId } from 'react';
import { DialogPortal } from './DialogPortal';

export function Modal({ open, title, subtitle, onClose, children, footer, wide = false }) {
  const titleId = useId();

  if (!open) return null;

  return (
    <DialogPortal overlayClassName="modal-backdrop" dialogClassName="modal" labelledBy={titleId} onClose={onClose} wide={wide}>
      <div className="modal-head">
        <div>
          <h2 id={titleId}>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog">
          <X />
        </button>
      </div>
      <div className="modal-body">{children}</div>
      {footer ? <div className="modal-foot">{footer}</div> : null}
    </DialogPortal>
  );
}
