import { useEffect, useMemo, useState } from 'react';
import { addMonths, format, startOfMonth, endOfMonth } from 'date-fns';
import { apiCalendario } from '../api/endpoints';
import { useAuth } from '../hooks/useAuth';
import CalendarMonth from '../components/CalendarMonth';
import JornadaModal from '../components/JornadaModal';
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {format(month, 'MMMM yyyy').replace(/^\w/, c => c.toUpperCase())}
          </h1>
          <p className="text-sm text-slate-500">{eventos.length} eventos en el mes</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={() => setMonth(addMonths(month, -1))}>← Mes anterior</button>
          <button className="btn-secondary" onClick={() => setMonth(startOfMonth(new Date()))}>Hoy</button>
          <button className="btn-secondary" onClick={() => setMonth(addMonths(month, 1))}>Mes siguiente →</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm items-center">
        {user.rol !== 'ce' && ['TODAS', 'CE', 'SIPRESALUD'].map((s) => (
          <button key={s} onClick={() => setSeccion(s)}
            className={`px-3 py-1.5 rounded-md border ${
              seccion === s
                ? 'bg-igss-primary text-white border-igss-primary'
                : 'bg-white border-slate-300 text-slate-700'
            }`}>{s}</button>
        ))}
        <label className="flex items-center gap-2 ml-2 px-3 py-1.5 rounded-md border cursor-pointer
                            border-red-300 bg-red-50 text-red-700 hover:bg-red-100">
          <input type="checkbox" checked={soloAlertas}
            onChange={(e) => setSoloAlertas(e.target.checked)} />
          <span>⚠️ Solo alertas (sin jornada asociada)</span>
        </label>
      </div>

      <CalendarMonth
        month={month}
        eventos={soloAlertas
          ? eventos.filter((e) => e.sin_jornada_asociada)
          : eventos}
        onEventClick={(e) => setSelected(e.id)} />

      {soloAlertas && eventos.filter((e) => e.sin_jornada_asociada).length === 0 && (
        <div className="card p-4 bg-green-50 border-green-200">
          <p className="text-green-800">
            ✓ Sin alertas en {format(month, 'MMMM yyyy')}. Todas las inauguraciones tienen jornada asociada.
          </p>
        </div>
      )}

      {/* Leyenda */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-600 pt-2">
        {[
          ['verde', '≥90% asistencia'],
          ['amarillo', '80-89% / Reprogramada / Cierre pendiente >7 días'],
          ['rojo', '<80% / Cancelada / Cierre >14 días'],
          ['azul', 'Inauguración / En curso'],
          ['gris', 'Programada (futura)'],
        ].map(([c, l]) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className={`inline-block w-3 h-3 rounded ${SEMAFORO_DOT[c]}`} />{l}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-red-700 font-bold">
          <span className="inline-block w-4 h-4 rounded ring-2 ring-red-500 bg-red-600 jornada-alerta-pulse" />
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
