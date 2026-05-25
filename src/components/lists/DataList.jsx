import EmptyState from '../feedback/EmptyState';

/**
 * Lista vertical compacta de items con render-prop.
 * Para sidebar R "Próximas jornadas", listas en modales, etc.
 */
export default function DataList({
  items = [],
  renderItem,
  header,
  footer,
  loading,
  empty = 'Sin elementos',
  emptyHint,
  className = '',
  density = 'normal',  // 'compact' | 'normal' | 'comfortable'
}) {
  const gap = density === 'compact' ? 'gap-0' : density === 'comfortable' ? 'gap-2' : 'gap-1';

  return (
    <div className={`flex flex-col ${className}`}>
      {header && <div className="flex-shrink-0 px-3 pt-3 pb-2">{header}</div>}
      <div className={`flex-1 overflow-y-auto px-2 flex flex-col ${gap}`}>
        {loading ? (
          <div className="p-3 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-lg border border-line-subtle bg-surface-elev h-16" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState title={empty} hint={emptyHint} />
        ) : (
          items.map((item, i) => (
            <div key={item.id ?? item.codigo ?? i}>
              {renderItem(item, i)}
            </div>
          ))
        )}
      </div>
      {footer && <div className="flex-shrink-0 px-3 py-2 border-t border-line-subtle">{footer}</div>}
    </div>
  );
}
