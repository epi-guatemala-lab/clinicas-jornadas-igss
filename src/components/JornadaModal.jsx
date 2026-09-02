import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  apiGetJornada, apiCancelarJornada, apiCerrarJornada, apiReprogramarJornada,
  apiSetMaterial, apiSetCharlas, apiCatalogoCharlas, apiListPersonal,
  apiGetCierreJornada, apiAmarrarClinica,
} from '../api/endpoints';
import {
  SEMAFORO_BG, TIPO_LABEL, ESTADO_LABEL, fmtN, fmtQ, fmtPct,
  fmtRangoFechas, fmtFechaHora, fmtFecha,
} from '../utils/format';
import { useAuth } from '../hooks/useAuth';
import JornadaFormModal from './JornadaFormModal';
import SearchableSelect from './filters/SearchableSelect';

// E1/F1: coordinador (Berkin) — única identidad que edita cerradas y material.
// Usa el flag es_coordinador computado en el backend (is_berkin); fallback por
// compat con sesiones viejas que aún no traen el campo.
function esBerkin(user) {
  return user?.es_coordinador === true || user?.personal_id === 10 || user?.username === 'Berkin.Santos';
}

const CATEGORIAS = [
  ['CLIMA', 'Clima'],
  ['PERSONAL_INSUFICIENTE', 'Personal insuficiente'],
  ['EMPRESA_CANCELO', 'Empresa canceló'],
  ['TRANSPORTE', 'Transporte'],
  ['EMERGENCIA_SANITARIA', 'Emergencia sanitaria'],
  ['REPROGRAMACION_INTERNA', 'Reprogramación interna'],
  ['OTRO', 'Otro (especificar)'],
];

