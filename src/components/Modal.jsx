import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, children, className = '', label, hideClose = false, wide = false }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className={`modal-layer ${wide ? 'is-wide' : ''}`} role="dialog" aria-modal="true" aria-label={label}>
      <button className="modal-scrim" aria-label="关闭" onClick={onClose} tabIndex={-1} />
      <div className={`modal-shell ${className}`}>
        {!hideClose && <button className="modal-close" onClick={onClose} aria-label="关闭"><X size={18} /></button>}
        {children}
      </div>
    </div>,
    document.body
  );
}
