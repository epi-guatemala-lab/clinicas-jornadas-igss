import { useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtFechaHora } from '../../utils/carga';
import { fmtN } from '../../utils/format';
import { norm } from '../../utils/norm';

/**
 * Carga de cierre detenida porque el nombre de empresa del archivo no cuadra
 * con el de la jornada. Última línea de defensa: decide una persona.
 *
 * El servidor coteja el nombre que trae el archivo contra TODAS las empresas
 * del portal y, cuando no puede resolverlo solo (no se parece a ninguna, le
 * cuadra a varias, le cuadra mejor a otra, o el archivo trae más de una), no
 * escribe nada y manda acá los dos nombres, cuánto se parecen y las empresas
 * más parecidas del sistema.
 *
 * Esta pantalla existe para que esa decisión se tome con lo que hace falta a la
 * vista, y no por inercia:
 *  · los dos nombres enfrentados, en grande;
 *  · las empresas que se parecen más —y si alguna tiene jornada ese mismo día,
 *    que es la señal de que el archivo va en OTRA jornada, con su enlace;
 *  · confirmar exige marcar antes la casilla que dice exactamente qué se está
 *    afirmando y que queda registrado con su usuario.
 *
 * Confirmar NO vuelve a subir el archivo: el servidor conservó el que ya se
 * subió (35 MB, ~80 s) y lo reusa.
 */
