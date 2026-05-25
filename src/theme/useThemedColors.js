import { useTheme } from './useTheme.js';
import { lightTokens, darkTokens } from './tokens.js';

/**
 * Devuelve el objeto de tokens del modo activo.
 * Útil para Recharts (que NO acepta CSS variables como `fill="var(...)"` consistentemente)
 * y para cualquier código JS que necesite los hex directos.
 *
 * Se re-evalúa al togglear tema porque consume `useTheme()`.
 */
export function useThemedColors() {
  const { isDark } = useTheme();
  return isDark ? darkTokens : lightTokens;
}

/** Devuelve un color de chart por índice (1-based como en los CSS vars --chart-1..7) */
export function useChartColor(index = 1) {
  const t = useThemedColors();
  const i = Math.max(1, Math.min(7, index)) - 1;
  return t.chart.series[i];
}
