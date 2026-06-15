import { useMemo, useState } from 'react';
import { useApi } from '../hooks/useApi';
import StatCard from '../components/cards/StatCard';
import EpiMapChart from '../components/EpiMapChart';
import {
  PrevalenciaPatologiaChart, PrevalenciaGrupoChart, DistribucionHallazgosChart,
  PiramidePoblacionalChart, PrevalenciaPorChart, EmpresasTabla, TendenciaEpiChart,
} from '../components/EpiCharts';
import { fmtN } from '../utils/format';

const PERIODOS = [
  { key: 'todo', label: 'Todo', desde: null, hasta: null },
  { key: '2026', label: '2026', desde: '2026-01-01', hasta: '2026-12-31' },
  { key: '2025', label: '2025', desde: '2025-01-01', hasta: '2025-12-31' },
];
const SEXOS = [
  { key: '', label: 'Ambos' },
  { key: 'M', label: 'Hombres' },
  { key: 'F', label: 'Mujeres' },
];

// ── Iconos inline (heroicons outline, 1 sola dependencia: SVG) ──────────
const Icon = {
  users: (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  pulse: (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h3l2.25-6 4.5 12 2.25-6h4.5" />
    </svg>
  ),
  stack: (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />
    </svg>
  ),
  fire: (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
    </svg>
  ),
};

function Pill({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition border ${
        active ? 'bg-igss-primary text-white border-igss-primary shadow-sm'
               : 'bg-surface text-fg-muted border-line hover:text-fg hover:border-line-strong'
      }`}>
      {children}
    </button>
  );
}

// Chip removible de filtro activo (drill-down)
function FilterChip({ label, value, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full text-xs font-medium
                     bg-accent-soft text-accent border border-accent/30 transition">
      <span className="opacity-70">{label}:</span>
      <span className="font-semibold capitalize">{value}</span>
      <button onClick={onRemove}
              className="ml-0.5 h-4 w-4 rounded-full flex items-center justify-center
                         hover:bg-accent/20 transition"
              aria-label={`Quitar filtro ${label}`}>
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}

export default function Hallazgos() {
  const [periodo, setPeriodo] = useState('todo');
  const [sexo, setSexo] = useState('');
  // Drill-down state
  // departamento = nombre normalizado (MAYÚSC sin tildes) → resalta el mapa y el chip.
  // departamentoRaw = nombre crudo de la BD ("Guatemala") → es lo que la API filtra
  // (el backend hace match EXACTO; enviar la versión normalizada daría 0 filas).
  const [departamento, setDepartamento] = useState(null);
  const [departamentoRaw, setDepartamentoRaw] = useState(null);
  const [patologiaId, setPatologiaId] = useState(null);
  const [patologiaNombre, setPatologiaNombre] = useState(null);
  const [grupoEtario, setGrupoEtario] = useState(null);

  const p = PERIODOS.find((x) => x.key === periodo) || PERIODOS[0];

  // Params base (período + sexo): los comparten el mapa y los charts no-drill.
  const baseParams = useMemo(() => {
    const o = {};
    if (p.desde) o.desde = p.desde;
    if (p.hasta) o.hasta = p.hasta;
    if (sexo) o.sexo = sexo;
    return o;
  }, [p.desde, p.hasta, sexo]);

  // Params completos (incluye drill-down): los consumen resumen + charts que aceptan filtros.
  // OJO: se envía departamentoRaw (valor de BD), no el normalizado del mapa.
  const params = useMemo(() => {
    const o = { ...baseParams };
    if (departamentoRaw) o.departamento = departamentoRaw;
    if (grupoEtario) o.grupo_etario = grupoEtario;
    if (patologiaId != null) o.patologia_id = patologiaId;
    return o;
  }, [baseParams, departamentoRaw, grupoEtario, patologiaId]);

  // resumen no acepta patologia_id (contrato) → params sin esa key.
  const resumenParams = useMemo(() => {
    const o = { ...baseParams };
    if (departamentoRaw) o.departamento = departamentoRaw;
    if (grupoEtario) o.grupo_etario = grupoEtario;
    return o;
  }, [baseParams, departamentoRaw, grupoEtario]);

  // El mapa siempre muestra el país COMPLETO: NO se le filtra por departamento
  // (la selección es solo un highlight). Sí respeta período/sexo/edad/patología.
  const mapParams = useMemo(() => {
    const o = { ...baseParams };
    if (grupoEtario) o.grupo_etario = grupoEtario;
    if (patologiaId != null) o.patologia_id = patologiaId;
    return o;
  }, [baseParams, grupoEtario, patologiaId]);

  const { data: resumen, loading } = useApi('/api/epi/resumen', resumenParams);

  const tamizados = resumen?.total_tamizados ?? 0;
  const pctHallazgo = resumen?.pct_con_hallazgo ?? 0;
  const hxPersona = resumen?.hallazgos_por_persona ?? 0;
  const lider = resumen?.patologia_lider;

  const hasDrill = departamento || grupoEtario || patologiaId != null;

  const pickDepto = (norm, raw) => {
    setDepartamento(norm);
    setDepartamentoRaw(raw);
  };

  const clearAll = () => {
    setDepartamento(null);
    setDepartamentoRaw(null);
    setGrupoEtario(null);
    setPatologiaId(null);
    setPatologiaNombre(null);
  };

  return (
    <div className="space-y-4">
      {/* ── Header con gradiente e identidad IGSS ────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-line shadow-sm
                      bg-gradient-to-br from-igss-primary via-accent-3 to-accent-2
                      dark:from-accent-3-dark dark:via-accent-3 dark:to-accent-2">
        <div aria-hidden className="absolute inset-0 opacity-20"
             style={{ background: 'radial-gradient(120% 120% at 100% 0%, rgba(255,255,255,.5), transparent 55%)' }} />
        <div className="relative p-5 lg:p-6 flex flex-wrap items-start justify-between gap-4">
          <div className="text-white">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-white/80">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              Vigilancia · SIPRESALUD
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold leading-tight mt-1">
              Hallazgos epidemiológicos
            </h1>
            <p className="text-sm text-white/85 mt-1 max-w-xl">
              Tamizaje de salud en Clínicas de Empresa
              {resumen?.data_range && (
                <span> · datos {resumen.data_range.from} a {resumen.data_range.to}</span>
              )}
            </p>
          </div>

          {/* Filtros período + sexo */}
          <div className="flex flex-col gap-2 items-end">
            <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur rounded-full p-1">
              {PERIODOS.map((x) => (
                <button key={x.key} onClick={() => setPeriodo(x.key)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                    periodo === x.key ? 'bg-white text-igss-primary shadow' : 'text-white/85 hover:text-white'
                  }`}>
                  {x.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur rounded-full p-1">
              {SEXOS.map((x) => (
                <button key={x.key} onClick={() => setSexo(x.key)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                    sexo === x.key ? 'bg-white text-igss-primary shadow' : 'text-white/85 hover:text-white'
                  }`}>
                  {x.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Chips de filtros activos (drill-down) ────────────────────── */}
      {hasDrill && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-fg-muted font-medium">Filtros activos:</span>
          {departamento && (
            <FilterChip label="Depto" value={(departamentoRaw || departamento).toLowerCase()}
                        onRemove={() => pickDepto(null, null)} />
          )}
          {grupoEtario && (
            <FilterChip label="Edad" value={grupoEtario}
                        onRemove={() => setGrupoEtario(null)} />
          )}
          {patologiaId != null && (
            <FilterChip label="Patología" value={patologiaNombre || `#${patologiaId}`}
                        onRemove={() => { setPatologiaId(null); setPatologiaNombre(null); }} />
          )}
          <button onClick={clearAll}
                  className="text-xs text-fg-muted hover:text-danger font-medium underline-offset-2 hover:underline transition">
            Limpiar todo
          </button>
        </div>
      )}

      {/* ── KPIs grandes ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Personas tamizadas" value={tamizados} tone="primary" icon={Icon.users}
                  subLabel={loading ? 'cargando…' : 'identificadas únicas'} />
        <StatCard label="% con ≥1 hallazgo" value={pctHallazgo} format="percent" decimals={1}
                  tone="warning" viz="donut" icon={Icon.pulse}
                  vizData={{ value: pctHallazgo, max: 100, centerLabel: `${pctHallazgo}%` }}
                  subLabel="prevalencia global" />
        <StatCard label="Hallazgos por persona" value={hxPersona} decimals={2} tone="accent-2" icon={Icon.stack}
                  subLabel="promedio entre tamizados" />
        <StatCard label="Patología líder" value={lider?.tasa ?? 0} format="percent" decimals={1}
                  tone="danger" icon={Icon.fire} subLabel={lider?.nombre || '—'} />
      </div>

      {/* ── HÉROES: Mapa + Prevalencia por patología ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3" style={{ minHeight: 460 }}>
        <div className="lg:col-span-7 min-h-[440px]">
          <EpiMapChart params={mapParams} selected={departamento}
                       onPick={pickDepto} />
        </div>
        <div className="lg:col-span-5 min-h-[440px]">
          <PrevalenciaPatologiaChart params={params}
            selectedPatologia={patologiaId}
            onPickPatologia={(id, nombre) => { setPatologiaId(id); setPatologiaNombre(id == null ? null : nombre); }} />
        </div>
      </div>

      {/* ── Fila: Pirámide + Grupo clínico + Comorbilidad ────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3" style={{ minHeight: 360 }}>
        <PiramidePoblacionalChart params={params}
          selectedGrupo={grupoEtario}
          onPickGrupo={(g) => setGrupoEtario(g)} />
        <PrevalenciaGrupoChart params={params} />
        <DistribucionHallazgosChart params={params} />
      </div>

      {/* ── Fila: Gremio + Departamento (barras) ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3" style={{ minHeight: 400 }}>
        <PrevalenciaPorChart dimension="gremio" titulo="Prevalencia por gremio" params={params} limit={25} />
        <PrevalenciaPorChart dimension="departamento" titulo="Prevalencia por departamento" params={params} limit={25} />
      </div>

      {/* ── Fila: Empresas (tabla) + Tendencia ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        <EmpresasTabla params={params} limit={40} />
        <TendenciaEpiChart params={params} />
      </div>

      {/* ── Nota de privacidad k-anon ────────────────────────────────── */}
      <p className="text-[11px] text-fg-subtle text-center pt-1 pb-2">
        Datos agregados. El DPI nunca se expone; las celdas con menos de 5 personas se
        suprimen (k-anonimato) y las tasas con denominador &lt;30 se marcan como inestables.
      </p>
    </div>
  );
}
