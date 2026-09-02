import { useMemo } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, differenceInCalendarDays, format, isSameMonth, isSameDay,
} from 'date-fns';
import { TIPO_LABEL, ESTADO_LABEL, isoLocalDate } from '../utils/format';
import { getChipDescriptor } from '../utils/derived';
import TipoIcon from './TipoIcon';

const DAYS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

/**
 * 'YYYY-MM-DD' → Date en la zona LOCAL del navegador.
 * `new Date('2026-08-26')` se lee como medianoche UTC y en Guatemala (UTC-6)
 * retrocede al día anterior; el constructor por componentes no tiene ese
 * corrimiento. Es la misma trampa que ya documenta utils/format.js.
 */
const fechaLocal = (iso) => {
  if (!iso) return null;
  const p = String(iso).slice(0, 10).split('-').map(Number);
  if (p.length !== 3 || p.some((n) => Number.isNaN(n))) return null;
  return new Date(p[0], p[1] - 1, p[2]);
};

/**
 * Calendario mensual.
 * Cambios Fase 1 — May 2026:
 *   1) Naranja vs Rojo: si backend manda 'rojo' pero la jornada NO está
 *      cancelada ni es inauguración sin jornada, se mapea a naranja (warning).
 *   2) "En curso" SOLO si fecha=hoy & hora_inicio<=ahora (derived.isEnCurso),
 *      no por estado de BD.
 * Cambio Fase 2 — Ago 2026: una actividad de varios días se pinta en TODOS sus
 *   días, no solo en el de inicio.
 */
