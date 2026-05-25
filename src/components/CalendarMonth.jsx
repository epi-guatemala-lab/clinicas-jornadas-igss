import { useMemo } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, format, isSameMonth, isSameDay,
} from 'date-fns';
import { SEMAFORO_BG, TIPO_LABEL } from '../utils/format';
import { isEnCurso, mapSemaforoLegacy } from '../utils/derived';

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
                  // 1) ¿Está realmente en curso (hoy + horario)?
                  const enCursoLocal = isEnCurso(e, now);
                  // 2) Mapear naranja vs rojo según contexto
                  const semNorm = enCursoLocal
                    ? 'azul'  // override visual: en curso
                    : mapSemaforoLegacy(e.semaforo, e);
                  const critico = !!e.sin_jornada_asociada || e.estado === 'CANCELADA';
                  return (
                    <button key={e.id} onClick={() => onEventClick?.(e)}
                      className={`block w-full text-left text-xs rounded px-1.5 py-1 truncate transition ${
                        e.sin_jornada_asociada
                          ? 'bg-danger text-white font-bold ring-2 ring-danger/60 shadow-md jornada-alerta-pulse'
                          : (SEMAFORO_BG[semNorm] || 'bg-neutral text-white') + ' hover:opacity-90'
                      }`}
                      title={`${TIPO_LABEL[e.tipo] || e.tipo} · ${e.empresa || ''}${
                        e.sin_jornada_asociada ? ' · ⚠️ INAUGURACIÓN SIN JORNADA ASOCIADA — coordinar con SIPRESALUD' : ''
                      }${enCursoLocal ? ' · 🔵 EN CURSO ahora' : ''}`}>
                      {e.sin_jornada_asociada && <span className="mr-1">🚨</span>}
                      {enCursoLocal && !critico && <span className="mr-1">●</span>}
                      {e.hora_inicio && <span className="mr-1 opacity-80">{e.hora_inicio.slice(0,5)}</span>}
                      <span className={e.sin_jornada_asociada ? 'uppercase tracking-wide' : 'font-medium'}>
                        {e.empresa || e.tema || TIPO_LABEL[e.tipo]}
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
