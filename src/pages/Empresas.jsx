import { useEffect, useState } from 'react';
import { apiListEmpresas, apiCreateEmpresa, apiUpdateEmpresa } from '../api/endpoints';
import { fmtN } from '../utils/format';

export default function Empresas() {
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  function reload() {
    apiListEmpresas({ activa: true }).then(setList);
  }
  useEffect(reload, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Empresas</h1>
        <button className="btn-primary" onClick={() => setCreating(true)}>+ Nueva empresa</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 uppercase text-xs">
            <tr>
              <th className="text-left p-2">Nombre</th>
              <th className="text-left p-2">NIT</th>
              <th className="text-left p-2">Empleados</th>
              <th className="text-left p-2">Ubicación</th>
              <th className="text-left p-2">Clínica amarrada</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="p-2 font-medium">{e.nombre_legal}{e.nombre_comercial && <span className="text-slate-500 block text-xs">{e.nombre_comercial}</span>}</td>
                <td className="p-2">{e.nit || '—'}</td>
                <td className="p-2">{fmtN(e.n_empleados_estimado)}</td>
                <td className="p-2">{[e.departamento, e.municipio, e.zona && `z. ${e.zona}`].filter(Boolean).join(' · ') || '—'}</td>
                <td className="p-2">{e.tiene_clinica_amarrada ?
                    <span className="badge bg-emerald-100 text-emerald-700">✓ Sí · {e.fecha_amarre}</span> :
                    <span className="text-slate-400">—</span>}</td>
                <td className="p-2"><button className="text-igss-primary text-sm hover:underline" onClick={() => setEditing(e)}>Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {creating && <EmpresaForm onClose={() => setCreating(false)} onSave={() => { setCreating(false); reload(); }} />}
      {editing && <EmpresaForm initial={editing} onClose={() => setEditing(null)} onSave={() => { setEditing(null); reload(); }} />}
    </div>
  );
}

function EmpresaForm({ initial, onClose, onSave }) {
  const [form, setForm] = useState(initial || {
    nombre_legal: '', nit: '', sector: 'privada',
    n_empleados_estimado: '', departamento: 'GUATEMALA', municipio: '', zona: '',
    direccion: '', contacto_nombre: '', contacto_telefono: '', contacto_email: '',
    tiene_clinica_amarrada: false,
  });
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault(); setErr('');
    const body = { ...form, n_empleados_estimado: form.n_empleados_estimado ? Number(form.n_empleados_estimado) : null };
    try {
      if (initial) await apiUpdateEmpresa(initial.id, body);
      else await apiCreateEmpresa(body);
      onSave();
    } catch (e) {
      setErr(e.response?.data?.detail || 'Error');
    }
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e)=>e.stopPropagation()} onSubmit={submit}>
        <div className="border-b p-4"><h2 className="text-xl font-bold">{initial ? 'Editar empresa' : 'Nueva empresa'}</h2></div>
        <div className="p-4 grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="label">Nombre legal *</label>
            <input className="input" value={form.nombre_legal} onChange={(e)=>set('nombre_legal', e.target.value)} required /></div>
          <div><label className="label">Nombre comercial</label>
            <input className="input" value={form.nombre_comercial || ''} onChange={(e)=>set('nombre_comercial', e.target.value)} /></div>
          <div><label className="label">NIT</label>
            <input className="input" value={form.nit || ''} onChange={(e)=>set('nit', e.target.value)} /></div>
          <div><label className="label">Sector</label>
            <select className="input" value={form.sector || ''} onChange={(e)=>set('sector', e.target.value)}>
              <option value="privada">Privada</option><option value="publica">Pública</option><option value="ong">ONG</option><option value="otro">Otro</option>
            </select></div>
          <div><label className="label"># Empleados (estimado)</label>
            <input className="input" type="number" min="0" value={form.n_empleados_estimado || ''} onChange={(e)=>set('n_empleados_estimado', e.target.value)} /></div>
          <div><label className="label">Departamento</label>
            <input className="input" value={form.departamento || ''} onChange={(e)=>set('departamento', e.target.value)} /></div>
          <div><label className="label">Municipio</label>
            <input className="input" value={form.municipio || ''} onChange={(e)=>set('municipio', e.target.value)} /></div>
          <div><label className="label">Zona</label>
            <input className="input" value={form.zona || ''} onChange={(e)=>set('zona', e.target.value)} /></div>
          <div className="col-span-2"><label className="label">Dirección</label>
            <input className="input" value={form.direccion || ''} onChange={(e)=>set('direccion', e.target.value)} /></div>
          <div><label className="label">Contacto (nombre)</label>
            <input className="input" value={form.contacto_nombre || ''} onChange={(e)=>set('contacto_nombre', e.target.value)} /></div>
          <div><label className="label">Teléfono</label>
            <input className="input" value={form.contacto_telefono || ''} onChange={(e)=>set('contacto_telefono', e.target.value)} /></div>
          <div className="col-span-2"><label className="label">Email contacto</label>
            <input className="input" type="email" value={form.contacto_email || ''} onChange={(e)=>set('contacto_email', e.target.value)} /></div>
          {err && <div className="col-span-2 bg-red-50 text-red-700 text-sm p-2 rounded">{err}</div>}
        </div>
        <div className="border-t p-3 flex justify-end gap-2 bg-slate-50">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary">{initial ? 'Guardar' : 'Crear'}</button>
        </div>
      </form>
    </div>
  );
}