export default function CalendarMonth({ month, eventos, onEventClick }) {
  const now = new Date();
  const hoyStr = isoLocalDate(now);

  const cells = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    const arr = [];
    let d = start;
    while (d <= end) { arr.push(d); d = addDays(d, 1); }
    return arr;
  }, [month]);

  // Expansión multi-día: una actividad del 30 al 2 tiene que aparecer en los
  // CUATRO días. Antes se indexaba solo por `fecha_inicio` y una jornada de tres
  // días se veía como si fuera de uno (21 jornadas reales en producción).
  //
  // La expansión se RECORTA a la rejilla visible —no tiene sentido crear copias
  // de días que nadie va a pintar, y un `fecha_fin` sucio no puede hacer girar el
  // bucle— pero `_dias` cuenta el rango COMPLETO: el rótulo «día 2/3» debe decir
  // la verdad aunque el mes en pantalla solo muestre parte de la actividad.
  const byDay = useMemo(() => {
    const map = {};
    if (!cells.length) return map;
    const rejillaIni = cells[0];
    const rejillaFin = cells[cells.length - 1];
    for (const e of eventos || []) {
      const ini = fechaLocal(e.fecha_inicio);
      if (!ini) continue;
      // Sin fecha_fin —o con una anterior al inicio, que es dato sucio— la
      // actividad dura un solo día.
      const fin = (e.fecha_fin && e.fecha_fin >= e.fecha_inicio ? fechaLocal(e.fecha_fin) : null) || ini;
      const dias = Math.max(1, differenceInCalendarDays(fin, ini) + 1);
      let cursor = ini < rejillaIni ? rejillaIni : ini;
      const ultimoVisible = fin > rejillaFin ? rejillaFin : fin;
      while (cursor <= ultimoVisible) {
        const k = format(cursor, 'yyyy-MM-dd');
        const dia = differenceInCalendarDays(cursor, ini) + 1;
        if (!map[k]) map[k] = [];
        map[k].push({
          ...e,
          _dia: dia,
          _dias: dias,
          _primerDia: dia === 1,
          _ultimoDia: dia === dias,
        });
        cursor = addDays(cursor, 1);
      }
    }
    return map;
  }, [eventos, cells]);

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
            <div key={i} className={`min-h-[150px] p-1.5 border-b border-r border-line-subtle ${
                inMonth ? 'bg-surface' : 'bg-canvas/60'
            }`}>
              <div className={`text-xs font-medium mb-1 ${
                  isToday ? 'inline-block w-6 h-6 leading-6 text-center bg-accent text-white rounded-full' :
                  inMonth ? 'text-fg' : 'text-fg-subtle'
              }`}>{format(d, 'd')}</div>
              <div className="space-y-1">
                {/* OJO: el descriptor se llama `desc`, NO `d` — `d` es la fecha de la
                    celda en el map de arriba y sombrearla dejaba el chip pintando
                    contra un Date. */}
                {events.map((e) => {
                  const desc = getChipDescriptor(e, now);
                  const label = desc.esTraslado
                    ? (e.tema || `Traslado hacia ${e.empresa || 'jornada'}`)
                    : (e.empresa || e.tema || TIPO_LABEL[e.tipo] || e.tipo);
                  const trailGlifo = desc.saludGlifo || desc.estadoGlifo;
                  const seccionNombre = desc.seccionPrefijo === 'CE' ? 'Clínicas de Empresa' : 'SIPRESALUD';
                  const multiDia = e._dias > 1;
                  // Hora de inicio y % de asistencia son datos del ARRANQUE y del
                  // CIERRE de la actividad: repetirlos en cada día de un rango haría
                  // leer «08:00» tres veces para una sola jornada.
                  const mostrarHora = e.hora_inicio && e._primerDia !== false;
                  const mostrarPct = desc.pctChip != null && e._ultimoDia !== false;
                  const title = [
                    `${TIPO_LABEL[e.tipo] || e.tipo} · ${seccionNombre}`,
                    desc.esTraslado ? 'Reserva del día previo para todo el equipo' : null,
                    desc.esTraslado && e.jornada_id ? `Jornada vinculada #${e.jornada_id}` : null,
                    e.empresa || null,
                    ESTADO_LABEL[e.estado] || e.estado,
                    multiDia ? `Día ${e._dia} de ${e._dias}` : null,
                    e.pct_asistencia != null ? `${e.pct_asistencia}% asistencia` : null,
                    desc.servicios.length ? `Servicios: ${desc.servicios.map((s) => s.nombre).join(', ')}` : null,
                    e.charla_tema ? `Charla: ${e.charla_tema}` : null,
                    desc.esAlertaInaug ? '⚠️ INAUGURACIÓN SIN JORNADA ASOCIADA — coordinar con SIPRESALUD' : null,
                    desc.esEnCurso ? '🔵 EN CURSO ahora' : null,
                  ].filter(Boolean).join(' · ');
                  return (
                    /* La llave lleva la fecha de la celda: el mismo evento aparece en
                       varios días y `e.id` solo ya no es único dentro de la rejilla. */
                    <button key={`${e.id}-${k}`} onClick={() => onEventClick?.(e)}
                      title={title}
                      className={`relative block w-full text-left text-[11px] rounded-r py-1.5 pr-1 overflow-hidden transition hover:opacity-90 ${desc.darkText ? 'text-zinc-900' : 'text-white'} ${desc.pulseClass} ${desc.esEnCurso ? 'ring-1 ring-zinc-900/40' : ''}`}
                      style={{
                        backgroundColor: `rgb(var(${desc.bgVar}))`,
                        borderLeft: `6px ${desc.seccionDashed ? 'dashed' : 'solid'} rgb(var(${desc.seccionVar}))`,
                        // C2: borde derecho naranja si la empresa tiene clínica amarrada
                        // (sin empresa → sin borde). El izquierdo sigue marcando sección.
                        borderRight: desc.clinicaAmarrada ? '3px solid rgb(var(--clinica-amarrada))' : undefined,
                      }}>
                      {/* Chip en 2 filas: metadatos arriba, nombre completo abajo (hasta 2
                          líneas). Antes todo iba en una fila con `truncate` y el nombre de
                          la empresa se cortaba — pedido de la Dra: barras más anchas para
                          ver los datos completos. */}
                      <span className="flex flex-col gap-0.5 pl-1.5 max-w-full">
                        <span className="flex items-center gap-1 max-w-full">
                          <span className={`text-[9px] font-bold leading-none px-1 py-0.5 rounded ${desc.darkText ? 'bg-black/15' : 'bg-white/25'}`}>{desc.seccionPrefijo}</span>
                          <TipoIcon tipo={e.tipo} inaugura={desc.esInaug} />
                          {desc.esDepartamental && (
                            /* F2.2: jornada departamental (interior) — pin de ubicación */
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
                                 strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                                 className="inline-block flex-shrink-0" aria-label="Departamental">
                              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                              <circle cx="12" cy="10" r="3" />
                            </svg>
                          )}
                          {desc.esAlertaInaug && <span aria-hidden>⚠️</span>}
                          {desc.leadGlifo && <span aria-hidden className="leading-none">{desc.leadGlifo}</span>}
                          {mostrarHora && <span className="opacity-90 tabular-nums">{e.hora_inicio.slice(0, 5)}</span>}
                          {multiDia && (
                            /* Rótulo discreto: sin él, tres días idénticos parecen tres
                               actividades distintas en vez de una sola de tres días. */
                            <span className="text-[9px] leading-none opacity-90 tabular-nums whitespace-nowrap">
                              día {e._dia}/{e._dias}
                            </span>
                          )}
                          {mostrarPct ? (
                            /* CERRADA con métricas: glifo de forma (cue colorblind) + % real */
                            <span className="ml-auto flex items-center gap-1 pl-0.5 flex-shrink-0">
                              {desc.saludGlifo && <span aria-hidden className="font-bold leading-none">{desc.saludGlifo}</span>}
                              <span className="text-[10px] font-bold leading-none px-1 py-0.5 rounded bg-white/25 tabular-nums">{desc.pctChip}%</span>
                            </span>
                          ) : (
                            trailGlifo && <span aria-hidden className="ml-auto font-bold pl-0.5 flex-shrink-0">{trailGlifo}</span>
                          )}
                        </span>
                        {/* Sin recorte a propósito: el nombre de la empresa se lee COMPLETO
                            (envuelve en las líneas que necesite). `break-words` evita que un
                            token largo se desborde de la celda. */}
                        <span className={`block text-[12px] leading-tight break-words ${desc.tachado ? 'line-through opacity-90' : 'font-semibold'} ${desc.esAlertaInaug ? 'uppercase tracking-wide font-bold' : ''}`}>
                          {label}
                        </span>
                        {/* Servicios de la actividad: de un vistazo se ve qué lleva
                            cada jornada sin abrir la ficha (pedidos 7 y 8). */}
                        {desc.servicios.length > 0 && (
                          <span className="flex items-center gap-1 leading-none">
                            {desc.servicios.map((s) => (
                              <span key={s.key} role="img" aria-label={s.nombre} title={s.nombre}
                                    className="text-[11px] leading-none">{s.emoji}</span>
                            ))}
                          </span>
                        )}
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
