import { useThemedColors } from '../../theme/useThemedColors';

/**
 * Devuelve props comunes para CartesianGrid/XAxis/YAxis/Legend según el tema activo.
 * Evita repetir colores en cada chart de Recharts.
 */
export function useChartTheme() {
  const t = useThemedColors();
  return {
    gridStroke: t.chart.grid,
    axisColor: t.chart.axis,
    series: t.chart.series,
    axisProps: {
      stroke: t.chart.axis,
      tick: { fill: t.chart.axis, fontSize: 11 },
      tickLine: { stroke: t.chart.axis },
    },
    gridProps: {
      stroke: t.chart.grid,
      strokeDasharray: '3 3',
      vertical: false,
    },
    legendProps: {
      wrapperStyle: { fontSize: 11, color: t.text.secondary },
    },
    surface: t.bg.surface,
    textPrimary: t.text.primary,
    textSecondary: t.text.secondary,
  };
}
