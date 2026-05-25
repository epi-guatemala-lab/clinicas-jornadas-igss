import { useMemo, useState } from 'react';
import { severityOf } from '../../utils/derived';
import { useThemedColors } from '../../theme/useThemedColors';

/**
 * Banner unificado de alertas, ordenadas por severidad.
 * - critical (rojo): cancelaciones + inauguraciones sin jornada
 * - warning (naranja): cierre tardío
 * - info (azul): reservado
 *
 * Si no hay alertas → muestra success bar verde lima "Sin alertas pendientes".
 *
 * @param {object[]} items - { id, severity, source, title, detail, fecha, codigo?, jornada_id?, action_url? }
 */
export default function AlertBanner({
  items = [],
  defaultOpen = true,
  maxVisible = 4,
  onItemClick,
  className = '',
}) {
  const t = useThemedColors();
  const [open, setOpen] = useState(defaultOpen);

  const { critical, warning, sorted, total } = useMemo(() => {
    const sorted = [...items].sort((a, b) => severityOf(a) - severityOf(b));
    return {
      critical: items.filter((a) => a.severity === 'critical').length,
      warning: items.filter((a) => a.severity === 'warning').length,
      sorted,
      total: items.length,
    };
  }, [items]);

  if (!total) {
    return (
      <div className={`rounded-2xl border border-success/40 bg-success-soft/40 px-4 py-2.5 text-sm
                       flex items-center gap-2 text-success ${className}`}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2.5" className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <span className="font-medium">Sin alertas pendientes — todo al día</span>
      </div>
    );
  }

  const visible = sorted.slice(0, open ? maxVisible : 0);
  const overflow = sorted.length - visible.length;
  const hasCritical = critical > 0;

  return (
    <div
      className={`rounded-2xl border-2 ${hasCritical ? 'border-danger/40 bg-danger-soft/30' : 'border-warning/40 bg-warning-soft/30'}
                  ${className}`}
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      {/* línea izquierda de severidad + glow */}
      <div
        aria-hidden
        style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
          background: hasCritical ? t.status.danger : t.status.warning,
          boxShadow: hasCritical ? `0 0 12px ${t.status.danger}` : 'none',
        }}
        className={hasCritical ? 'jornada-alerta-pulse' : ''}
      />
      <div className="pl-5 pr-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xl leading-none">🚨</span>
              <span className="font-bold text-fg">Alertas</span>
            </div>
            {critical > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-danger text-white">
                {critical} {critical === 1 ? 'crítica' : 'críticas'}
              </span>
            )}
            {warning > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-warning text-white">
                {warning} {warning === 1 ? 'aviso' : 'avisos'}
              </span>
            )}
          </div>
          <button
            onClick={() => setOpen(!open)}
            className="text-xs font-semibold text-fg-muted hover:text-fg transition-colors"
            aria-label={open ? 'Colapsar alertas' : 'Expandir alertas'}
          >
            {open ? 'Ocultar' : 'Ver detalle'}
          </button>
        </div>

        {open && (
          <ul className="mt-2 space-y-1.5">
            {visible.map((a) => (
              <li
                key={a.id}
                onClick={() => onItemClick && onItemClick(a)}
                className={`flex items-start gap-2 text-xs rounded-md px-2 py-1.5
                            ${onItemClick ? 'cursor-pointer hover:bg-surface/60' : ''}`}
              >
                <span
                  aria-hidden
                  className="flex-shrink-0 mt-1 h-2 w-2 rounded-full"
                  style={{
                    background: a.severity === 'critical' ? t.status.danger
                              : a.severity === 'warning' ? t.status.warning
                              : t.status.info,
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-fg">
                    {a.codigo && <span className="font-mono text-[11px] mr-1.5 text-fg-muted">{a.codigo}</span>}
                    {a.title}
                  </div>
                  {a.detail && (
                    <div className="text-fg-muted truncate">{a.detail}</div>
                  )}
                </div>
                {a.fecha && (
                  <span className="text-[10px] text-fg-muted tabular-nums flex-shrink-0 mt-0.5">{a.fecha}</span>
                )}
              </li>
            ))}
            {overflow > 0 && (
              <li className="text-xs text-fg-muted px-2 py-1">
                +{overflow} más
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
