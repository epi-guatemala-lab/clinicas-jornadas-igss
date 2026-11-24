import { useCallback, useEffect, useState } from 'react';
import { apiEnlazarTamizaje, apiTamizajesPendientes } from '../../api/endpoints';
import { describirError } from '../../utils/apiError';
import { fmtN } from '../../utils/format';
import { fmtFechaMes, textoMotivo } from '../../utils/fechasCarga';

/**
 * Tamizajes que no encontraron su jornada al cargar. Se enlazan a mano: elegir
 * la jornada candidata y «Enlazar». Si la fecha o la empresa no coinciden, el
 * servidor responde 409 y se pide una confirmación explícita.
 */
export default function TamizajesPendientes({ puedeEditar, recargarToken = 0 }) {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setLista(await apiTamizajesPendientes());
      setError(null);
    } catch (e) {
      setError(describirError(e, 'consultar los tamizajes sin jornada'));
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar, recargarToken]);

  return (
    <section className="card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-fg">Tamizajes sin jornada</h2>
        <button type="button" className="btn-secondary text-xs" onClick={cargar}>Actualizar</button>
      </div>
      <p className="text-xs text-fg-muted max-w-3xl">
        Son tamizajes cargados que no encontraron su jornada. Elegí la jornada que corresponde y
        enlazalos para que cuenten en ella.
      </p>

      {error && (
        <div className="rounded-lg border border-danger/40 bg-danger-soft/40 p-3 text-sm">
          <div className="font-semibold text-danger">{error.titulo}</div>
          {error.detalle && <div className="text-fg-muted mt-0.5 break-words">{error.detalle}</div>}
        </div>
      )}

      {lista === null && !error && <p className="text-sm text-fg-muted">Cargando…</p>}
      {lista && lista.length === 0 && (
        <p className="text-sm text-fg-muted">Todos los tamizajes tienen su jornada.</p>
      )}
      {lista && lista.length > 0 && (
        <ul className="divide-y divide-line-subtle">
          {lista.map((p) => (
            <Pendiente key={p.epi_jornada_codigo} p={p}
              puedeEditar={puedeEditar} onEnlazado={cargar} />
          ))}
        </ul>
      )}
    </section>
  );
}

function etiquetaCandidata(c) {
  const dias = Number(c.dias_diferencia);
  const dif = Number.isFinite(dias) && dias !== 0
    ? ` · ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'} de diferencia`
    : '';
  const fecha = c.fecha_fin && c.fecha_fin !== c.fecha_inicio
    ? `${fmtFechaMes(c.fecha_inicio)} al ${fmtFechaMes(c.fecha_fin)}`
    : fmtFechaMes(c.fecha_inicio);
  return `${c.codigo} · ${fecha} · ${c.empresa || 'sin empresa'} · ${fmtN(Number(c.atendidos) || 0)} atendidos`
    + `${c.empresa_compatible ? ' · misma empresa' : ''}${dif}`;
}

function Pendiente({ p, puedeEditar, onEnlazado }) {
  const candidatas = Array.isArray(p.candidatas) ? p.candidatas : [];
  const [sel, setSel] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [confirmar, setConfirmar] = useState(null);   // {codigo, mensaje}

  async function enlazar(conf = {}) {
    if (!sel) return;
    setEnviando(true); setError(null);
    try {
      await apiEnlazarTamizaje(p.epi_jornada_codigo, {
        jornada_id: Number(sel),
        confirmar_fecha_distinta: Boolean(conf.fecha),
        confirmar_empresa_distinta: Boolean(conf.empresa),
      });
      setConfirmar(null);
      await onEnlazado();
    } catch (e) {
      const d = e?.response?.data?.detail;
      if (e?.response?.status === 409 && d && typeof d === 'object'
        && (d.codigo === 'FECHA_DISTINTA' || d.codigo === 'EMPRESA_DISTINTA')) {
        setConfirmar({ codigo: d.codigo, mensaje: d.mensaje, conf });
      } else if (d && typeof d === 'object' && d.mensaje) {
        setConfirmar(null);
        setError({ titulo: d.mensaje });
      } else {
        setConfirmar(null);
        setError(describirError(e, 'enlazar el tamizaje'));
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <li className="py-3 space-y-2">
      <div className="text-sm">
        <span className="font-mono font-semibold">{p.epi_jornada_codigo}</span>
        {' · '}{fmtFechaMes(p.fecha)}{' · '}{p.empresa}
        {' · '}{fmtN(Number(p.personas) || 0)} {Number(p.personas) === 1 ? 'persona' : 'personas'}
      </div>
      <div className="text-xs text-fg-muted">{textoMotivo(p.motivo)}</div>

      {puedeEditar && (
        candidatas.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <select className="input max-w-xl" value={sel} disabled={enviando}
              aria-label={`Jornada para ${p.epi_jornada_codigo}`}
              onChange={(e) => { setSel(e.target.value); setConfirmar(null); setError(null); }}>
              <option value="">Elegí una jornada…</option>
              {candidatas.map((c) => (
                <option key={c.id} value={c.id}>{etiquetaCandidata(c)}</option>
              ))}
            </select>
            <button type="button" className="btn-primary text-xs"
              disabled={!sel || enviando} onClick={() => enlazar()}>
              {enviando ? 'Enlazando…' : 'Enlazar'}
            </button>
          </div>
        ) : (
          <p className="text-xs text-fg-subtle">
            No hay jornadas candidatas a una semana de distancia. Cuando el equipo registre la jornada, aparecerá aquí para enlazarla.
          </p>
        )
      )}

      {confirmar && (
        <div className="rounded-lg border border-warning/50 bg-warning-soft/40 p-3 text-sm space-y-2">
          <p className="text-fg">{confirmar.mensaje}</p>
          <button type="button" className="btn-secondary text-xs" disabled={enviando}
            onClick={() => enlazar({
              ...confirmar.conf,
              ...(confirmar.codigo === 'FECHA_DISTINTA' ? { fecha: true } : { empresa: true }),
            })}>
            Enlazar igual
          </button>
        </div>
      )}
      {error && <p className="text-sm text-danger break-words">{error.titulo}{error.detalle ? `: ${error.detalle}` : ''}</p>}
    </li>
  );
}
