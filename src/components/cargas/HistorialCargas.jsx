import { useCallback, useEffect, useState } from 'react';
import { apiListCargas } from '../../api/endpoints';
import { describirError } from '../../utils/apiError';
import { ESTADO_CARGA, MODO_CARGA, etiquetaTipoCarga, fmtBytes, fmtFechaHora } from '../../utils/carga';

/**
 * Bitácora de cargas: quién subió qué archivo, cuándo y con qué resultado.
 * Hasta ahora el bloque operativo se cargaba a mano por consola y no quedaba
 * rastro de nada.
 */
export default function HistorialCargas({ recargarToken = 0, onVerCarga }) {
  const [filas, setFilas] = useState([]);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(() => {
    setCargando(true);
    apiListCargas(20)
      .then((r) => {
        setFilas(Array.isArray(r) ? r : (r?.data || []));
        setError(null);
      })
      .catch((e) => setError(describirError(e, 'leer el historial')))
      .finally(() => setCargando(false));
  }, []);

  useEffect(cargar, [cargar, recargarToken]);

  return (
    <section className="card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-fg">Historial de cargas</h2>
          <p className="text-xs text-fg-muted">Últimas 20, de la más reciente a la más antigua.</p>
        </div>
        <button type="button" className="btn-secondary text-xs" onClick={cargar} disabled={cargando}>
          {cargando ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {error && (
        <div className="text-sm text-danger">
          {error.titulo}. {error.sugerencia}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-elev text-fg-muted uppercase text-xs">
            <tr>
              <th className="text-left p-2">#</th>
              <th className="text-left p-2">Fecha</th>
              <th className="text-left p-2">Archivo</th>
              <th className="text-left p-2">Modo</th>
              <th className="text-left p-2">Estado</th>
              <th className="text-left p-2">Quién</th>
              <th className="text-left p-2">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((c) => {
              const est = ESTADO_CARGA[c.estado] || { texto: c.estado, clase: 'badge-neutral' };
              return (
                <tr key={c.id} className="border-t border-line-subtle hover:bg-surface-elev align-top">
                  <td className="p-2 font-mono text-xs">{c.id}</td>
                  <td className="p-2 whitespace-nowrap text-xs">{fmtFechaHora(c.creado_at)}</td>
                  <td className="p-2">
                    <div className="max-w-[18rem] truncate" title={c.archivo_nombre || ''}>
                      {c.archivo_nombre || '—'}
                    </div>
                    <div className="text-[11px] text-fg-subtle">{fmtBytes(c.archivo_bytes)}</div>
                  </td>
                  <td className="p-2 text-xs">
                    {MODO_CARGA[c.modo] || c.modo}
                    {c.tipo === 'CIERRE_JORNADA' && (
                      <div className="text-[11px] text-igss-primary">
                        {etiquetaTipoCarga(c.tipo)}
                        {c.jornada_id != null && ` · jornada #${c.jornada_id}`}
                      </div>
                    )}
                  </td>
                  <td className="p-2"><span className={est.clase}>{est.texto}</span></td>
                  <td className="p-2 text-xs">{c.creado_por || '—'}</td>
                  <td className="p-2 text-xs text-fg-muted">
                    {c.error
                      ? <span className="text-danger">{c.error}</span>
                      : (c.etapa || (c.estado === 'OK' ? 'Terminó sin problemas' : '—'))}
                    {onVerCarga && (
                      <button type="button" onClick={() => onVerCarga(c.id)}
                        className="ml-2 text-accent hover:underline">
                        Ver
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!cargando && filas.length === 0 && (
              <tr>
                <td colSpan="7" className="p-6 text-center text-fg-subtle">
                  Todavía no se ha cargado ningún archivo desde el portal.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
