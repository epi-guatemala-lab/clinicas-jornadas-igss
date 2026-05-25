import { useThemedColors } from '../../theme/useThemedColors';

/**
 * Gauge radial 3/4 (270°) — para % meta. Arco abierto abajo.
 * Más legible que dona 360° para comunicar "avance hacia meta".
 *
 * @param {number} value - 0-100 (porcentaje)
 * @param {object} props - { size=140, thickness=14, thresholds={warning:80, success:90}, label }
 */
export default function Gauge({
  value = 0,
  size = 140,
  thickness = 14,
  thresholds = { warning: 80, success: 90 },
  label,
  sublabel,
  ariaLabel = 'Indicador de meta',
}) {
  const t = useThemedColors();
  const radius = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;

  // arc 270°: desde 135° hasta -135° (sentido horario) — abierto abajo
  const startAngle = 135;
  const endAngle = -135;
  const totalAngle = 270;

  // Decide color por umbral
  let color = t.status.warning;
  if (value >= thresholds.success) color = t.status.success;
  else if (value >= thresholds.warning) color = t.accent.primary;
  else color = t.status.warning;

  // path del track (completo 270°)
  const polarToCartesian = (centerX, centerY, r, angleInDegrees) => {
    const a = ((angleInDegrees - 0) * Math.PI) / 180.0;
    return {
      x: centerX + r * Math.cos(a),
      y: centerY - r * Math.sin(a),
    };
  };

  const arcPath = (start, end) => {
    const s = polarToCartesian(cx, cy, radius, start);
    const e = polarToCartesian(cx, cy, radius, end);
    const largeArc = Math.abs(start - end) > 180 ? 1 : 0;
    const sweep = start > end ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${e.x} ${e.y}`;
  };

  const pct = Math.max(0, Math.min(100, value));
  const valueEnd = startAngle - (pct / 100) * totalAngle;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={ariaLabel}>
      {/* track */}
      <path
        d={arcPath(startAngle, endAngle)}
        fill="none"
        stroke={t.bg.surfaceElev}
        strokeWidth={thickness}
        strokeLinecap="round"
      />
      {/* valor */}
      {pct > 0 && (
        <path
          d={arcPath(startAngle, valueEnd)}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          style={{ transition: 'all 800ms cubic-bezier(0.4,0,0.2,1)' }}
        />
      )}
      {/* tick threshold a 80% */}
      {(() => {
        const tickAngle = startAngle - (thresholds.warning / 100) * totalAngle;
        const inner = polarToCartesian(cx, cy, radius - thickness / 2 - 2, tickAngle);
        const outer = polarToCartesian(cx, cy, radius + thickness / 2 + 2, tickAngle);
        return (
          <line
            x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
            stroke={t.text.muted} strokeWidth="1.5"
          />
        );
      })()}
      {/* label central */}
      {label && (
        <text x={cx} y={cy - 4} textAnchor="middle" dominantBaseline="middle"
              fill={t.text.primary} fontSize={size * 0.24} fontWeight="800"
              fontFamily="Inter, sans-serif"
              style={{ fontVariantNumeric: 'tabular-nums' }}>
          {label}
        </text>
      )}
      {sublabel && (
        <text x={cx} y={cy + size * 0.16} textAnchor="middle"
              fill={t.text.secondary} fontSize={size * 0.08}>
          {sublabel}
        </text>
      )}
    </svg>
  );
}
