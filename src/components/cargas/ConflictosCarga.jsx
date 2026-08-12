import { useMemo, useState } from 'react';
import {
  ETIQUETA_COLUMNA, NOMBRE_CAPA, etiquetaDeCampo, separarConflictos, fmtFechaHora,
} from '../../utils/carga';
import { fmtN } from '../../utils/format';

// Un valor de conflicto que viene como 'YYYY-MM-DD' (o con hora) es una
// fecha, aunque llegue como texto plano desde el backend. Sin esto la tabla
// mostraba "2026-01-09" crudo — el mismo problema de fecha en formato
// EE.UU./ambiguo que ya se corrigió en el resto del portal, vivo de nuevo acá.
const ES_FECHA_ISO = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/;

const PAGINA = 50;

/**
 * Lo que el Excel dice distinto de lo que ya está cargado.
 *
 * Las dos capas se comportan al revés y meterlas en la misma tabla escondía lo
 * único que hay que decidir:
 *  · **Operativa**: el Excel manda (atendidos, programados, viáticos). Estas
 *    filas SÍ pisan datos guardados → van primero, abiertas y destacadas.
 *  · **Epidemiología**: no se sobrescribe nunca. El dato viejo se conserva y la
 *    diferencia solo se reporta → va después y plegada; son 50 filas de
 *    información que no tapan las 6 que cambian la base.
 */
export default function ConflictosCarga({ conflictos, aplicado = false }) {
  const { sobrescriben, informativas } = useMemo(
    () => separarConflictos(conflictos), [conflictos]);

  if (!sobrescriben.filas.length && !informativas.filas.length) return null;

  return (
    <div className="space-y-4">
      {sobrescriben.filas.length > 0 && (
        <section className="space-y-2">
          <div className="rounded-lg border border-warning/50 bg-warning-soft/40 p-3 text-sm">
            <h4 className="font-semibold text-warning">
              {fmtN(sobrescriben.total)}{' '}
              {sobrescriben.total === 1 ? 'registro que ya existe' : 'registros que ya existen'}
              {aplicado ? ' se sobrescribieron' : ' se van a sobrescribir'}
            </h4>
            <p className="mt-1 text-xs text-fg-muted">
              El archivo es la fuente de los datos operativos (personas atendidas,
              programadas, viáticos).{' '}
              {aplicado
                ? 'Estos valores reemplazaron a los que había en el sistema; acá queda constancia de qué se cambió y por qué valor.'
                : 'Estos valores reemplazan a los que están hoy en el sistema. Revisá la tabla antes de aplicar: es el único lugar donde la carga pisa información existente.'}
            </p>
            {sobrescriben.truncado && (
              <p className="mt-1 text-xs text-fg-muted">
                La tabla muestra una selección de ejemplos, no los{' '}
                {fmtN(sobrescriben.total)} registros.
              </p>
            )}
          </div>
          <TablaDiferencias filas={sobrescriben.filas}
            // Ya aplicada, «valor cargado hoy» sería mentira: ese es el valor
            // que estaba ANTES y que el archivo acaba de reemplazar.
            etiquetas={aplicado
              ? { actual: 'Valor anterior', valor_actual: 'Valor anterior',
                nuevo: 'Valor que quedó', valor_nuevo: 'Valor que quedó',
                valor_excel: 'Valor que quedó' }
              : null} />
        </section>
      )}

      {informativas.filas.length > 0 && (
        <Plegable
          titulo={`${fmtN(informativas.total)} ${informativas.total === 1
            ? 'diferencia de tamizaje que NO se aplica'
            : 'diferencias de tamizaje que NO se aplican'}`}
          nota={'La capa epidemiológica está protegida: el dato que ya estaba se conserva '
            + 'y la diferencia queda reportada acá para que alguien la revise. '
            + 'Nada de esta lista cambia la base.'}
          truncado={informativas.truncado}
          total={informativas.total}
        >
          <TablaDiferencias filas={informativas.filas} />
        </Plegable>
      )}
    </div>
  );
}

