import { useEffect, useState } from 'react';
import {
  apiListEmpresas, apiListPersonal, apiListJornadas,
  apiCreateJornada, apiUpdateJornada, apiSetCharlas,
} from '../api/endpoints';
import { useAuth } from '../hooks/useAuth';
import { useApi } from '../hooks/useApi';
import { isoLocalDate, TIPOS_ACTIVIDAD_UI } from '../utils/format';
// Traductor ÚNICO de errores del backend (incluye el aplanado por campo de los
// 422 de Pydantic). Este archivo tenía su propia copia con el mismo nombre y
// semántica opuesta en el segundo argumento —texto por defecto acá, acción en
// infinitivo allá—, así que el mismo error se leía distinto según la pantalla.
import { mensajeDeError } from '../utils/apiError';
import SearchableSelect from './filters/SearchableSelect';

const ROLES_JOR = ['LIDER', 'MEDICO', 'ADMIN', 'ENFERMERIA', 'NUTRICIONISTA', 'LABORATORISTA', 'DIGITADOR', 'ENCUESTADOR'];

// Campos de texto que el navegador devuelve como '' cuando quedan vacíos. Sin
// convertirlos, la BD termina con cadenas vacías donde debería haber NULL y
// todo filtro o reporte tiene que preguntar por las dos cosas.
const TEXTOS_OPCIONALES = ['hora_inicio', 'tema', 'departamento', 'municipio', 'zona',
  'direccion', 'qr_link'];

/**
 * Charlas tal como vienen del servidor → filas del formulario.
 * `charla_tema` se CONSERVA: es el texto libre de las charlas antiguas (las que
 * no traen código de catálogo) y sin él, guardar cualquier edición las borraba,
 * porque el payload descartaba toda fila sin código.
 */
function charlasDesdeJornada(jornada) {
  return (jornada?.charlas || []).map((c) => ({
    charla_codigo: c.charla_codigo || '',
    charla_tema: c.charla_tema || '',
    responsable_personal_id: c.responsable_personal_id || '',
  }));
}

/** Filas del formulario → payload de charlas que acepta el servidor. */
function charlasPayload(lista) {
  return (lista || [])
    .filter((c) => c.charla_codigo || c.charla_tema)
    .map((c) => ({
      charla_codigo: c.charla_codigo || null,
      // Con código, el título lo deriva el servidor del catálogo (fuente única);
      // el texto libre solo viaja cuando NO hay código.
      charla_tema: c.charla_codigo ? null : (c.charla_tema || null),
      responsable_personal_id: c.responsable_personal_id ? Number(c.responsable_personal_id) : null,
    }));
}

