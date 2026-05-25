import LoadingState, { ChartLoading } from '../feedback/LoadingState';
import EmptyState from '../feedback/EmptyState';
import ErrorState from '../feedback/ErrorState';

/**
 * Wrapper para gráfica pequeña con header (título + acciones) y body grid-aware.
 * Reemplaza el `ChartCard` interno de Charts.jsx.
 */
export default function MiniChartCard({
  title,
  subtitle,
  actions,
  height,
  loading,
  error,
  empty,
  emptyTitle = 'Sin datos para este período',
  emptyHint,
  retry,
  children,
  className = '',
  bodyClassName = '',
  density = 'comfortable',  // 'comfortable' | 'compact'
}) {
  const pad = density === 'compact' ? 'p-3' : 'p-4';

  return (
    <div className={`rounded-2xl border border-line bg-surface shadow-sm ${pad} ${className}`}>
      {(title || actions) && (
        <div className="flex items-start justify-between mb-2 gap-2">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold text-fg truncate">{title}</h3>}
            {subtitle && <p className="text-[11px] text-fg-muted mt-0.5 truncate">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-1 flex-shrink-0">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName} style={height ? { height } : undefined}>
        {error ? (
          <ErrorState message={typeof error === 'string' ? error : null} retry={retry} />
        ) : loading ? (
          height ? <ChartLoading height={height} /> : <LoadingState />
        ) : empty ? (
          <EmptyState title={emptyTitle} hint={emptyHint} />
        ) : (
          children
        )}
      </div>
    </div>
  );
}
