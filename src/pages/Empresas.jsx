import { useEffect, useState } from 'react';
import { apiListEmpresas, apiCreateEmpresa, apiUpdateEmpresa } from '../api/endpoints';
import { fmtN } from '../utils/format';
import Modal from '../components/forms/Modal';
import Field from '../components/forms/Field';
import MiniChartCard from '../components/cards/MiniChartCard';

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
        <h1 className="text-xl font-bold text-fg">Empresas</h1>
        <button className="btn-primary" onClick={() => setCreating(true)}>+ Nueva empresa</button>
      </div>
      <MiniChartCard title={`${list.length} empresas activas`} density="compact">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-elev text-fg-muted uppercase text-xs">
              <tr>
                <th className="text-left p-2">Nombre</th>
                <th className="text-left p-2">NIT</th>
                <th className="text-left p-2">Empleados</th>
                <th className="text-left p-2">Ubicación</th>
                <th className="text-left p-2">Clínica + Jornada</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id} className="border-t border-line-subtle">
                  <td className="p-2 font-medium text-fg">
                    {e.nombre_legal}
                    {e.nombre_comercial && <span className="text-fg-muted block text-xs">{e.nombre_comercial}</span>}
                  </td>
                  <td className="p-2 tabular-nums">{e.nit || '—'}</td>
                  <td className="p-2 tabular-nums">{fmtN(e.n_empleados_estimado)}</td>
                  <td className="p-2 text-fg-muted">
                    {[e.departamento, e.municipio, e.zona && `z. ${e.zona}`].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="p-2">
                    {e.tiene_clinica_amarrada
                      ? <span className="badge-success">✓ Activa · {e.fecha_amarre || ''}</span>
                      : <span className="text-fg-subtle">—</span>}
                  </td>
                  <td className="p-2">
                    <button className="text-accent text-sm hover:underline" onClick={() => setEditing(e)}>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan="6" className="text-center py-4 text-fg-muted">Sin empresas activas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </MiniChartCard>
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
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  async function submit(e) {
    e.preventDefault(); setErr('');
    const body = { ...form, n_empleados_estimado: form.n_empleados_estimado ? Number(form.n_empleados_estimado) : null };
    try {
      if (initial) await apiUpdateEmpresa(initial.id, body);
      else await apiCreateEmpresa(body);
      onSave();
    } catch (e) { setErr(e.response?.data?.detail || 'Error'); }
  }

  return (
    <Modal
      open onClose={onClose}
      title={initial ? 'Editar empresa' : 'Nueva empresa'}
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="empresa-form" className="btn-primary">
            {initial ? 'Guardar' : 'Crear'}
          </button>
        </>
      }
    >
      <form id="empresa-form" onSubmit={submit} className="grid grid-cols-2 gap-3">
        <Field className="col-span-2" label="Nombre legal" name="nombre_legal" required
               value={form.nombre_legal} onChange={set('nombre_legal')} />
        <Field label="Nombre comercial" value={form.nombre_comercial || ''} onChange={set('nombre_comercial')} />
        <Field label="NIT" value={form.nit || ''} onChange={set('nit')} />
        <Field label="Sector" type="select" value={form.sector} onChange={set('sector')}
               options={[['privada','Privada'],['publica','Pública'],['ong','ONG'],['otro','Otro']]} />
        <Field label="# Empleados (estimado)" type="number" min="0"
               value={form.n_empleados_estimado || ''} onChange={set('n_empleados_estimado')} />
        <Field label="Departamento" value={form.departamento || ''} onChange={set('departamento')} />
        <Field label="Municipio" value={form.municipio || ''} onChange={set('municipio')} />
        <Field label="Zona" value={form.zona || ''} onChange={set('zona')} />
        <Field className="col-span-2" label="Dirección" value={form.direccion || ''} onChange={set('direccion')} />
        <Field label="Contacto (nombre)" value={form.contacto_nombre || ''} onChange={set('contacto_nombre')} />
        <Field label="Teléfono" value={form.contacto_telefono || ''} onChange={set('contacto_telefono')} />
        <Field className="col-span-2" label="Email contacto" type="email"
               value={form.contacto_email || ''} onChange={set('contacto_email')} />
        {err && <div className="col-span-2 bg-danger-soft text-danger text-sm p-2 rounded">{err}</div>}
      </form>
    </Modal>
  );
}
