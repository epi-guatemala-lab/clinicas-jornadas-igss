import { useEffect, useState } from 'react';
import {
  apiGetJornada, apiCancelarJornada, apiCerrarJornada,
  apiSetMaterial, apiSetCharlas, apiCatalogoCharlas, apiListPersonal,
} from '../api/endpoints';
import { SEMAFORO_BG, TIPO_LABEL, ESTADO_LABEL, fmtN, fmtQ, fmtPct } from '../utils/format';
import { useAuth } from '../hooks/useAuth';

// E1/F1: Berkin (coordinador) — única identidad que edita cerradas y material.
function esBerkin(user) {
  return user?.personal_id === 10 || user?.username === 'Berkin.Santos';
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

  useEffect(() => {
    apiGetJornada(jornadaId).then(setJ);
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
  async function doClose() {
    if (form.atendidos == null || form.atendidos === '') {
      alert('Atendidos requerido'); return;
    }
    const body = {
      atendidos: Number(form.atendidos),
      afiliados_atendidos: form.afiliados_atendidos !== '' ? Number(form.afiliados_atendidos) : null,
      kits_consumidos: form.kits_consumidos !== '' ? Number(form.kits_consumidos) : null,
      viaticos_real: form.viaticos_real !== '' ? Number(form.viaticos_real) : null,
      notas: form.notas || null,
      confirmar_amarre_clinica: !!form.confirmar_amarre_clinica,
    };
    const upd = await apiCerrarJornada(j.id, body);
    setJ(upd); setMode('view'); onChanged?.();
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
          <Field label="Fecha">{j.fecha_inicio}{j.fecha_fin && j.fecha_fin !== j.fecha_inicio ? ` → ${j.fecha_fin}` : ''}</Field>
          <Field label="Hora inicio">{j.hora_inicio || '—'}</Field>
          <Field label="Sección">{j.seccion_responsable}</Field>
          <Field label="Modalidad">{j.modalidad}</Field>
          <Field label="Ubicación">{[j.departamento, j.municipio, j.zona && `z. ${j.zona}`].filter(Boolean).join(' · ') || '—'}</Field>
          <Field label="Líder">{j.lider_nombre || '—'}</Field>
          <Field label="Programados">{fmtN(j.programados)}</Field>
          <Field label="Atendidos">{j.atendidos != null ? `${fmtN(j.atendidos)} (${fmtPct(j.pct_asistencia)})` : '—'}</Field>
          {j.afiliados_atendidos != null && <Field label="Afiliados atendidos">{fmtN(j.afiliados_atendidos)}</Field>}
          {j.kits_consumidos != null && <Field label="Kits consumidos">{fmtN(j.kits_consumidos)}</Field>}
          {j.viaticos_real != null && <Field label="Viáticos reales">{fmtQ(j.viaticos_real)}</Field>}
          {j.inaugura_clinica && <Field label="Inaugura clínica" className="col-span-2 text-accent font-medium">✂️ Esta jornada inaugura una clínica permanente</Field>}
          <Field label="Material entregado" className="col-span-2">
            <span className={j.material_entregado ? 'text-success font-semibold' : 'text-fg-muted'}>
              {j.material_entregado ? '✓ Entregado' : '○ Pendiente'}
            </span>
            {j.material_entregado_at && <span className="text-fg-muted text-xs"> · {j.material_entregado_at.replace('T', ' ')}</span>}
            {berkin && (
              <button className="ml-3 text-xs underline text-igss-primary disabled:opacity-50"
                onClick={toggleMaterial} disabled={savingMat}>
                {j.material_entregado ? 'Desmarcar' : 'Marcar entregado'}
              </button>
            )}
          </Field>
        </div>

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

        {mode === 'close' && (
          <div className="bg-success-soft border border-success/30 rounded p-3 space-y-2">
            <h4 className="font-semibold text-success">Cerrar jornada con métricas</h4>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">Atendidos *</label>
                <input type="number" className="input" min="0"
                  value={form.atendidos ?? ''}
                  onChange={(e) => setForm({ ...form, atendidos: e.target.value })} /></div>
              <div><label className="label">Afiliados atendidos</label>
                <input type="number" className="input" min="0"
                  value={form.afiliados_atendidos ?? ''}
                  onChange={(e) => setForm({ ...form, afiliados_atendidos: e.target.value })} /></div>
              <div><label className="label">Kits consumidos</label>
                <input type="number" className="input" min="0"
                  value={form.kits_consumidos ?? ''}
                  onChange={(e) => setForm({ ...form, kits_consumidos: e.target.value })} /></div>
              <div><label className="label">Viáticos reales (Q)</label>
                <input type="number" className="input" step="0.01" min="0"
                  value={form.viaticos_real ?? ''}
                  onChange={(e) => setForm({ ...form, viaticos_real: e.target.value })} /></div>
            </div>
            {j.inaugura_clinica && (
              <label className="flex items-center gap-2 text-sm mt-1">
                <input type="checkbox" checked={!!form.confirmar_amarre_clinica}
                  onChange={(e) => setForm({ ...form, confirmar_amarre_clinica: e.target.checked })} />
                Confirmar amarre de clínica permanente en esta empresa
              </label>
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
                <select className="input" value={c.responsable_personal_id}
                  onChange={(e) => setCharlasEdit((arr) => arr.map((x, ix) => ix === i ? { ...x, responsable_personal_id: e.target.value } : x))}>
                  <option value="">— Responsable —</option>
                  {roster.filter((p) => !j.seccion_responsable || p.seccion === j.seccion_responsable)
                    .map((p) => <option key={p.id} value={p.id}>{p.nombre_completo}</option>)}
                </select>
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
          {puedeEditar && canWrite && (
            <div className="flex gap-2">
              <button className="btn-danger" onClick={() => { setForm({}); setMode('cancel'); }}>Cancelar</button>
              <button className="btn-primary" onClick={() => { setForm({}); setMode('close'); }}>Cerrar con métricas</button>
            </div>
          )}
        </div>
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
