import { useEffect, useState } from 'react';
import { apiListMetas, apiCreateMeta } from '../api/endpoints';
import { fmtN, fmtPct, SEMAFORO_DOT } from '../utils/format';

const TIPOS = [
  ['PACIENTES_ATENDIDOS', 'Pacientes atendidos'],
  ['JORNADAS_EJECUTADAS', 'Jornadas ejecutadas'],
  ['CLINICAS_AMARRADAS', 'Clínicas amarradas'],
  ['AFILIADOS_ATENDIDOS_PCT', '% Afiliados atendidos'],
];

export default function Metas() {
  const [list, setList] = useState([]);
  const [creating, setCreating] = useState(false);
  const year = new Date().getFullYear();

  function reload() { apiListMetas({ anio: year }).then(setList); }
  useEffect(reload, []); // eslint-disable-line

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Metas {year}</h1>
        <button className="btn-primary" onClick={()=>setCreating(true)}>+ Nueva meta</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="text-left p-2">Período</th>
              <th className="text-left p-2">Sección</th>
              <th className="text-left p-2">Tipo</th>
              <th className="text-right p-2">Meta</th>
              <th className="text-right p-2">Logrado</th>
              <th className="text-right p-2">%</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((m) => {
              const pct = m.valor_meta ? (100 * (m.valor_logrado || 0) / m.valor_meta) : 0;
              const color = pct >= 90 ? 'verde' : pct >= 70 ? 'amarillo' : 'rojo';
              return (
                <tr key={m.id} className="border-t">
                  <td className="p-2">{m.anio}{m.mes ? `-${String(m.mes).padStart(2,'0')}` : ''}</td>
                  <td className="p-2">{m.seccion}</td>
                  <td className="p-2">{TIPOS.find(([k])=>k===m.tipo_meta)?.[1] || m.tipo_meta}</td>
                  <td className="p-2 text-right font-mono">{fmtN(m.valor_meta)}</td>
                  <td className="p-2 text-right font-mono">{fmtN(m.valor_logrado)}</td>
                  <td className="p-2 text-right">
                    <span className="inline-flex items-center gap-1.5 justify-end">
                      <span className={`w-2 h-2 rounded-full ${SEMAFORO_DOT[color]}`}/>
                      {fmtPct(pct)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {creating && <MetaForm onClose={()=>setCreating(false)} onSaved={()=>{setCreating(false); reload();}} />}
    </div>
  );
}

function MetaForm({ onClose, onSaved }) {
  const [form, setForm] = useState({
    anio: new Date().getFullYear(), mes: '', seccion: 'SIPRESALUD',
    tipo_meta: 'PACIENTES_ATENDIDOS', valor_meta: 5000, notas: '',
  });
  const [err, setErr] = useState('');
  const set = (k,v)=>setForm(f=>({...f,[k]:v}));
  async function submit(e) {
    e.preventDefault(); setErr('');
    try {
      await apiCreateMeta({ ...form, mes: form.mes === '' ? null : Number(form.mes), valor_meta: Number(form.valor_meta) });
      onSaved();
    } catch (e) { setErr(e.response?.data?.detail || 'Error'); }
  }
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form className="bg-white rounded-xl shadow-xl max-w-md w-full" onClick={(e)=>e.stopPropagation()} onSubmit={submit}>
        <div className="border-b p-4"><h2 className="text-xl font-bold">Nueva meta</h2></div>
        <div className="p-4 grid grid-cols-2 gap-3">
          <div><label className="label">Año</label><input className="input" type="number" value={form.anio} onChange={(e)=>set('anio', Number(e.target.value))} /></div>
          <div><label className="label">Mes (vacío = anual)</label>
            <select className="input" value={form.mes} onChange={(e)=>set('mes', e.target.value)}>
              <option value="">Anual</option>
              {Array.from({length:12},(_,i)=>i+1).map((m)=><option key={m} value={m}>{m}</option>)}
            </select></div>
          <div><label className="label">Sección</label>
            <select className="input" value={form.seccion} onChange={(e)=>set('seccion', e.target.value)}>
              <option value="GLOBAL">GLOBAL</option><option value="CE">CE</option><option value="SIPRESALUD">SIPRESALUD</option>
            </select></div>
          <div><label className="label">Tipo</label>
            <select className="input" value={form.tipo_meta} onChange={(e)=>set('tipo_meta', e.target.value)}>
              {TIPOS.map(([k,l])=><option key={k} value={k}>{l}</option>)}
            </select></div>
          <div className="col-span-2"><label className="label">Valor meta</label>
            <input className="input" type="number" step="0.01" value={form.valor_meta} onChange={(e)=>set('valor_meta', e.target.value)} /></div>
          <div className="col-span-2"><label className="label">Notas</label>
            <textarea className="input" rows="2" value={form.notas} onChange={(e)=>set('notas', e.target.value)} /></div>
          {err && <div className="col-span-2 bg-red-50 text-red-700 p-2 rounded text-sm">{err}</div>}
        </div>
        <div className="border-t p-3 flex justify-end gap-2 bg-slate-50">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary">Crear</button>
        </div>
      </form>
    </div>
  );
}
