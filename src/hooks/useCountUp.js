import { useEffect, useRef, useState } from 'react';

/**
 * Anima un número de su valor anterior al nuevo. Respeta prefers-reduced-motion.
 *
 * @param {number} target - valor objetivo
 * @param {object} opts - { duration=800ms, decimals=0 }
 * @returns {number} valor mostrado en este frame
 */
export function useCountUp(target, { duration = 800, decimals = 0 } = {}) {
  const [display, setDisplay] = useState(target ?? 0);
  const fromRef = useRef(target ?? 0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (target == null || Number.isNaN(target)) {
      setDisplay(0);
      return;
    }
    const reduce = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
    if (reduce || duration <= 0) {
      setDisplay(target);
      fromRef.current = target;
      return;
    }
    const start = performance.now();
    const from = fromRef.current ?? 0;
    const to = target;
    const tick = (t) => {
      const elapsed = t - start;
      const progress = Math.min(1, elapsed / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = from + (to - from) * eased;
      setDisplay(decimals > 0 ? Number(value.toFixed(decimals)) : Math.round(value));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, decimals]);

  return display;
}
