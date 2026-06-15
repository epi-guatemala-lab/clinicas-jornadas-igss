import { useEffect, useMemo, useRef, useState } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import { useApi } from '../hooks/useApi';
import { useThemedColors } from '../theme/useThemedColors';
import MiniChartCard from './cards/MiniChartCard';
import { fmtN } from '../utils/format';
import { normDepto, choroScale, loadDeptosGeoJSON } from '../utils/geo';

// viewBox fijo con la proporción de Guatemala (bbox ~4.02° x 4.08°).
const VBW = 1000;
const VBH = 1015;

/**
 * Mapa coroplético de Guatemala por tasa de prevalencia (% con hallazgo).
 *
 * - GeoJSON: public/geo/gt_departamentos.geojson (22 deptos, properties.nombre_normalizado).
 * - Datos:   /api/epi/prevalencia-por/departamento?limit=25 (tasa_por_100 por depto).
 * - Join:    normDepto(api.grupo) === feature.properties.nombre_normalizado.
 * - Click en un depto → onPick(nombreNormalizado, nombreDB) para filtrar la página.
 *   `nombreNormalizado` (MAYÚSC sin tildes) sirve para resaltar el feature;
 *   `nombreDB` es el valor crudo de la BD que la API espera en ?departamento.
 *
 * Renderizado como SVG puro (geoMercator().fitSize + geoPath) para tener control
 * total sobre hover/click/leyenda y respetar dark-mode con los tokens del theme.
 */
