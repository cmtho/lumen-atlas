import { useEffect, useMemo, useRef, useState } from 'react';

export default function AnimatedNumber({ value, duration = 600, format = {}, className = '' }) {
  const target = Number(value) || 0;
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const formatter = useMemo(() => new Intl.NumberFormat('zh-CN', format), [JSON.stringify(format)]);

  useEffect(() => {
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const from = fromRef.current;
    fromRef.current = target;
    if (reduced || duration <= 0) {
      setDisplay(target);
      return undefined;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (target - from) * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return <span className={`animated-number ${className}`} style={{ fontVariantNumeric: 'tabular-nums' }}>{formatter.format(display)}</span>;
}
