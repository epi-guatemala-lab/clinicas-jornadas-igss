import { useEffect, useState } from 'react';
import {
  apiListJornadas, apiListEmpresas, apiListPersonal, apiCreateJornada,
} from '../api/endpoints';
import { useAuth } from '../hooks/useAuth';
import { useApi } from '../hooks/useApi';
import JornadaModal from '../components/JornadaModal';
import {
  SEMAFORO_DOT, TIPO_LABEL, ESTADO_LABEL, fmtN, fmtPct,
} from '../utils/format';

const TIPOS = [
  ['CE_JORNADA', '🏢 Jornada CE'],
  ['SIPRESALUD_JORNADA', '💉 Jornada SIPRESALUD'],
  ['INAUGURACION', '🎉 Inauguración (deja clínica permanente)'],
  ['TALLER', '📚 Taller'],
  ['WEBINAR', '💻 Webinar'],
  ['VISITA_SEGUIMIENTO', '🔍 Visita de seguimiento'],
  ['INFORME_OFICINA', '📝 Informe / Oficina'],
];

const ROLES_JOR = ['LIDER', 'MEDICO', 'ADMIN', 'ENFERMERIA', 'LABORATORISTA', 'DIGITADOR', 'ENCUESTADOR'];

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
        <NuevaJornadaModal onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); reload(); }} />
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