export default function EpiMapChart({ params = {}, selected, onPick, ajustada = false }) {
  const { data, err, loading } = useApi('/api/epi/prevalencia-por/departamento', { ...params, limit: 25 });
  const t = useThemedColors();

  const [geo, setGeo] = useState(null);
  const [geoErr, setGeoErr] = useState(null);
  const [hover, setHover] = useState(null); // { name, tasa, tamizados, x, y }
  const wrapRef = useRef(null);

  // Cargar GeoJSON una vez
  useEffect(() => {
    let alive = true;
    loadDeptosGeoJSON()
      .then((gj) => { if (alive) setGeo(gj); })
      .catch((e) => { if (alive) setGeoErr(e.message || 'No se pudo cargar el mapa'); });
    return () => { alive = false; };
  }, []);

  // ¿el backend devolvió tasa ajustada? (toggle solo aplica si hay dato)
  const hasAdj = useMemo(
    () => (data?.items || []).some((it) => it.tasa_ajustada_por_100 != null),
    [data],
  );
  const usaAjuste = ajustada && hasAdj;

  // Mapa nombre_normalizado → {tasa, tamizados, casos, raw, ...}
  // `raw` = nombre tal cual en la BD ("Guatemala", "Petén"), necesario para
  // filtrar la API: el backend hace match EXACTO sobre departamento, así que
  // enviar la versión normalizada (MAYÚSC sin tildes) devolvería 0 filas.
  // `tasa` es la que COLOREA el mapa: cruda u ajustada según el toggle.
  const byDepto = useMemo(() => {
    const m = {};
    for (const it of data?.items || []) {
      const tasaCol = usaAjuste && it.tasa_ajustada_por_100 != null
        ? it.tasa_ajustada_por_100 : it.tasa_por_100;
      m[normDepto(it.grupo)] = {
        tasa: tasaCol,
        tasa_cruda: it.tasa_por_100,
        tasa_ajustada: it.tasa_ajustada_por_100,
        ci_low: it.ci_low,
        ci_high: it.ci_high,
        tamizados: it.tamizados,
        casos: it.casos,
        inestable: it.inestable,
        raw: it.grupo,
      };
    }
    return m;
  }, [data, usaAjuste]);

  // Proyección + path generador con viewBox FIJO (Guatemala ~ 1000×1015) +
  // preserveAspectRatio: el SVG escala con CSS, así el mapa nunca depende de
  // medir el contenedor en píxeles (evita el race que lo achicaba).
  const { path, features } = useMemo(() => {
    if (!geo) return { path: null, features: [] };
    const proj = geoMercator().fitSize([VBW, VBH], geo);
    return { path: geoPath(proj), features: geo.features || [] };
  }, [geo]);

  const isError = err && err !== '403';
  // Escala por cuantiles adaptada al rango real de las tasas con dato.
  const scale = useMemo(
    () => choroScale(Object.values(byDepto).map((d) => d.tasa), t),
    [byDepto, t],
  );
  const legend = scale.legend;

  return (
    <MiniChartCard
      title="Mapa de prevalencia por departamento"
      subtitle={usaAjuste
        ? 'Tasa AJUSTADA por edad-sexo · clic en un departamento para filtrar'
        : 'Tasa de tamizados con ≥1 hallazgo · clic en un departamento para filtrar'}
      className="h-full"
      loading={loading && !geo}
      error={isError ? err : (geoErr || null)}
    >
      <div ref={wrapRef} className="relative w-full h-full flex flex-col min-h-0">
        {/* Mapa — altura fija y SVG con aspect-ratio bloqueado */}
        <div className="relative flex-1 min-h-0" style={{ minHeight: 380 }}>
          {path && features.length > 0 ? (
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${VBW} ${VBH}`}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label="Mapa coroplético de Guatemala por prevalencia"
              style={{ display: 'block' }}
              onMouseLeave={() => setHover(null)}
            >
              {features.map((f, i) => {
                const name = f.properties?.nombre_normalizado;
                const rec = byDepto[name];
                const tasa = rec ? rec.tasa : null;
                const fill = scale.colorFor(tasa);
                const isSel = selected && normDepto(selected) === name;
                const d = path(f);
                if (!d) return null;
                return (
                  <path
                    key={name || i}
                    d={d}
                    fill={fill}
                    stroke={isSel ? t.accent.primary : t.bg.surface}
                    strokeWidth={isSel ? 2.4 : 0.8}
                    style={{
                      // A3: solo es clickeable si el depto tiene datos.
                      cursor: rec ? 'pointer' : 'default',
                      transition: 'fill 200ms ease, opacity 150ms ease, stroke 150ms ease',
                      opacity: hover && hover.name !== name ? 0.78 : 1,
                      filter: isSel ? `drop-shadow(0 0 6px ${t.accent.primary}aa)` : 'none',
                    }}
                    onMouseMove={(ev) => {
                      const box = wrapRef.current?.getBoundingClientRect();
                      setHover({
                        name,
                        tasa,
                        tasa_cruda: rec?.tasa_cruda,
                        tasa_ajustada: rec?.tasa_ajustada,
                        ci_low: rec?.ci_low,
                        ci_high: rec?.ci_high,
                        tamizados: rec?.tamizados,
                        casos: rec?.casos,
                        inestable: rec?.inestable,
                        x: ev.clientX - (box?.left || 0),
                        y: ev.clientY - (box?.top || 0),
                      });
                    }}
                    onClick={() => {
                      // A3: no crear "chip fantasma" en deptos sin datos.
                      if (!onPick || !rec) return;
                      isSel ? onPick(null, null) : onPick(name, rec.raw);
                    }}
                  />
                );
              })}
            </svg>
          ) : (
            <div className="flex items-center justify-center h-full text-fg-muted text-sm">
              {geoErr ? 'No se pudo cargar el mapa' : 'Cargando mapa…'}
            </div>
          )}

          {/* Tooltip flotante */}
          {hover && (
            <div
              className="pointer-events-none absolute z-10 rounded-lg border border-line bg-surface/95 backdrop-blur px-3 py-2 shadow-lg"
              style={{
                left: Math.min(hover.x + 14, (wrapRef.current?.clientWidth || 520) - 170),
                top: Math.max(hover.y - 10, 4),
                minWidth: 150,
              }}
            >
              <div className="text-xs font-semibold text-fg capitalize">
                {(hover.name || '').toLowerCase()}
              </div>
              {hover.tasa == null ? (
                <div className="text-[11px] text-fg-muted mt-0.5">Sin tamizajes</div>
              ) : (
                <div className="mt-1 space-y-0.5 text-[11px]">
                  <Row label={usaAjuste ? 'Ajustada' : 'Prevalencia'} value={`${hover.tasa}%`}
                       strong color={scale.colorFor(hover.tasa)} />
                  {hover.ci_low != null && hover.ci_high != null && (
                    <Row label="IC95%" value={`${hover.ci_low} – ${hover.ci_high}`} />
                  )}
                  {usaAjuste && hover.tasa_cruda != null && (
                    <Row label="Cruda" value={`${hover.tasa_cruda}%`} />
                  )}
                  {!usaAjuste && hover.tasa_ajustada != null && (
                    <Row label="Ajustada" value={`${hover.tasa_ajustada}%`} />
                  )}
                  <Row label="Casos" value={fmtN(hover.casos ?? 0)} />
                  <Row label="Tamizados" value={fmtN(hover.tamizados ?? 0)} />
                  {hover.ci_low == null && hover.inestable && (
                    <div className="text-[10px] text-fg-subtle italic">n&lt;30 · tasa inestable</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Leyenda */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 mt-1 border-t border-line-subtle flex-shrink-0">
          {legend.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5 text-[10px] text-fg-muted">
              <span className="inline-block h-3 w-3 rounded-sm border border-line"
                    style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      </div>
    </MiniChartCard>
  );
}

function Row({ label, value, strong, color }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-fg-muted">{label}</span>
      <span className={`tabular-nums ${strong ? 'font-bold' : 'font-medium text-fg'}`}
            style={strong ? { color } : undefined}>
        {value}
      </span>
    </div>
  );
}
