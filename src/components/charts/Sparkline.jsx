import { useThemedColors } from '../../theme/useThemedColors';

/**
 * Sparkline SVG puro (sin Recharts). Ligero, sin tooltip.
 * Útil para meter una mini-tendencia dentro de un StatCard.
 *
 * @param {number[]} data - array de valores
 * @param {object} props - { color, height=40, width=120, fill=true, showDot=true }
 */
export default function Sparkline({
  data = [],
  color,
  height = 40,
  width = 120,
  fill = true,
  showDot = true,
  ariaLabel = 'Tendencia',
}) {
  const t = useThemedColors();
  const stroke = color || t.accent.primary;

  if (!data || data.length < 2) {
    return <svg width={width} height={height} aria-label={ariaLabel} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - 2 - ((v - min) / range) * (height - 4);
    return [x, y];
  });
  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const areaPath = `${path} L ${width} ${height} L 0 ${height} Z`;
  const last = points[points.length - 1];
  const gradId = `spark-grad-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <svg width={width} height={height} aria-label={ariaLabel} viewBox={`0 0 ${width} ${height}`}>
      {fill && (
        <>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradId})`} />
        </>
      )}
      <path d={path} fill="none" stroke={stroke} strokeWidth="2"
            strokeLinejoin="round" strokeLinecap="round" />
      {showDot && (
        <circle cx={last[0]} cy={last[1]} r="3" fill={stroke}>
          <animate attributeName="r" values="3;5;3" dur="1.6s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  );
}
