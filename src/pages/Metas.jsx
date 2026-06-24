import { useEffect, useState } from 'react';
import { apiListMetas, apiCreateMeta, apiMetasPorEmpresa, apiGetConfig, apiSetMetaAfiliados } from '../api/endpoints';
import { useAuth } from '../hooks/useAuth';
import { fmtN, fmtPct, fmtQ, SEMAFORO_DOT } from '../utils/format';
import Modal from '../components/forms/Modal';
import Field from '../components/forms/Field';
import StatCard from '../components/cards/StatCard';
import MiniChartCard from '../components/cards/MiniChartCard';
import EmptyState from '../components/feedback/EmptyState';

// Tipos de meta (con rename: "Clínicas amarradas" → "Clínica + Jornada")
const TIPOS = [
  ['PERSONAS_TAMIZADAS', 'Personas tamizadas'],
  ['AFILIADOS_ATENDIDOS', 'Afiliados atendidos'],
  ['PACIENTES_ATENDIDOS', 'Pacientes atendidos'],
  ['JORNADAS_EJECUTADAS', 'Jornadas ejecutadas'],
  ['CLINICAS_AMARRADAS', 'Clínica + Jornada'],
  ['AFILIADOS_ATENDIDOS_PCT', '% Afiliados atendidos'],
];

const TIPO_LABEL_MAP = Object.fromEntries(TIPOS);

// Años con datos epi (mismo set que Hallazgos). Default = año más reciente
// con datos (2026), NO el getFullYear() del sistema.
const ANIOS = [2026, 2025];
const ANIO_DEFAULT = ANIOS[0];

