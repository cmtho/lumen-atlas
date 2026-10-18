import { useEffect } from 'react';
import { Check, Info } from 'lucide-react';

export default function Toast({ toast, onDone }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [toast, onDone]);
  if (!toast) return null;
  return (
    <div className={`toast glass ${toast.type === 'error' ? 'error' : ''}`} role="status">
      {toast.type === 'error' ? <Info size={16} /> : <Check size={16} />}
      <span>{toast.message}</span>
    </div>
  );
}