function Plegable({ titulo, nota, children, truncado, total }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <section className="rounded-lg border border-line bg-surface-elev/60 p-3 space-y-2">
      <button type="button" onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left">
        <span className="text-sm font-semibold text-fg">{titulo}</span>
        <span className="text-xs text-fg-muted whitespace-nowrap">
          {abierto ? 'Ocultar ▲' : 'Ver ▼'}
        </span>
      </button>
      <p className="text-xs text-fg-muted">{nota}</p>
      {abierto && (
        <>
          {truncado && (
            <p className="text-xs text-fg-muted">
              La tabla muestra una selección de ejemplos, no los {fmtN(total)} registros.
            </p>
          )}
          {children}
        </>
      )}
    </section>
  );
}

function TablaDiferencias({ filas, etiquetas = null }) {
  const [mostrar, setMostrar] = useState(PAGINA);

  const columnas = useMemo(() => {
    const vistas = [];
    filas.slice(0, 200).forEach((f) => {
      Object.keys(f).forEach((k) => { if (!vistas.includes(k)) vistas.push(k); });
    });
    // 'capa' siempre primero: es lo que decide si el dato se pisa o no.
    return vistas.sort((a, b) => (a === 'capa' ? -1 : b === 'capa' ? 1 : 0));
  }, [filas]);

  const visibles = filas.slice(0, mostrar);

  return (
    <div className="space-y-2">
      {/* En pantallas angostas la tabla se desplaza horizontal (overflow-x-auto
          ya lo permite), pero sin ningún indicador visual nadie se entera de
          que hay más columnas — se ve simplemente cortada. Esta es justo la
          tabla que le pide a Berkin "revisá antes de aplicar": que no sepa
          que falta desplazar es tan grave como que la columna no exista. */}
      <p className="sm:hidden text-[11px] text-fg-muted flex items-center gap-1">
        <span aria-hidden>↔</span> Deslizá la tabla hacia los lados para ver todas las columnas
      </p>
      <div className="card overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-surface-elev text-fg-muted uppercase">
            <tr>
              {columnas.map((c) => (
                <th key={c} className="text-left p-2 whitespace-nowrap">
                  {etiquetas?.[c] || ETIQUETA_COLUMNA[c] || etiquetaDeCampo(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibles.map((f, i) => (
              <tr key={i} className="border-t border-line-subtle align-top hover:bg-surface-elev">
                {columnas.map((c) => (
                  <td key={c} className="p-2 max-w-[22rem]">
                    {c === 'capa' ? <Capa valor={f[c]} />
                      : c === 'campo' ? <Celda valor={etiquetaDeCampo(f[c])} />
                        : <Celda valor={f[c]} />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filas.length > visibles.length && (
        <button type="button" className="btn-secondary text-xs"
          onClick={() => setMostrar((m) => m + PAGINA)}>
          Ver {fmtN(Math.min(PAGINA, filas.length - visibles.length))} más
          {' '}(de {fmtN(filas.length)})
        </button>
      )}
    </div>
  );
}

function Capa({ valor }) {
  if (valor == null || valor === '') return <span className="text-fg-subtle">—</span>;
  const clave = String(valor).toLowerCase();
  const esEpi = clave.startsWith('epi');
  return (
    <span className={`badge ${esEpi ? 'bg-info-soft text-info' : 'bg-warning-soft text-warning'} whitespace-nowrap`}>
      {NOMBRE_CAPA[clave] || valor}
    </span>
  );
}

function Celda({ valor }) {
  if (valor == null || valor === '') return <span className="text-fg-subtle">—</span>;
  if (typeof valor === 'boolean') return <span>{valor ? 'Sí' : 'No'}</span>;
  if (typeof valor === 'object') {
    return <code className="text-[11px] break-all">{JSON.stringify(valor)}</code>;
  }
  const txt = String(valor);
  if (ES_FECHA_ISO.test(txt)) {
    return <span className="tabular-nums">{fmtFechaHora(txt)}</span>;
  }
  return <span className="break-words" title={txt.length > 60 ? txt : undefined}>{txt}</span>;
}
