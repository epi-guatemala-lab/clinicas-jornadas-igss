import { useThemedColors } from '../../theme/useThemedColors';

/**
 * Tooltip de Recharts theme-aware. Reemplaza el tooltip default
 * que tiene bg-white hardcoded y se ve mal en dark mode.
 *
 * Uso:
 *   <Tooltip content={<ThemedTooltip />} />
 */
export default function ThemedTooltip({ active, payload, label, formatter, labelFormatter }) {
  const t = useThemedColors();
  if (!active || !payload || !payload.length) return null;

  return (
    <div
      style={{
        background: t.bg.surface,
        border: `1px solid ${t.border.default}`,
        borderRadius: 8,
        padding: '8px 12px',
        color: t.text.primary,
        fontSize: 12,
        boxShadow: '0 8px 20px -8px rgba(0,0,0,0.25)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {label != null && (
        <div style={{ color: t.text.secondary, marginBottom: 4, fontWeight: 600 }}>
          {labelFormatter ? labelFormatter(label) : label}
        </div>
      )}
      {payload.map((entry, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: entry.color || entry.fill || t.accent.primary,
          }} />
          <span style={{ color: t.text.secondary }}>{entry.name}:</span>
          <span style={{ color: t.text.primary, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {formatter ? formatter(entry.value, entry.name, entry) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}
