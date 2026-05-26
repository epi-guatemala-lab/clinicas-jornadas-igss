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

  const desde = useMemo(() => format(startOfMonth(month), 'yyyy-MM-dd'), [month]);
  const hasta = useMemo(() => format(endOfMonth(month), 'yyyy-MM-dd'), [month]);

  useEffect(() => {
    apiCalendario(desde, hasta, seccion).then((d) => setEventos(d.eventos || []));
  }, [desde, hasta, seccion]);

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
        <span className="flex items-center gap-1.5 text-danger font-bold w-full">
          <span className="inline-block w-4 h-4 rounded ring-2 ring-danger/60 bg-danger jornada-alerta-pulse" />
          🚨 INAUGURACIÓN SIN JORNADA (crítico — coordinar con SIPRESALUD)
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
