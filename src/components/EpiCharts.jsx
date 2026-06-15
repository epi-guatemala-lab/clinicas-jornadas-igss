import {
  BarChart, Bar, Line, ComposedChart, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, ErrorBar,
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

// Algunos endpoints/params del contrato (co-ocurrencia, heatmap, prevalencia-sexo,
// ci_low/ci_high, tasa_ajustada, M_tasa/F_tasa en pirámide) los agrega el stream
// de backend (be-epi-analitica). Mientras no existan devuelven 404/422: tratamos
// cualquier error !=403 como "estado vacío elegante" en vez de romper la página.
const softErr = (err) => (err && err !== '403' ? err : null);

// Para las VISTAS NUEVAS del contrato (heatmap, co-ocurrencia, prevalencia-sexo):
// si el endpoint todavía no está desplegado (404/422) o no responde, no mostramos
// un banner rojo de error — lo tratamos como "vista no disponible" → estado vacío
// elegante. Solo errores 5xx del servidor se muestran como error real.
const NOT_DEPLOYED = new Set(['403', '404', '422', '405']);
const softErrNew = (err) => {
  if (!err) return null;
  if (NOT_DEPLOYED.has(err)) return null;                 // endpoint no desplegado aún
  if (!/^\d{3}$/.test(err)) return null;                  // network error / sin status → vacío
  if (err.startsWith('5')) return err;                    // 5xx = error real del servidor
  return null;
};
// ¿el error indica simplemente que la vista nueva aún no existe? (para texto del vacío)
const isNotDeployed = (err) => !!err && (NOT_DEPLOYED.has(err) || !/^5\d{2}$/.test(err));

// Formatea una tasa con su IC95% Wilson: "12.3% (11.1–13.6)".
// Si no hay IC (backend viejo) cae a "12.3%".
function fmtTasaIC(tasa, lo, hi) {
  if (tasa == null) return '—';
  if (lo == null || hi == null) return `${tasa}%`;
  return `${tasa}% (${lo}–${hi})`;
}

// ── Tooltip rico de prevalencia: casos + denominador + tasa + IC95% ─────
// Reemplaza el flag binario 'n<30 inestable' por el ANCHO del IC95% Wilson,
// que comunica la incertidumbre real de forma continua.
function PrevTooltip({ active, payload }) {
  const t = useThemedColors();
  if (!active || !payload || !payload.length) return null;
  const p = payload[0]?.payload || {};
  const hasIC = p.ci_low != null && p.ci_high != null;
  return (
    <div style={{
      background: t.bg.surface, border: `1px solid ${t.border.default}`,
      borderRadius: 8, padding: '8px 12px', color: t.text.primary, fontSize: 12,
      boxShadow: '0 8px 20px -8px rgba(0,0,0,0.25)', backdropFilter: 'blur(8px)',
      minWidth: 168,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{p._full || p.nombre}</div>
      <Line2 t={t} label="Prevalencia" value={p.tasa != null ? `${p.tasa}%` : '—'} strong color={p.color} />
      {hasIC && (
        <Line2 t={t} label="IC95%" value={`${p.ci_low} – ${p.ci_high}`} />
      )}
      {p.tasa_ajustada != null && (
        <Line2 t={t} label="Ajustada" value={`${p.tasa_ajustada}%`} />
      )}
      <Line2 t={t} label="Casos" value={fmtN(p.casos ?? 0)} />
      <Line2 t={t} label="Tamizados" value={fmtN(p.tamizados ?? p._den ?? 0)} />
      {!hasIC && p.inestable && (
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

// Botón-toggle reutilizable (estilo FilterChip) para acciones del header.
function ToggleAction({ active, onClick, children, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition border ${
        active
          ? 'bg-accent-soft text-accent border-accent/40'
          : 'bg-surface text-fg-muted border-line hover:text-fg hover:border-line-strong'
      }`}
    >
      {children}
    </button>
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
    ci_low: d.ci_low, ci_high: d.ci_high,
    // ErrorBar de Recharts espera [errLow, errHigh] como distancia desde el valor.
    _err: (d.ci_low != null && d.ci_high != null)
      ? [Math.max(0, d.tasa_por_100 - d.ci_low), Math.max(0, d.ci_high - d.tasa_por_100)]
      : null,
    color: COL[d.grupo] || t.accent.tertiary,
  }));
  const hasId = fmt.some((d) => d.patologia_id != null);
  const hasIC = fmt.some((d) => d._err != null);
  return (
    <MiniChartCard
      title="Prevalencia por patología"
      subtitle={`Tasa por 100 · IC95% Wilson${hasId ? ' · clic para filtrar' : ''} · n=${fmtN(data?.tamizados || 0)}`}
      className="h-full"
      loading={loading}
      error={softErr(err)}
      empty={!loading && fmt.length === 0}
    >
      {fmt.length > 0 && (
        <ResponsiveContainer>
          <BarChart data={fmt} layout="vertical" margin={{ left: 20, right: 40 }}>
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
              {hasIC && (
                <ErrorBar dataKey="_err" width={3} strokeWidth={1.2}
                          stroke={t.text.muted} direction="x" />
              )}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </MiniChartCard>
  );
}

// ── Prevalencia por GRUPO clínico (donut con total al centro) ───────────
export function PrevalenciaGrupoChart({ params = {} }) {
  const { data, err, loading } = useEpi('prevalencia-grupo', params);
  const t = useThemedColors();
  if (err === '403') return null;
  const COL = GRUPO_COLOR(t);
  const items = (data?.items || []).map((d) => ({
    nombre: d.grupo, casos: d.casos, tasa: d.tasa_por_100,
    ci_low: d.ci_low, ci_high: d.ci_high,
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
          {/* Donut con el total de hallazgos rotulado en el centro */}
          <div className="relative flex-1 min-w-0 h-full">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={items} dataKey="casos" nameKey="nombre"
                     innerRadius="58%" outerRadius="84%" paddingAngle={2}
                     stroke={t.bg.surface} strokeWidth={2}>
                  {items.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip content={<PrevTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-extrabold text-fg tabular-nums leading-none">{fmtN(total)}</span>
              <span className="text-[10px] text-fg-muted mt-0.5">hallazgos</span>
            </div>
          </div>
          {/* Leyenda con tasa + IC95% */}
          <div className="flex flex-col gap-1.5 pr-1 max-w-[48%]">
            {items.map((e) => (
              <div key={e.nombre} className="flex items-center gap-2 text-[11px]">
                <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: e.color }} />
                <span className="text-fg-muted truncate flex-1" title={e.nombre}>{e.nombre}</span>
                <span className="font-semibold text-fg tabular-nums">{e.tasa != null ? `${e.tasa}%` : '—'}</span>
              </div>
            ))}
            <div className="text-[10px] text-fg-subtle pt-1 mt-0.5 border-t border-line-subtle">
              tasa por 100 tamizados
            </div>
          </div>
        </div>
      )}
    </MiniChartCard>
  );
}

// ── Distribución de comorbilidad (0/1/2/3+ hallazgos) ───────────────────
// Rampa de 4 colores DISTINTOS que ESCALA en severidad (verde → ámbar →
// naranja → rojo): cada nivel de carga lee distinto y más severo (antes 1 y 2
// compartían 'warning'). Rampa fija para garantizar el orden visual creciente
// independiente de los tokens del theme.
export function DistribucionHallazgosChart({ params = {} }) {
  const { data, err, loading } = useEpi('distribucion-hallazgos', params);
  const t = useThemedColors();
  const ct = useChartTheme();
  if (err === '403') return null;
  const PAL = ['#22C55E', '#FACC15', '#F97316', '#DC2626']; // verde→amarillo→naranja→rojo
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

// ── Pirámide poblacional ────────────────────────────────────────────────
// Sin patología: conteo de tamizados por sexo/grupo (comportamiento histórico).
// Con patología (es_prevalencia=true): PREVALENCIA por-100 dentro del estrato
// (M_tasa/F_tasa), eje en %, rotulado. k-anon respetado por el backend.
// A9 fix: el onClick vive SOLO en las barras (se quitó el del YAxis duplicado).
export function PiramidePoblacionalChart({ params = {}, selectedGrupo, onPickGrupo }) {
  const { data, err, loading } = useEpi('piramide', params);
  const t = useThemedColors();
  const ct = useChartTheme();
  if (err === '403') return null;
  // Modo prevalencia cuando el backend marca es_prevalencia (patología seleccionada).
  const esPrev = data?.es_prevalencia === true;
  const fmt = (data?.items || []).map((d) => {
    if (esPrev) {
      return {
        grupo: d.grupo_etario,
        Hombres: d.M_tasa ?? 0, Mujeres: d.M_tasa != null || d.F_tasa != null ? -(d.F_tasa ?? 0) : 0,
        _f: d.F_tasa, _m: d.M_tasa, _prev: true,
      };
    }
    return { grupo: d.grupo_etario, Hombres: d.M, Mujeres: -d.F, _f: d.F, _m: d.M, _prev: false };
  });
  const handlePick = (g) => onPickGrupo && g != null &&
    onPickGrupo(selectedGrupo === g ? null : g);
  const axisFmt = esPrev ? (v) => `${Math.abs(v)}%` : (v) => fmtN(Math.abs(v));
  const tipFmt = esPrev ? (v) => `${Math.abs(v)}%` : (v) => fmtN(Math.abs(v));
  return (
    <MiniChartCard
      title={esPrev ? 'Pirámide de prevalencia' : 'Pirámide de tamizados'}
      subtitle={
        esPrev
          ? `Prevalencia por-100 dentro de cada estrato${onPickGrupo ? ' · clic para filtrar' : ''}`
          : `Personas por sexo y grupo etario${onPickGrupo ? ' · clic para filtrar' : ''}`
      }
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
            <XAxis type="number" {...ct.axisProps} tickFormatter={axisFmt} />
            <YAxis dataKey="grupo" type="category" {...ct.axisProps} width={48} />
            <Tooltip cursor={{ fill: t.bg.sunken, opacity: 0.4 }}
                     content={<ThemedTooltip formatter={tipFmt} />} />
            <Legend {...ct.legendProps} />
            <Bar dataKey="Mujeres" name="Mujeres" stackId="p" radius={[4, 0, 0, 4]}
                 onClick={(e) => handlePick(e?.grupo)}
                 cursor={onPickGrupo ? 'pointer' : 'default'}>
              {fmt.map((e, i) => (
                <Cell key={i} fill={t.accent.secondary}
                      fillOpacity={selectedGrupo && selectedGrupo !== e.grupo ? 0.35 : 1} />
              ))}
            </Bar>
            <Bar dataKey="Hombres" name="Hombres" stackId="p" radius={[0, 4, 4, 0]}
                 onClick={(e) => handlePick(e?.grupo)}
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
// Toggle CRUDA ↔ AJUSTADA (estandarización directa por edad-sexo). Cuando hay
// ajuste, la barra usa tasa_ajustada y el tooltip muestra ambas + IC95%.
// El IC95% sustituye el rótulo binario 'n<30' (ancho del IC = incertidumbre).
export function PrevalenciaPorChart({ dimension, titulo, params = {}, limit = 25, ajustada, onToggleAjustada }) {
  const { data, err, loading } = useEpi(`prevalencia-por/${dimension}`, { ...params, limit });
  const t = useThemedColors();
  const ct = useChartTheme();
  if (err === '403') return null;
  const items = data?.items || [];
  const hasAdj = items.some((d) => d.tasa_ajustada_por_100 != null);
  const usaAjuste = ajustada && hasAdj;
  const fmt = items.map((d) => {
    const tasaPlot = usaAjuste ? d.tasa_ajustada_por_100 : d.tasa_por_100;
    return {
      nombre: d.grupo.length > 22 ? d.grupo.slice(0, 20) + '…' : d.grupo,
      _full: d.grupo,
      tasa: d.tasa_por_100, tasa_plot: tasaPlot, tasa_ajustada: d.tasa_ajustada_por_100,
      ci_low: d.ci_low, ci_high: d.ci_high,
      _err: (!usaAjuste && d.ci_low != null && d.ci_high != null)
        ? [Math.max(0, d.tasa_por_100 - d.ci_low), Math.max(0, d.ci_high - d.tasa_por_100)]
        : null,
      casos: d.casos, tamizados: d.tamizados, inestable: d.inestable,
      color: d.inestable ? t.status.neutral : (usaAjuste ? t.accent.tertiary : t.accent.secondary),
    };
  });
  // Re-ordenar localmente si estamos en modo ajustada (el backend ordena por ajustada
  // desc, pero re-ordenamos por seguridad cuando el toggle cambia el eje graficado).
  if (usaAjuste) fmt.sort((a, b) => (b.tasa_plot || 0) - (a.tasa_plot || 0));
  const hasIC = fmt.some((d) => d._err != null);
  return (
    <MiniChartCard
      title={titulo}
      subtitle={usaAjuste
        ? 'Tasa AJUSTADA por edad-sexo (estandarización directa)'
        : 'Tasa CRUDA por 100 · IC95% Wilson · gris = n<30'}
      className="h-full"
      loading={loading}
      error={softErr(err)}
      empty={!loading && fmt.length === 0}
      actions={onToggleAjustada && hasAdj && (
        <div className="flex items-center gap-1">
          <ToggleAction active={!ajustada} onClick={() => onToggleAjustada(false)} title="Tasa cruda observada">
            Cruda
          </ToggleAction>
          <ToggleAction active={ajustada} onClick={() => onToggleAjustada(true)} title="Estandarizada por edad-sexo">
            Ajustada
          </ToggleAction>
        </div>
      )}
    >
      {fmt.length > 0 && (
        <ResponsiveContainer>
          <BarChart data={fmt} layout="vertical" margin={{ left: 20, right: 40 }}>
            <CartesianGrid {...ct.gridProps} horizontal={false} vertical />
            <XAxis type="number" {...ct.axisProps} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
            <YAxis dataKey="nombre" type="category" width={150} {...ct.axisProps}
                   tick={{ ...ct.axisProps.tick, fontSize: 10 }} />
            <Tooltip cursor={{ fill: t.bg.sunken, opacity: 0.4 }} content={<PrevTooltip />} />
            <Bar dataKey="tasa_plot" name={usaAjuste ? 'Tasa ajustada %' : 'Tasa %'}
                 radius={[0, 4, 4, 0]} isAnimationActive>
              {fmt.map((e, i) => <Cell key={i} fill={e.color} />)}
              {hasIC && (
                <ErrorBar dataKey="_err" width={3} strokeWidth={1.2}
                          stroke={t.text.muted} direction="x" />
              )}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </MiniChartCard>
  );
}

// ── Tabla de empresas (n + tasa% + IC95%) ───────────────────────────────
export function EmpresasTabla({ params = {}, limit = 40 }) {
  const { data, err, loading } = useEpi('prevalencia-por/empresa', { ...params, limit });
  const t = useThemedColors();
  if (err === '403') return null;
  const items = data?.items || [];
  const maxTasa = Math.max(1, ...items.map((d) => d.tasa_por_100 || 0));
  const anyIC = items.some((d) => d.ci_low != null && d.ci_high != null);
  return (
    <MiniChartCard
      title="Prevalencia por empresa"
      subtitle={anyIC
        ? `Top ${limit} por tasa de hallazgo · IC95% Wilson`
        : `Top ${limit} por tasa de hallazgo · badge = muestra inestable (n<30)`}
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
                <th className="text-right font-semibold py-2 px-2 w-[34%]">Tasa (IC95%)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d, i) => {
                const tasa = d.tasa_por_100 ?? 0;
                const col = d.inestable ? t.status.neutral
                  : tasa > 25 ? t.status.danger : tasa > 10 ? t.status.warning : t.accent.secondary;
                const hasIC = d.ci_low != null && d.ci_high != null;
                return (
                  <tr key={i} className="border-t border-line-subtle hover:bg-surface-elev transition">
                    <td className="py-2 px-2 text-fg max-w-[220px]">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate" title={d.grupo}>{d.grupo}</span>
                        {!hasIC && d.inestable && (
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
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden max-w-[90px]"
                             style={{ background: t.bg.sunken }}>
                          <div className="h-full rounded-full transition-all duration-700"
                               style={{ width: `${(tasa / maxTasa) * 100}%`, background: col }} />
                        </div>
                        <span className="tabular-nums font-semibold text-right" style={{ color: col }}>
                          {tasa}%
                        </span>
                        {hasIC && (
                          <span className="tabular-nums text-[10px] text-fg-subtle w-[72px] text-right">
                            {d.ci_low}–{d.ci_high}
                          </span>
                        )}
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

// ════════════════════════════════════════════════════════════════════════
//  VISTAS NUEVAS (consumen endpoints del contrato be-epi-analitica)
// ════════════════════════════════════════════════════════════════════════

const GRUPOS_ETARIOS = ['≤19', '20-29', '30-39', '40-49', '50-59', '≥60'];

// Rampa secuencial para el heatmap (clara → intensa). Resuelta sobre los
// tokens del theme para respetar dark-mode visualmente.
function heatColor(tasa, maxTasa, t) {
  if (tasa == null) return t.bg.sunken;            // suprimido / sin dato
  const f = maxTasa > 0 ? Math.min(1, tasa / maxTasa) : 0;
  // interpolación lineal entre warningSoft (claro) y danger (intenso)
  const a = hexToRgb(t.status.warningSoft);
  const b = hexToRgb(t.status.danger);
  if (!a || !b) return t.accent.secondary;
  const mix = (i) => Math.round(a[i] + (b[i] - a[i]) * f);
  return `rgb(${mix(0)}, ${mix(1)}, ${mix(2)})`;
}
function hexToRgb(hex) {
  if (typeof hex !== 'string') return null;
  const m = hex.replace('#', '');
  if (m.length !== 6) return null;
  const n = parseInt(m, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ── Heatmap patología × grupo etario ────────────────────────────────────
// Matriz: filas = patologías, columnas = grupo etario. Celda = tasa por-100
// (personas con la patología en ese grupo / tamizados del grupo). k-anon: el
// backend devuelve tasa=null donde n_estrato<5 → se pinta '—'.
export function HeatmapPatologiaEdad({ params = {} }) {
  const { data, err, loading } = useEpi('heatmap', params);
  const t = useThemedColors();
  if (err === '403') return null;
  const grupos = data?.grupos || GRUPOS_ETARIOS;
  const patologias = data?.patologias || [];
  const celdas = data?.celdas || [];
  // index { `${pid}|${grupo}` : celda }
  const idx = {};
  let maxTasa = 0;
  for (const cel of celdas) {
    idx[`${cel.patologia_id}|${cel.grupo_etario}`] = cel;
    if (cel.tasa_por_100 != null) maxTasa = Math.max(maxTasa, cel.tasa_por_100);
  }
  return (
    <MiniChartCard
      title="Mapa de calor patología × edad"
      subtitle="Prevalencia por-100 dentro de cada grupo etario · '—' = celda suprimida (privacidad)"
      loading={loading}
      error={softErrNew(err)}
      empty={!loading && patologias.length === 0}
      emptyTitle={isNotDeployed(err) ? 'Vista no disponible' : 'Sin datos para este período'}
      emptyHint={isNotDeployed(err) ? 'El mapa de calor se habilitará cuando el servidor lo soporte.' : undefined}
    >
      {patologias.length > 0 && (
        <div className="overflow-auto -mx-1 max-h-[460px]">
          <table className="w-full border-collapse text-[11px]">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr>
                <th className="text-left font-semibold text-fg-muted py-1.5 px-2 sticky left-0 bg-surface">
                  Patología
                </th>
                {grupos.map((g) => (
                  <th key={g} className="font-semibold text-fg-muted py-1.5 px-1 text-center min-w-[52px]">
                    {g}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {patologias.map((p) => (
                <tr key={p.id} className="border-t border-line-subtle">
                  <td className="py-1 px-2 text-fg max-w-[160px] truncate sticky left-0 bg-surface"
                      title={p.nombre}>
                    {p.nombre}
                  </td>
                  {grupos.map((g) => {
                    const cel = idx[`${p.id}|${g}`];
                    const tasa = cel?.tasa_por_100 ?? null;
                    const bg = heatColor(tasa, maxTasa, t);
                    const dark = tasa != null && maxTasa > 0 && tasa / maxTasa > 0.55;
                    return (
                      <td key={g} className="p-0.5">
                        <div
                          className="rounded-md h-7 flex items-center justify-center font-semibold tabular-nums transition"
                          style={{
                            background: bg,
                            color: tasa == null ? t.text.muted : (dark ? '#fff' : t.text.primary),
                          }}
                          title={cel
                            ? `${p.nombre} · ${g}\n${tasa == null ? 'Suprimido (n<5)' : tasa + '%'}` +
                              `${cel.casos != null ? ' · ' + fmtN(cel.casos) + ' casos' : ''}` +
                              `${cel.n_estrato != null ? ' · n=' + fmtN(cel.n_estrato) : ''}`
                            : `${p.nombre} · ${g}`}
                        >
                          {tasa == null ? '—' : `${tasa}`}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {/* Leyenda de la rampa */}
          <div className="flex items-center gap-2 pt-2 mt-1 text-[10px] text-fg-muted">
            <span>Menor</span>
            <span className="flex-1 h-2 rounded-full max-w-[160px]"
                  style={{ background: `linear-gradient(90deg, ${t.status.warningSoft}, ${t.status.danger})` }} />
            <span>Mayor</span>
            <span className="ml-2">· valores = tasa por 100</span>
          </div>
        </div>
      )}
    </MiniChartCard>
  );
}

// ── Co-ocurrencia de patologías (top pares en la misma persona) ─────────
export function CoOcurrenciaChart({ params = {}, top = 12 }) {
  const { data, err, loading } = useEpi('co-ocurrencia', { ...params, top });
  const t = useThemedColors();
  const ct = useChartTheme();
  if (err === '403') return null;
  const items = (data?.items || []).map((d) => ({
    par: `${shorten(d.a)} + ${shorten(d.b)}`,
    _full: `${d.a} + ${d.b}`,
    a: d.a, b: d.b,
    ambos: d.ambos, tasa: d.tasa_conjunta_por_100,
  }));
  return (
    <MiniChartCard
      title="Co-ocurrencia de patologías"
      subtitle={`Top ${top} pares en una misma persona · tasa conjunta por 100 · n=${fmtN(data?.tamizados || 0)}`}
      className="h-full"
      loading={loading}
      error={softErrNew(err)}
      empty={!loading && items.length === 0}
      emptyTitle={isNotDeployed(err) ? 'Vista no disponible' : 'Datos insuficientes'}
      emptyHint={isNotDeployed(err)
        ? 'La co-ocurrencia se habilitará cuando el servidor lo soporte.'
        : 'Datos insuficientes — privacidad (k-anonimato)'}
    >
      {items.length > 0 && (
        <ResponsiveContainer>
          <BarChart data={items} layout="vertical" margin={{ left: 20, right: 44 }}>
            <CartesianGrid {...ct.gridProps} horizontal={false} vertical />
            <XAxis type="number" {...ct.axisProps} tickFormatter={(v) => `${v}%`} />
            <YAxis dataKey="par" type="category" width={210} {...ct.axisProps}
                   tick={{ ...ct.axisProps.tick, fontSize: 10 }} />
            <Tooltip cursor={{ fill: t.bg.sunken, opacity: 0.4 }}
                     content={<CoocTooltip />} />
            <Bar dataKey="tasa" name="Tasa conjunta %" radius={[0, 4, 4, 0]}
                 fill={t.accent.primary} isAnimationActive>
              {items.map((e, i) => (
                <Cell key={i} fill={i === 0 ? t.accent.primary : t.accent.secondary} fillOpacity={1 - i * 0.045} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </MiniChartCard>
  );
}
function shorten(s) {
  if (!s) return '';
  return s.length > 18 ? s.slice(0, 16) + '…' : s;
}
function CoocTooltip({ active, payload }) {
  const t = useThemedColors();
  if (!active || !payload || !payload.length) return null;
  const p = payload[0]?.payload || {};
  return (
    <div style={{
      background: t.bg.surface, border: `1px solid ${t.border.default}`,
      borderRadius: 8, padding: '8px 12px', color: t.text.primary, fontSize: 12,
      boxShadow: '0 8px 20px -8px rgba(0,0,0,0.25)', backdropFilter: 'blur(8px)', minWidth: 180,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{p._full}</div>
      <Line2 t={t} label="Tasa conjunta" value={p.tasa != null ? `${p.tasa}%` : '—'} strong color={t.accent.primary} />
      <Line2 t={t} label="Personas con ambas" value={fmtN(p.ambos ?? 0)} />
    </div>
  );
}

// ── Comparación M vs F por patología (barras agrupadas + ratio) ─────────
// Top 10 patologías por prevalencia combinada (el backend ya ordena desc) para
// que las barras pareadas y sus etiquetas no se solapen. Hombres = azul,
// Mujeres = rosa (contraste M/F nítido en dark-mode).
export function ComparacionSexoChart({ params = {}, top = 10 }) {
  const { data, err, loading } = useEpi('prevalencia-sexo', params);
  const t = useThemedColors();
  const ct = useChartTheme();
  if (err === '403') return null;
  const items = (data?.items || []).slice(0, top).map((d) => ({
    nombre: d.patologia.length > 22 ? d.patologia.slice(0, 20) + '…' : d.patologia,
    _full: d.patologia,
    Hombres: d.tasa_m, Mujeres: d.tasa_f,
    n_m: d.n_m, n_f: d.n_f, ratio: d.ratio_mf,
  }));
  const colM = t.accent.tertiary;   // azul/cyan
  const colF = t.accent.primary;    // rosa coral → contraste claro vs azul
  return (
    <MiniChartCard
      title="Comparación por sexo"
      subtitle={`Prevalencia por-100 · hombres vs mujeres · ratio M/F · top ${top}`}
      className="h-full"
      loading={loading}
      error={softErrNew(err)}
      empty={!loading && items.length === 0}
      emptyTitle={isNotDeployed(err) ? 'Vista no disponible' : 'Sin datos para este período'}
      emptyHint={isNotDeployed(err) ? 'La comparación por sexo se habilitará cuando el servidor lo soporte.' : undefined}
    >
      {items.length > 0 && (
        <ResponsiveContainer>
          <BarChart data={items} layout="vertical" barCategoryGap="22%" barGap={2}
                    margin={{ left: 20, right: 16, top: 4 }}>
            <CartesianGrid {...ct.gridProps} horizontal={false} vertical />
            <XAxis type="number" {...ct.axisProps} tickFormatter={(v) => `${v}%`} />
            <YAxis dataKey="nombre" type="category" width={150} interval={0} {...ct.axisProps}
                   tick={{ ...ct.axisProps.tick, fontSize: 10 }} />
            <Tooltip cursor={{ fill: t.bg.sunken, opacity: 0.4 }} content={<SexoTooltip />} />
            <Legend {...ct.legendProps} />
            <Bar dataKey="Hombres" name="Hombres" fill={colM} radius={[0, 3, 3, 0]} />
            <Bar dataKey="Mujeres" name="Mujeres" fill={colF} radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </MiniChartCard>
  );
}
function SexoTooltip({ active, payload }) {
  const t = useThemedColors();
  if (!active || !payload || !payload.length) return null;
  const p = payload[0]?.payload || {};
  return (
    <div style={{
      background: t.bg.surface, border: `1px solid ${t.border.default}`,
      borderRadius: 8, padding: '8px 12px', color: t.text.primary, fontSize: 12,
      boxShadow: '0 8px 20px -8px rgba(0,0,0,0.25)', backdropFilter: 'blur(8px)', minWidth: 180,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{p._full}</div>
      <Line2 t={t} label="Hombres" value={p.Hombres != null ? `${p.Hombres}%` : '—'} strong color={t.accent.tertiary} />
      <Line2 t={t} label="Mujeres" value={p.Mujeres != null ? `${p.Mujeres}%` : '—'} strong color={t.accent.secondary} />
      <Line2 t={t} label="n (H / M)" value={`${fmtN(p.n_m ?? 0)} / ${fmtN(p.n_f ?? 0)}`} />
      <Line2 t={t} label="Ratio M/F" value={p.ratio != null ? `${p.ratio}×` : '—'} />
    </div>
  );
}
