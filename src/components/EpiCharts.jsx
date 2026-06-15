import {
  BarChart, Bar, Line, ComposedChart, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import { useApi } from '../hooks/useApi';
import { useThemedColors } from '../theme/useThemedColors';
import { useChartTheme } from './charts/useChartTheme';
import ThemedTooltip from './charts/ThemedTooltip';
import MiniChartCard from './cards/MiniChartCard';
import { fmtN } from '../utils/format';

function useEpi(path, params = {}) {
  const r = useApi(`/api/epi/${path}`, params);
  return { data: r.data, err: r.error, loading: r.loading };
}

const GRUPO_COLOR = (t) => ({
  'Lípidos': t.accent.tertiary,
  'Glucemia': t.status.warning,
  'Presión arterial': t.status.danger,
  'Hepático': t.accent.secondary,
  'Renal': t.accent.primary,
  'Ácido úrico': t.status.info,
  'Hematología': t.status.neutral,
});

// ── Prevalencia por patología (barra ranked horizontal, tasa por-100) ──
export function PrevalenciaPatologiaChart({ params = {} }) {
  const { data, err, loading } = useEpi('prevalencia-patologia', params);
  const t = useThemedColors();
  const ct = useChartTheme();
  if (err === '403') return null;
  const COL = GRUPO_COLOR(t);
  const fmt = (data?.items || []).map((d) => ({
    nombre: d.patologia.length > 26 ? d.patologia.slice(0, 24) + '…' : d.patologia,
    tasa: d.tasa_por_100, casos: d.casos, grupo: d.grupo,
    color: COL[d.grupo] || t.accent.tertiary,
  }));
  return (
    <MiniChartCard
      title="Prevalencia por patología"
      subtitle={`Tasa por 100 tamizados · n=${fmtN(data?.tamizados || 0)}`}
      className="h-full"
      loading={loading}
      error={err && err !== '403' ? err : null}
      empty={!loading && fmt.length === 0}
    >
      {fmt.length > 0 && (
        <ResponsiveContainer>
          <BarChart data={fmt} layout="vertical" margin={{ left: 20, right: 32 }}>
            <CartesianGrid {...ct.gridProps} horizontal={false} vertical />
            <XAxis type="number" {...ct.axisProps} tickFormatter={(v) => `${v}%`} />
            <YAxis dataKey="nombre" type="category" width={150} {...ct.axisProps}
                   tick={{ ...ct.axisProps.tick, fontSize: 10 }} />
            <Tooltip content={<ThemedTooltip formatter={(v, n) => n === 'tasa' ? `${v}%` : fmtN(v)} />} />
            <Bar dataKey="tasa" name="Tasa %" radius={[0, 4, 4, 0]}>
              {fmt.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </MiniChartCard>
  );
}

// ── Pirámide poblacional (M derecha / F izquierda) ──────────────────
export function PiramidePoblacionalChart({ params = {} }) {
  const { data, err, loading } = useEpi('piramide', params);
  const t = useThemedColors();
  const ct = useChartTheme();
  if (err === '403') return null;
  const fmt = (data?.items || []).map((d) => ({
    grupo: d.grupo_etario, Hombres: d.M, Mujeres: -d.F, _f: d.F,
  }));
  return (
    <MiniChartCard
      title="Pirámide de tamizados"
      subtitle="Personas por sexo y grupo etario"
      className="h-full"
      loading={loading}
      error={err && err !== '403' ? err : null}
      empty={!loading && fmt.length === 0}
    >
      {fmt.length > 0 && (
        <ResponsiveContainer>
          <BarChart data={fmt} layout="vertical" stackOffset="sign"
                    margin={{ left: 8, right: 16 }}>
            <CartesianGrid {...ct.gridProps} horizontal={false} vertical />
            <XAxis type="number" {...ct.axisProps} tickFormatter={(v) => fmtN(Math.abs(v))} />
            <YAxis dataKey="grupo" type="category" {...ct.axisProps} width={48} />
            <Tooltip content={<ThemedTooltip formatter={(v) => fmtN(Math.abs(v))} />} />
            <Legend {...ct.legendProps} />
            <Bar dataKey="Mujeres" name="Mujeres" stackId="p" fill={t.accent.secondary} radius={[4, 0, 0, 4]} />
            <Bar dataKey="Hombres" name="Hombres" stackId="p" fill={t.accent.tertiary} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </MiniChartCard>
  );
}

// ── Prevalencia por dimensión (gremio | departamento | empresa) ─────
export function PrevalenciaPorChart({ dimension, titulo, params = {}, limit = 12 }) {
  const { data, err, loading } = useEpi(`prevalencia-por/${dimension}`, { ...params, limit });
  const t = useThemedColors();
  const ct = useChartTheme();
  if (err === '403') return null;
  const fmt = (data?.items || []).map((d) => ({
    nombre: d.grupo.length > 22 ? d.grupo.slice(0, 20) + '…' : d.grupo,
    tasa: d.tasa_por_100, tamizados: d.tamizados, inestable: d.inestable,
  }));
  return (
    <MiniChartCard
      title={titulo}
      subtitle="Tasa de hallazgo por 100 · gris = n<30 (inestable)"
      className="h-full"
      loading={loading}
      error={err && err !== '403' ? err : null}
      empty={!loading && fmt.length === 0}
    >
      {fmt.length > 0 && (
        <ResponsiveContainer>
          <BarChart data={fmt} layout="vertical" margin={{ left: 20, right: 32 }}>
            <CartesianGrid {...ct.gridProps} horizontal={false} vertical />
            <XAxis type="number" {...ct.axisProps} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
            <YAxis dataKey="nombre" type="category" width={150} {...ct.axisProps}
                   tick={{ ...ct.axisProps.tick, fontSize: 10 }} />
            <Tooltip content={<ThemedTooltip formatter={(v, n) => n === 'tasa' ? `${v}%` : fmtN(v)} />} />
            <Bar dataKey="tasa" name="Tasa %" radius={[0, 4, 4, 0]}>
              {fmt.map((e, i) => (
                <Cell key={i} fill={e.inestable ? t.status.neutral : t.accent.secondary} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </MiniChartCard>
  );
}

// ── Tendencia mensual (tamizados + tasa de prevalencia) ─────────────
export function TendenciaEpiChart({ params = {} }) {
  const { data, err, loading } = useEpi('tendencia', params);
  const t = useThemedColors();
  const ct = useChartTheme();
  if (err === '403') return null;
  const serie = data?.serie || [];
  return (
    <MiniChartCard
      title="Tendencia mensual"
      subtitle="Tamizados (barras) y % con ≥1 hallazgo (línea)"
      height={280}
      loading={loading}
      error={err && err !== '403' ? err : null}
      empty={!loading && serie.length === 0}
    >
      {serie.length > 0 && (
        <ResponsiveContainer>
          <ComposedChart data={serie} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid {...ct.gridProps} />
            <XAxis dataKey="bucket" {...ct.axisProps} tick={{ ...ct.axisProps.tick, fontSize: 10 }} />
            <YAxis yAxisId="l" {...ct.axisProps} />
            <YAxis yAxisId="r" orientation="right" {...ct.axisProps}
                   tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
            <Tooltip content={<ThemedTooltip formatter={(v, n) => n?.includes('%') ? `${v}%` : fmtN(v)} />} />
            <Legend {...ct.legendProps} />
            <Bar yAxisId="l" dataKey="tamizados" name="Tamizados"
                 fill={t.accent.tertiary} radius={[3, 3, 0, 0]} />
            <Line yAxisId="r" type="monotone" dataKey="tasa_prevalencia" name="% con hallazgo"
                  stroke={t.status.danger} strokeWidth={2.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </MiniChartCard>
  );
}
