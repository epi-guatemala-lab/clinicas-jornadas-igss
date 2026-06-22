import { useMemo } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, format, isSameMonth, isSameDay,
} from 'date-fns';
import { TIPO_LABEL, ESTADO_LABEL } from '../utils/format';
import { getChipDescriptor } from '../utils/derived';
import TipoIcon from './TipoIcon';

const DAYS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

/**
 * Calendario mensual.
 * Cambios Fase 1 — May 2026:
 *   1) Naranja vs Rojo: si backend manda 'rojo' pero la jornada NO está
 *      cancelada ni es inauguración sin jornada, se mapea a naranja (warning).
 *   2) "En curso" SOLO si fecha=hoy & hora_inicio<=ahora (derived.isEnCurso),
 *      no por estado de BD.
 */
export default function CalendarMonth({ month, eventos, onEventClick }) {
  const now = new Date();
  const hoyStr = now.toISOString().slice(0, 10);

  const cells = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    const arr = [];
    let d = start;
    while (d <= end) { arr.push(d); d = addDays(d, 1); }
    return arr;
  }, [month]);

  const byDay = useMemo(() => {
    const map = {};
    for (const e of eventos || []) {
      const k = e.fecha_inicio;
      if (!map[k]) map[k] = [];
      map[k].push(e);
    }
    return map;
  }, [eventos]);

  return (
    <div className="rounded-2xl border border-line bg-surface overflow-hidden">
      <div className="grid grid-cols-7 bg-accent-3-soft text-fg text-xs font-bold text-center">
        {DAYS.map((d, i) => <div key={i} className="py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 border-t border-line-subtle">
        {cells.map((d, i) => {
          const k = format(d, 'yyyy-MM-dd');
          const events = byDay[k] || [];
          const inMonth = isSameMonth(d, month);
          const isToday = isSameDay(d, now);
          return (
            <div key={i} className={`min-h-[110px] p-1.5 border-b border-r border-line-subtle ${
                inMonth ? 'bg-surface' : 'bg-canvas/60'
            }`}>
              <div className={`text-xs font-medium mb-1 ${
                  isToday ? 'inline-block w-6 h-6 leading-6 text-center bg-accent text-white rounded-full' :
                  inMonth ? 'text-fg' : 'text-fg-subtle'
              }`}>{format(d, 'd')}</div>
              <div className="space-y-1">
                {events.map((e) => {
                  const d = getChipDescriptor(e, now);
                  const label = e.empresa || e.tema || TIPO_LABEL[e.tipo] || e.tipo;
                  const trailGlifo = d.saludGlifo || d.estadoGlifo;
                  const seccionNombre = d.seccionPrefijo === 'CE' ? 'Clínicas de Empresa' : 'SIPRESALUD';
                  const title = [
                    `${TIPO_LABEL[e.tipo] || e.tipo} · ${seccionNombre}`,
                    e.empresa || null,
                    ESTADO_LABEL[e.estado] || e.estado,
                    e.pct_asistencia != null ? `${e.pct_asistencia}% asistencia` : null,
                    e.charla_tema ? `Charla: ${e.charla_tema}` : null,
                    d.esAlertaInaug ? '⚠️ INAUGURACIÓN SIN JORNADA ASOCIADA — coordinar con SIPRESALUD' : null,
                    d.esEnCurso ? '🔵 EN CURSO ahora' : null,
                  ].filter(Boolean).join(' · ');
                  return (
                    <button key={e.id} onClick={() => onEventClick?.(e)}
                      title={title}
                      className={`relative block w-full text-left text-[11px] rounded-r py-1 pr-1 truncate text-white transition hover:opacity-90 ${d.pulseClass} ${d.esEnCurso ? 'ring-1 ring-white/90' : ''}`}
                      style={{
                        backgroundColor: `rgb(var(${d.bgVar}))`,
                        borderLeft: `4px ${d.seccionDashed ? 'dashed' : 'solid'} rgb(var(${d.seccionVar}))`,
                      }}>
                      <span className="flex items-center gap-1 pl-1 max-w-full">
                        <span className="text-[8px] font-bold leading-none px-1 py-0.5 rounded bg-white/25">{d.seccionPrefijo}</span>
                        <TipoIcon tipo={e.tipo} />
                        {d.esAlertaInaug && <span aria-hidden>⚠️</span>}
                        {d.leadGlifo && <span aria-hidden className="leading-none">{d.leadGlifo}</span>}
                        {e.hora_inicio && <span className="opacity-80">{e.hora_inicio.slice(0, 5)}</span>}
                        <span className={`truncate ${d.tachado ? 'line-through opacity-90' : 'font-medium'} ${d.esAlertaInaug ? 'uppercase tracking-wide font-bold' : ''}`}>
                          {label}
                        </span>
                        {trailGlifo && <span aria-hidden className="ml-auto font-bold pl-0.5">{trailGlifo}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
