import { useEffect, useState } from 'react';
import { apiListPersonal, apiCreatePersonal, apiUpdatePersonal } from '../api/endpoints';
import { fmtQ } from '../utils/format';

const ROLES = ['LIDER', 'MEDICO', 'ADMIN', 'ENFERMERIA', 'LABORATORISTA', 'DIGITADOR', 'ENCUESTADOR'];

export default function Personal() {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState({ seccion: '' });
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  function reload() {
    apiListPersonal({ ...filter, activo: true }).then(setList);
  }
  useEffect(reload, [filter]); // eslint-disable-line

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Personal IGSS</h1>
        <button className="btn-primary" onClick={() => setCreating(true)}>+ Agregar</button>
      </div>

      <div className="flex gap-2">
        {['', 'CE', 'SIPRESALUD'].map((s) => (
          <button key={s||'all'} onClick={()=>setFilter({ seccion: s })}
            className={`px-3 py-1.5 rounded border ${filter.seccion === s
              ? 'bg-igss-primary text-white border-igss-primary' : 'bg-white border-slate-300'}`}>
            {s || 'Todas'}
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="text-left p-2">Nombre</th>
              <th className="text-left p-2">Sección</th>
              <th className="text-left p-2">Rol default</th>
              <th className="text-left p-2">Renglón</th>
              <th className="text-right p-2">Compensación (Q/mes)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-2 font-medium">{p.nombre_completo}<div className="text-xs text-slate-500">NIT: {p.nit || '—'}</div></td>
                <td className="p-2">{p.seccion}</td>
                <td className="p-2">{p.rol_default}</td>
                <td className="p-2">{p.renglon} {p.ibm && <span className="text-slate-500 text-xs">({p.ibm})</span>}</td>
                <td className="p-2 text-right font-mono">{fmtQ(p.compensacion)}</td>
                <td className="p-2"><button className="text-igss-primary text-xs hover:underline" onClick={()=>setEditing(p)}>Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {creating && <PersonalForm onClose={()=>setCreating(false)} onSave={()=>{setCreating(false); reload();}} />}
      {editing && <PersonalForm initial={editing} onClose={()=>setEditing(null)} onSave={()=>{setEditing(null); reload();}} />}
    </div>
  );
}

function PersonalForm({ initial, onClose, onSave }) {
  const [form, setForm] = useState(initial || {
    nombre_completo: '', nit: '', renglon: '029', ibm: '',
    rol_default: 'MEDICO', seccion: 'SIPRESALUD', compensacion: '',
    email: '', telefono: '',
  });
  const [err, setErr] = useState('');
  const set = (k,v)=>setForm(f=>({...f, [k]:v}));
  async function submit(e) {
    e.preventDefault(); setErr('');
    try {
      const body = { ...form, compensacion: form.compensacion === '' ? null : Number(form.compensacion) };
      if (initial) await apiUpdatePersonal(initial.id, body);
      else await apiCreatePersonal(body);
      onSave();
    } catch (e) { setErr(e.response?.data?.detail || 'Error'); }
  }
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form className="bg-white rounded-xl shadow-xl max-w-xl w-full" onClick={(e)=>e.stopPropagation()} onSubmit={submit}>
        <div className="border-b p-4"><h2 className="text-xl font-bold">{initial ? 'Editar persona' : 'Nueva persona'}</h2></div>
        <div className="p-4 grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="label">Nombre completo *</label>
            <input className="input" value={form.nombre_completo} onChange={(e)=>set('nombre_completo', e.target.value)} required /></div>
          <div><label className="label">NIT</label>
            <input className="input" value={form.nit || ''} onChange={(e)=>set('nit', e.target.value)} /></div>
          <div><label className="label">Renglón</label>
            <select className="input" value={form.renglon || ''} onChange={(e)=>set('renglon', e.target.value)}>
              <option value="011">011 (regular)</option><option value="022">022</option><option value="029">029 (honorarios)</option>
            </select></div>
          <div><label className="label">IBM</label>
            <input className="input" value={form.ibm || ''} onChange={(e)=>set('ibm', e.target.value)} /></div>
          <div><label className="label">Rol default</label>
            <select className="input" value={form.rol_default} onChange={(e)=>set('rol_default', e.target.value)}>
              {ROLES.map((r)=><option key={r} value={r}>{r}</option>)}
            </select></div>
          <div><label className="label">Sección *</label>
            <select className="input" value={form.seccion} onChange={(e)=>set('seccion', e.target.value)}>
              <option value="SIPRESALUD">SIPRESALUD</option><option value="CE">CE</option>
            </select></div>
          <div><label className="label">Compensación Q/mes (cifrada)</label>
            <input className="input" type="number" step="0.01" value={form.compensacion} onChange={(e)=>set('compensacion', e.target.value)} /></div>
          <div><label className="label">Email</label>
            <input className="input" type="email" value={form.email || ''} onChange={(e)=>set('email', e.target.value)} /></div>
          <div><label className="label">Teléfono</label>
            <input className="input" value={form.telefono || ''} onChange={(e)=>set('telefono', e.target.value)} /></div>
          {err && <div className="col-span-2 bg-red-50 text-red-700 p-2 rounded text-sm">{err}</div>}
        </div>
        <div className="border-t p-3 flex justify-end gap-2 bg-slate-50">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary">{initial ? 'Guardar' : 'Crear'}</button>
        </div>
      </form>
    </div>
  );
}
