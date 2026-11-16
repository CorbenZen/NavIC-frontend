import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../common/cx';

export function DialogPortal({ children, overlayClassName = 'modal-backdrop', dialogClassName = 'modal', labelledBy, onClose, dismissible = true, returnFocusRef, wide = false }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);

  useEffect(() => {
    closeRef.current = onClose;
    dismissibleRef.current = dismissible;
  }, [onClose, dismissible]);

  useEffect(() => {
    const priorFocus = returnFocusRef?.current || document.activeElement;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusables = () => [...(dialogRef.current?.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])];
    requestAnimationFrame(() => (focusables()[0] || dialogRef.current)?.focus());
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && dismissibleRef.current) {
        event.stopPropagation();
        closeRef.current?.();
      }
      if (event.key === 'Tab') {
        const items = focusables();
        if (!items.length) { event.preventDefault(); dialogRef.current?.focus(); return; }
        if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1).focus(); }
        else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = priorOverflow;
      document.removeEventListener('keydown', onKeyDown);
      if (priorFocus?.isConnected && typeof priorFocus.focus === 'function') priorFocus.focus();
    };
  }, [returnFocusRef]);

  return createPortal(
    <div className={overlayClassName} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && dismissibleRef.current) closeRef.current?.(); }}>
      <div ref={dialogRef} className={cx(dialogClassName, wide && 'wide')} role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
