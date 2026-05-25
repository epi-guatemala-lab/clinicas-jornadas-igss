import { useMemo } from 'react';
import { useThemedColors } from '../../theme/useThemedColors';

/**
 * Donut chart SVG puro (sin Recharts) — theme-reactive.
 * Para usar como mini-viz dentro de StatCard o como gráfica compacta.
 *
 * @param {number} value - valor a representar (porcentaje 0-100, o número absoluto si pasás `max`)
 * @param {object} props - { max=100, size=80, thickness=10, color, trackColor, label, centerLabel? }
 */
export default function Donut({
  value = 0,
  max = 100,
  size = 80,
  thickness = 10,
  color,
  trackColor,
  centerLabel,
  centerSub,
  ariaLabel = 'Indicador',
}) {
  const t = useThemedColors();
  const fillColor = color || t.accent.primary;
  const track = trackColor || (t === t /* always */, t.bg.surfaceElev);

  const radius = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  const dash = pct * circumference;

  // Determinar color dinámico por umbral si no se pasó explícito
  const dynColor = useMemo(() => {
    if (color) return color;
    const p = pct * 100;
    if (p >= 90) return t.status.success;
    if (p >= 80) return t.accent.primary;
    if (p >= 50) return t.status.warning;
    return t.accent.primary; // sigue rosa, no rojo (rojo es solo crítico)
  }, [color, pct, t]);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={ariaLabel}>
      <circle cx={cx} cy={cy} r={radius} fill="none"
              stroke={track} strokeWidth={thickness} />
      <circle
        cx={cx} cy={cy} r={radius}
        fill="none"
        stroke={dynColor}
        strokeWidth={thickness}
        strokeDasharray={`${dash} ${circumference - dash}`}
        strokeDashoffset={circumference / 4}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dasharray 600ms cubic-bezier(0.4,0,0.2,1), stroke 200ms ease' }}
      />
      {centerLabel && (
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
              fill={t.text.primary} fontSize={size * 0.22} fontWeight="700">
          {centerLabel}
        </text>
      )}
      {centerSub && (
        <text x={cx} y={cy + size * 0.18} textAnchor="middle" dominantBaseline="central"
              fill={t.text.secondary} fontSize={size * 0.11}>
          {centerSub}
        </text>
      )}
    </svg>
  );
}
