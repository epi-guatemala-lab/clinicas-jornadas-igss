import { useState } from 'react';
import { fmtN } from '../../utils/format';
import {
  SECCIONES_RESUMEN, defectosResumen, etiquetaDeClave, extrasResumen,
  listasResumen, renglonesDeSeccion, totalesResumen,
} from '../../utils/carga';

/**
 * Comprobante de la carga: qué entró, qué se omitió y qué quedó pendiente.
 * Se usa igual para la previsualización (lo que ENTRARÍA) y para el resultado
 * ya aplicado (lo que ENTRÓ); solo cambia el tiempo verbal del encabezado.
 *
 * Dos cosas que antes no se veían y ahora sí:
 *  · Las LISTAS que manda el servidor (a qué empresas se les quitó el NIT de
 *    ejemplo, qué jornadas quedaron sin tamizaje). El aplanado solo miraba
 *    números y las tiraba.
 *  · Los avisos con nombre de programador. Toda clave se traduce a una frase
 *    en español; el identificador interno solo aparece en el detalle técnico.
 */
export default function ResumenCarga({ resumen, aplicado = false }) {
  const [verDetalle, setVerDetalle] = useState(false);
  if (!resumen) return null;

  const totales = totalesResumen(resumen);
  const defectos = defectosResumen(resumen);
  const extras = extrasResumen(resumen);
  const listas = listasResumen(resumen);

  const secciones = SECCIONES_RESUMEN
    .map((s) => ({ ...s, renglones: renglonesDeSeccion(s, resumen) }))
    .filter((s) => s.renglones.length > 0);

  const defectosConValor = Object.entries(defectos)
    .filter(([, v]) => v)
    .map(([k, v]) => ({ clave: k, etiqueta: etiquetaDeClave(k), valor: v }))
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'));

  const hayAlgo = secciones.length > 0 || totales || defectosConValor.length
    || extras.length || listas.length;

  if (!hayAlgo) {
    return (
      <div className="text-sm text-fg-muted">
        El servidor no devolvió contadores para esta carga.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-fg-muted">
        {aplicado
          ? 'Esto es lo que quedó guardado. Podés cerrar esta pantalla cuando termines de leerlo: el resultado también queda en el historial de abajo.'
          : 'Esto es lo que entraría si aplicás la carga.'}
      </p>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {secciones.map((s) => (
          <section key={s.titulo} className="rounded-lg border border-line bg-surface-elev/60 p-3">
            <h4 className="text-sm font-semibold text-fg mb-2">{s.titulo}</h4>
            <dl className="space-y-1">
              {s.renglones.map((r) => (
                <Fila key={r.id} etiqueta={r.etiqueta} valor={r.valor}
                  ayuda={r.ayuda} destacado={r.destacado} />
              ))}
            </dl>
            {s.nota && (
              <p className="text-[11px] text-fg-subtle mt-2 leading-snug">{s.nota}</p>
            )}
          </section>
        ))}
      </div>

      {listas.map((l) => <ListaDetalle key={l.clave} lista={l} aplicado={aplicado} />)}

      {totales && (
        <section className="rounded-lg border border-accent-3/30 bg-accent-3-soft/40 p-3">
          <h4 className="text-sm font-semibold text-fg mb-2">
            {aplicado ? 'Total acumulado en la base' : 'Total acumulado si aplicás'}
          </h4>
          <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-3">
            {Object.entries(totales).map(([k, v]) => (
              <Fila key={k} etiqueta={ETIQUETA_TOTAL[k] || etiquetaDeClave(k)} valor={v} />
            ))}
          </dl>
        </section>
      )}

      {defectosConValor.length > 0 && (
        <section className="rounded-lg border border-warning/40 bg-warning-soft/40 p-3">
          <h4 className="text-sm font-semibold text-warning mb-1">
            Filas con defectos que se reportan
          </h4>
          <p className="text-[11px] text-fg-muted mb-2">
            No se inventó ningún dato: estas filas se dejaron fuera o se marcaron para revisión.
          </p>
          <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {defectosConValor.map((d) => (
              <Fila key={d.clave} etiqueta={d.etiqueta} valor={d.valor} />
            ))}
          </dl>
        </section>
      )}

      {extras.length > 0 && (
        <section>
          <button type="button" onClick={() => setVerDetalle((v) => !v)}
            className="text-xs font-semibold text-accent hover:underline">
            {verDetalle
              ? '▲ Ocultar detalle técnico'
              : `▼ Ver detalle técnico (${extras.length} ${extras.length === 1 ? 'dato más' : 'datos más'})`}
          </button>
          {verDetalle && (
            <div className="mt-2 rounded-lg border border-line bg-surface-elev/60 p-3">
              <p className="text-[11px] text-fg-subtle mb-2">
                Contadores sueltos del proceso. Entre paréntesis va el nombre interno,
                que es lo que hay que pasarle al equipo técnico si algo no cuadra.
              </p>
              <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                {extras.map((x) => (
                  <Fila key={x.clave} valor={x.valor}
                    etiqueta={(
                      <span>
                        {x.etiqueta}{' '}
                        <code className="text-[10px] text-fg-subtle">({x.clave})</code>
                      </span>
                    )} />
                ))}
              </dl>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

const ETIQUETA_TOTAL = {
  personas: 'Personas tamizadas',
  hallazgos: 'Hallazgos',
  jornadas: 'Jornadas',
  empresas: 'Empresas',
  lab_resultados: 'Resultados de laboratorio',
};

const TOPE_LISTA = 20;

/** Lista de detalle (empresas limpiadas, jornadas sin tamizaje…). */
function ListaDetalle({ lista, aplicado }) {
  const [abierta, setAbierta] = useState(lista.destacada && lista.elementos.length <= TOPE_LISTA);
  const [todos, setTodos] = useState(false);
  const visibles = todos ? lista.elementos : lista.elementos.slice(0, TOPE_LISTA);
  const clases = lista.destacada
    ? 'border-warning/40 bg-warning-soft/30'
    : 'border-line bg-surface-elev/60';

  return (
    <section className={`rounded-lg border p-3 ${clases}`}>
      <button type="button" onClick={() => setAbierta((v) => !v)}
        className="flex w-full items-start justify-between gap-3 text-left">
        <span>
          <span className={`text-sm font-semibold ${lista.destacada ? 'text-warning' : 'text-fg'}`}>
            {lista.etiqueta}
          </span>
          {!lista.conocida && (
            <code className="ml-2 text-[10px] text-fg-subtle">({lista.clave})</code>
          )}
        </span>
        <span className="text-xs text-fg-muted whitespace-nowrap">
          {fmtN(lista.elementos.length)} {abierta ? '▲' : '▼'}
        </span>
      </button>
      {lista.ayuda && (
        <p className="text-[11px] text-fg-muted mt-1 leading-snug">
          {lista.ayuda}
          {lista.destacada && (
            <> {aplicado ? 'Ya quedó aplicado.' : 'Se aplica cuando confirmes la carga.'}</>
          )}
        </p>
      )}
      {abierta && (
        <>
          <ul className="mt-2 space-y-1 text-xs text-fg list-disc pl-5">
            {visibles.map((t, i) => <li key={`${t}-${i}`} className="break-words">{t}</li>)}
          </ul>
          {lista.elementos.length > visibles.length && (
            <button type="button" className="btn-secondary text-xs mt-2"
              onClick={() => setTodos(true)}>
              Ver los {fmtN(lista.elementos.length)}
            </button>
          )}
        </>
      )}
    </section>
  );
}

function Fila({ etiqueta, valor, ayuda, destacado = false }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className={`text-xs ${destacado ? 'text-fg font-medium' : 'text-fg-muted'}`}>
          {etiqueta}
        </dt>
        <dd className={`text-sm font-semibold tabular-nums whitespace-nowrap ${
          destacado ? 'text-warning' : 'text-fg'}`}>
          <Valor valor={valor} />
        </dd>
      </div>
      {ayuda && (
        <p className="text-[11px] text-fg-subtle leading-snug mt-0.5 mb-1">{ayuda}</p>
      )}
    </div>
  );
}

function Valor({ valor }) {
  if (typeof valor === 'number') return <>{fmtN(valor)}</>;
  if (typeof valor === 'boolean') return <>{valor ? 'Sí' : 'No'}</>;
  if (valor === null || valor === undefined || valor === '') return <>—</>;
  return <>{String(valor)}</>;
}
