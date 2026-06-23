import { useEffect, useState } from 'react';
import {
  apiListEmpresas, apiListPersonal, apiListJornadas,
  apiCreateJornada, apiUpdateJornada, apiSetCharlas,
} from '../api/endpoints';
import { useAuth } from '../hooks/useAuth';
import { useApi } from '../hooks/useApi';

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

/**
 * Formulario de jornada — CREA (jornada=null) o EDITA (jornada=objeto hidratado).
 * En edición guarda los campos centrales (PUT /jornadas/{id}) y, por separado,
 * el set de charlas (PUT /jornadas/{id}/charlas). El backend gatea quién puede:
 * jornadas CERRADAS solo Berkin (E1); charlas solo editores de la sección (E2).
 */
export default function JornadaFormModal({ jornada = null, onClose, onSaved }) {
  const { user } = useAuth();
  const isEdit = !!jornada;
  const [empresas, setEmpresas] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [jornadasSipre, setJornadasSipre] = useState([]);
  const [err, setErr] = useState('');

  const [form, setForm] = useState(() => isEdit ? {
    tipo: jornada.tipo,
    seccion_responsable: jornada.seccion_responsable,
    empresa_id: jornada.empresa_id || null,
    modalidad: jornada.modalidad || 'PRESENCIAL',
    tema: jornada.tema || '',
    fecha_inicio: jornada.fecha_inicio,
    fecha_fin: jornada.fecha_fin || '',
    hora_inicio: jornada.hora_inicio || '',
    departamento: jornada.departamento || '',
    municipio: jornada.municipio || '',
    zona: jornada.zona || '',
    programados: jornada.programados ?? 0,
    aplica_kit_lab: !!jornada.aplica_kit_lab,
    inaugura_clinica: !!jornada.inaugura_clinica,
    inauguracion_jornada_id: jornada.inauguracion_jornada_id || null,
    lider_personal_id: jornada.lider_personal_id || null,
    viaticos_presupuesto: jornada.viaticos_presupuesto ?? 0,
    notas: jornada.notas || '',
    personal: (jornada.personal || []).map((p) => ({
      personal_id: p.personal_id, rol_jornada: p.rol_jornada,
      dias_asignados: p.dias_asignados ?? 1.0, funcion_extra: p.funcion_extra || null,
    })),
    charlas: (jornada.charlas || []).map((c) => ({
      charla_codigo: c.charla_codigo || '',
      responsable_personal_id: c.responsable_personal_id || '',
    })),
  } : {
    tipo: 'SIPRESALUD_JORNADA',
    seccion_responsable: user.seccion || 'SIPRESALUD',
    modalidad: 'PRESENCIAL',
    fecha_inicio: new Date().toISOString().slice(0, 10),
    programados: 0,
    aplica_kit_lab: true,
    inaugura_clinica: false,
    viaticos_presupuesto: 0,
    personal: [],
    charlas: [],
  });

  useEffect(() => {
    apiListEmpresas({ activa: true }).then(setEmpresas);
    apiListPersonal({ activo: true }).then(setPersonal);
    apiListJornadas({ seccion: 'SIPRESALUD' }).then(setJornadasSipre);
  }, []);

  const personalDisponible = personal.filter((p) =>
    (user.rol === 'admin' || user.rol === 'gerencia') ? true : p.seccion === form.seccion_responsable
  );
  function setField(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  const { data: catCharlas } = useApi('/api/catalogos/charlas');
  const { data: deptosCat } = useApi('/api/catalogos/departamentos');
  const { data: munisCat } = useApi('/api/catalogos/municipios',
    { departamento: form.departamento || '' }, { enabled: !!form.departamento });

  function addCharla() { setField('charlas', [...form.charlas, { charla_codigo: '', responsable_personal_id: '' }]); }
  function updCharla(i, k, v) { const c = [...form.charlas]; c[i] = { ...c[i], [k]: v }; setField('charlas', c); }
  function removeCharla(i) { setField('charlas', form.charlas.filter((_, idx) => idx !== i)); }
  function addPersona() {
    const primero = personalDisponible[0];
    if (!primero) { alert(`No hay personal activo en la sección ${form.seccion_responsable}`); return; }
    setField('personal', [...form.personal, { personal_id: primero.id, rol_jornada: 'MEDICO', dias_asignados: 1.0 }]);
  }
  function updPersona(i, k, v) { const c = [...form.personal]; c[i] = { ...c[i], [k]: v }; setField('personal', c); }
  function removePersona(i) { setField('personal', form.personal.filter((_, idx) => idx !== i)); }

  function charlasPayload() {
    return (form.charlas || []).filter((c) => c.charla_codigo).map((c) => ({
      charla_codigo: c.charla_codigo,
      responsable_personal_id: c.responsable_personal_id ? Number(c.responsable_personal_id) : null,
    }));
  }

  async function submit(e) {
    e.preventDefault();
    setErr('');
    const base = {
      ...form,
      inaugura_clinica: form.tipo === 'INAUGURACION' || !!form.inaugura_clinica,
      programados: Number(form.programados) || 0,
      viaticos_presupuesto: Number(form.viaticos_presupuesto) || 0,
      empresa_id: form.empresa_id || null,
      lider_personal_id: form.lider_personal_id || null,
      fecha_fin: form.fecha_fin || null,
      inauguracion_jornada_id: form.tipo === 'INAUGURACION' ? (form.inauguracion_jornada_id || null) : null,
    };
    try {
      if (isEdit) {
        // PUT no toca charlas → se guardan aparte para no perderlas.
        await apiUpdateJornada(jornada.id, { ...base, charla_tema: null, charla_responsable: null });
        await apiSetCharlas(jornada.id, charlasPayload());
      } else {
        await apiCreateJornada({ ...base, charlas: charlasPayload(), charla_tema: null, charla_responsable: null });
      }
      onSaved?.();
    } catch (e) {
      setErr(e.response?.data?.detail || (isEdit ? 'Error guardando cambios' : 'Error creando jornada'));
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-line dark:shadow-glow-accent" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={submit}>
          <div className="border-b border-line-subtle p-4">
            <h2 className="text-xl font-bold">{isEdit ? `Editar jornada ${jornada.codigo}` : 'Nueva jornada'}</h2>
            {isEdit && jornada.estado === 'CERRADA' && (
              <p className="text-xs text-warning mt-1">Editando una jornada CERRADA (acción reservada al coordinador).</p>
            )}
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Tipo *</label>
                <select className="input" value={form.tipo} onChange={(e) => setField('tipo', e.target.value)}>
                  {TIPOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select></div>
              <div><label className="label">Sección responsable *</label>
                <select className="input" value={form.seccion_responsable}
                  disabled={isEdit || user.rol === 'ce' || user.rol === 'sipresalud'}
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
              <div><label className="label">Fecha fin</label>
                <input className="input" type="date" value={form.fecha_fin || ''}
                  onChange={(e) => setField('fecha_fin', e.target.value)} /></div>
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

            {/* Charlas de educación en salud — MÚLTIPLES, desde catálogo */}
            <div className="rounded-lg border border-line-subtle bg-surface-elev p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-fg">
                  Charlas de educación en salud <span className="text-fg-subtle font-normal">(opcional · múltiples)</span>
                </div>
                <button type="button" className="btn-secondary text-xs" onClick={addCharla}>+ Agregar charla</button>
              </div>
              {form.charlas.length === 0 && <div className="text-xs text-fg-subtle">Sin charlas.</div>}
              <div className="space-y-2">
                {form.charlas.map((c, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                    <select className="input" value={c.charla_codigo}
                      onChange={(e) => updCharla(i, 'charla_codigo', e.target.value)}>
                      <option value="">— Tema (catálogo) —</option>
                      {(catCharlas?.items || []).map((o) => (
                        <option key={o.codigo} value={o.codigo}>{o.codigo} · {o.titulo}</option>
                      ))}
                    </select>
                    <select className="input" value={c.responsable_personal_id}
                      onChange={(e) => updCharla(i, 'responsable_personal_id', e.target.value)}>
                      <option value="">— Responsable —</option>
                      {personalDisponible.map((p) => <option key={p.id} value={p.id}>{p.nombre_completo}</option>)}
                    </select>
                    <button type="button" className="text-danger px-2" title="Quitar" onClick={() => removeCharla(i)}>✕</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.aplica_kit_lab}
                  onChange={(e) => setField('aplica_kit_lab', e.target.checked)} />
                Aplica kit de laboratorio
              </label>
              {form.tipo === 'INAUGURACION' ? (
                <span className="text-success font-medium flex items-center gap-1">🎉 Inaugura clínica permanente (automático por tipo)</span>
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
                <label className="label">Jornada SIPRESALUD asociada</label>
                <select className="input" value={form.inauguracion_jornada_id || ''}
                  onChange={(e) => setField('inauguracion_jornada_id', e.target.value ? Number(e.target.value) : null)}>
                  <option value="">— Sin asociar (generará alerta roja) —</option>
                  {jornadasSipre.map((j) => (
                    <option key={j.id} value={j.id}>{j.codigo} · {j.fecha_inicio} · {(j.empresa_nombre || j.tema || '').slice(0, 35)}</option>
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
            <button type="submit" className="btn-primary">{isEdit ? 'Guardar cambios' : 'Crear jornada'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
