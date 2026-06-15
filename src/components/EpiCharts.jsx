import {
  BarChart, Bar, Line, ComposedChart, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
  PieChart, Pie,
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

// Mapa grupo clínico → token de color (consistente en todas las vistas)
const GRUPO_COLOR = (t) => ({
  'Lípidos': t.accent.tertiary,
  'Glucemia': t.status.warning,
  'Presión arterial': t.status.danger,
  'Hepático': t.accent.secondary,
  'Renal': t.accent.primary,
  'Ácido úrico': t.status.info,
  'Hematología': t.status.neutral,
});

// Algunos endpoints/params del contrato (patologia_id en piramide/tendencia,
// prevalencia-grupo, distribucion-hallazgos) los agrega el stream de backend.
// Si todavía no existen devuelven 404/422: tratamos cualquier error !=403 como
// "estado vacío elegante" en vez de romper la página.
const softErr = (err) => (err && err !== '403' ? err : null);

// Tooltip rico reutilizable: muestra casos + denominador + tasa juntos.
function PrevTooltip({ active, payload }) {
  const t = useThemedColors();
  if (!active || !payload || !payload.length) return null;
  const p = payload[0]?.payload || {};
  return (
    <div style={{
      background: t.bg.surface, border: `1px solid ${t.border.default}`,
      borderRadius: 8, padding: '8px 12px', color: t.text.primary, fontSize: 12,
      boxShadow: '0 8px 20px -8px rgba(0,0,0,0.25)', backdropFilter: 'blur(8px)',
      minWidth: 150,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{p._full || p.nombre}</div>
      <Line2 t={t} label="Prevalencia" value={p.tasa != null ? `${p.tasa}%` : '—'} strong color={p.color} />
      <Line2 t={t} label="Casos" value={fmtN(p.casos ?? 0)} />
      <Line2 t={t} label="Tamizados" value={fmtN(p.tamizados ?? p._den ?? 0)} />
      {p.inestable && (
        <div style={{ fontSize: 10, fontStyle: 'italic', color: t.text.muted, marginTop: 2 }}>
          n&lt;30 · tasa inestable
        </div>
      )}
    </div>
  );
}
function Line2({ t, label, value, strong, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 2 }}>
      <span style={{ color: t.text.secondary }}>{label}:</span>
      <span style={{
        fontWeight: strong ? 700 : 600, fontVariantNumeric: 'tabular-nums',
        color: strong && color ? color : t.text.primary,
      }}>{value}</span>
    </div>
  );
}

// ── Prevalencia por patología (barra ranked, clic → drill-down) ─────────
export function PrevalenciaPatologiaChart({ params = {}, selectedPatologia, onPickPatologia }) {
  const { data, err, loading } = useEpi('prevalencia-patologia', params);
  const t = useThemedColors();
  const ct = useChartTheme();
  if (err === '403') return null;
  const COL = GRUPO_COLOR(t);
  const items = data?.items || [];
  const fmt = items.map((d) => ({
    nombre: d.patologia.length > 26 ? d.patologia.slice(0, 24) + '…' : d.patologia,
    _full: d.patologia,
    patologia_id: d.patologia_id,
    tasa: d.tasa_por_100, casos: d.casos, tamizados: d.tamizados, grupo: d.grupo,
    color: COL[d.grupo] || t.accent.tertiary,
  }));
  const hasId = fmt.some((d) => d.patologia_id != null);
  return (
    <MiniChartCard
      title="Prevalencia por patología"
      subtitle={`Tasa por 100 tamizados · n=${fmtN(data?.tamizados || 0)}${hasId ? ' · clic para filtrar' : ''}`}
      className="h-full"
      loading={loading}
      error={softErr(err)}
      empty={!loading && fmt.length === 0}
    >
      {fmt.length > 0 && (
        <ResponsiveContainer>
          <BarChart data={fmt} layout="vertical" margin={{ left: 20, right: 36 }}>
            <CartesianGrid {...ct.gridProps} horizontal={false} vertical />
            <XAxis type="number" {...ct.axisProps} tickFormatter={(v) => `${v}%`} />
            <YAxis dataKey="nombre" type="category" width={150} {...ct.axisProps}
                   tick={{ ...ct.axisProps.tick, fontSize: 10 }} />
            <Tooltip cursor={{ fill: t.bg.sunken, opacity: 0.4 }} content={<PrevTooltip />} />
            <Bar dataKey="tasa" name="Tasa %" radius={[0, 4, 4, 0]}
                 onClick={(e) => hasId && onPickPatologia && e?.patologia_id != null &&
                   onPickPatologia(
                     selectedPatologia === e.patologia_id ? null : e.patologia_id,
                     e._full,
                   )}
                 cursor={hasId ? 'pointer' : 'default'} isAnimationActive>
              {fmt.map((e, i) => {
                const dim = selectedPatologia != null && selectedPatologia !== e.patologia_id;
                return <Cell key={i} fill={e.color} fillOpacity={dim ? 0.35 : 1} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </MiniChartCard>
  );
}

// ── Prevalencia por GRUPO clínico (donut) ───────────────────────────────
export function PrevalenciaGrupoChart({ params = {} }) {
  const { data, err, loading } = useEpi('prevalencia-grupo', params);
  const t = useThemedColors();
  if (err === '403') return null;
  const COL = GRUPO_COLOR(t);
  const items = (data?.items || []).map((d) => ({
    nombre: d.grupo, casos: d.casos, tasa: d.tasa_por_100,
    tamizados: data?.tamizados, color: COL[d.grupo] || t.accent.tertiary,
  }));
  const total = items.reduce((s, d) => s + (d.casos || 0), 0);
  return (
    <MiniChartCard
      title="Prevalencia por grupo clínico"
      subtitle="Personas con ≥1 hallazgo en el grupo · tasa por 100"
      className="h-full"
      loading={loading}
      error={softErr(err)}
      empty={!loading && items.length === 0}
    >
      {items.length > 0 && (
        <div className="flex h-full items-center gap-3">
          <div className="flex-1 min-w-0 h-full">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={items} dataKey="casos" nameKey="nombre"
                     innerRadius="55%" outerRadius="82%" paddingAngle={2}
                     stroke={t.bg.surface} strokeWidth={2}>
                  {items.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip content={<PrevTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Leyenda con tasa */}
          <div className="flex flex-col gap-1.5 pr-1 max-w-[46%]">
            {items.map((e) => (
              <div key={e.nombre} className="flex items-center gap-2 text-[11px]">
                <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: e.color }} />
                <span className="text-fg-muted truncate flex-1">{e.nombre}</span>
                <span className="font-semibold text-fg tabular-nums">{e.tasa != null ? `${e.tasa}%` : '—'}</span>
              </div>
            ))}
            <div className="text-[10px] text-fg-subtle pt-1 mt-0.5 border-t border-line-subtle">
              {fmtN(total)} hallazgos por grupo
            </div>
          </div>
        </div>
      )}
    </MiniChartCard>
  );
}

// ── Distribución de comorbilidad (0/1/2/3+ hallazgos) ───────────────────
export function DistribucionHallazgosChart({ params = {} }) {
  const { data, err, loading } = useEpi('distribucion-hallazgos', params);
  const t = useThemedColors();
  const ct = useChartTheme();
  if (err === '403') return null;
  const PAL = [t.status.success, t.status.warning, t.status.warning, t.status.danger];
  const items = (data?.items || []).map((d, i) => ({
    bucket: d.bucket, personas: d.personas, pct: d.pct,
    color: PAL[Math.min(i, PAL.length - 1)],
    _label: d.bucket === '0' ? 'Sin hallazgos' : `${d.bucket} hallazgo${d.bucket === '1' ? '' : 's'}`,
  }));
  return (
    <MiniChartCard
      title="Carga de comorbilidad"
      subtitle="Distribución de personas por número de hallazgos"
      className="h-full"
      loading={loading}
      error={softErr(err)}
      empty={!loading && items.length === 0}
    >
      {items.length > 0 && (
        <ResponsiveContainer>
          <BarChart data={items} margin={{ top: 16, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid {...ct.gridProps} />
            <XAxis dataKey="bucket" {...ct.axisProps} />
            <YAxis {...ct.axisProps} tickFormatter={(v) => fmtN(v)} />
            <Tooltip cursor={{ fill: t.bg.sunken, opacity: 0.4 }}
                     content={<ThemedTooltip
                       labelFormatter={(l) => items.find((x) => x.bucket === l)?._label || l}
                       formatter={(v, n, e) => `${fmtN(v)} (${e?.payload?.pct ?? 0}%)`} />} />
            <Bar dataKey="personas" name="Personas" radius={[4, 4, 0, 0]} isAnimationActive>
              {items.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </MiniChartCard>
  );
}

// ── Pirámide poblacional (clic en grupo etario → drill-down) ────────────
export function PiramidePoblacionalChart({ params = {}, selectedGrupo, onPickGrupo }) {
  const { data, err, loading } = useEpi('piramide', params);
  const t = useThemedColors();
  const ct = useChartTheme();
  if (err === '403') return null;
  const fmt = (data?.items || []).map((d) => ({
    grupo: d.grupo_etario, Hombres: d.M, Mujeres: -d.F, _f: d.F, _m: d.M,
  }));
  const tot = fmt.reduce((s, d) => s + d._m + d._f, 0);
  return (
    <MiniChartCard
      title="Pirámide de tamizados"
      subtitle={`Personas por sexo y grupo etario${onPickGrupo ? ' · clic para filtrar' : ''}`}
      className="h-full"
      loading={loading}
      error={softErr(err)}
      empty={!loading && fmt.length === 0}
    >
      {fmt.length > 0 && (
        <ResponsiveContainer>
          <BarChart data={fmt} layout="vertical" stackOffset="sign"
                    margin={{ left: 8, right: 16 }}>
            <CartesianGrid {...ct.gridProps} horizontal={false} vertical />
            <XAxis type="number" {...ct.axisProps} tickFormatter={(v) => fmtN(Math.abs(v))} />
            <YAxis dataKey="grupo" type="category" {...ct.axisProps} width={48}
                   onClick={(e) => onPickGrupo && e?.value != null &&
                     onPickGrupo(selectedGrupo === e.value ? null : e.value)}
                   cursor={onPickGrupo ? 'pointer' : 'default'} />
            <Tooltip cursor={{ fill: t.bg.sunken, opacity: 0.4 }}
                     content={<ThemedTooltip formatter={(v) => fmtN(Math.abs(v))} />} />
            <Legend {...ct.legendProps} />
            <Bar dataKey="Mujeres" name="Mujeres" stackId="p" radius={[4, 0, 0, 4]}
                 onClick={(e) => onPickGrupo && e?.grupo != null &&
                   onPickGrupo(selectedGrupo === e.grupo ? null : e.grupo)}
                 cursor={onPickGrupo ? 'pointer' : 'default'}>
              {fmt.map((e, i) => (
                <Cell key={i} fill={t.accent.secondary}
                      fillOpacity={selectedGrupo && selectedGrupo !== e.grupo ? 0.35 : 1} />
              ))}
            </Bar>
            <Bar dataKey="Hombres" name="Hombres" stackId="p" radius={[0, 4, 4, 0]}
                 onClick={(e) => onPickGrupo && e?.grupo != null &&
                   onPickGrupo(selectedGrupo === e.grupo ? null : e.grupo)}
                 cursor={onPickGrupo ? 'pointer' : 'default'}>
              {fmt.map((e, i) => (
                <Cell key={i} fill={t.accent.tertiary}
                      fillOpacity={selectedGrupo && selectedGrupo !== e.grupo ? 0.35 : 1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </MiniChartCard>
  );
}

// ── Prevalencia por dimensión (gremio | departamento) barras ────────────
export function PrevalenciaPorChart({ dimension, titulo, params = {}, limit = 25 }) {
  const { data, err, loading } = useEpi(`prevalencia-por/${dimension}`, { ...params, limit });
  const t = useThemedColors();
  const ct = useChartTheme();
  if (err === '403') return null;
  const fmt = (data?.items || []).map((d) => ({
    nombre: d.grupo.length > 22 ? d.grupo.slice(0, 20) + '…' : d.grupo,
    _full: d.grupo,
    tasa: d.tasa_por_100, casos: d.casos, tamizados: d.tamizados, inestable: d.inestable,
    color: d.inestable ? t.status.neutral : t.accent.secondary,
  }));
  return (
    <MiniChartCard
      title={titulo}
      subtitle="Tasa de hallazgo por 100 · gris = n<30 (inestable)"
      className="h-full"
      loading={loading}
      error={softErr(err)}
      empty={!loading && fmt.length === 0}
    >
      {fmt.length > 0 && (
        <ResponsiveContainer>
          <BarChart data={fmt} layout="vertical" margin={{ left: 20, right: 36 }}>
            <CartesianGrid {...ct.gridProps} horizontal={false} vertical />
            <XAxis type="number" {...ct.axisProps} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
            <YAxis dataKey="nombre" type="category" width={150} {...ct.axisProps}
                   tick={{ ...ct.axisProps.tick, fontSize: 10 }} />
            <Tooltip cursor={{ fill: t.bg.sunken, opacity: 0.4 }} content={<PrevTooltip />} />
            <Bar dataKey="tasa" name="Tasa %" radius={[0, 4, 4, 0]} isAnimationActive>
              {fmt.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </MiniChartCard>
  );
}

// ── Tabla de empresas (n + tasa% + badge inestable) ─────────────────────
export function EmpresasTabla({ params = {}, limit = 40 }) {
  const { data, err, loading } = useEpi('prevalencia-por/empresa', { ...params, limit });
  const t = useThemedColors();
  if (err === '403') return null;
  const items = data?.items || [];
  const maxTasa = Math.max(1, ...items.map((d) => d.tasa_por_100 || 0));
  return (
    <MiniChartCard
      title="Prevalencia por empresa"
      subtitle={`Top ${limit} por tasa de hallazgo · badge = muestra inestable (n<30)`}
      loading={loading}
      error={softErr(err)}
      empty={!loading && items.length === 0}
    >
      {items.length > 0 && (
        <div className="overflow-auto max-h-[420px] -mx-1">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-surface z-10">
              <tr className="text-[10px] uppercase tracking-wider text-fg-muted">
                <th className="text-left font-semibold py-2 px-2">Empresa</th>
                <th className="text-right font-semibold py-2 px-2">Tamizados</th>
                <th className="text-right font-semibold py-2 px-2">Casos</th>
                <th className="text-right font-semibold py-2 px-2 w-[34%]">Tasa</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d, i) => {
                const tasa = d.tasa_por_100 ?? 0;
                const col = d.inestable ? t.status.neutral
                  : tasa > 25 ? t.status.danger : tasa > 10 ? t.status.warning : t.accent.secondary;
                return (
                  <tr key={i} className="border-t border-line-subtle hover:bg-surface-elev transition">
                    <td className="py-2 px-2 text-fg max-w-[220px]">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate" title={d.grupo}>{d.grupo}</span>
                        {d.inestable && (
                          <span className="flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-neutral-soft text-fg-muted font-semibold">
                            n&lt;30
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-fg-muted">{fmtN(d.tamizados)}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-fg-muted">{fmtN(d.casos)}</td>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2 justify-end">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden max-w-[110px]"
                             style={{ background: t.bg.sunken }}>
                          <div className="h-full rounded-full transition-all duration-700"
                               style={{ width: `${(tasa / maxTasa) * 100}%`, background: col }} />
                        </div>
                        <span className="tabular-nums font-semibold w-12 text-right" style={{ color: col }}>
                          {tasa}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </MiniChartCard>
  );
}

// ── Tendencia mensual (tamizados + tasa de prevalencia) ─────────────────
export function TendenciaEpiChart({ params = {} }) {
  const { data, err, loading } = useEpi('tendencia', params);
  const t = useThemedColors();
  const ct = useChartTheme();
  if (err === '403') return null;
  const serie = (data?.serie || []).map((d) => ({
    ...d,
    _label: d.bucket,
  }));
  return (
    <MiniChartCard
      title="Tendencia mensual"
      subtitle="Tamizados (barras) y % con ≥1 hallazgo (línea)"
      height={300}
      loading={loading}
      error={softErr(err)}
      empty={!loading && serie.length === 0}
    >
      {serie.length > 0 && (
        <ResponsiveContainer>
          <ComposedChart data={serie} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <defs>
              <linearGradient id="epiTendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={t.accent.tertiary} stopOpacity={0.95} />
                <stop offset="100%" stopColor={t.accent.tertiary} stopOpacity={0.55} />
              </linearGradient>
            </defs>
            <CartesianGrid {...ct.gridProps} />
            <XAxis dataKey="bucket" {...ct.axisProps} tick={{ ...ct.axisProps.tick, fontSize: 10 }} />
            <YAxis yAxisId="l" {...ct.axisProps} tickFormatter={(v) => fmtN(v)} />
            <YAxis yAxisId="r" orientation="right" {...ct.axisProps}
                   tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
            <Tooltip cursor={{ fill: t.bg.sunken, opacity: 0.4 }}
                     content={<ThemedTooltip formatter={(v, n) => n?.includes('%') ? `${v}%` : fmtN(v)} />} />
            <Legend {...ct.legendProps} />
            <Bar yAxisId="l" dataKey="tamizados" name="Tamizados"
                 fill="url(#epiTendGrad)" radius={[3, 3, 0, 0]} />
            <Line yAxisId="r" type="monotone" dataKey="tasa_prevalencia" name="% con hallazgo"
                  stroke={t.status.danger} strokeWidth={2.5}
                  dot={{ r: 2.5, fill: t.status.danger }} activeDot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </MiniChartCard>
  );
}
