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

  // Si NO se pasa height explícito y NO está en className h-full, el div crece con su contenido.
  // Si SE pasa height o className h-full, el body usa flex-1 con min-h-0 para no desbordar.
  const fillHeight = className.includes('h-full') || height;
  const containerClass = `rounded-2xl border border-line bg-surface shadow-sm ${pad} ${className}`;
  const bodyStyle = height ? { height } : undefined;
  const bodyCls = fillHeight ? `flex-1 min-h-0 ${bodyClassName}` : bodyClassName;
  const wrapCls = fillHeight ? 'flex flex-col h-full' : '';

  return (
    <div className={containerClass}>
      <div className={wrapCls}>
        {(title || actions) && (
          <div className="flex items-start justify-between mb-2 gap-2 flex-shrink-0">
            <div className="min-w-0">
              {title && <h3 className="text-sm font-semibold text-fg truncate">{title}</h3>}
              {subtitle && <p className="text-[11px] text-fg-muted mt-0.5 truncate">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-1 flex-shrink-0">{actions}</div>}
          </div>
        )}
        <div className={bodyCls} style={bodyStyle}>
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
    </div>
  );
}