/** Firma comparable del set de charlas, para saber si la sección cambió. */
const firmaCharlas = (lista) => JSON.stringify(charlasPayload(lista));

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
    // Hidratar la dirección es obligatorio: el PUT REEMPLAZA la fila completa,
    // así que si no se lee de la jornada viaja vacía y cada edición borraba la
    // dirección del lugar donde se hace la actividad, sin que nadie la tocara.
    direccion: jornada.direccion || '',
    programados: jornada.programados ?? 0,
    aplica_kit_lab: !!jornada.aplica_kit_lab,
    tamizaje_vih: !!jornada.tamizaje_vih,
    vacunacion: !!jornada.vacunacion,
    // Hidratar los servicios NUEVOS es obligatorio: si no se leen de la jornada,
    // arrancan apagados y la primera edición apaga el flag que ya estaba puesto.
    odontologia: !!jornada.odontologia,
    nutricion: !!jornada.nutricion,
    qr_link: jornada.qr_link || '',
    inaugura_clinica: !!jornada.inaugura_clinica,
    inauguracion_jornada_id: jornada.inauguracion_jornada_id || null,
    lider_personal_id: jornada.lider_personal_id || null,
    viaticos_presupuesto: jornada.viaticos_presupuesto ?? 0,
    notas: jornada.notas || '',
    // Gerencia recibe `observaciones` en null (el servidor se las quita), así que
    // acá queda '' y la llave NO se manda al guardar — ver `submit`.
    observaciones: jornada.observaciones || '',
    personal: (jornada.personal || []).map((p) => ({
      personal_id: p.personal_id, rol_jornada: p.rol_jornada,
      dias_asignados: p.dias_asignados ?? 1.0, funcion_extra: p.funcion_extra || null,
    })),
    charlas: charlasDesdeJornada(jornada),
  } : {
    tipo: 'SIPRESALUD_JORNADA',
    seccion_responsable: 'SIPRESALUD',   // siempre SIPRESALUD (no se hacen jornadas CE)
    modalidad: 'PRESENCIAL',
    fecha_inicio: isoLocalDate(),
    programados: 0,
    aplica_kit_lab: true,
    tamizaje_vih: false,
    vacunacion: false,
    odontologia: false,
    nutricion: false,
    qr_link: '',
    inaugura_clinica: false,
    viaticos_presupuesto: 0,
    observaciones: '',
    personal: [],
    charlas: [],
  });

  // Foto de las charlas al abrir el modal: si al guardar no cambiaron, ni se
  // llama al endpoint. Cada llamada BORRA e inserta la tabla de charlas de la
  // jornada, y hacerlo en toda edición era reescribir datos ajenos sin motivo.
  const [charlasAlAbrir] = useState(() => firmaCharlas(charlasDesdeJornada(jornada)));

  useEffect(() => {
    apiListEmpresas({ activa: true }).then(setEmpresas);
    apiListPersonal({ activo: true }).then(setPersonal);
    apiListJornadas({ seccion: 'SIPRESALUD' }).then(setJornadasSipre);
  }, []);

  // `user?.rol`: si el token venció mientras el modal estaba abierto, el
  // contexto se vacía y leer `user.rol` a secas revienta el render — que es
  // justamente el error de pantalla en blanco que se está corrigiendo.
  const personalDisponible = personal.filter((p) =>
    (user?.rol === 'admin' || user?.rol === 'gerencia') ? true : p.seccion === form.seccion_responsable
  );
  function setField(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  const { data: catCharlas } = useApi('/api/catalogos/charlas');
  const { data: deptosCat } = useApi('/api/catalogos/departamentos');
  const { data: munisCat } = useApi('/api/catalogos/municipios',
    { departamento: form.departamento || '' }, { enabled: !!form.departamento });

  function addCharla() { setField('charlas', [...form.charlas, { charla_codigo: '', charla_tema: '', responsable_personal_id: '' }]); }
  function updCharla(i, k, v) { const c = [...form.charlas]; c[i] = { ...c[i], [k]: v }; setField('charlas', c); }
  function removeCharla(i) { setField('charlas', form.charlas.filter((_, idx) => idx !== i)); }
  function addPersona() {
    const primero = personalDisponible[0];
    if (!primero) { alert(`No hay personal activo en la sección ${form.seccion_responsable}`); return; }
    setField('personal', [...form.personal, { personal_id: primero.id, rol_jornada: 'MEDICO', dias_asignados: 1.0 }]);
  }
  function updPersona(i, k, v) { const c = [...form.personal]; c[i] = { ...c[i], [k]: v }; setField('personal', c); }
  function removePersona(i) { setField('personal', form.personal.filter((_, idx) => idx !== i)); }

  async function submit(e) {
    e.preventDefault();
    setErr('');
    // `charlas` sale del cuerpo de la jornada: el PUT las IGNORA a propósito
    // (viajan por su propio endpoint) y mandarlas era el origen del 422 —
    // un responsable vacío ('') que el modelo espera como entero.
    const { charlas: charlasForm, ...campos } = form;
    const base = {
      ...campos,
      inaugura_clinica: form.tipo === 'INAUGURACION' || !!form.inaugura_clinica,
      programados: Number(form.programados) || 0,
      viaticos_presupuesto: Number(form.viaticos_presupuesto) || 0,
      empresa_id: form.empresa_id || null,
      lider_personal_id: form.lider_personal_id || null,
      fecha_fin: form.fecha_fin || null,
      inauguracion_jornada_id: form.tipo === 'INAUGURACION' ? (form.inauguracion_jornada_id || null) : null,
      charla_tema: null,
      charla_responsable: null,
    };
    for (const k of TEXTOS_OPCIONALES) {
      if (k in base) base[k] = (typeof base[k] === 'string' ? base[k].trim() : base[k]) || null;
    }
    // Gerencia no ve las observaciones (el servidor se las devuelve en null),
    // así que si su formulario las mandara vacías borraría lo que escribió otro.
    // El servidor ya ignora la llave para ese rol; acá ni se envía.
    if (user?.rol === 'gerencia') delete base.observaciones;
    // `observaciones` NO entra en TEXTOS_OPCIONALES a propósito: al editar, el
    // servidor conserva el valor anterior cuando recibe null, así que mandar
    // null en vez de '' dejaría sin forma de BORRAR una observación. Al crear no
    // hay nada que conservar y sí conviene guardar NULL en vez de cadena vacía.
    if (!isEdit && 'observaciones' in base) base.observaciones = base.observaciones.trim() || null;

    const charlas = charlasPayload(charlasForm);
    try {
      if (isEdit) {
        await apiUpdateJornada(jornada.id, base);
        // Solo si la sección de charlas cambió (ver `charlasAlAbrir`).
        if (JSON.stringify(charlas) !== charlasAlAbrir) {
          await apiSetCharlas(jornada.id, charlas);
        }
      } else {
        await apiCreateJornada({ ...base, charlas });
      }
      onSaved?.();
    } catch (e2) {
      setErr(mensajeDeError(
        e2, isEdit ? 'guardar los cambios' : 'crear la actividad'));
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
              <div><label className="label">Actividad *</label>
                <select className="input" value={form.tipo} onChange={(e) => setField('tipo', e.target.value)}>
                  {TIPOS_ACTIVIDAD_UI.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select></div>
              <div><label className="label">Sección responsable *</label>
                {/* Siempre SIPRESALUD (no se hacen jornadas CE) — fuente Berkin. */}
                <select className="input" value="SIPRESALUD" disabled
                  onChange={(e) => setField('seccion_responsable', e.target.value)}>
                  <option value="SIPRESALUD">SIPRESALUD</option>
                </select></div>
              <div><label className="label">Empresa</label>
                <SearchableSelect value={form.empresa_id || ''}
                  onChange={(v) => setField('empresa_id', v ? Number(v) : null)}
                  placeholder="— Sin empresa (webinar/oficina) —"
                  options={empresas.map((e) => ({ value: e.id, label: e.nombre_legal }))} />
              </div>
              {/* Sin casilla «Tema»: al crear, el servidor lo deriva (empresa,
                  primera charla o la actividad). En edición el valor que ya
                  tenga la jornada viaja intacto en `form.tema` y se conserva. */}
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
              <div><label className="label">Afiliados proyectados</label>
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
              {/* Cierra el bloque de ubicación (departamento/municipio/zona): es
                  la dirección exacta del lugar donde se monta la actividad, la
                  que necesita el equipo para llegar. Va acá abajo, a lo ancho,
                  porque no cabe en media columna. */}
              <div className="col-span-2"><label className="label">Dirección</label>
                <input className="input" value={form.direccion || ''}
                  placeholder="Dirección exacta del lugar de la actividad"
                  onChange={(e) => setField('direccion', e.target.value)} /></div>
              <div className="col-span-2"><label className="label">Líder de jornada</label>
                <SearchableSelect value={form.lider_personal_id || ''}
                  onChange={(v) => setField('lider_personal_id', v ? Number(v) : null)}
                  placeholder="— Sin líder asignado —"
                  options={personalDisponible.map((p) => ({ value: p.id, label: `${p.nombre_completo} (${p.rol_default || 'sin rol'})` }))} />
              </div>
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
                    <div>
                      <select className="input" value={c.charla_codigo}
                        onChange={(e) => updCharla(i, 'charla_codigo', e.target.value)}>
                        <option value="">— Tema (catálogo) —</option>
                        {(catCharlas?.items || []).map((o) => (
                          <option key={o.codigo} value={o.codigo}>{o.codigo} · {o.titulo}</option>
                        ))}
                      </select>
                      {/* Charla vieja de texto libre (anterior al catálogo): el
                          desplegable no la puede representar y sin este aviso la
                          fila se ve vacía. Se conserva tal cual al guardar. */}
                      {!c.charla_codigo && c.charla_tema && (
                        <div className="text-[11px] text-fg-subtle mt-1 truncate" title={c.charla_tema}>
                          Tema escrito a mano: «{c.charla_tema}» — se conserva.
                        </div>
                      )}
                    </div>
                    <SearchableSelect value={c.responsable_personal_id || ''}
                      onChange={(v) => updCharla(i, 'responsable_personal_id', v)}
                      placeholder="— Responsable —"
                      options={personalDisponible.map((p) => ({ value: p.id, label: p.nombre_completo }))} />
                    <button type="button" className="text-danger px-2" title="Quitar" onClick={() => removeCharla(i)}>✕</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Servicios que se prestan durante la actividad. Van en su propio
                recuadro (el mismo del panel de charlas) para que se lean como un
                bloque: sueltas, las casillas se confundían con la de inauguración,
                que NO es un servicio y por eso queda fuera. Estos flags son los
                que el calendario pinta como emojis en el chip de cada evento. */}
            <div className="rounded-lg border border-line-subtle bg-surface-elev p-3">
              <div className="text-sm font-semibold text-fg mb-2">
                Servicios de la actividad <span className="text-fg-subtle font-normal">(opcional · varios)</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.aplica_kit_lab}
                    onChange={(e) => setField('aplica_kit_lab', e.target.checked)} />
                  🧪 Laboratorio
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!form.tamizaje_vih}
                    onChange={(e) => setField('tamizaje_vih', e.target.checked)} />
                  🩸 Tamizaje VIH
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!form.vacunacion}
                    onChange={(e) => setField('vacunacion', e.target.checked)} />
                  💉 Vacunación
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!form.odontologia}
                    onChange={(e) => setField('odontologia', e.target.checked)} />
                  🦷 Odontología
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!form.nutricion}
                    onChange={(e) => setField('nutricion', e.target.checked)} />
                  🥕 Nutrición
                </label>
              </div>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
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

            <div><label className="label">QR Link (encuesta)</label>
              <input className="input" type="url" inputMode="url" placeholder="https://… (link de la encuesta)"
                value={form.qr_link || ''} onChange={(e) => setField('qr_link', e.target.value)} /></div>

            {form.tipo === 'INAUGURACION' && (
              <div className="bg-warning-soft border-l-4 border-warning p-3 rounded">
                <label className="label">Jornada SIPRESALUD asociada</label>
                <SearchableSelect value={form.inauguracion_jornada_id || ''}
                  onChange={(v) => setField('inauguracion_jornada_id', v ? Number(v) : null)}
                  placeholder="— Sin asociar (generará alerta roja) —"
                  options={jornadasSipre.map((j) => ({ value: j.id, label: `${j.codigo} · ${j.fecha_inicio} · ${(j.empresa_nombre || j.tema || '').slice(0, 35)}` }))} />
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
                    <SearchableSelect className="flex-1" value={p.personal_id}
                      onChange={(v) => updPersona(i, 'personal_id', Number(v))}
                      allowEmpty={false}
                      options={personalDisponible.map((x) => ({ value: x.id, label: `${x.nombre_completo} (${x.seccion})` }))} />
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

            {/* Observaciones de campo. A Gerencia el servidor se las devuelve en
                null en TODAS partes (ficha, listados, tableros, bitácora), así
                que a ese rol ni se le ofrece el campo: lo vería siempre vacío y
                al guardar borraría lo que escribió otra persona. */}
            {user?.rol !== 'gerencia' && (
              <div>
                <label className="label">Observaciones (no visible para Gerencia)</label>
                <textarea className="input" rows="2"
                  placeholder="Observaciones de la actividad — las ven SIPRESALUD, Clínicas de Empresa y administración."
                  value={form.observaciones || ''}
                  onChange={(e) => setField('observaciones', e.target.value)} />
              </div>
            )}

            {err && <div className="bg-danger-soft text-danger p-2 rounded text-sm whitespace-pre-wrap">{err}</div>}
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
