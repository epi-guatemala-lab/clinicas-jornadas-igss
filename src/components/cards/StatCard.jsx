import { useCountUp } from '../../hooks/useCountUp';
import { useThemedColors } from '../../theme/useThemedColors';
import Donut from '../charts/Donut';
import Gauge from '../charts/Gauge';
import Sparkline from '../charts/Sparkline';

/**
 * KPI card grande con número hero + visualización lateral opcional.
 *
 * Variants de viz:
 * - 'gauge' → Gauge radial (% meta)
 * - 'donut' → Donut (composición)
 * - 'spark' → Sparkline (tendencia)
 * - 'bar'   → barra horizontal de progreso (mes consumido)
 * - null    → solo big number
 */
export default function StatCard({
  label,
  value,
  unit,
  format = 'number',          // 'number' | 'percent' | 'currency'
  decimals = 0,
  subLabel,
  delta,                       // { value, unit, polarity?: 'positive'|'negative' }
  viz,                         // 'gauge' | 'donut' | 'spark' | 'bar' | null
  vizData = {},
  tone = 'primary',            // 'primary'|'success'|'warning'|'danger'|'info'|'neutral'|'accent-2'|'accent-3'
  onClick,
  className = '',
  icon,
  compact = false,            // modo denso para grids single-view
}) {
  const t = useThemedColors();
  const numeric = typeof value === 'number' ? value : Number(value) || 0;
  const animated = useCountUp(numeric, { duration: 900, decimals });

  const formatVal = (v) => {
    if (format === 'percent') return `${Number(v).toFixed(decimals)}%`;
    if (format === 'currency') return `Q${v.toLocaleString('es-GT', { maximumFractionDigits: decimals })}`;
    return v.toLocaleString('es-GT', { maximumFractionDigits: decimals });
  };

  const toneToColor = {
    primary: t.accent.primary,
    'accent-2': t.accent.secondary,
    'accent-3': t.accent.tertiary,
    success: t.status.success,
    warning: t.status.warning,
    danger: t.status.danger,
    info: t.status.info,
    neutral: t.status.neutral,
  };
  const accentColor = toneToColor[tone] || t.accent.primary;

  const padCls = compact ? 'p-3' : 'p-4';
  const gapCls = compact ? 'gap-2' : 'gap-3';
  const numFs = compact ? 'clamp(24px, 3vw, 36px)' : 'clamp(28px, 4vw, 44px)';
  const headerMb = compact ? 'mb-1.5' : 'mb-2';

  return (
    <div
      onClick={onClick}
      className={`group relative rounded-2xl border border-line bg-surface ${padCls} shadow-sm
                  hover:shadow-md hover:-translate-y-0.5 transition-all duration-200
                  dark:hover:shadow-glow-accent-lg flex flex-col h-full
                  ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{ overflow: 'hidden' }}
    >
      {/* glow lateral en hover (dark) */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }}
      />

      <div className={`flex items-center justify-between ${headerMb}`}>
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-fg-muted font-semibold truncate">
          {icon}
          <span className="truncate">{label}</span>
        </div>
        {delta != null && delta.value != null && (
          <DeltaBadge delta={delta} t={t} />
        )}
      </div>

      <div className={`flex items-center ${gapCls} flex-1 min-h-0`}>
        <div className="flex-1 min-w-0">
          <div
            className="font-extrabold leading-none tabular-nums truncate"
            style={{ fontSize: numFs, color: accentColor }}
          >
            {formatVal(animated)}
            {unit && <span className={`${compact ? 'text-sm' : 'text-base'} font-semibold opacity-70 ml-1`}>{unit}</span>}
          </div>
          {subLabel && (
            <div className={`mt-1 ${compact ? 'text-[10px]' : 'text-[11px]'} text-fg-muted truncate`}>{subLabel}</div>
          )}
        </div>

        {viz === 'gauge' && (
          <Gauge
            value={vizData.value ?? numeric}
            size={vizData.size ?? 84}
            thickness={vizData.thickness ?? 9}
            thresholds={vizData.thresholds}
          />
        )}
        {viz === 'donut' && (
          <Donut
            value={vizData.value ?? numeric}
            max={vizData.max ?? 100}
            size={vizData.size ?? 72}
            thickness={vizData.thickness ?? 9}
            color={vizData.color || accentColor}
            centerLabel={vizData.centerLabel}
          />
        )}
        {viz === 'spark' && (
          <Sparkline
            data={vizData.data || []}
            color={accentColor}
            height={vizData.height ?? 48}
            width={vizData.width ?? 110}
          />
        )}
        {viz === 'bar' && (
          <ProgressBar
            value={vizData.value ?? numeric}
            max={vizData.max ?? 100}
            color={accentColor}
            label={vizData.label}
            t={t}
          />
        )}
      </div>
    </div>
  );
}

function DeltaBadge({ delta, t }) {
  const v = delta.value;
  const isPositive = delta.polarity ? delta.polarity === 'positive' : v >= 0;
  const color = v === 0 ? t.text.muted : isPositive ? t.status.success : t.status.danger;
  const arrow = v === 0 ? '•' : isPositive ? '▲' : '▼';
  return (
    <span className="text-[10px] font-semibold tabular-nums flex items-center gap-0.5"
          style={{ color }}>
      <span>{arrow}</span>
      <span>{Math.abs(v).toFixed(delta.decimals ?? 1)}{delta.unit || ''}</span>
    </span>
  );
}

function ProgressBar({ value, max, color, label, t }) {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0));
  return (
    <div className="w-[110px]">
      <div className="h-2 rounded-full overflow-hidden" style={{ background: t.bg.surfaceElev }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      {label && (
        <div className="text-[10px] text-fg-muted mt-1 text-right tabular-nums">{label}</div>
      )}
    </div>
  );
}
