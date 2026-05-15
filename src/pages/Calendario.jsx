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

      {user.rol !== 'ce' && (
        <div className="flex flex-wrap gap-2 text-sm">
          {['TODAS', 'CE', 'SIPRESALUD'].map((s) => (
            <button key={s} onClick={() => setSeccion(s)}
              className={`px-3 py-1.5 rounded-md border ${
                seccion === s
                  ? 'bg-igss-primary text-white border-igss-primary'
                  : 'bg-white border-slate-300 text-slate-700'
              }`}>{s}</button>
          ))}
        </div>
      )}

      <CalendarMonth month={month} eventos={eventos} onEventClick={(e) => setSelected(e.id)} />

      {/* Leyenda */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-600 pt-2">
        {[
          ['verde', '≥90% asistencia'],
          ['amarillo', '70-89% / Reprogramada / Cierre pendiente >7 días'],
          ['rojo', '<70% / Cancelada / Cierre >14 días'],
          ['azul', 'Inauguración / En curso'],
          ['gris', 'Programada (futura)'],
        ].map(([c, l]) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className={`inline-block w-3 h-3 rounded ${SEMAFORO_DOT[c]}`} />{l}
          </span>
        ))}
      </div>

      {selected && (
        <JornadaModal jornadaId={selected}
          onClose={() => setSelected(null)}
          onChanged={() => apiCalendario(desde, hasta, seccion).then((d) => setEventos(d.eventos || []))} />
      )}
    </div>
  );
}
