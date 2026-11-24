import { useState } from 'react';
import { fmtN } from '../../utils/format';
import { fmtFechaMes, textoMotivo } from '../../utils/fechasCarga';

const num = (v) => (typeof v === 'number' ? v : Number(v) || 0);

/**
 * Comprobante de una carga SOLO epidemiológica: tamizaje, ficha de la persona,
 * laboratorio y el enlace de cada tamizaje con su jornada. Todo defensivo: el
 * servidor puede omitir cualquier clave.
 */
export default function ResumenEpidemiologia({ resumen, aplicado = false }) {
  const [verEnlaces, setVerEnlaces] = useState(false);
  const epi = resumen?.epi || {};
  const det = resumen?.detalle || {};
  const enlace = resumen?.enlace || {};
  const enlaces = Array.isArray(enlace.enlaces) ? enlace.enlaces : [];
  const pendientes = Array.isArray(enlace.pendientes) ? enlace.pendientes : [];
  const hojas = resumen?.hojas || {};
  const ignoradas = Array.isArray(hojas.ignoradas) ? hojas.ignoradas : [];
  const labHojas = Array.isArray(det.lab_resultados_hojas) ? det.lab_resultados_hojas : [];
  const enlazadas = enlace.enlazadas ?? enlaces.length;

  return (
    <div className="space-y-4">
      <p className="text-xs text-fg-muted">
        {aplicado
          ? 'Esto es lo que quedó guardado. El resultado también queda en el historial de abajo.'
          : 'Esto es lo que entraría si aplicás la carga.'}
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <Tarjeta titulo="Epidemiología">
          <Fila etiqueta="Personas nuevas" valor={epi.personas_insertadas} />
          <Fila etiqueta="Personas leídas en el archivo" valor={epi.personas_leidas} />
          <Fila etiqueta="Personas omitidas por repetidas" valor={epi.duplicados_personas_omitidos} />
          <Fila etiqueta="Hallazgos nuevos" valor={epi.hallazgos_insertados} />
          <Fila etiqueta="Hallazgos leídos en el archivo" valor={epi.hallazgos_leidos} />
          <Fila etiqueta="Hallazgos omitidos por repetidos" valor={epi.duplicados_hallazgos_omitidos} />
        </Tarjeta>

        <Tarjeta titulo="Ficha y laboratorio">
          <Fila etiqueta="Fichas de personas con cambios" valor={det.persona_detalle_con_cambios} />
          <Fila etiqueta="Fichas sin cambios" valor={det.persona_detalle_sin_cambios} />
          <Fila etiqueta="Filas vacías que se saltaron" valor={det.persona_detalle_vacias_saltadas} />
          <Fila etiqueta="Filas sin persona en el tamizaje" valor={det.persona_detalle_sin_persona_en_el_tamizaje} />
          <Fila etiqueta="Resultados de laboratorio nuevos" valor={det.lab_resultados_insertados} />
          <Fila etiqueta="Resultados de laboratorio que ya estaban" valor={det.lab_resultados_ya_estaban} />
          <Fila etiqueta="Hojas de laboratorio leídas"
            valor={labHojas.length ? labHojas.map(nombreHoja).join(', ') : (det.lab_resultados_filas != null ? `${fmtN(num(det.lab_resultados_filas))} filas` : null)} />
        </Tarjeta>

        <Tarjeta titulo="Enlace con jornadas">
          <p className="text-sm text-fg">
            <b>{fmtN(num(enlazadas))}</b> {num(enlazadas) === 1
              ? 'tamizaje enlazado a su jornada'
              : 'tamizajes enlazados a su jornada'}
          </p>
          {enlaces.length > 0 && (
            <div className="mt-2">
              <button type="button" className="btn-secondary text-xs"
                onClick={() => setVerEnlaces((v) => !v)} aria-expanded={verEnlaces}>
                {verEnlaces ? 'Ocultar enlaces' : `Ver enlaces (${fmtN(enlaces.length)})`}
              </button>
              {verEnlaces && (
                <div className="mt-2 overflow-x-auto max-h-72 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="text-left text-fg-muted">
                      <tr>
                        <th className="pr-2 py-1">Tamizaje</th>
                        <th className="pr-2 py-1">Jornada</th>
                        <th className="pr-2 py-1">Empresa</th>
                        <th className="pr-2 py-1">Fecha</th>
                        <th className="pr-2 py-1 text-right">Personas</th>
                        <th className="py-1 text-right">Atendidos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enlaces.map((e, i) => (
                        <tr key={`${e.epi_jornada_codigo}-${i}`} className="border-t border-line-subtle">
                          <td className="pr-2 py-1 font-mono">{e.epi_jornada_codigo}</td>
                          <td className="pr-2 py-1 font-mono">{e.jornada_codigo || e.jornada_id}</td>
                          <td className="pr-2 py-1">{e.empresa}</td>
                          <td className="pr-2 py-1 whitespace-nowrap">{fmtFechaMes(e.fecha)}</td>
                          <td className="pr-2 py-1 text-right tabular-nums">{fmtN(num(e.personas))}</td>
                          <td className="py-1 text-right tabular-nums">{fmtN(num(e.atendidos))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Tarjeta>

        {ignoradas.length > 0 && (
          <Tarjeta titulo="Hojas ignoradas">
            <p className="text-sm text-fg-muted">
              No se tocaron: {ignoradas.map(nombreHoja).join(', ')}.
            </p>
          </Tarjeta>
        )}
      </div>

      {pendientes.length > 0 && (
        <section className="rounded-lg border border-warning/40 bg-warning-soft/40 p-3">
          <h4 className="text-sm font-semibold text-warning mb-1">
            Tamizajes que quedaron sin jornada ({fmtN(pendientes.length)})
          </h4>
          <p className="text-xs text-fg-muted mb-2">
            Se enlazan a mano en la sección «Tamizajes sin jornada», más abajo.
          </p>
          <ul className="space-y-1 text-sm">
            {pendientes.map((p, i) => (
              <li key={`${p.epi_jornada_codigo}-${i}`}>
                <span className="font-mono">{p.epi_jornada_codigo}</span>
                {' · '}{fmtFechaMes(p.fecha)}{' · '}{p.empresa}
                {' · '}{fmtN(num(p.personas))} {num(p.personas) === 1 ? 'persona' : 'personas'}
                <span className="text-fg-muted"> — {textoMotivo(p.motivo)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

const nombreHoja = (h) => (typeof h === 'string' ? h : (h?.nombre || h?.hoja || JSON.stringify(h)));

function Tarjeta({ titulo, children }) {
  return (
    <section className="rounded-lg border border-line bg-surface-elev/60 p-3">
      <h4 className="text-sm font-semibold text-fg mb-2">{titulo}</h4>
      <dl className="space-y-1">{children}</dl>
    </section>
  );
}

function Fila({ etiqueta, valor }) {
  if (valor === undefined || valor === null) return null;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-fg-muted">{etiqueta}</dt>
      <dd className="text-sm font-semibold tabular-nums text-fg text-right">
        {typeof valor === 'number' ? fmtN(valor) : String(valor)}
      </dd>
    </div>
  );
}
