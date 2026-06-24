import { useEffect, useState } from 'react';
import { apiListJornadas } from '../api/endpoints';
import { useAuth } from '../hooks/useAuth';
import JornadaModal from '../components/JornadaModal';
import JornadaFormModal from '../components/JornadaFormModal';
import {
  SEMAFORO_DOT, TIPO_LABEL, ESTADO_LABEL, fmtN, fmtPct,
} from '../utils/format';

const TIPOS = [
  ['CE_JORNADA', '🏢 Jornada CE'],
  ['SIPRESALUD_JORNADA', '💉 Jornada SIPRESALUD'],
  ['INAUGURACION', '🎉 Inauguración (deja clínica permanente)'],
  ['TALLER', '🎤 Conferencia'],
  ['WEBINAR', '💻 Webinar'],
];

export default function Jornadas() {
  const { user, canWrite } = useAuth();
  const [list, setList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState({ seccion: '', tipo: '', estado: '' });

  function reload() {
    const params = {};
    if (filter.seccion) params.seccion = filter.seccion;
    if (filter.tipo) params.tipo = filter.tipo;
    if (filter.estado) params.estado = filter.estado;
    apiListJornadas(params).then(setList);
  }
  useEffect(reload, [filter]);  // eslint-disable-line

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Jornadas</h1>
        {canWrite && (
          <button className="btn-primary" onClick={() => setCreating(true)}>+ Nueva jornada</button>
        )}
      </div>

      <div className="card p-3 flex flex-wrap gap-2 items-end">
        {user.rol !== 'ce' && (
          <Select label="Sección" value={filter.seccion}
            onChange={(v) => setFilter({ ...filter, seccion: v })}
            options={[['', 'Todas'], ['CE', 'CE'], ['SIPRESALUD', 'SIPRESALUD']]} />
        )}
        <Select label="Tipo" value={filter.tipo}
          onChange={(v) => setFilter({ ...filter, tipo: v })}
          options={[['', 'Todos'], ...TIPOS]} />
        <Select label="Estado" value={filter.estado}
          onChange={(v) => setFilter({ ...filter, estado: v })}
          options={[['', 'Todos'], ['PROGRAMADA', 'Programada'], ['CERRADA', 'Cerrada'], ['CANCELADA', 'Cancelada']]} />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-elev text-fg-muted uppercase text-xs">
            <tr>
              <th className="text-left p-2">Código</th>
              <th className="text-left p-2">Fecha</th>
              <th className="text-left p-2">Tipo</th>
              <th className="text-left p-2">Empresa</th>
              <th className="text-left p-2">Lugar</th>
              <th className="text-right p-2">Atendidos/Prog</th>
              <th className="text-left p-2">Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((j) => (
              <tr key={j.id} className="border-t border-line-subtle hover:bg-surface-elev">
                <td className="p-2 font-mono text-xs">{j.codigo}</td>
                <td className="p-2">{j.fecha_inicio}</td>
                <td className="p-2">{TIPO_LABEL[j.tipo] || j.tipo}</td>
                <td className="p-2">{j.empresa_nombre || '—'}</td>
                <td className="p-2 text-fg-muted">{[j.departamento, j.municipio].filter(Boolean).join(', ')}</td>
                <td className="p-2 text-right">
                  {j.atendidos != null ? `${fmtN(j.atendidos)}/${fmtN(j.programados)} (${fmtPct(j.pct_asistencia)})`
                                       : `—/${fmtN(j.programados)}`}
                </td>
                <td className="p-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${SEMAFORO_DOT[j.semaforo]}`} />
                    {ESTADO_LABEL[j.estado] || j.estado}
                  </span>
                </td>
                <td className="p-2">
                  <button className="text-accent hover:underline text-xs"
                    onClick={() => setSelected(j.id)}>Ver</button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan="8" className="p-8 text-center text-fg-subtle">Sin jornadas para los filtros aplicados</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <JornadaModal jornadaId={selected}
          onClose={() => setSelected(null)} onChanged={reload} />
      )}
      {creating && (
        <JornadaFormModal jornada={null} onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); reload(); }} />
      )}
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input min-w-[160px]" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}