export default function ConfirmarEmpresaCierre({
  bloqueo, canWrite = true, confirmando = false, error = null,
  onConfirmar, onCancelar,
}) {
  const [aceptado, setAceptado] = useState(false);
  if (!bloqueo) return null;

  const enElArchivo = bloqueo.empresa_archivo || null;
  const variasDelArchivo = Array.isArray(bloqueo.empresas_en_archivo)
    ? bloqueo.empresas_en_archivo : [];
  const hayVarias = variasDelArchivo.length > 1;
  const empresaJornada = bloqueo.empresa_jornada || null;
  const jornada = bloqueo.jornada || null;
  const candidatas = Array.isArray(bloqueo.candidatas) ? bloqueo.candidatas : [];
  const parecido = typeof bloqueo.parecido_pct === 'number' ? bloqueo.parecido_pct : null;

  const nombreJornada = nombreDe(empresaJornada);
  const codigo = jornada?.codigo || '';
  // Candidatas que aportan algo: o se parecen, o tienen una jornada suya ese
  // mismo día. Una lista de empresas al 0 % (archivo sin nombre de empresa) no
  // ayuda a decidir: es ruido con forma de evidencia.
  const candidatasUtiles = candidatas.filter(
    (c) => (c.parecido_pct || 0) > 0 || (c.jornadas || []).length > 0);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-warning/50 bg-warning-soft/40 p-3">
        <h3 className="font-semibold text-warning">
          La carga se detuvo: hay que confirmar de qué empresa es este archivo
        </h3>
        <p className="text-sm text-fg-muted mt-1">
          {MOTIVOS[bloqueo.motivo] || bloqueo.mensaje
            || 'El nombre de la empresa del archivo no coincide con el de esta jornada.'}
          {' '}No se escribió nada: el sistema prefiere preguntarte antes que dejar los datos
          de una empresa en la jornada de otra.
        </p>
      </div>

      {/* ── Los dos nombres, enfrentados ───────────────────────────── */}
      <div className="card p-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <Ficha titulo="Lo que dice el archivo" tono="archivo">
            {hayVarias ? (
              <ul className="space-y-1">
                {variasDelArchivo.map((e) => (
                  <li key={e.empresa} className="text-sm">
                    <span className="font-semibold text-fg">«{e.empresa}»</span>{' '}
                    <span className="text-xs text-fg-muted">
                      · {fmtN(e.filas)} {e.filas === 1 ? 'persona' : 'personas'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-base font-semibold text-fg break-words">
                {enElArchivo ? `«${enElArchivo}»` : 'El archivo no dice de qué empresa es'}
              </p>
            )}
            <p className="text-xs text-fg-muted mt-1">
              Tal cual viene escrito en la hoja «Encuesta» del archivo de Sipresalud.
            </p>
          </Ficha>

          <Ficha titulo="La empresa de esta jornada" tono="portal">
            <p className="text-base font-semibold text-fg break-words">
              {nombreJornada ? `«${nombreJornada}»` : 'La jornada no tiene empresa anotada'}
            </p>
            {empresaJornada?.nombre_comercial
              && empresaJornada.nombre_comercial !== empresaJornada.nombre_legal && (
              <p className="text-sm text-fg-muted">
                También registrada como «{empresaJornada.nombre_comercial}»
              </p>
            )}
            <p className="text-xs text-fg-muted mt-1">
              {codigo && <>Jornada {codigo}</>}
              {jornada?.fecha_inicio && <> · {fmtFechaHora(jornada.fecha_inicio)}</>}
              {jornada?.fecha_fin && jornada.fecha_fin !== jornada.fecha_inicio
                && <> al {fmtFechaHora(jornada.fecha_fin)}</>}
              {empresaJornada?.nit && <> · NIT {empresaJornada.nit}</>}
            </p>
          </Ficha>
        </div>

        {/* Sin nombre en el archivo (o sin empresa en la jornada) no hay nada
            que comparar: un «se parecen un 0 %» sería un dato inventado. */}
        {parecido != null && empresaJornada && (enElArchivo || hayVarias) && (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-fg-muted">
                {hayVarias
                  ? 'El nombre que más se repite en el archivo se parece al de la jornada'
                  : 'Los dos nombres se parecen'}
              </span>
              <span className="font-semibold tabular-nums text-fg">{parecido} %</span>
            </div>
            <BarraParecido pct={parecido} />
          </div>
        )}
      </div>

      {/* ── ¿No irá en otra jornada? ───────────────────────────────── */}
      {candidatasUtiles.length > 0 && (
        <div className="card p-4 space-y-2">
          <div>
            <h4 className="font-semibold text-fg">
              {enElArchivo || hayVarias
                ? 'Empresas del portal que se parecen a lo que dice el archivo'
                : 'Otras empresas del portal con jornada en esa misma fecha'}
            </h4>
            <p className="text-xs text-fg-muted mt-0.5">
              Si alguna de estas es la empresa de verdad, el archivo va en la jornada de ELLA:
              cerrá esta pantalla y subilo allá. Cuando el sistema encuentra una jornada suya
              en la misma fecha del archivo, la muestra acá con su enlace.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-fg-muted uppercase tracking-wide">
                  <th className="py-1.5 pr-3">Empresa del portal</th>
                  <th className="py-1.5 pr-3">Se parece</th>
                  <th className="py-1.5">Jornada suya en esa misma fecha</th>
                </tr>
              </thead>
              <tbody>
                {candidatasUtiles.map((c) => {
                  const mejor = cuadraMejor(c, parecido, empresaJornada);
                  return (
                    <tr key={c.empresa_id ?? nombreDe(c)}
                      className={`border-b border-line-subtle align-top ${
                        mejor ? 'bg-warning-soft/40' : ''}`}>
                      <td className="py-1.5 pr-3">
                        <div className="font-medium text-fg break-words">
                          {nombreDe(c) || '—'}
                        </div>
                        {c.nombre_comercial && c.nombre_comercial !== c.nombre_legal && (
                          <div className="text-xs text-fg-muted break-words">
                            También «{c.nombre_comercial}»
                          </div>
                        )}
                        {mejor && (
                          <span className="badge-warning mt-1">
                            Le cuadra mejor que a la empresa de esta jornada
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 pr-3 tabular-nums whitespace-nowrap">
                        {typeof c.parecido_pct === 'number' ? `${c.parecido_pct} %` : '—'}
                      </td>
                      <td className="py-1.5">
                        {(c.jornadas || []).length === 0 ? (
                          <span className="text-fg-subtle">—</span>
                        ) : (
                          <ul className="space-y-1">
                            {c.jornadas.map((j) => (
                              <li key={j.id ?? j.codigo}>
                                <Link className="text-igss-primary hover:underline"
                                  to={`/jornadas/${j.id}/analisis`}>
                                  {j.codigo}
                                </Link>
                                <span className="text-xs text-fg-muted"> · {fmtFechaHora(j.fecha_inicio)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── La decisión ───────────────────────────────────────────── */}
      <div className="card p-4 space-y-3">
        <h4 className="font-semibold text-fg">¿Qué hacemos con este archivo?</h4>

        {canWrite ? (
          <label className="flex items-start gap-2 rounded-lg border border-line bg-surface-elev/60 p-3">
            <input type="checkbox" className="mt-1" checked={aceptado}
              disabled={confirmando}
              onChange={(e) => setAceptado(e.target.checked)} />
            <span className="text-sm text-fg">
              {fraseConfirmacion({ hayVarias, enElArchivo, nombreJornada, codigo })}
              <span className="block text-xs text-fg-muted mt-1">
                Queda registrado con tu usuario, la fecha, el nombre que traía el archivo y la
                empresa que tiene la jornada. Se salta ÚNICAMENTE esta comprobación: la fecha
                de atención, los documentos de identidad y todo lo demás se revisan igual.
              </span>
            </span>
          </label>
        ) : (
          <p className="text-sm text-danger">
            Tu usuario es de solo lectura, así que no podés confirmar. Pedile a quien sube los
            cierres que revise esta pantalla.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-primary"
            disabled={!canWrite || !aceptado || confirmando}
            title={!aceptado && canWrite
              ? 'Marcá primero la casilla: confirmar queda registrado con tu usuario'
              : undefined}
            onClick={onConfirmar}>
            {confirmando ? 'Continuando…' : 'Sí, es la misma empresa — continuar'}
          </button>
          <button type="button" className="btn-secondary" disabled={confirmando}
            onClick={onCancelar}>
            No, me equivoqué de jornada
          </button>
        </div>

        <ul className="text-xs text-fg-muted list-disc pl-4 space-y-0.5">
          <li>
            Si confirmás, la carga sigue con el archivo que ya subiste: no hace falta volver a
            subir los 35 MB.
          </li>
          <li>
            Si te equivocaste de jornada, no se escribe nada. Volvés al listado para subir el
            archivo en la jornada que corresponde.
          </li>
        </ul>

        {error && (
          <div className="rounded-lg border border-danger/40 bg-danger-soft/40 p-3 text-sm">
            <div className="font-semibold text-danger">{error.titulo}</div>
            {error.detalle && (
              <div className="text-fg-muted mt-0.5 break-words">{error.detalle}</div>
            )}
            {error.sugerencia && (
              <div className="text-xs text-fg-muted mt-1">{error.sugerencia}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Por qué se detuvo, en una línea y sin jerga. */
const MOTIVOS = {
  sin_coincidencia:
    'El nombre que trae el archivo no se parece al de la empresa de esta jornada.',
  otra_empresa:
    'El nombre que trae el archivo se parece más a OTRA empresa del portal que a la de esta jornada.',
  ambigua:
    'El nombre que trae el archivo le cuadra a más de una empresa del portal, así que el sistema no puede elegir por su cuenta.',
  varias_empresas:
    'El archivo trae más de una empresa. Un cierre es de una sola jornada, o sea de una sola empresa.',
  sin_empresa:
    'El archivo no dice de qué empresa es: la columna «empresa» de la hoja «Encuesta» viene vacía.',
  jornada_sin_empresa:
    'Esta jornada no tiene empresa anotada en el portal, así que no hay contra qué comparar el nombre del archivo.',
};

const TONOS_FICHA = {
  archivo: 'border-info/40 bg-info-soft/30',
  portal: 'border-line bg-surface-elev/60',
};

function Ficha({ titulo, tono, children }) {
  return (
    <div className={`rounded-lg border p-3 ${TONOS_FICHA[tono] || TONOS_FICHA.portal}`}>
      <div className="text-xs uppercase tracking-wide text-fg-muted mb-1">{titulo}</div>
      {children}
    </div>
  );
}

function BarraParecido({ pct }) {
  const v = Math.max(0, Math.min(100, Number(pct) || 0));
  // Verde no: aunque se parezcan mucho, acá nada está resuelto hasta que una
  // persona decide. El color no puede sugerir «esto ya está bien».
  return (
    <div className="h-2 w-full rounded-full bg-sunken overflow-hidden"
      role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}
      aria-label="Parecido entre los dos nombres">
      <div className="h-full bg-warning" style={{ width: `${v}%` }} />
    </div>
  );
}

function nombreDe(ficha) {
  if (!ficha) return null;
  return ficha.nombre_legal || ficha.nombre_comercial || null;
}

/**
 * Qué está afirmando exactamente quien marca la casilla.
 *
 * No es una sola frase con huecos: «confirmo que A y B son la misma empresa»
 * no significa nada cuando el archivo no trae nombre, y menos todavía cuando
 * los dos nombres son idénticos (el caso ambiguo: dos fichas distintas del
 * portal se llaman igual, y lo que se decide es a CUÁL de las dos va).
 */
function fraseConfirmacion({ hayVarias, enElArchivo, nombreJornada, codigo }) {
  const jornadaTxt = codigo ? `la jornada ${codigo}` : 'esta jornada';
  if (!nombreJornada) {
    return `Confirmo que este archivo corresponde a ${jornadaTxt}, aunque el portal no `
      + 'tenga anotada la empresa de esa jornada.';
  }
  if (hayVarias) {
    return `Confirmo que las empresas que trae el archivo corresponden a «${nombreJornada}», `
      + `la empresa de ${jornadaTxt}, y que los datos deben quedar ahí.`;
  }
  if (!enElArchivo) {
    return `Confirmo que este archivo es de «${nombreJornada}», la empresa de ${jornadaTxt}, `
      + 'aunque el archivo no diga de qué empresa es.';
  }
  if (mismoTexto(enElArchivo, nombreJornada)) {
    return `Confirmo que este archivo es de «${nombreJornada}», la empresa de ${jornadaTxt}, `
      + 'y no de la otra empresa del portal que está registrada con el mismo nombre.';
  }
  return `Confirmo que «${enElArchivo}» y «${nombreJornada}» son la misma empresa, y que los `
    + `datos de este archivo deben quedar en ${jornadaTxt}.`;
}

/** Mismo nombre salvo mayúsculas, tildes y puntuación (criterio del servidor). */
function mismoTexto(a, b) {
  const clave = (s) => norm(s).replace(/[^A-Z0-9]+/g, '');
  return clave(a) === clave(b);
}

/** ¿Esta empresa del portal le cuadra al archivo MEJOR que la de la jornada? */
function cuadraMejor(candidata, parecidoJornada, empresaJornada) {
  if (candidata.coincidencia === 'exacta' && empresaJornada?.coincidencia !== 'exacta') return true;
  if (typeof candidata.parecido_pct !== 'number' || parecidoJornada == null) return false;
  return candidata.parecido_pct > parecidoJornada;
}
