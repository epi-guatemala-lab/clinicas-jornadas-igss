import LoadingState, { ChartLoading } from '../feedback/LoadingState';
import EmptyState from '../feedback/EmptyState';
import ErrorState from '../feedback/ErrorState';

/**
 * Wrapper para gráfica pequeña con header (título + acciones) y body.
 *
 * 3 modos de sizing:
 *  - height (numérico): body con altura FIJA (px), útil cuando el padre
 *    no tiene altura definida (ej. dentro de un grid con rows auto, como
 *    el análisis histórico). El card en sí no es flex.
 *  - className contiene 'h-full': el card ocupa el alto del padre y el
 *    body usa flex-1 min-h-0 (ResponsiveContainer de Recharts se adapta).
 *    Útil cuando el padre tiene altura forzada (ej. grid con rows fijas).
 *  - sin height ni 'h-full': body crece con su contenido (sin altura fija).
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
  density = 'comfortable',
}) {
  const pad = density === 'compact' ? 'p-3' : 'p-4';
  const usesFillHeight = className.includes('h-full');
  const containerClass = `rounded-2xl border border-line bg-surface shadow-sm ${pad} ${className}`;

  const wrapCls = usesFillHeight ? 'flex flex-col h-full' : '';
  // Body sizing:
  //  - h-full: flex-1 min-h-0 (Recharts ResponsiveContainer toma altura del flex)
  //  - height numérico: style.height fijo + el container NO es flex
  //  - ninguno: altura natural
  const bodyCls = usesFillHeight
    ? `flex-1 min-h-0 ${bodyClassName}`
    : bodyClassName;
  const bodyStyle = (!usesFillHeight && height) ? { height } : undefined;

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
