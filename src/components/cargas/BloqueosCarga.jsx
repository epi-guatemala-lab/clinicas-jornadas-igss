import { useEffect, useMemo, useState } from 'react';
import { apiCreatePatologia, apiListPatologias } from '../../api/endpoints';
import { describirError } from '../../utils/apiError';
import { normalizarBloqueos } from '../../utils/carga';
import { fmtN } from '../../utils/format';

/**
 * Carga BLOQUEADA: el Excel trae patologías que no están en el catálogo.
 *
 * Antes esto se resolvía editando código y redesplegando el backend. Acá se
 * dan de alta en el momento —con su grupo clínico— y se reintenta. El catálogo
 * vive en la base de datos, así que el alta queda para siempre.
 */
export default function BloqueosCarga({ bloqueos, canWrite = true, onReintentar }) {
  const { patologias, otros } = useMemo(() => normalizarBloqueos(bloqueos), [bloqueos]);
  const [grupos, setGrupos] = useState([]);
  const [filas, setFilas] = useState({});   // nombre → {grupo, estado, error}

  useEffect(() => {
    apiListPatologias()
      .then((r) => {
        const data = Array.isArray(r) ? r : (r?.data || []);
        const gs = [...new Set(data.map((p) => p.grupo).filter(Boolean))].sort();
        setGrupos(gs);
      })
      .catch(() => setGrupos(GRUPOS_SUGERIDOS));
  }, []);

  const listaGrupos = grupos.length ? grupos : GRUPOS_SUGERIDOS;
  const set = (nombre, patch) =>
    setFilas((f) => ({ ...f, [nombre]: { ...(f[nombre] || {}), ...patch } }));

  async function darDeAlta(p) {
    const grupo = (filas[p.nombre]?.grupo || '').trim();
    if (!grupo) {
      set(p.nombre, { error: 'Indicá a qué grupo clínico pertenece.' });
      return;
    }
    set(p.nombre, { estado: 'guardando', error: '' });
    try {
      await apiCreatePatologia({ nombre_canonico: p.nombre, grupo });
      set(p.nombre, { estado: 'listo', error: '' });
      if (!listaGrupos.includes(grupo)) setGrupos((g) => [...new Set([...g, grupo])].sort());
    } catch (e) {
      const d = describirError(e, 'dar de alta la patología');
      set(p.nombre, { estado: 'error', error: [d.titulo, d.detalle].filter(Boolean).join(' — ') });
    }
  }

  const pendientes = patologias.filter((p) => filas[p.nombre]?.estado !== 'listo');
  const todasListas = patologias.length > 0 && pendientes.length === 0;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-warning/40 bg-warning-soft/40 p-3">
        <h3 className="font-semibold text-warning">La carga se detuvo antes de escribir nada</h3>
        <p className="text-sm text-fg-muted mt-1">
          El archivo trae información que el sistema no sabe dónde guardar. Se frenó a propósito:
          meterla a medias dejaría la base con datos sin clasificar. Resolvé lo de abajo y reintentá.
        </p>
      </div>

      {patologias.length > 0 && (
        <div className="card p-4 space-y-3">
          <div>
            <h4 className="font-semibold text-fg">
              Patologías que no están en el catálogo ({fmtN(patologias.length)})
            </h4>
            <p className="text-xs text-fg-muted mt-0.5">
              Indicá a qué grupo clínico pertenece cada una y dala de alta. Queda guardada en el
              catálogo, así que el mes que viene ya no vuelve a frenar la carga.
            </p>
          </div>

          <datalist id="grupos-patologia">
            {listaGrupos.map((g) => <option key={g} value={g} />)}
          </datalist>

          <ul className="space-y-2">
            {patologias.map((p) => {
              const f = filas[p.nombre] || {};
              const listo = f.estado === 'listo';
              return (
                <li key={p.nombre}
                  className={`rounded-lg border p-2.5 ${listo
                    ? 'border-success/40 bg-success-soft/30' : 'border-line bg-surface-elev/60'}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-[12rem] flex-1">
                      <div className="text-sm font-medium text-fg">{p.nombre}</div>
                      {p.filas != null && (
                        <div className="text-[11px] text-fg-muted">
                          {fmtN(p.filas)} {p.filas === 1 ? 'fila en el archivo' : 'filas en el archivo'}
                        </div>
                      )}
                    </div>
                    {listo ? (
                      <span className="badge-success">Dada de alta</span>
                    ) : (
                      <>
                        <input
                          className="input max-w-[14rem]"
                          list="grupos-patologia"
                          placeholder="Grupo clínico (ej. Lípidos)"
                          value={f.grupo || ''}
                          disabled={!canWrite || f.estado === 'guardando'}
                          onChange={(e) => set(p.nombre, { grupo: e.target.value, error: '' })}
                        />
                        <button type="button" className="btn-primary text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={!canWrite || f.estado === 'guardando'}
                          onClick={() => darDeAlta(p)}>
                          {f.estado === 'guardando' ? 'Guardando…' : 'Dar de alta'}
                        </button>
                      </>
                    )}
                  </div>
                  {f.error && <p className="text-xs text-danger mt-1.5">{f.error}</p>}
                </li>
              );
            })}
          </ul>

          {!canWrite && (
            <p className="text-xs text-danger">
              Tu usuario es de solo lectura, así que no podés dar de alta patologías. Pedile a un
              administrador con permiso de edición que las agregue.
            </p>
          )}

          {todasListas && (
            <div className="rounded-lg border border-success/40 bg-success-soft/40 p-3 text-sm">
              <span className="font-semibold text-success">Listo: ya están todas en el catálogo.</span>{' '}
              Volvé a previsualizar el mismo archivo para continuar.
            </div>
          )}
        </div>
      )}

      {otros.length > 0 && (
        <div className="card p-4">
          <h4 className="font-semibold text-fg mb-1">Otros motivos del bloqueo</h4>
          <ul className="list-disc pl-5 text-sm text-fg-muted space-y-1">
            {otros.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
          <p className="text-xs text-fg-subtle mt-2">
            Estos hay que corregirlos en el archivo antes de volver a subirlo.
          </p>
        </div>
      )}

      {onReintentar && (
        <button type="button" className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={patologias.length > 0 && !todasListas}
          title={patologias.length > 0 && !todasListas
            ? 'Primero dales de alta a todas las patologías de la lista'
            : undefined}
          onClick={onReintentar}>
          Reintentar la previsualización
        </button>
      )}
    </div>
  );
}

// Grupos del catálogo sembrado, por si la consulta al catálogo falla.
const GRUPOS_SUGERIDOS = [
  'Antropometría', 'Ácido úrico', 'Glucemia', 'Hematología', 'Hepático',
  'Lípidos', 'Presión arterial', 'Renal',
];
