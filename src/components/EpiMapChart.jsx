import { useEffect, useMemo, useRef, useState } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import { useApi } from '../hooks/useApi';
import { useThemedColors } from '../theme/useThemedColors';
import MiniChartCard from './cards/MiniChartCard';
import { fmtN } from '../utils/format';
import { normDepto, choroColor, choroLegend, loadDeptosGeoJSON } from '../utils/geo';

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
export default function EpiMapChart({ params = {}, selected, onPick }) {
  const { data, err, loading } = useApi('/api/epi/prevalencia-por/departamento', { ...params, limit: 25 });
  const t = useThemedColors();

  const [geo, setGeo] = useState(null);
  const [geoErr, setGeoErr] = useState(null);
  const [hover, setHover] = useState(null); // { name, tasa, tamizados, x, y }
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ w: 520, h: 420 });

  // Cargar GeoJSON una vez
  useEffect(() => {
    let alive = true;
    loadDeptosGeoJSON()
      .then((gj) => { if (alive) setGeo(gj); })
      .catch((e) => { if (alive) setGeoErr(e.message || 'No se pudo cargar el mapa'); });
    return () => { alive = false; };
  }, []);

  // Medir el contenedor para hacer el mapa responsive
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = Math.max(280, e.contentRect.width);
        const h = Math.max(320, Math.min(560, w * 0.82));
        setSize({ w, h });
      }
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Mapa nombre_normalizado → {tasa, tamizados, casos, raw}
  // `raw` = nombre tal cual en la BD ("Guatemala", "Petén"), necesario para
  // filtrar la API: el backend hace match EXACTO sobre departamento, así que
  // enviar la versión normalizada (MAYÚSC sin tildes) devolvería 0 filas.
  const byDepto = useMemo(() => {
    const m = {};
    for (const it of data?.items || []) {
      m[normDepto(it.grupo)] = {
        tasa: it.tasa_por_100,
        tamizados: it.tamizados,
        casos: it.casos,
        inestable: it.inestable,
        raw: it.grupo,
      };
    }
    return m;
  }, [data]);

  // Proyección + path generador (fitSize al tamaño actual)
  const { path, features } = useMemo(() => {
    if (!geo) return { path: null, features: [] };
    const proj = geoMercator().fitSize([size.w, size.h], geo);
    return { path: geoPath(proj), features: geo.features || [] };
  }, [geo, size.w, size.h]);

  const isError = err && err !== '403';
  const legend = choroLegend(t);

  return (
    <MiniChartCard
      title="Mapa de prevalencia por departamento"
      subtitle="Tasa de tamizados con ≥1 hallazgo · clic en un departamento para filtrar"
      className="h-full"
      loading={loading && !geo}
      error={isError ? err : (geoErr || null)}
    >
      <div ref={wrapRef} className="relative w-full h-full flex flex-col min-h-0">
        {/* Mapa */}
        <div className="relative flex-1 min-h-0">
          {path && features.length > 0 ? (
            <svg
              width="100%"
              height={size.h}
              viewBox={`0 0 ${size.w} ${size.h}`}
              role="img"
              aria-label="Mapa coroplético de Guatemala por prevalencia"
              style={{ display: 'block' }}
              onMouseLeave={() => setHover(null)}
            >
              {features.map((f, i) => {
                const name = f.properties?.nombre_normalizado;
                const rec = byDepto[name];
                const tasa = rec ? rec.tasa : null;
                const fill = choroColor(tasa, t);
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
                      cursor: 'pointer',
                      transition: 'fill 200ms ease, opacity 150ms ease, stroke 150ms ease',
                      opacity: hover && hover.name !== name ? 0.78 : 1,
                      filter: isSel ? `drop-shadow(0 0 6px ${t.accent.primary}aa)` : 'none',
                    }}
                    onMouseMove={(ev) => {
                      const box = wrapRef.current?.getBoundingClientRect();
                      setHover({
                        name,
                        tasa,
                        tamizados: rec?.tamizados,
                        casos: rec?.casos,
                        inestable: rec?.inestable,
                        x: ev.clientX - (box?.left || 0),
                        y: ev.clientY - (box?.top || 0),
                      });
                    }}
                    onClick={() => onPick && (isSel
                      ? onPick(null, null)
                      : onPick(name, rec?.raw ?? null))}
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
                left: Math.min(hover.x + 14, size.w - 170),
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
                  <Row label="Prevalencia" value={`${hover.tasa}%`} strong color={choroColor(hover.tasa, t)} />
                  <Row label="Casos" value={fmtN(hover.casos ?? 0)} />
                  <Row label="Tamizados" value={fmtN(hover.tamizados ?? 0)} />
                  {hover.inestable && (
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
