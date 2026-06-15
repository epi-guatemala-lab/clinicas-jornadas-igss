// Helpers geográficos para el mapa coroplético de Guatemala (Epidemiología).
//
// El GeoJSON (public/geo/gt_departamentos.geojson) usa
// `properties.nombre_normalizado` en MAYÚSCULAS y sin tildes (22 deptos).
// La API (/api/epi/prevalencia-por/departamento) devuelve `grupo` con el
// nombre tal cual está en la BD ("Guatemala", "Petén", "Suchitepéquez"…),
// es decir mixed-case CON tildes. `normDepto()` lleva ambos al mismo espacio
// para poder hacer el join.

/** Normaliza un nombre de departamento: sin tildes, MAYÚSCULAS, trim. */
export function normDepto(s) {
  if (s == null) return '';
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim();
}

// ── Escala por CUANTILES (adaptativa al rango real de los datos) ────────
//
// A10 (cleanup): se eliminaron CHORO_BUCKETS / choroColor / choroLegend
// (umbrales fijos 0–10–25 muertos). El mapa SIEMPRE usa choroScale, que
// reparte por cuantiles y es la única fuente de verdad de la coloración.
// Las tasas de "≥1 hallazgo" por depto caen en 52–86%, así que umbrales fijos
// (>25→rojo) pintan TODO rojo. choroScale reparte los deptos CON dato en 5
// tramos por cuantiles, con rampa secuencial YlOrRd, para que el mapa
// diferencie. Los deptos sin dato quedan en gris.
const RAMP = ['#FFEDA0', '#FEB24C', '#FD8D3C', '#F03B20', '#BD0026'];

export function choroScale(values, t) {
  const vals = (values || []).filter((v) => v != null && !Number.isNaN(v)).sort((a, b) => a - b);
  const grey = t.status.neutral;
  if (vals.length < 2) {
    const only = vals[0];
    return {
      colorFor: (v) => (v == null ? grey : RAMP[RAMP.length - 1]),
      legend: [
        ...(only != null ? [{ label: `${only}%`, color: RAMP[RAMP.length - 1] }] : []),
        { label: 'Sin dato', color: grey },
      ],
    };
  }
  // 4 cortes por cuantiles → 5 tramos
  const q = (p) => vals[Math.min(vals.length - 1, Math.max(0, Math.round(p * (vals.length - 1))))];
  const cuts = [q(0.2), q(0.4), q(0.6), q(0.8)];
  const bucket = (v) => {
    if (v == null || Number.isNaN(v)) return -1;
    let i = 0;
    while (i < cuts.length && v > cuts[i]) i += 1;
    return i; // 0..4
  };
  const colorFor = (v) => (bucket(v) < 0 ? grey : RAMP[bucket(v)]);
  // leyenda con los rangos reales
  const lo = vals[0], hi = vals[vals.length - 1];
  const edges = [lo, ...cuts, hi];
  const legend = [];
  for (let i = RAMP.length - 1; i >= 0; i -= 1) {
    const a = edges[i], b = edges[i + 1];
    legend.push({ label: `${Math.round(a)}–${Math.round(b)}%`, color: RAMP[i] });
  }
  legend.push({ label: 'Sin dato', color: grey });
  return { colorFor, legend };
}

// ── Carga (con cache) del GeoJSON de departamentos ──────────────────────
// Respeta el subpath de GitHub Pages vía import.meta.env.BASE_URL.

let _geoCache = null;
let _geoPromise = null;

export function geoUrl() {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}geo/gt_departamentos.geojson`;
}

/** Carga el GeoJSON una sola vez; resuelve con el FeatureCollection. */
export async function loadDeptosGeoJSON() {
  if (_geoCache) return _geoCache;
  if (_geoPromise) return _geoPromise;
  _geoPromise = fetch(geoUrl())
    .then((r) => {
      if (!r.ok) throw new Error(`geojson ${r.status}`);
      return r.json();
    })
    .then((gj) => {
      _geoCache = gj;
      _geoPromise = null;
      return gj;
    })
    .catch((e) => {
      _geoPromise = null;
      throw e;
    });
  return _geoPromise;
}