export default function JornadaModal({ jornadaId, onClose, onChanged }) {
  const { user, canWrite } = useAuth();
  const [j, setJ] = useState(null);
  const [mode, setMode] = useState('view');  // view | cancel | close | charlas
  const [form, setForm] = useState({});
  const [catalogo, setCatalogo] = useState([]);
  const [roster, setRoster] = useState([]);
  const [charlasEdit, setCharlasEdit] = useState([]);
  const [savingMat, setSavingMat] = useState(false);
  const [editing, setEditing] = useState(false);
  const [amarrando, setAmarrando] = useState(false);

  const [cierre, setCierre] = useState(null);

  useEffect(() => {
    apiGetJornada(jornadaId).then(setJ);
    // Estado del análisis de cierre (sección «Análisis de datos»): si la jornada
    // ya tiene archivo cargado muestra KPIs; si no, el botón para subirlo.
    apiGetCierreJornada(jornadaId).then(setCierre).catch(() => setCierre(null));
  }, [jornadaId]);

  // Catálogo de charlas (D2) + roster de responsables (D3) — para el editor.
  useEffect(() => {
    apiCatalogoCharlas().then((d) => setCatalogo(d.items || [])).catch(() => {});
    apiListPersonal({ activo: 1 }).then((d) => setRoster(d || [])).catch(() => {});
  }, []);

  if (!j) return (
    <Modal onClose={onClose}><div className="p-6 text-fg-muted">Cargando…</div></Modal>
  );

  const berkin = esBerkin(user);
  const puedeEditar = !['CERRADA', 'CANCELADA'].includes(j.estado);
  // Charlas: editables por cualquier editor de la sección (tras E2 = Marlon/Isabel
  // + admin), incl. en jornadas CERRADAS (revisión a detalle). Backend re-valida.
  const puedeEditarCharlas = canWrite && j.estado !== 'CANCELADA';

  async function toggleMaterial() {
    setSavingMat(true);
    try {
      const upd = await apiSetMaterial(j.id, !j.material_entregado);
      setJ(upd); onChanged?.();
    } catch (e) {
      alert(e.response?.data?.detail || 'No se pudo actualizar el material');
    } finally { setSavingMat(false); }
  }
  function startCharlas() {
    setCharlasEdit((j.charlas || []).map((c) => ({
      charla_codigo: c.charla_codigo || '', charla_tema: c.charla_tema || '',
      responsable_personal_id: c.responsable_personal_id || '',
    })));
    setMode('charlas');
  }
  async function saveCharlas() {
    const payload = charlasEdit
      .filter((c) => c.charla_codigo || c.charla_tema)
      .map((c) => {
        const cat = catalogo.find((x) => x.codigo === c.charla_codigo);
        return {
          charla_codigo: c.charla_codigo || null,
          charla_tema: cat ? cat.titulo : (c.charla_tema || ''),
          responsable_personal_id: c.responsable_personal_id ? Number(c.responsable_personal_id) : null,
        };
      });
    try {
      const upd = await apiSetCharlas(j.id, payload);
      setJ(upd); setMode('view'); onChanged?.();
    } catch (e) {
      alert(e.response?.data?.detail || 'No se pudieron guardar las charlas');
    }
  }

  async function doCancel() {
    if (!form.justificacion_categoria || !form.justificacion_texto || form.justificacion_texto.length < 5) {
      alert('Categoría y detalle (mín 5 chars) requeridos'); return;
    }
    const upd = await apiCancelarJornada(j.id, form);
    setJ(upd); setMode('view'); onChanged?.();
  }
  async function doReprogramar() {
    if (!form.nueva_fecha_inicio || !form.motivo || form.motivo.length < 5) {
      alert('Nueva fecha y motivo (mín 5 caracteres) requeridos'); return;
    }
    try {
      const upd = await apiReprogramarJornada(j.id, {
        nueva_fecha_inicio: form.nueva_fecha_inicio,
        nueva_fecha_fin: form.nueva_fecha_fin || null,
        nueva_hora_inicio: form.nueva_hora_inicio || null,
        motivo: form.motivo,
      });
      setJ(upd); setMode('view'); onChanged?.();
    } catch (e) {
      alert(e.response?.data?.detail || 'No se pudo reprogramar');
    }
  }
  async function doClose() {
    // Cierre manual (jornadas sin archivo: talleres/webinars). Ya NO se piden
    // viáticos acá: el monto entra después, por persona, desde su propio flujo,
    // y el backend ignora `viaticos_real` en el cierre.
    //
    // Un solo conteo (decisión del 2026-08-28): todas las personas atendidas se
    // registran como afiliadas y los kits de laboratorio van 1:1 con ellas. Los
    // tres campos que se pedían por separado devolvían números descuadrados de
    // la misma realidad, así que ahora se derivan del valor capturado.
    //
    // La derivación la hace el SERVIDOR y acá se mandan SOLO los atendidos:
    // `afiliados_atendidos` y `kits_consumidos` viajaban con el mismo número y
    // eso anulaba el resguardo del backend, que prefiere el conteo de afiliados
    // ya MEDIDO por el análisis de datos (`epi_personas` con afiliado_igss='SI')
    // sobre cualquier derivación. Mandarlo desde acá pisaba ese dato real con
    // una copia de los atendidos. Sin la llave, el servidor resuelve: kits =
    // atendidos si la jornada lleva laboratorio (NULL si no), y afiliados = el
    // conteo medido cuando existe, y solo si no existe = atendidos.
    const atendidos = Number(form.atendidos);
    if (form.atendidos == null || form.atendidos === ''
        || !Number.isFinite(atendidos) || atendidos < 0) {
      alert('Escribí cuántos afiliados se atendieron (un número igual o mayor que cero)');
      return;
    }
    const body = {
      atendidos,
      notas: form.notas || null,
      confirmar_amarre_clinica: !!form.confirmar_amarre_clinica,
    };
    try {
      const upd = await apiCerrarJornada(j.id, body);
      setJ(upd); setMode('view'); onChanged?.();
    } catch (e) {
      alert(e.response?.data?.detail || 'No se pudo cerrar la jornada');
    }
  }
  async function doAmarrar() {
    // Rescate: amarra la clínica de una inauguración que se cerró sin confirmarlo
    // (/cerrar ya da 409). Idempotente y conserva la trazabilidad a la jornada.
    setAmarrando(true);
    try {
      const upd = await apiAmarrarClinica(j.id);
      setJ(upd); onChanged?.();
    } catch (e) {
      alert(e.response?.data?.detail || 'No se pudo amarrar la clínica');
    } finally { setAmarrando(false); }
  }

  return (
    <Modal onClose={onClose}>
      <div className="border-b border-line-subtle p-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-fg-muted">{j.codigo}</div>
          <h2 className="text-xl font-bold">{TIPO_LABEL[j.tipo] || j.tipo}</h2>
          <div className="text-sm text-fg-muted">{j.empresa_nombre} · {j.tema}</div>
        </div>
        <span className={`badge ${SEMAFORO_BG[j.semaforo] || 'bg-neutral'}`}>
          {ESTADO_LABEL[j.estado] || j.estado}
        </span>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Fecha">{fmtRangoFechas(j.fecha_inicio, j.fecha_fin)}</Field>
          <Field label="Hora inicio">{j.hora_inicio || '—'}</Field>
          <Field label="Sección">{j.seccion_responsable}</Field>
          <Field label="Modalidad">{j.modalidad}</Field>
          <Field label="Ubicación">{[j.departamento, j.municipio, j.zona && `z. ${j.zona}`].filter(Boolean).join(' · ') || '—'}</Field>
          <Field label="Tipo de ubicación">{j.es_departamental ? 'Departamental (fuera de la capital)' : 'Capital'}</Field>
          {j.requiere_dia_traslado_previo && (
            <Field label="Traslado previo" className="col-span-2 text-cyan-700 dark:text-cyan-300 font-medium">
              🚐 {fmtFecha(j.fecha_traslado_previo)} · todo el equipo queda reservado ese día
            </Field>
          )}
          <Field label="Líder">{j.lider_nombre || '—'}</Field>
          <Field label="Afiliados proyectados">{fmtN(j.programados)}</Field>
          {/* Un solo renglón para el conteo del cierre: todas las personas
              atendidas son afiliadas y los kits van 1:1 con ellas, así que los
              tres números eran el mismo repetido y se leían como tres datos
              distintos. */}
          <Field label="Afiliados atendidos">{j.atendidos != null ? `${fmtN(j.atendidos)} (${fmtPct(j.pct_asistencia)})` : '—'}</Field>
          {/* Cierres viejos, capturados cuando afiliados y kits se escribían
              aparte: se muestran SOLO si no coinciden con el conteo, para no
              esconder un dato que quedó registrado distinto. */}
          {j.afiliados_atendidos != null && j.afiliados_atendidos !== j.atendidos && (
            <Field label="Afiliados registrados en el cierre">{fmtN(j.afiliados_atendidos)}</Field>
          )}
          {j.kits_consumidos != null && j.kits_consumidos !== j.atendidos && (
            <Field label="Kits consumidos">{fmtN(j.kits_consumidos)}</Field>
          )}
          {j.viaticos_real != null && <Field label="Viáticos reales">{fmtQ(j.viaticos_real)}</Field>}
          {j.inaugura_clinica && <Field label="Inaugura clínica" className="col-span-2 text-accent font-medium">✂️ Esta jornada inaugura una clínica permanente</Field>}
          <Field label="Material entregado" className="col-span-2">
            <span className={j.material_entregado ? 'text-success font-semibold' : 'text-fg-muted'}>
              {j.material_entregado ? '✓ Entregado' : '○ Pendiente'}
            </span>
            {/* El sello viene en UTC (SQLite lo escribe con datetime('now')):
                reordenarlo a mano mostraba la entrega 6 horas adelantada. */}
            {j.material_entregado_at && <span className="text-fg-muted text-xs"> · {fmtFechaHora(j.material_entregado_at)}</span>}
            {berkin && (
              <button className="ml-3 text-xs underline text-igss-primary disabled:opacity-50"
                onClick={toggleMaterial} disabled={savingMat}>
                {j.material_entregado ? 'Desmarcar' : 'Marcar entregado'}
              </button>
            )}
          </Field>
          {/* Observaciones de campo. El servidor ya las devuelve en null para
              gerencia; la compuerta se repite acá para que una ficha que quedó
              cacheada en el navegador con otra sesión tampoco se las muestre.
              La captura vive en el formulario de la jornada, no en la ficha. */}
          {j.observaciones && user?.rol !== 'gerencia' && (
            <Field label="Observaciones" className="col-span-2">
              <span className="font-normal whitespace-pre-line">{j.observaciones}</span>
            </Field>
          )}
        </div>

        {/* Rescate del amarre: una inauguración que se cerró SIN confirmar el
            amarre queda con la clínica sin registrar, y /cerrar ya no se puede
            repetir (409). Este botón la amarra aparte, en cualquier estado y
            conservando la trazabilidad a la jornada de origen (que el arreglo a
            mano de la empresa perdía). Solo se muestra si la empresa aún no
            figura amarrada. */}
        {j.inaugura_clinica && j.empresa_id && !j.empresa_clinica_amarrada
          && j.estado === 'CERRADA' && canWrite && (
          <div className="rounded-lg border border-warning/50 bg-warning-soft/40 p-3 space-y-2 text-sm">
            <div className="font-semibold text-warning">
              La clínica de esta inauguración no quedó amarrada
            </div>
            <p className="text-fg-muted text-xs">
              La jornada inauguró una clínica permanente en «{j.empresa_nombre}», pero la empresa
              no figura como amarrada: se cerró sin confirmarlo. Confirmalo acá y quedará contada
              en la meta institucional, con la trazabilidad a esta jornada.
            </p>
            <button className="btn-primary text-xs" onClick={doAmarrar} disabled={amarrando}>
              {amarrando ? 'Amarrando…' : 'Confirmar amarre de clínica'}
            </button>
          </div>
        )}

        {/* Charlas de educación en salud — MÚLTIPLES (D1/D4) */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-fg">
              Charlas de educación en salud ({j.charlas?.length || 0})
            </h3>
            {mode === 'view' && puedeEditarCharlas && (
              <button className="text-xs underline text-igss-primary" onClick={startCharlas}>
                Editar charlas
              </button>
            )}
          </div>
          {j.charlas?.length > 0 ? (
            <ul className="text-sm space-y-1">
              {j.charlas.map((c) => (
                <li key={c.id} className="flex justify-between border-b border-line-subtle py-1">
                  <span>{c.charla_codigo ? <span className="text-fg-muted">{c.charla_codigo} </span> : null}{c.charla_tema}</span>
                  <span className="text-fg-muted">{c.responsable_nombre || '—'}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-fg-muted">Sin charlas registradas.</div>
          )}
        </div>

        {j.personal?.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-fg mb-1">Personal asignado ({j.personal.length})</h3>
            <ul className="text-sm space-y-1">
              {j.personal.map((p) => (
                <li key={p.id} className="flex justify-between border-b py-1">
                  <span>{p.personal_nombre} — <span className="text-fg-muted">{p.rol_jornada}</span></span>
                  <span className="text-fg-muted">{p.dias_asignados}d</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Análisis de cierre (archivo «N - Análisis de Datos …»): estado en la
            ficha, subida y listado referible en su propia página. Solo jornadas
            de clínica; visible en CERRADA (los labs llegan días después). */}
        {['SIPRESALUD_JORNADA', 'CE_JORNADA'].includes(j.tipo) && j.estado !== 'CANCELADA' && (
          <div className="rounded-lg border border-line-subtle bg-sunken/30 p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-fg">Análisis de datos (cierre)</h3>
              <div className="flex items-center gap-2">
                {cierre?.epi_jornada_codigo && (
                  <Link to={`/hallazgos?jornada=${j.codigo}`}
                    className="text-xs underline text-igss-primary">
                    Ver epidemiología
                  </Link>
                )}
                <Link to={`/jornadas/${j.id}/analisis`}
                  className="btn-secondary text-xs no-underline">
                  {cierre?.carga_id ? 'Ver análisis' : 'Cargar análisis'}
                </Link>
              </div>
            </div>
            {cierre?.carga_id ? (
              <p className="text-xs text-fg-muted">
                Cargado por {cierre.cargado_por} el {fmtFechaHora(cierre.cargado_at)} ·{' '}
                <b className="text-fg">{fmtN(cierre.personas)} tamizados</b>
                {cierre.con_hallazgo != null && (
                  <> · {fmtN(cierre.con_hallazgo)} con hallazgos · {fmtN(cierre.referibles)} por referir</>
                )}
                {cierre.atendidos_declarado != null && cierre.personas != null
                  && cierre.atendidos_declarado !== cierre.personas && (
                  <span className="text-warning"> · atendidos declarados: {fmtN(cierre.atendidos_declarado)} (distinto de los {fmtN(cierre.personas)} del análisis)</span>
                )}
              </p>
            ) : (
              <p className="text-xs text-fg-muted">
                Cuando Sipresalud genere el archivo «N - Análisis de Datos …», subilo acá: el
                triaje, la encuesta y el laboratorio quedan asociados a esta jornada.
              </p>
            )}
          </div>
        )}

        {j.estado === 'CANCELADA' && (
          <div className="bg-danger-soft border border-danger/30 rounded p-3 text-sm">
            <div className="font-semibold text-danger">Cancelada · {j.justificacion_categoria}</div>
            <div className="text-danger mt-1">{j.justificacion_texto}</div>
          </div>
        )}

        {mode === 'cancel' && (
          <div className="bg-danger-soft border border-danger/30 rounded p-3 space-y-2">
            <h4 className="font-semibold text-danger">Cancelar jornada</h4>
            <select className="input" value={form.justificacion_categoria || ''}
              onChange={(e) => setForm({ ...form, justificacion_categoria: e.target.value })}>
              <option value="">— Seleccionar razón —</option>
              {CATEGORIAS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <textarea className="input" rows="3" placeholder="Detalle (obligatorio, mín 5 chars)"
              value={form.justificacion_texto || ''}
              onChange={(e) => setForm({ ...form, justificacion_texto: e.target.value })} />
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary" onClick={() => setMode('view')}>Volver</button>
              <button className="btn-danger" onClick={doCancel}>Confirmar cancelación</button>
            </div>
          </div>
        )}

        {mode === 'reprogramar' && (
          <div className="bg-warning-soft border border-warning/30 rounded p-3 space-y-2">
            <h4 className="font-semibold text-warning">Reprogramar jornada</h4>
            <div className="grid grid-cols-3 gap-2">
              <div><label className="label">Nueva fecha *</label>
                <input type="date" className="input" value={form.nueva_fecha_inicio || ''}
                  onChange={(e) => setForm({ ...form, nueva_fecha_inicio: e.target.value })} /></div>
              <div><label className="label">Nueva fecha fin</label>
                <input type="date" className="input" value={form.nueva_fecha_fin || ''}
                  onChange={(e) => setForm({ ...form, nueva_fecha_fin: e.target.value })} /></div>
              <div><label className="label">Nueva hora</label>
                <input type="time" className="input" value={form.nueva_hora_inicio || ''}
                  onChange={(e) => setForm({ ...form, nueva_hora_inicio: e.target.value })} /></div>
            </div>
            <textarea className="input" rows="2" placeholder="Motivo de la reprogramación (obligatorio)"
              value={form.motivo || ''} onChange={(e) => setForm({ ...form, motivo: e.target.value })} />
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary" onClick={() => setMode('view')}>Volver</button>
              <button className="btn-primary" onClick={doReprogramar}>Confirmar reprogramación</button>
            </div>
          </div>
        )}

        {mode === 'close' && (
          <div className="bg-success-soft border border-success/30 rounded p-3 space-y-2">
            <h4 className="font-semibold text-success">Cerrar jornada con métricas</h4>
            {/* Este cierre manual es para jornadas SIN archivo (talleres, webinars).
                Las jornadas de clínica se cierran solas al aplicar el análisis. */}
            <p className="text-xs text-fg-muted">
              Para jornadas con archivo de cierre, cerrá desde «Análisis de cierre»: los afiliados
              atendidos y los kits los toma del archivo y la jornada se cierra al aplicarlo.
            </p>
            {/* Un solo campo: los tres conteos que se pedían antes (atendidos,
                afiliados y kits) son el mismo número, y pedirlos por separado
                era la vía por la que entraban descuadrados. */}
            <div>
              <label className="label" htmlFor="cierre_afiliados">Afiliados atendidos *</label>
              <input id="cierre_afiliados" type="number" className="input max-w-[12rem]" min="0"
                value={form.atendidos ?? ''}
                onChange={(e) => setForm({ ...form, atendidos: e.target.value })} />
              <p className="text-[11px] text-fg-subtle mt-0.5">
                {j.aplica_kit_lab
                  ? 'Equivale a los kits de laboratorio consumidos: el sistema descuenta uno por persona atendida.'
                  : 'Todas las personas atendidas quedan registradas como afiliadas.'}
              </p>
            </div>
            {/* Amarre prominente y tildado por defecto (ver el default al abrir
                este modo). Solo con empresa: sin ella la confirmación no haría
                nada y se descartaría en silencio. */}
            {j.inaugura_clinica && j.empresa_id && (
              <div className="rounded-lg border border-warning/50 bg-warning-soft/40 p-2 mt-1 space-y-1">
                <label className="flex items-start gap-2 text-sm font-medium text-fg">
                  <input type="checkbox" className="mt-0.5" checked={!!form.confirmar_amarre_clinica}
                    onChange={(e) => setForm({ ...form, confirmar_amarre_clinica: e.target.checked })} />
                  <span>Confirmar el amarre de la clínica permanente en esta empresa</span>
                </label>
                <p className="text-[11px] text-fg-muted pl-6">
                  Viene marcado a propósito: si cerrás sin confirmarlo, la clínica no queda contada
                  y corregirlo después es a mano. Destildalo solo si de verdad no se inauguró.
                </p>
              </div>
            )}
            {j.inaugura_clinica && !j.empresa_id && (
              <p className="text-[11px] text-warning mt-1">
                Inaugura una clínica pero no tiene empresa asignada: no hay a quién amarrarla.
              </p>
            )}
            <textarea className="input" rows="2" placeholder="Notas del cierre (opcional)"
              value={form.notas ?? ''}
              onChange={(e) => setForm({ ...form, notas: e.target.value })} />
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary" onClick={() => setMode('view')}>Volver</button>
              <button className="btn-primary" onClick={doClose}>Cerrar jornada</button>
            </div>
          </div>
        )}

        {mode === 'charlas' && (
          <div className="bg-surface-elev border border-line rounded p-3 space-y-2">
            <h4 className="font-semibold text-fg">Editar charlas de educación en salud</h4>
            {charlasEdit.map((c, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                <select className="input" value={c.charla_codigo}
                  onChange={(e) => setCharlasEdit((arr) => arr.map((x, ix) => ix === i ? { ...x, charla_codigo: e.target.value } : x))}>
                  <option value="">— Tema (catálogo) —</option>
                  {catalogo.map((o) => <option key={o.codigo} value={o.codigo}>{o.codigo} · {o.titulo}</option>)}
                </select>
                <SearchableSelect value={c.responsable_personal_id || ''}
                  onChange={(v) => setCharlasEdit((arr) => arr.map((x, ix) => ix === i ? { ...x, responsable_personal_id: v } : x))}
                  placeholder="— Responsable —"
                  options={roster.filter((p) => !j.seccion_responsable || p.seccion === j.seccion_responsable)
                    .map((p) => ({ value: p.id, label: p.nombre_completo }))} />
                <button className="text-danger px-2" title="Quitar"
                  onClick={() => setCharlasEdit((arr) => arr.filter((_, ix) => ix !== i))}>✕</button>
              </div>
            ))}
            <button className="btn-secondary text-sm"
              onClick={() => setCharlasEdit((arr) => [...arr, { charla_codigo: '', charla_tema: '', responsable_personal_id: '' }])}>
              + Agregar charla
            </button>
            <div className="flex gap-2 justify-end pt-1">
              <button className="btn-secondary" onClick={() => setMode('view')}>Volver</button>
              <button className="btn-primary" onClick={saveCharlas}>Guardar charlas</button>
            </div>
          </div>
        )}
      </div>

      {mode === 'view' && (
        <div className="border-t border-line-subtle p-4 flex justify-between bg-surface-elev">
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
          <div className="flex gap-2">
            {/* Editar: campos centrales. CERRADA → solo Berkin (E1). CANCELADA → nadie. */}
            {canWrite && (puedeEditar || (j.estado === 'CERRADA' && berkin)) && (
              <button className="btn-secondary" onClick={() => setEditing(true)}>Editar</button>
            )}
            {puedeEditar && canWrite && (
              <>
                <button className="btn-secondary" onClick={() => { setForm({}); setMode('reprogramar'); }}>Reprogramar</button>
                <button className="btn-danger" onClick={() => { setForm({}); setMode('cancel'); }}>Cancelar</button>
                <button className="btn-primary"
                  onClick={() => {
                    // Amarre tildado por defecto en inauguraciones con empresa:
                    // el descuido caro es cerrar sin amarrar la clínica.
                    setForm({ confirmar_amarre_clinica: Boolean(j.inaugura_clinica && j.empresa_id) });
                    setMode('close');
                  }}>Cerrar con métricas</button>
              </>
            )}
          </div>
        </div>
      )}

      {editing && (
        <JornadaFormModal
          jornada={j}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); apiGetJornada(jornadaId).then(setJ); onChanged?.(); }}
        />
      )}
    </Modal>
  );
}

function Modal({ onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
         onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl border border-line max-w-2xl w-full max-h-[90vh] overflow-y-auto dark:shadow-glow-accent"
           onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <div className="text-xs uppercase text-fg-muted tracking-wide">{label}</div>
      <div className="font-medium">{children}</div>
    </div>
  );
}
