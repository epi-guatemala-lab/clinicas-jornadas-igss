import { useMemo } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, format, isSameMonth, isSameDay, parseISO,
} from 'date-fns';
import { SEMAFORO_BG, TIPO_LABEL } from '../utils/format';

const DAYS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

export default function CalendarMonth({ month, eventos, onEventClick }) {
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
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 bg-igss-light text-igss-dark text-xs font-semibold text-center">
        {DAYS.map((d, i) => <div key={i} className="py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 border-t border-slate-200">
        {cells.map((d, i) => {
          const k = format(d, 'yyyy-MM-dd');
          const events = byDay[k] || [];
          const inMonth = isSameMonth(d, month);
          const isToday = isSameDay(d, new Date());
          return (
            <div key={i} className={`min-h-[110px] p-1.5 border-b border-r border-slate-200 ${
                inMonth ? 'bg-white' : 'bg-slate-50'
            }`}>
              <div className={`text-xs font-medium mb-1 ${
                  isToday ? 'inline-block w-6 h-6 leading-6 text-center bg-igss-primary text-white rounded-full' :
                  inMonth ? 'text-slate-700' : 'text-slate-400'
              }`}>{format(d, 'd')}</div>
              <div className="space-y-1">
                {events.map((e) => (
                  <button key={e.id} onClick={() => onEventClick?.(e)}
                    className={`block w-full text-left text-xs rounded px-1.5 py-1 truncate ${
                      SEMAFORO_BG[e.semaforo] || 'bg-slate-300'
                    } hover:opacity-90`}
                    title={`${TIPO_LABEL[e.tipo] || e.tipo} · ${e.empresa || ''}`}>
                    {e.hora_inicio && <span className="mr-1 opacity-80">{e.hora_inicio.slice(0,5)}</span>}
                    <span className="font-medium">{e.empresa || e.tema || TIPO_LABEL[e.tipo]}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
