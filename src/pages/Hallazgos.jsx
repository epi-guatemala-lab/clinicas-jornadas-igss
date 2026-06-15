import { useMemo, useState } from 'react';
import { useApi } from '../hooks/useApi';
import StatCard from '../components/cards/StatCard';
import {
  PrevalenciaPatologiaChart, PiramidePoblacionalChart,
  PrevalenciaPorChart, TendenciaEpiChart,
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

export default function Hallazgos() {
  const [periodo, setPeriodo] = useState('todo');
  const [sexo, setSexo] = useState('');

  const p = PERIODOS.find((x) => x.key === periodo) || PERIODOS[0];
  const params = useMemo(() => {
    const o = {};
    if (p.desde) o.desde = p.desde;
    if (p.hasta) o.hasta = p.hasta;
    if (sexo) o.sexo = sexo;
    return o;
  }, [p.desde, p.hasta, sexo]);

  const { data: resumen, loading } = useApi('/api/epi/resumen', params);

  const tamizados = resumen?.total_tamizados ?? 0;
  const pctHallazgo = resumen?.pct_con_hallazgo ?? 0;
  const hxPersona = resumen?.hallazgos_por_persona ?? 0;
  const lider = resumen?.patologia_lider;

  return (
    <div className="space-y-4">
      {/* Header + filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-fg">Hallazgos epidemiológicos</h1>
          <p className="text-xs text-fg-muted">
            Tamizaje SIPRESALUD · Clínicas de Empresa
            {resumen?.data_range && (
              <span> · datos {resumen.data_range.from} a {resumen.data_range.to}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            {PERIODOS.map((x) => (
              <Pill key={x.key} active={periodo === x.key} onClick={() => setPeriodo(x.key)}>
                {x.label}
              </Pill>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {SEXOS.map((x) => (
              <Pill key={x.key} active={sexo === x.key} onClick={() => setSexo(x.key)}>
                {x.label}
              </Pill>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Personas tamizadas" value={tamizados} tone="primary"
                  subLabel={loading ? 'cargando…' : 'identificadas únicas'} />
        <StatCard label="% con ≥1 hallazgo" value={pctHallazgo} format="percent" decimals={1}
                  tone="warning" viz="donut"
                  vizData={{ value: pctHallazgo, max: 100, centerLabel: `${pctHallazgo}%` }}
                  subLabel="prevalencia global" />
        <StatCard label="Hallazgos por persona" value={hxPersona} decimals={2} tone="accent-2"
                  subLabel="promedio entre tamizados" />
        <StatCard label="Patología líder" value={lider?.tasa ?? 0} format="percent" decimals={1}
                  tone="danger" subLabel={lider?.nombre || '—'} />
      </div>

      {/* Fila 1: prevalencia patología + pirámide */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3" style={{ minHeight: 360 }}>
        <PrevalenciaPatologiaChart params={params} />
        <PiramidePoblacionalChart params={params} />
      </div>

      {/* Fila 2: por gremio + por departamento */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3" style={{ minHeight: 380 }}>
        <PrevalenciaPorChart dimension="gremio" titulo="Prevalencia por gremio" params={params} />
        <PrevalenciaPorChart dimension="departamento" titulo="Prevalencia por departamento" params={params} />
      </div>

      {/* Fila 3: tendencia */}
      <TendenciaEpiChart params={params} />
    </div>
  );
}
