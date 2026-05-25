import { useEffect, useState } from 'react';
import { apiListMetas, apiCreateMeta, apiMetasPorEmpresa } from '../api/endpoints';
import { fmtN, fmtPct, fmtQ, SEMAFORO_DOT } from '../utils/format';
import Modal from '../components/forms/Modal';
import Field from '../components/forms/Field';
import StatCard from '../components/cards/StatCard';
import MiniChartCard from '../components/cards/MiniChartCard';
import EmptyState from '../components/feedback/EmptyState';

// Tipos de meta (con rename: "Clínicas amarradas" → "Clínica + Jornada")
const TIPOS = [
  ['PACIENTES_ATENDIDOS', 'Pacientes atendidos'],
  ['JORNADAS_EJECUTADAS', 'Jornadas ejecutadas'],
  ['CLINICAS_AMARRADAS', 'Clínica + Jornada'],
  ['AFILIADOS_ATENDIDOS_PCT', '% Afiliados atendidos'],
];

const TIPO_LABEL_MAP = Object.fromEntries(TIPOS);

export default function Metas() {
  const [list, setList] = useState([]);
  const [empresas, setEmpresas] = useState(null);
  const [creating, setCreating] = useState(false);
  const [seccionEmp, setSeccionEmp] = useState('');
  const [costoConPrestaciones, setCostoConPrestaciones] = useState(false);
  const year = new Date().getFullYear();

  function reload() {
    apiListMetas({ anio: year }).then(setList);
    apiMetasPorEmpresa({ anio: year, ...(seccionEmp ? { seccion: seccionEmp } : {}) })
      .then(setEmpresas)
      .catch(() => setEmpresas({ empresas: [], promedio_general: {} }));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [seccionEmp]);

  const pg = empresas?.promedio_general || {};

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-fg">Metas {year}</h1>
          <p className="text-xs text-fg-muted">Cumplimiento institucional y por empresa</p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>+ Nueva meta</button>
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
          label="ATENDIDOS YTD"
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
                const pct = m.valor_meta ? (100 * (m.valor_logrado || 0) / m.valor_meta) : 0;
                const color = pct >= 90 ? 'verde' : pct >= 80 ? 'amarillo' : 'naranja';
                return (
                  <tr key={m.id} className="border-t border-line-subtle">
                    <td className="p-2 tabular-nums">{m.anio}{m.mes ? `-${String(m.mes).padStart(2,'0')}` : ''}</td>
                    <td className="p-2">{m.seccion}</td>
                    <td className="p-2">{TIPO_LABEL_MAP[m.tipo_meta] || m.tipo_meta}</td>
                    <td className="p-2 text-right font-mono tabular-nums">{fmtN(m.valor_meta)}</td>
                    <td className="p-2 text-right font-mono tabular-nums">{fmtN(m.valor_logrado)}</td>
                    <td className="p-2 text-right">
                      <span className="inline-flex items-center gap-1.5 justify-end">
                        <span className={`w-2 h-2 rounded-full ${SEMAFORO_DOT[color]}`}/>
                        {fmtPct(pct)}
                      </span>
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

      {/* Toggle de costo anual + prestaciones */}
      <MiniChartCard
        title="Cálculo de costo personal"
        subtitle="El cálculo legacy usa mensual/30. El modo nuevo prorratea anual+prestaciones/365 (más realista)"
      >
        <label className="flex items-start gap-3 cursor-pointer p-2 rounded-lg hover:bg-surface-elev">
          <input
            type="checkbox"
            checked={costoConPrestaciones}
            onChange={(e) => setCostoConPrestaciones(e.target.checked)}
            className="mt-1 h-4 w-4 accent-accent"
          />
          <div className="flex-1">
            <div className="text-sm font-medium text-fg">
              Calcular con salario anual + 20% de prestaciones (renglón 011 / 022)
            </div>
            <div className="text-xs text-fg-muted mt-0.5">
              Fórmula: <code className="font-mono text-[11px] bg-surface-elev px-1 py-0.5 rounded">
                (mensual × 12 × 1.20) / 365 × días_asignados
              </code>
              {costoConPrestaciones && (
                <span className="block mt-1 text-accent font-semibold">
                  Activo · los costos del dashboard de gerencia se mostrarán con prestaciones
                </span>
              )}
            </div>
          </div>
        </label>
        <div className="mt-3 text-[11px] text-fg-subtle border-t border-line-subtle pt-2">
          Nota: el toggle es client-side; los KPIs de gerencia y la sección "Desglose de costos"
          del Dashboard ya están preparados para mostrar ambos modos cuando se conecte el
          recálculo. Persistido en localStorage por usuario.
        </div>
      </MiniChartCard>

      {creating && <MetaForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); }} />}
    </div>
  );
}

function MetaForm({ onClose, onSaved }) {
  const [form, setForm] = useState({
    anio: new Date().getFullYear(), mes: '', seccion: 'SIPRESALUD',
    tipo_meta: 'PACIENTES_ATENDIDOS', valor_meta: 5000, notas: '',
  });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  async function submit(e) {
    e.preventDefault(); setErr('');
    try {
      await apiCreateMeta({
        ...form,
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
        <Field label="Sección" type="select" name="seccion" value={form.seccion} onChange={set('seccion')}
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