function NuevaJornadaModal({ onClose, onCreated }) {
  const { user } = useAuth();
  const [empresas, setEmpresas] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [form, setForm] = useState({
    tipo: 'SIPRESALUD_JORNADA',
    seccion_responsable: user.seccion || 'SIPRESALUD',
    modalidad: 'PRESENCIAL',
    fecha_inicio: new Date().toISOString().slice(0, 10),
    programados: 0,
    aplica_kit_lab: true,
    inaugura_clinica: false,
    viaticos_presupuesto: 0,
    personal: [],
  });
  const [err, setErr] = useState('');

  const [jornadasSipre, setJornadasSipre] = useState([]);

  useEffect(() => {
    apiListEmpresas({ activa: true }).then(setEmpresas);
    apiListPersonal({ activo: true }).then(setPersonal);
    apiListJornadas({ seccion: 'SIPRESALUD' }).then(setJornadasSipre);
  }, []);

  // Personal filtrado por sección de la jornada (admin/gerencia ven todo)
  const personalDisponible = personal.filter((p) =>
    (user.rol === 'admin' || user.rol === 'gerencia') ? true : p.seccion === form.seccion_responsable
  );

  function setField(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  // Catálogo GT canónico (cascada departamento → municipio)
  const { data: deptosCat } = useApi('/api/catalogos/departamentos');
  const { data: munisCat } = useApi(
    '/api/catalogos/municipios',
    { departamento: form.departamento || '' },
    { enabled: !!form.departamento },
  );

  function addPersona() {
    const primero = personalDisponible[0];
    if (!primero) { alert(`No hay personal activo en la sección ${form.seccion_responsable}`); return; }
    setField('personal', [...form.personal, { personal_id: primero.id, rol_jornada: 'MEDICO', dias_asignados: 1.0 }]);
  }
  function updPersona(i, k, v) {
    const copy = [...form.personal]; copy[i] = { ...copy[i], [k]: v }; setField('personal', copy);
  }
  function removePersona(i) {
    setField('personal', form.personal.filter((_, idx) => idx !== i));
  }

  async function submit(e) {
    e.preventDefault();
    setErr('');
    try {
      // C1: inauguración = flag independiente del tipo. El tipo INAUGURACION
      // siempre inaugura; otros tipos (ej. tamizaje SIPRESALUD) pueden marcar
      // el checkbox para indicar que ADEMÁS inauguran una clínica.
      await apiCreateJornada({
        ...form,
        inaugura_clinica: form.tipo === 'INAUGURACION' || !!form.inaugura_clinica,
        charla_tema: form.charla_tema?.trim() || null,
        charla_responsable: form.charla_responsable?.trim() || null,
        programados: Number(form.programados) || 0,
        viaticos_presupuesto: Number(form.viaticos_presupuesto) || 0,
        empresa_id: form.empresa_id || null,
        lider_personal_id: form.lider_personal_id || null,
        inauguracion_jornada_id: form.tipo === 'INAUGURACION'
          ? (form.inauguracion_jornada_id || null)
          : null,
      });
      onCreated();
    } catch (e) {
      setErr(e.response?.data?.detail || 'Error creando jornada');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-line dark:shadow-glow-accent" onClick={(e)=>e.stopPropagation()}>
        <form onSubmit={submit}>
          <div className="border-b border-line-subtle p-4">
            <h2 className="text-xl font-bold">Nueva jornada</h2>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Tipo *</label>
                <select className="input" value={form.tipo} onChange={(e) => setField('tipo', e.target.value)}>
                  {TIPOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select></div>
              <div><label className="label">Sección responsable *</label>
                <select className="input" value={form.seccion_responsable}
                  disabled={user.rol === 'ce' || user.rol === 'sipresalud'}
                  onChange={(e) => setField('seccion_responsable', e.target.value)}>
                  <option value="CE">CE</option><option value="SIPRESALUD">SIPRESALUD</option>
                </select></div>
              <div><label className="label">Empresa</label>
                <select className="input" value={form.empresa_id || ''}
                  onChange={(e) => setField('empresa_id', e.target.value ? Number(e.target.value) : null)}>
                  <option value="">— Sin empresa (webinar/oficina) —</option>
                  {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre_legal}</option>)}
                </select></div>
              <div><label className="label">Tema</label>
                <input className="input" value={form.tema || ''} onChange={(e) => setField('tema', e.target.value)} /></div>
              <div><label className="label">Fecha inicio *</label>
                <input className="input" type="date" value={form.fecha_inicio}
                  onChange={(e) => setField('fecha_inicio', e.target.value)} required /></div>
              <div><label className="label">Hora inicio</label>
                <input className="input" type="time" value={form.hora_inicio || ''}
                  onChange={(e) => setField('hora_inicio', e.target.value)} /></div>
              <div><label className="label">Modalidad</label>
                <select className="input" value={form.modalidad} onChange={(e) => setField('modalidad', e.target.value)}>
                  <option value="PRESENCIAL">Presencial</option>
                  <option value="VIRTUAL">Virtual</option>
                  <option value="MIXTA">Mixta</option>
                </select></div>
              <div><label className="label">Programados</label>
                <input className="input" type="number" min="0" value={form.programados}
                  onChange={(e) => setField('programados', e.target.value)} /></div>
              <div><label className="label">Departamento</label>
                <select className="input" value={form.departamento || ''}
                  onChange={(e) => setForm((f) => ({ ...f, departamento: e.target.value, municipio: '' }))}>
                  <option value="">— Seleccione —</option>
                  {(deptosCat?.items || []).map((d) => <option key={d} value={d}>{d}</option>)}
                </select></div>
              <div><label className="label">Municipio</label>
                <select className="input" value={form.municipio || ''}
                  onChange={(e) => setField('municipio', e.target.value)}>
                  <option value="">{form.departamento ? '— Seleccione —' : '(elija departamento)'}</option>
                  {(munisCat?.items || []).map((m) => <option key={m} value={m}>{m}</option>)}
                </select></div>
              <div><label className="label">Zona</label>
                <input className="input" value={form.zona || ''} onChange={(e) => setField('zona', e.target.value)} /></div>
              <div><label className="label">Viáticos presupuesto (Q)</label>
                <input className="input" type="number" step="0.01" min="0" value={form.viaticos_presupuesto}
                  onChange={(e) => setField('viaticos_presupuesto', e.target.value)} /></div>
              <div className="col-span-2"><label className="label">Líder de jornada</label>
                <select className="input" value={form.lider_personal_id || ''}
                  onChange={(e) => setField('lider_personal_id', e.target.value ? Number(e.target.value) : null)}>
                  <option value="">— Sin líder asignado —</option>
                  {personalDisponible.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre_completo} ({p.rol_default || 'sin rol'})</option>
                  ))}
                </select></div>
            </div>

            {/* Charla de educación en salud (OPCIONAL — no todas las jornadas llevan) */}
            <div className="rounded-lg border border-line-subtle bg-surface-elev p-3">
              <div className="text-sm font-semibold text-fg mb-2">
                Charla de educación en salud <span className="text-fg-subtle font-normal">(opcional)</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Tema(s) de la charla</label>
                  <input className="input" value={form.charla_tema || ''}
                    placeholder="Ej: Prevención de dengue, lavado de manos"
                    onChange={(e) => setField('charla_tema', e.target.value)} /></div>
                <div><label className="label">Responsable de impartirla</label>
                  <input className="input" value={form.charla_responsable || ''}
                    placeholder="Nombre de quien da la charla"
                    onChange={(e) => setField('charla_responsable', e.target.value)} /></div>
              </div>
            </div>

            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.aplica_kit_lab}
                  onChange={(e) => setField('aplica_kit_lab', e.target.checked)} />
                Aplica kit de laboratorio
              </label>
              {form.tipo === 'INAUGURACION' ? (
                <span className="text-success font-medium flex items-center gap-1">
                  🎉 Inaugura clínica permanente (automático por tipo)
                </span>
              ) : (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!form.inaugura_clinica}
                    onChange={(e) => setField('inaugura_clinica', e.target.checked)} />
                  ✂️ Esta jornada también inaugura una clínica
                </label>
              )}
            </div>

            {form.tipo === 'INAUGURACION' && (
              <div className="bg-warning-soft border-l-4 border-warning p-3 rounded">
                <p className="text-sm text-warning font-medium mb-2">
                  ⚠️ Las inauguraciones requieren <b>jornada de tamizaje SIPRESALUD asociada</b>
                  para llevar equipo médico. Si dejás sin asociar, aparecerá como alerta roja
                  en dashboard y calendario.
                </p>
                <label className="label">Jornada SIPRESALUD asociada</label>
                <select className="input" value={form.inauguracion_jornada_id || ''}
                  onChange={(e) => setField('inauguracion_jornada_id', e.target.value ? Number(e.target.value) : null)}>
                  <option value="">— Sin asociar (generará alerta roja) —</option>
                  {jornadasSipre.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.codigo} · {j.fecha_inicio} · {(j.empresa_nombre || j.tema || '').slice(0, 35)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold">Personal asignado</h3>
                <button type="button" className="text-accent text-sm hover:underline" onClick={addPersona}>+ Añadir persona</button>
              </div>
              <div className="space-y-2">
                {form.personal.map((p, i) => (
                  <div key={i} className="flex gap-2 items-center bg-surface-elev p-2 rounded">
                    <select className="input flex-1" value={p.personal_id}
                      onChange={(e) => updPersona(i, 'personal_id', Number(e.target.value))}>
                      {personalDisponible.map((x) => <option key={x.id} value={x.id}>{x.nombre_completo} ({x.seccion})</option>)}
                    </select>
                    <select className="input w-32" value={p.rol_jornada}
                      onChange={(e) => updPersona(i, 'rol_jornada', e.target.value)}>
                      {ROLES_JOR.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <input className="input w-20" type="number" step="0.5" min="0.5" value={p.dias_asignados}
                      onChange={(e) => updPersona(i, 'dias_asignados', Number(e.target.value))} title="Días asignados" />
                    <button type="button" className="text-danger text-sm" onClick={() => removePersona(i)}>✕</button>
                  </div>
                ))}
                {form.personal.length === 0 && <div className="text-fg-subtle text-sm">Sin personal asignado</div>}
              </div>
            </div>

            <textarea className="input" rows="2" placeholder="Notas internas (opcional)"
              value={form.notas || ''} onChange={(e) => setField('notas', e.target.value)} />

            {err && <div className="bg-danger-soft text-danger p-2 rounded text-sm">{err}</div>}
          </div>
          <div className="border-t border-line-subtle p-3 flex justify-end gap-2 bg-surface-elev">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary">Crear jornada</button>
          </div>
        </form>
      </div>
    </div>
  );
}
