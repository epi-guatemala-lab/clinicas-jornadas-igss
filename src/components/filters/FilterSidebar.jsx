import { useState } from 'react';
import FilterChip from './FilterChip';
import SeccionSwitch from './SeccionSwitch';

/**
 * Sidebar L del Dashboard con filtros persistidos.
 * En mobile/tablet se vuelve drawer (control externo via `open`/`onClose`).
 *
 * @param {object} filters - estado del hook useFilters
 * @param {function} setFilter - setter del hook
 * @param {function} clearFilters
 * @param {number} activeCount
 */
export default function FilterSidebar({
  filters,
  setFilter,
  setFilters,
  clearFilters,
  activeCount = 0,
  hideOnMobile = true,
  className = '',
}) {
  const onMesChange = (delta) => {
    const m = filters.mes + delta;
    let nm = m, ny = filters.anio;
    if (m < 1) { nm = 12; ny -= 1; }
    if (m > 12) { nm = 1; ny += 1; }
    setFilters({ mes: nm, anio: ny });
  };

  const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  return (
    <aside className={`${hideOnMobile ? 'hidden lg:block' : ''} w-full lg:w-60 flex-shrink-0
                       border-r border-line-subtle bg-surface/40 backdrop-blur-sm
                       overflow-y-auto ${className}`}>
      <div className="p-4 space-y-5">
        {/* header */}
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
            Filtros {activeCount > 0 && <span className="text-accent">({activeCount})</span>}
          </div>
          {activeCount > 0 && (
            <button onClick={clearFilters} className="text-[10px] text-accent hover:underline">
              Limpiar
            </button>
          )}
        </div>

        {/* Sección */}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted mb-1.5">
            Sección
          </div>
          <SeccionSwitch
            value={filters.seccion || ''}
            onChange={(v) => setFilter('seccion', v)}
            includeAll
          />
        </div>

        {/* Período */}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted mb-1.5">
            Período
          </div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <button onClick={() => onMesChange(-1)}
                    aria-label="Mes anterior"
                    className="h-7 w-7 rounded-md border border-line bg-surface hover:bg-surface-elev text-fg-muted hover:text-fg">
              ‹
            </button>
            <div className="flex-1 text-center text-sm font-semibold text-fg">
              {MESES[filters.mes]} {filters.anio}
            </div>
            <button onClick={() => onMesChange(1)}
                    aria-label="Mes siguiente"
                    className="h-7 w-7 rounded-md border border-line bg-surface hover:bg-surface-elev text-fg-muted hover:text-fg">
              ›
            </button>
          </div>
        </div>

        {/* Tipo */}
        {filters.tipo !== undefined && (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted mb-1.5">
              Tipo de actividad
            </div>
            <div className="flex flex-wrap gap-1">
              {[
                ['', 'Todos'],
                ['CE_JORNADA', 'CE Jornada'],
                ['SIPRESALUD_JORNADA', 'SIPRESALUD'],
                ['INAUGURACION', 'Inaug'],
                ['TALLER', 'Taller'],
                ['WEBINAR', 'Webinar'],
              ].map(([v, l]) => (
                <FilterChip key={v || 'all'}
                            active={filters.tipo === v}
                            onClick={() => setFilter('tipo', v)}>
                  {l}
                </FilterChip>
              ))}
            </div>
          </div>
        )}

        {/* Solo alertas */}
        {filters.soloAlertas !== undefined && (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted mb-1.5">
              Estado
            </div>
            <label className="flex items-center gap-2 text-sm text-fg cursor-pointer">
              <input
                type="checkbox"
                checked={!!filters.soloAlertas}
                onChange={(e) => setFilter('soloAlertas', e.target.checked)}
                className="h-4 w-4 accent-accent"
              />
              Solo con alertas
            </label>
          </div>
        )}
      </div>
    </aside>
  );
}