function Pill({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition border ${
        active ? 'bg-igss-primary text-white border-igss-primary'
               : 'bg-surface text-fg-muted border-line hover:text-fg'
      }`}>
      {children}
    </button>
  );
}

export default function Metas() {
  const { user, canWrite } = useAuth();
  // Crear/editar metas institucionales = gerencia/admin (estratégico). El resto
  // (sipresalud/ce) VE sus metas y el progreso, pero no las modifica. Espeja require_gerencia_write.
  const canCreateMeta = canWrite && (user.rol === 'admin' || user.rol === 'gerencia');
  const [list, setList] = useState([]);
  const [empresas, setEmpresas] = useState(null);
  const [creating, setCreating] = useState(false);
  const [seccionEmp, setSeccionEmp] = useState('');
  const [year, setYear] = useState(ANIO_DEFAULT);
  // Módulo admin: meta mensual de afiliados SIPRESALUD (editable, default 5000).
  const [metaAfi, setMetaAfi] = useState(null);
  const [metaAfiDraft, setMetaAfiDraft] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);

  useEffect(() => {
    apiGetConfig().then((d) => {
      setMetaAfi(d.meta_afiliados_mensual);
      setMetaAfiDraft(String(d.meta_afiliados_mensual ?? ''));
    }).catch(() => {});
  }, []);

  async function saveMetaAfi() {
    const v = Number(metaAfiDraft);
    if (!v || v <= 0) { alert('Ingresá un valor válido (> 0)'); return; }
    setSavingMeta(true);
    try {
      const d = await apiSetMetaAfiliados(v);
      setMetaAfi(d.meta_afiliados_mensual);
    } catch (e) {
      alert(e.response?.data?.detail || 'No se pudo guardar la meta');
    } finally { setSavingMeta(false); }
  }

  function reload() {
    apiListMetas({ anio: year }).then(setList);
    apiMetasPorEmpresa({ anio: year, ...(seccionEmp ? { seccion: seccionEmp } : {}) })
      .then(setEmpresas)
      .catch(() => setEmpresas({ empresas: [], promedio_general: {} }));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [seccionEmp, year]);

  const pg = empresas?.promedio_general || {};

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-fg">Metas {year}</h1>
          <p className="text-xs text-fg-muted">Cumplimiento institucional y por empresa</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {ANIOS.map((a) => (
              <Pill key={a} active={year === a} onClick={() => setYear(a)}>{a}</Pill>
            ))}
          </div>
          {canCreateMeta && (
            <button className="btn-primary" onClick={() => setCreating(true)}>+ Nueva meta</button>
          )}
        </div>
      </div>

      {/* Módulo admin: meta mensual de afiliados (SIPRESALUD) editable */}
      <div className="rounded-2xl border border-line bg-surface-elev p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px]">
          <div className="text-sm font-semibold text-fg">Meta mensual de afiliados (SIPRESALUD)</div>
          <div className="text-xs text-fg-muted">
            Es la meta del dashboard. Afiliados = atendidos que son cotizantes IGSS
            (puede ser menor que el total de pacientes atendidos).
          </div>
        </div>
        {canCreateMeta ? (
          <div className="flex items-center gap-2">
            <input type="number" min="1" className="input w-32" value={metaAfiDraft}
              onChange={(e) => setMetaAfiDraft(e.target.value)} />
            <button className="btn-primary" onClick={saveMetaAfi}
              disabled={savingMeta || String(metaAfi) === metaAfiDraft}>
              {savingMeta ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        ) : (
          <div className="text-2xl font-extrabold tabular-nums text-accent">{fmtN(metaAfi ?? 0)}</div>
        )}
      </div>

      {/* KPIs agregados — promedio general */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="EMPRESAS ACTIVAS"
          value={pg.n_empresas || 0}
          tone="primary"
          subLabel={`${pg.n_jornadas || 0} jornadas totales`}
        />
        <StatCard
          label="ATENDIDOS EN EL AÑO"
          value={pg.atendidos || 0}
          tone="accent-2"
          subLabel={`${fmtN(pg.programados)} programados`}
        />
        <StatCard
          label="% ASISTENCIA GLOBAL"
          value={pg.pct_asistencia || 0}
          format="percent"
          decimals={1}
          tone="accent-3"
          viz="donut"
          vizData={{ value: pg.pct_asistencia || 0, size: 64, thickness: 8 }}
        />
        <StatCard
          label="PROMEDIO POR JORNADA"
          value={pg.promedio_por_jornada || 0}
          decimals={0}
          tone="primary"
          subLabel={`${fmtN(pg.promedio_atendidos_por_empresa)} por empresa`}
        />
      </div>

      {/* Tabla principal de metas */}
      <MiniChartCard title={`Metas institucionales ${year}`} subtitle="% logrado en tiempo real">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-elev text-xs uppercase text-fg-muted">
              <tr>
                <th className="text-left p-2">Período</th>
                <th className="text-left p-2">Sección</th>
                <th className="text-left p-2">Tipo</th>
                <th className="text-right p-2">Meta</th>
                <th className="text-right p-2">Logrado</th>
                <th className="text-right p-2">%</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && (
                <tr><td colSpan="6" className="text-center py-4">
                  <EmptyState title="Sin metas configuradas" hint="Crea la primera meta del año arriba" />
                </td></tr>
              )}
              {list.map((m) => {
                // A5: el backend devuelve valor_logrado=null cuando NO hubo base
                // en el período (cero operativo / cero personas epi). 0 real
                // (hubo base pero logro 0) se pinta como 0% rojo, NO gris.
                const sinData = m.valor_logrado == null;   // sin base en el período
                const logrado = m.valor_logrado ?? 0;
                const pctRaw = m.valor_meta ? (100 * logrado / m.valor_meta) : 0;
                // % logrado capeado a 100% (no se muestra >100 en la columna).
                const pct = Math.min(100, pctRaw);
                const cumplida = pctRaw >= 100;
                // 0% real (hubo base, logro 0) → rojo, NO gris. <80% pero >0 →
                // naranja (warning). El branch "sin data" se evalúa antes.
                const color = pct >= 90 ? 'verde' : pct >= 80 ? 'amarillo' : pct > 0 ? 'naranja' : 'rojo';
                const MES_NOM = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
                const periodoTxt = m.mes ? `${MES_NOM[m.mes]} ${m.anio}` : `Anual ${m.anio}`;
                const esAnual = !m.mes;
                return (
                  <tr key={m.id} className="border-t border-line-subtle">
                    <td className="p-2">
                      <span className={esAnual ? 'inline-flex items-center gap-1.5 font-semibold text-fg' : 'text-fg-muted'}>
                        {esAnual && <span className="px-1.5 py-0.5 rounded text-[9px] uppercase bg-accent-soft text-accent font-bold">Anual</span>}
                        {periodoTxt}
                      </span>
                    </td>
                    <td className="p-2">{m.seccion === 'GLOBAL' ? <span className="text-fg-muted text-xs">Toda la institución</span> : m.seccion}</td>
                    <td className="p-2">{TIPO_LABEL_MAP[m.tipo_meta] || m.tipo_meta}</td>
                    <td className="p-2 text-right font-mono tabular-nums">{fmtN(m.valor_meta)}</td>
                    <td className="p-2 text-right font-mono tabular-nums">{fmtN(m.valor_logrado)}</td>
                    <td className="p-2 text-right">
                      {sinData ? (
                        <span className="inline-flex items-center gap-1.5 justify-end text-fg-subtle">
                          <span className="w-2 h-2 rounded-full bg-neutral" />
                          <span className="text-xs">sin data</span>
                        </span>
                      ) : cumplida ? (
                        <span className="inline-flex items-center gap-1.5 justify-end">
                          <span className="badge-success text-[10px]">cumplida</span>
                          <span className="font-semibold text-success">100%</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 justify-end">
                          <span className={`w-2 h-2 rounded-full ${SEMAFORO_DOT[color]}`}/>
                          {fmtPct(pct)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </MiniChartCard>

      {/* Tabla promedios por empresa */}
      <MiniChartCard
        title="Promedio por empresa"
        subtitle={`Año ${year} · % asistencia por empresa, ordenado por atendidos`}
        actions={
          <select
            value={seccionEmp}
            onChange={(e) => setSeccionEmp(e.target.value)}
            className="text-xs rounded-md border border-line bg-surface text-fg px-2 py-1"
          >
            <option value="">Todas</option>
            <option value="CE">CE</option>
            <option value="SIPRESALUD">SIPRESALUD</option>
          </select>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-elev text-xs uppercase text-fg-muted">
              <tr>
                <th className="text-left p-2">Empresa</th>
                <th className="text-right p-2">Jornadas</th>
                <th className="text-right p-2">Atendidos</th>
                <th className="text-right p-2">Promedio/jornada</th>
                <th className="text-right p-2">% Asistencia</th>
                <th className="text-left p-2">Clínica + Jornada</th>
              </tr>
            </thead>
            <tbody>
              {(empresas?.empresas || []).map((e) => (
                <tr key={e.empresa_id} className="border-t border-line-subtle">
                  <td className="p-2 font-medium text-fg">{e.nombre_legal}</td>
                  <td className="p-2 text-right tabular-nums">{e.n_jornadas}</td>
                  <td className="p-2 text-right tabular-nums font-semibold">{fmtN(e.atendidos)}</td>
                  <td className="p-2 text-right tabular-nums">{fmtN(e.promedio_por_jornada)}</td>
                  <td className="p-2 text-right">
                    <span className="inline-flex items-center gap-1.5 justify-end">
                      <span className={`w-2 h-2 rounded-full ${SEMAFORO_DOT[e.semaforo]}`} />
                      {fmtPct(e.pct_asistencia)}
                    </span>
                  </td>
                  <td className="p-2">
                    {e.tiene_clinica_amarrada
                      ? <span className="badge-success">✓ {e.fecha_amarre || 'activa'}</span>
                      : <span className="text-fg-subtle">—</span>}
                  </td>
                </tr>
              ))}
              {empresas && empresas.empresas?.length === 0 && (
                <tr><td colSpan="6" className="text-center py-3 text-fg-muted">
                  Sin empresas con jornadas este año
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </MiniChartCard>

      {creating && <MetaForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); }} />}
    </div>
  );
}

function MetaForm({ onClose, onSaved }) {
  // A6: PERSONAS_TAMIZADAS solo tiene sentido GLOBAL (epi no tiene sección).
  // El default es PERSONAS_TAMIZADAS, así que la sección arranca en GLOBAL.
  const [form, setForm] = useState({
    anio: ANIO_DEFAULT, mes: '', seccion: 'GLOBAL',
    tipo_meta: 'PERSONAS_TAMIZADAS', valor_meta: 5000, notas: '',
  });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setForm((f) => {
    const val = e?.target ? e.target.value : e;
    const next = { ...f, [k]: val };
    // A6: al cambiar a PERSONAS_TAMIZADAS, forzar sección GLOBAL (el backend
    // rechaza con 400 cualquier otra sección para este tipo).
    if (k === 'tipo_meta' && val === 'PERSONAS_TAMIZADAS') {
      next.seccion = 'GLOBAL';
    }
    return next;
  });
  const seccionForzadaGlobal = form.tipo_meta === 'PERSONAS_TAMIZADAS';

  async function submit(e) {
    e.preventDefault(); setErr('');
    try {
      await apiCreateMeta({
        ...form,
        // A6: defensa en profundidad — PERSONAS_TAMIZADAS siempre GLOBAL.
        seccion: form.tipo_meta === 'PERSONAS_TAMIZADAS' ? 'GLOBAL' : form.seccion,
        mes: form.mes === '' ? null : Number(form.mes),
        valor_meta: Number(form.valor_meta),
      });
      onSaved();
    } catch (e) { setErr(e.response?.data?.detail || 'Error'); }
  }

  return (
    <Modal
      open onClose={onClose}
      title="Nueva meta" size="md"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="meta-form" className="btn-primary">Crear</button>
        </>
      }
    >
      <form id="meta-form" onSubmit={submit} className="grid grid-cols-2 gap-3">
        <Field label="Año" type="number" name="anio" value={form.anio} onChange={set('anio')} />
        <Field label="Mes (vacío = anual)" type="select" name="mes" value={form.mes} onChange={set('mes')}
               options={[['', 'Anual'], ...Array.from({length:12},(_,i)=>[String(i+1), String(i+1)])]} />
        <Field label="Sección" type="select" name="seccion"
               value={seccionForzadaGlobal ? 'GLOBAL' : form.seccion}
               onChange={set('seccion')}
               disabled={seccionForzadaGlobal}
               hint={seccionForzadaGlobal ? 'Personas tamizadas es siempre GLOBAL' : undefined}
               options={[['GLOBAL','GLOBAL'],['CE','CE'],['SIPRESALUD','SIPRESALUD']]} />
        <Field label="Tipo" type="select" name="tipo_meta" value={form.tipo_meta} onChange={set('tipo_meta')}
               options={TIPOS} />
        <Field className="col-span-2" label="Valor meta" type="number" step="0.01"
               value={form.valor_meta} onChange={set('valor_meta')} required />
        <Field className="col-span-2" label="Notas" type="textarea" rows={2}
               value={form.notas} onChange={set('notas')} />
        {err && <div className="col-span-2 bg-danger-soft text-danger text-sm p-2 rounded">{err}</div>}
      </form>
    </Modal>
  );
}
