import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, children, className = '', label, hideClose = false, wide = false }) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return undefined;
    }
    if (!mounted) return undefined;
    setClosing(true);
    const timer = setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, 120);
    return () => clearTimeout(timer);
  }, [open, mounted]);

  useEffect(() => {
    if (!mounted) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape' && open) onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [mounted, open, onClose]);

  if (!mounted) return null;
  return createPortal(
    <div className={`modal-layer ${wide ? 'is-wide' : ''} ${closing ? 'is-closing' : ''}`} role="dialog" aria-modal="true" aria-label={label}>
      <button className="modal-scrim" aria-label="关闭" onClick={onClose} tabIndex={-1} />
      <div className={`modal-shell ${className}`}>
        {!hideClose && <button className="modal-close" onClick={onClose} aria-label="关闭"><X size={18} /></button>}
        {children}
      </div>
    </div>,
    document.body
  );
}
