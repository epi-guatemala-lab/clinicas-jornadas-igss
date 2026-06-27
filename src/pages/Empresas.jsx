import { useEffect, useState } from 'react';
import {
  apiListEmpresas, apiCreateEmpresa, apiUpdateEmpresa, apiSetInauguracion,
  apiEmpresaGrupos, apiCatalogoSectores, apiCatalogoUnidadesAdscripcion,
} from '../api/endpoints';
import { useAuth } from '../hooks/useAuth';
import { fmtN, isoLocalDate } from '../utils/format';
import Modal from '../components/forms/Modal';
import Field from '../components/forms/Field';
import GeoSelects from '../components/forms/GeoSelects';
import MiniChartCard from '../components/cards/MiniChartCard';

export default function Empresas() {
  const { canWrite, user } = useAuth();
  // Empresas + inauguración solo las gestiona CE (+admin); SIPRESALUD/gerencia read-only.
  const canEdit = canWrite && (user?.rol === 'ce' || user?.rol === 'admin');
  const [tab, setTab] = useState('pendientes');      // 'pendientes' | 'historico'
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [inaugurando, setInaugurando] = useState(null);

  function reload() {
    apiListEmpresas({ activa: true, tiene_clinica_amarrada: tab === 'historico' }).then(setList);
  }
  useEffect(reload, [tab]);

  const esHistorico = tab === 'historico';

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h1 className="text-xl font-bold text-fg">Empresas</h1>
        {canEdit && !esHistorico && (
          <button className="btn-primary" onClick={() => setCreating(true)}>+ Nueva empresa</button>
        )}
      </div>

      {/* Tabs: pendientes de inauguración vs histórico (ya con clínica) */}
      <div className="flex gap-1.5">
        <Pill active={tab === 'pendientes'} onClick={() => setTab('pendientes')}>Pendientes de inauguración</Pill>
        <Pill active={tab === 'historico'} onClick={() => setTab('historico')}>Histórico (con clínica)</Pill>
      </div>

      <MiniChartCard title={`${list.length} empresas · ${esHistorico ? 'con clínica de empresa' : 'pendientes'}`} density="compact">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-elev text-fg-muted uppercase text-xs">
              <tr>
                <th className="text-left p-2">Razón Social</th>
                <th className="text-left p-2">Patronal</th>
                <th className="text-left p-2">Sector</th>
                <th className="text-left p-2">Planilla</th>
                <th className="text-left p-2">Unidad adscripción</th>
                <th className="text-left p-2">Grupo</th>
                <th className="text-left p-2">{esHistorico ? 'Clínica desde' : 'Inauguración'}</th>
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id} className="border-t border-line-subtle hover:bg-surface-elev">
                  <td className="p-2 font-medium text-fg">
                    {e.nombre_legal}
                    {e.nombre_comercial && <span className="text-fg-muted block text-xs">{e.nombre_comercial}</span>}
                  </td>
                  <td className="p-2 tabular-nums text-xs">{e.numero_patronal || '—'}</td>
                  <td className="p-2 text-fg-muted text-xs">{e.sector || '—'}</td>
                  <td className="p-2 tabular-nums">{e.n_empleados_planilla != null ? fmtN(e.n_empleados_planilla) : '—'}</td>
                  <td className="p-2 text-fg-muted text-xs">{e.unidad_adscripcion || '—'}</td>
                  <td className="p-2 text-fg-muted text-xs">{e.grupo || '—'}</td>
                  <td className="p-2 text-xs">
                    {esHistorico
                      ? <span className="badge-success">✓ {e.fecha_amarre || ''}</span>
                      : e.fecha_inauguracion
                        ? <span className="text-accent">🗓 {e.fecha_inauguracion}{e.inauguracion_hora_inicio ? ` ${e.inauguracion_hora_inicio}` : ''}</span>
                        : <span className="text-fg-subtle">sin agendar</span>}
                  </td>
                  {canEdit && (
                    <td className="p-2 whitespace-nowrap">
                      <button className="text-accent text-sm hover:underline mr-3" onClick={() => setEditing(e)}>Editar</button>
                      {!esHistorico && (
                        <button className="text-igss-primary text-sm hover:underline" onClick={() => setInaugurando(e)}>
                          {e.fecha_inauguracion ? 'Editar inaug.' : 'Agendar inaug.'}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={canEdit ? 8 : 7} className="text-center py-4 text-fg-muted">
                  {esHistorico ? 'Sin empresas con clínica' : 'Sin empresas pendientes'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </MiniChartCard>

      {creating && <EmpresaForm onClose={() => setCreating(false)} onSave={() => { setCreating(false); reload(); }} />}
      {editing && <EmpresaForm initial={editing} onClose={() => setEditing(null)} onSave={() => { setEditing(null); reload(); }} />}
      {inaugurando && <InauguracionForm empresa={inaugurando} onClose={() => setInaugurando(null)} onSave={() => { setInaugurando(null); reload(); }} />}
    </div>
  );
}

function Pill({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition border ${
        active ? 'bg-igss-primary text-white border-igss-primary' : 'bg-surface text-fg-muted border-line hover:text-fg'
      }`}>{children}</button>
  );
}

function EmpresaForm({ initial, onClose, onSave }) {
  const [form, setForm] = useState(initial || {
    nombre_legal: '', nit: '', numero_patronal: '', sector: '', unidad_adscripcion: '',
    n_empleados_planilla: '', grupo: '', departamento: 'GUATEMALA', municipio: '', zona: '',
    direccion: '', contacto_nombre: '', contacto_telefono: '', contacto_email: '',
    tiene_clinica_amarrada: false,
  });
  const [sectores, setSectores] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  useEffect(() => {
    apiCatalogoSectores().then((d) => setSectores(d.items || [])).catch(() => {});
    apiCatalogoUnidadesAdscripcion().then((d) => setUnidades(d.items || [])).catch(() => {});
    apiEmpresaGrupos().then((d) => setGrupos(d.items || [])).catch(() => {});
  }, []);

  async function submit(e) {
    e.preventDefault(); setErr('');
    const body = {
      ...form,
      n_empleados_planilla: form.n_empleados_planilla ? Number(form.n_empleados_planilla) : null,
    };
    try {
      if (initial) await apiUpdateEmpresa(initial.id, body);
      else await apiCreateEmpresa(body);
      onSave();
    } catch (e) { setErr(e.response?.data?.detail || 'Error'); }
  }

  // Preservar el valor actual aunque no esté en el catálogo (empresas legacy con
  // sector 'privado' en minúscula, o catálogo placeholder) → no se blanquea/pierde.
  const sectorOptions = [['', '— Seleccione —'], ...sectores.map((s) => [s.codigo, s.titulo])];
  if (form.sector && !sectores.some((s) => s.codigo === form.sector)) sectorOptions.push([form.sector, `${form.sector} (actual)`]);
  const unidadOptions = [['', '— Seleccione —'], ...unidades.map((u) => [u.codigo, u.titulo])];
  if (form.unidad_adscripcion && !unidades.some((u) => u.codigo === form.unidad_adscripcion)) unidadOptions.push([form.unidad_adscripcion, `${form.unidad_adscripcion} (actual)`]);

  return (
    <Modal open onClose={onClose} title={initial ? 'Editar empresa' : 'Nueva empresa'} size="lg"
      footer={<>
        <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" form="empresa-form" className="btn-primary">{initial ? 'Guardar' : 'Crear'}</button>
      </>}>
      <form id="empresa-form" onSubmit={submit} className="grid grid-cols-2 gap-3">
        <Field className="col-span-2" label="Razón Social" name="nombre_legal" required
               value={form.nombre_legal} onChange={set('nombre_legal')} />
        <Field label="Nombre comercial" value={form.nombre_comercial || ''} onChange={set('nombre_comercial')} />
        <Field label="NIT" value={form.nit || ''} onChange={set('nit')} />
        <Field label="Número patronal IGSS" value={form.numero_patronal || ''} onChange={set('numero_patronal')} />
        <Field label="Sector / Gremio" type="select" value={form.sector || ''} onChange={set('sector')}
               options={sectorOptions} />
        <Field label="Unidad médica de adscripción" type="select" value={form.unidad_adscripcion || ''} onChange={set('unidad_adscripcion')}
               options={unidadOptions} />
        <Field label="# Empleados en planilla" type="number" min="0"
               value={form.n_empleados_planilla || ''} onChange={set('n_empleados_planilla')} />
        <Field label="Grupo" type="combobox" placeholder="Escribí o elegí…" hint="Campo abierto: podés agregar nuevos."
               value={form.grupo || ''} onChange={set('grupo')} options={grupos} />
        <GeoSelects departamento={form.departamento} municipio={form.municipio}
                    onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} />
        <Field label="Zona" value={form.zona || ''} onChange={set('zona')} />
        <Field className="col-span-2" label="Dirección" value={form.direccion || ''} onChange={set('direccion')} />
        <Field label="Contacto (nombre)" value={form.contacto_nombre || ''} onChange={set('contacto_nombre')} />
        <Field label="Teléfono" value={form.contacto_telefono || ''} onChange={set('contacto_telefono')} />
        <Field className="col-span-2" label="Email contacto" type="email"
               value={form.contacto_email || ''} onChange={set('contacto_email')} />
        <div className="col-span-2">
          <Field type="checkbox" placeholder="Ya tiene clínica de empresa (mover a Histórico)"
                 value={form.tiene_clinica_amarrada} onChange={(e) => set('tiene_clinica_amarrada')(e.target.checked)} />
        </div>
        {err && <div className="col-span-2 bg-danger-soft text-danger text-sm p-2 rounded">{err}</div>}
      </form>
    </Modal>
  );
}

// B1-B3: agenda de inauguración (solo CE/admin) → alimenta el calendario.
function InauguracionForm({ empresa, onClose, onSave }) {
  const [form, setForm] = useState({
    fecha_inauguracion: empresa.fecha_inauguracion || '',
    inauguracion_fecha_fin: empresa.inauguracion_fecha_fin || '',
    inauguracion_hora_inicio: empresa.inauguracion_hora_inicio || '',
    inauguracion_hora_fin: empresa.inauguracion_hora_fin || '',
    inauguracion_lugar: empresa.inauguracion_lugar || '',
  });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const hoy = isoLocalDate();

  async function submit(e) {
    e.preventDefault(); setErr('');
    try {
      await apiSetInauguracion(empresa.id, {
        ...form,
        inauguracion_fecha_fin: form.inauguracion_fecha_fin || null,
      });
      onSave();
    } catch (e) { setErr(e.response?.data?.detail || 'Error'); }
  }

  return (
    <Modal open onClose={onClose} title={`Inauguración · ${empresa.nombre_legal}`} size="md"
      footer={<>
        <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" form="inaug-form" className="btn-primary">Guardar inauguración</button>
      </>}>
      <form id="inaug-form" onSubmit={submit} className="grid grid-cols-2 gap-3">
        <Field label="Fecha de inauguración" type="date" required min={hoy}
               value={form.fecha_inauguracion} onChange={set('fecha_inauguracion')} />
        <Field label="Fecha fin (opcional)" type="date" min={form.fecha_inauguracion || hoy}
               value={form.inauguracion_fecha_fin} onChange={set('inauguracion_fecha_fin')} />
        <Field label="Hora inicio" type="time" value={form.inauguracion_hora_inicio} onChange={set('inauguracion_hora_inicio')} />
        <Field label="Hora fin" type="time" value={form.inauguracion_hora_fin} onChange={set('inauguracion_hora_fin')} />
        <Field className="col-span-2" label="Lugar (dirección completa)" type="textarea" rows={2}
               value={form.inauguracion_lugar} onChange={set('inauguracion_lugar')} />
        <p className="col-span-2 text-[11px] text-fg-subtle">Aparece en el calendario. SIPRESALUD la ve pero no la edita.</p>
        {err && <div className="col-span-2 bg-danger-soft text-danger text-sm p-2 rounded">{err}</div>}
      </form>
    </Modal>
  );
}
