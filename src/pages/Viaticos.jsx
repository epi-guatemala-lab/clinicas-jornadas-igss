import { useEffect, useState } from 'react';
import {
  apiListViaticos, apiCreateViatico, apiNextCorrelativo, apiListPersonal, apiListJornadas,
} from '../api/endpoints';
import { fmtQ } from '../utils/format';

const STATUS = ['PENDIENTE', 'UTILIZADO', 'ANULADO', 'EXTRAVIADO'];
const STATUS_BG = {
  PENDIENTE: 'bg-neutral-soft text-fg-muted',
  UTILIZADO: 'bg-success-soft text-success',
  ANULADO: 'bg-warning-soft text-warning',
  EXTRAVIADO: 'bg-danger-soft text-danger',
};

export default function Viaticos() {
  const [list, setList] = useState([]);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState({ status: '' });

  function reload() {
    const p = {}; if (filter.status) p.status = filter.status;
    apiListViaticos(p).then(setList);
  }
  useEffect(reload, [filter]); // eslint-disable-line

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Viáticos · Correlativo {new Date().getFullYear()}</h1>
        <button className="btn-primary" onClick={()=>setCreating(true)}>+ Nuevo viático</button>
      </div>
      <div className="flex gap-2">
        {['', ...STATUS].map((s) => (
          <button key={s||'all'} onClick={()=>setFilter({ status: s })}
            className={`px-3 py-1.5 rounded border text-sm ${filter.status === s
              ? 'bg-accent text-white border-accent' : 'bg-surface border-line'}`}>
            {s || 'Todos'}
          </button>
        ))}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-elev text-xs uppercase text-fg-muted">
            <tr>
              <th className="text-left p-2">#</th>
              <th className="text-left p-2">Mes</th>
              <th className="text-left p-2">Servidor</th>
              <th className="text-left p-2">Nombramiento</th>
              <th className="text-right p-2">Monto</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Jornada</th>
            </tr>
          </thead>
          <tbody>
            {list.map((v) => (
              <tr key={v.id} className="border-t">
                <td className="p-2 font-mono">{v.correlativo}</td>
                <td className="p-2">{v.mes_anio}</td>
                <td className="p-2">{v.personal_nombre || '—'}</td>
                <td className="p-2 text-xs">{v.nombramiento} {v.fecha_nombramiento && <span className="text-fg-muted">({v.fecha_nombramiento})</span>}</td>
                <td className="p-2 text-right font-mono">{fmtQ(v.monto)}</td>
                <td className="p-2"><span className={`badge ${STATUS_BG[v.status]}`}>{v.status}</span></td>
                <td className="p-2 text-xs">{v.jornada_id ? `#${v.jornada_id}` : '—'}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan="7" className="p-6 text-center text-fg-subtle">Sin viáticos</td></tr>}
          </tbody>
        </table>
      </div>
      {creating && <NuevoViatico onClose={()=>setCreating(false)} onSaved={()=>{setCreating(false); reload();}} />}
    </div>
  );
}

function NuevoViatico({ onClose, onSaved }) {
  const [form, setForm] = useState({
    mes_anio: monthLabel(new Date()),
    correlativo: '',
    monto: '',
    status: 'PENDIENTE',
    nombramiento: '',
    fecha_nombramiento: new Date().toISOString().slice(0, 10),
  });
  const [next, setNext] = useState(null);
  const [personal, setPersonal] = useState([]);
  const [jornadas, setJornadas] = useState([]);
  const [err, setErr] = useState('');
  const set = (k,v)=>setForm(f=>({...f,[k]:v}));

  useEffect(() => {
    apiNextCorrelativo().then((r) => setNext(r.siguiente));
    apiListPersonal({ activo: true }).then(setPersonal);
    apiListJornadas({}).then(setJornadas);
  }, []);

  async function submit(e) {
    e.preventDefault(); setErr('');
    try {
      await apiCreateViatico({
        ...form,
        correlativo: form.correlativo === '' ? null : Number(form.correlativo),
        monto: form.monto === '' ? null : Number(form.monto),
        personal_id: form.personal_id || null,
        jornada_id: form.jornada_id || null,
      });
      onSaved();
    } catch (e) { setErr(e.response?.data?.detail || 'Error'); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form className="bg-surface rounded-2xl shadow-2xl max-w-xl w-full border border-line dark:shadow-glow-accent" onClick={(e)=>e.stopPropagation()} onSubmit={submit}>
        <div className="border-b border-line-subtle p-4"><h2 className="text-xl font-bold">Nuevo viático</h2>
          {next && <div className="text-xs text-fg-muted mt-0.5">Siguiente correlativo automático: <b>{next}</b> (podés cambiarlo)</div>}
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          <div><label className="label">Correlativo</label>
            <input className="input" type="number" placeholder={next ? `auto: ${next}` : ''}
              value={form.correlativo} onChange={(e)=>set('correlativo', e.target.value)} /></div>
          <div><label className="label">Mes</label>
            <input className="input" value={form.mes_anio} onChange={(e)=>set('mes_anio', e.target.value)} /></div>
          <div><label className="label">Servidor público</label>
            <select className="input" value={form.personal_id || ''} onChange={(e)=>set('personal_id', e.target.value ? Number(e.target.value) : null)}>
              <option value="">—</option>
              {personal.map((p)=><option key={p.id} value={p.id}>{p.nombre_completo}</option>)}
            </select></div>
          <div><label className="label">Jornada (opcional)</label>
            <select className="input" value={form.jornada_id || ''} onChange={(e)=>set('jornada_id', e.target.value ? Number(e.target.value) : null)}>
              <option value="">—</option>
              {jornadas.slice(0, 50).map((j)=><option key={j.id} value={j.id}>{j.codigo} · {j.fecha_inicio}</option>)}
            </select></div>
          <div><label className="label">Nombramiento</label>
            <input className="input" placeholder="ej 223/2026" value={form.nombramiento} onChange={(e)=>set('nombramiento', e.target.value)} /></div>
          <div><label className="label">Fecha nombramiento</label>
            <input className="input" type="date" value={form.fecha_nombramiento} onChange={(e)=>set('fecha_nombramiento', e.target.value)} /></div>
          <div><label className="label">Monto Q</label>
            <input className="input" type="number" step="0.01" value={form.monto} onChange={(e)=>set('monto', e.target.value)} /></div>
          <div><label className="label">Status</label>
            <select className="input" value={form.status} onChange={(e)=>set('status', e.target.value)}>
              {STATUS.map((s)=><option key={s} value={s}>{s}</option>)}
            </select></div>
          {err && <div className="col-span-2 bg-danger-soft text-danger p-2 rounded text-sm">{err}</div>}
        </div>
        <div className="border-t p-3 flex justify-end gap-2 bg-surface-elev">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary">Crear viático</button>
        </div>
      </form>
    </div>
  );
}

function monthLabel(d) {
  const meses = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
  return `${meses[d.getMonth()]}-${d.getFullYear()}`;
}
