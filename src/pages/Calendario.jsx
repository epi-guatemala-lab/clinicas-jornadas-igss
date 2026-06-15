import { useEffect, useMemo, useState } from 'react';
import { addMonths, format, startOfMonth, endOfMonth } from 'date-fns';
import { apiCalendario } from '../api/endpoints';
import { useAuth } from '../hooks/useAuth';
import CalendarMonth from '../components/CalendarMonth';
import JornadaModal from '../components/JornadaModal';
import SeccionSwitch from '../components/filters/SeccionSwitch';
import FilterChip from '../components/filters/FilterChip';
import { SEMAFORO_DOT } from '../utils/format';

export default function Calendario() {
  const { user } = useAuth();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [seccion, setSeccion] = useState('TODAS');
  const [eventos, setEventos] = useState([]);
  const [selected, setSelected] = useState(null);
  const [soloAlertas, setSoloAlertas] = useState(false);
  const [ultimoMes, setUltimoMes] = useState(null);  // último mes con jornadas (lookback)

  const desde = useMemo(() => format(startOfMonth(month), 'yyyy-MM-dd'), [month]);
  const hasta = useMemo(() => format(endOfMonth(month), 'yyyy-MM-dd'), [month]);

  useEffect(() => {
    let cancelled = false;
    apiCalendario(desde, hasta, seccion).then((d) => {
      if (cancelled) return;
      const evs = d.eventos || [];
      setEventos(evs);
      // Si el mes está vacío, buscar el último mes (12 meses atrás) con jornadas
      // para dar un hint accionable. Si hay eventos, no hace falta.
      if (evs.length === 0) {
        const lookbackDesde = format(addMonths(startOfMonth(month), -12), 'yyyy-MM-dd');
        const lookbackHasta = format(endOfMonth(addMonths(startOfMonth(month), -1)), 'yyyy-MM-dd');
        apiCalendario(lookbackDesde, lookbackHasta, seccion)
          .then((p) => {
            if (cancelled) return;
            const prev = (p.eventos || []).filter((e) => e.fecha_inicio);
            if (prev.length === 0) { setUltimoMes(null); return; }
            // fecha más reciente entre los eventos del lookback
            const maxFecha = prev.reduce((mx, e) => (e.fecha_inicio > mx ? e.fecha_inicio : mx), prev[0].fecha_inicio);
            const [y, m] = maxFecha.split('-').map(Number);
            setUltimoMes({ date: startOfMonth(new Date(y, m - 1, 1)) });
          })
          .catch(() => { if (!cancelled) setUltimoMes(null); });
      } else {
        setUltimoMes(null);
      }
    });
    return () => { cancelled = true; };
  }, [desde, hasta, seccion, month]);

  const filteredEventos = soloAlertas
    ? eventos.filter((e) => e.sin_jornada_asociada || e.estado === 'CANCELADA')
    : eventos;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-fg">
            {format(month, 'MMMM yyyy').replace(/^\w/, c => c.toUpperCase())}
          </h1>
          <p className="text-xs text-fg-muted">{eventos.length} eventos en el mes</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth(addMonths(month, -1))}
                  className="btn-secondary">← Mes anterior</button>
          <button onClick={() => setMonth(startOfMonth(new Date()))}
                  className="btn-secondary">Hoy</button>
          <button onClick={() => setMonth(addMonths(month, 1))}
                  className="btn-secondary">Mes siguiente →</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {user.rol !== 'ce' && (
          <SeccionSwitch
            value={seccion === 'TODAS' ? '' : seccion}
            onChange={(v) => setSeccion(v || 'TODAS')}
            includeAll
          />
        )}
        <FilterChip
          active={soloAlertas}
          onClick={() => setSoloAlertas(!soloAlertas)}
        >
          ⚠️ Solo alertas
        </FilterChip>
      </div>

      <CalendarMonth
        month={month}
        eventos={filteredEventos}
        onEventClick={(e) => setSelected(e.id)} />

      {/* Mes sin eventos: hint accionable hacia el último mes con jornadas */}
      {!soloAlertas && eventos.length === 0 && (
        <div className="rounded-2xl border border-line bg-surface-elev px-4 py-3 text-sm text-fg-muted flex flex-wrap items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 flex-shrink-0">
            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" />
          </svg>
          <span>
            Sin eventos en <span className="font-semibold text-fg">{format(month, 'MMMM yyyy').replace(/^\w/, c => c.toUpperCase())}</span>.
          </span>
          {ultimoMes ? (
            <button
              onClick={() => setMonth(ultimoMes.date)}
              className="font-semibold text-igss-primary hover:underline"
            >
              Ir al último mes con jornadas: {format(ultimoMes.date, 'MMMM yyyy').replace(/^\w/, c => c.toUpperCase())} →
            </button>
          ) : (
            <span className="text-fg-subtle">No hay jornadas en los 12 meses previos.</span>
          )}
        </div>
      )}

      {soloAlertas && filteredEventos.length === 0 && (
        <div className="rounded-2xl border border-success/40 bg-success-soft/40 px-4 py-2.5 text-sm text-success font-medium">
          ✓ Sin alertas en {format(month, 'MMMM yyyy')}.
        </div>
      )}

      {/* Leyenda — paleta unificada: verde / naranja / rojo / azul / gris (sin amarillo) */}
      <div className="flex flex-wrap gap-3 text-[11px] text-fg-muted pt-2">
        {[
          ['verde', '≥90% asistencia'],
          ['naranja', '<90% asistencia · Reprogramada · Cierre tardío'],
          ['rojo', 'CANCELADA (crítica)'],
          ['azul', 'En curso ahora · Inauguración'],
          ['gris', 'Programada (futura)'],
        ].map(([c, l]) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className={`inline-block w-3 h-3 rounded ${SEMAFORO_DOT[c]}`} />{l}
          </span>
        ))}
        <span className="flex items-center gap-1.5 font-bold w-full"
              style={{ color: 'rgb(168 85 247)' }}>
          <span className="inline-block w-4 h-4 rounded ring-2 jornada-alerta-pulse"
                style={{ background: 'rgb(147 51 234)', boxShadow: '0 0 0 2px rgb(168 85 247 / 0.6)' }} />
          ⚠️ INAUGURACIÓN SIN JORNADA (crítico — coordinar con SIPRESALUD)
        </span>
      </div>

      {selected && (
        <JornadaModal jornadaId={selected}
          onClose={() => setSelected(null)}
          onChanged={() => apiCalendario(desde, hasta, seccion).then((d) => setEventos(d.eventos || []))} />
      )}
    </div>
  );
}
