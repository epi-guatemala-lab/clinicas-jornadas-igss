import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiAplicarCarga, apiCrearCarga } from '../api/endpoints';
import { useAuth } from '../hooks/useAuth';
import { useCargaJob, esFinal } from '../hooks/useCargaJob';
import { describirError } from '../utils/apiError';
import { ESTADO_CARGA, fmtBytes, resultadoCarga } from '../utils/carga';
import { fmtN } from '../utils/format';
import ResumenCarga from '../components/cargas/ResumenCarga';
import BloqueosCarga from '../components/cargas/BloqueosCarga';
import ConflictosCarga from '../components/cargas/ConflictosCarga';
import HistorialCargas from '../components/cargas/HistorialCargas';

const EXTENSIONES = ['.xlsx', '.xlsm'];
const LIMITE_MB = 120;   // config.CARGA_MAX_MB del backend

/**
 * Carga de datos — el Excel maestro (BASE_EPIDE) en una sola pantalla.
 *
 * Reemplaza al acordeón escondido dentro de Epidemiología: la carga ya no toca
 * solo el tamizaje, sino jornadas, empresas, personal, viáticos y laboratorio,
 * así que vive en su propia sección del menú y no colgando de un tablero.
 *
 * Tres cosas que esta pantalla NO puede hacer, porque desde acá se decide
 * sobrescribir datos reales:
 *  1. Decir «ya estaba cargado, no cambió nada» mirando solo la capa
 *     epidemiológica: la operativa vuelve a escribir aunque el archivo sea el
 *     mismo (ver `resultadoCarga`).
 *  2. Enterrar lo que SÍ se sobrescribe debajo de lo meramente informativo.
 *  3. Prometerle a quien no puede cargar un formulario que el servidor le va a
 *     rechazar: el visor de solo lectura ve el historial, no el formulario.
 *
 * El archivo se sube UNA sola vez: la aplicación reusa el que quedó en el
 * servidor de la previsualización (`POST /api/cargas/{id}/aplicar`). Subir
 * 34 MB desde una máquina real toma unos 80 segundos, así que hacerlo dos
 * veces era minuto y medio de espera regalado.
 */
export default function Cargas() {
  const { canWrite } = useAuth();
  const [archivo, setArchivo] = useState(null);
  const [cargaId, setCargaId] = useState(null);
  const [soloLectura, setSoloLectura] = useState(false);   // viendo una del historial
  const [pctSubida, setPctSubida] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [reenviando, setReenviando] = useState(false);     // el servidor pidió el archivo otra vez
  const [error, setError] = useState(null);               // {titulo, detalle, sugerencia}
  const [tokenHistorial, setTokenHistorial] = useState(0);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  const { carga, error: errorSondeo, sondeando, refrescar } = useCargaJob(cargaId);

  // Al terminar el trabajo, refrescar el historial una sola vez.
  const estadoPrevio = useRef(null);
  useEffect(() => {
    if (carga && esFinal(carga.estado) && estadoPrevio.current !== carga.id + carga.estado) {
      estadoPrevio.current = carga.id + carga.estado;
      setTokenHistorial((t) => t + 1);
    }
  }, [carga]);

  // Si el usuario cierra la pestaña mientras sube, cortar la petición.
  useEffect(() => () => abortRef.current?.abort(), []);

  const limpiar = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setArchivo(null); setCargaId(null); setSoloLectura(false);
    setPctSubida(null); setEnviando(false); setReenviando(false); setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  function elegir(f) {
    setError(null); setCargaId(null); setSoloLectura(false); setPctSubida(null);
    if (!f) { setArchivo(null); return; }
    const nombre = f.name.toLowerCase();
    if (!EXTENSIONES.some((x) => nombre.endsWith(x))) {
      setArchivo(null);
      setError({
        titulo: 'Ese archivo no es un Excel',
        detalle: `Elegiste «${f.name}».`,
        sugerencia: `Tiene que ser el archivo maestro con extensión ${EXTENSIONES.join(' o ')}.`,
      });
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    if (f.size > LIMITE_MB * 1024 * 1024) {
      setArchivo(null);
      setError({
        titulo: 'El archivo es demasiado grande',
        detalle: `Pesa ${fmtBytes(f.size)} y el límite del servidor es de ${LIMITE_MB} MB.`,
        sugerencia: 'Confirmá que estás subiendo el Excel maestro y no un respaldo con hojas de más.',
      });
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setArchivo(f);
  }

  async function previsualizar() {
    if (!archivo) return;
    setError(null); setEnviando(true); setReenviando(false);
    setPctSubida(0); setCargaId(null); setSoloLectura(false);
    abortRef.current = new AbortController();
    try {
      const r = await apiCrearCarga(archivo, 'PREVIEW', {
        signal: abortRef.current.signal,
        onUploadProgress: (e) => {
          if (e.total) setPctSubida(Math.round((e.loaded * 100) / e.total));
        },
      });
      setPctSubida(100);
      setCargaId(r.id);
    } catch (e) {
      setError(describirError(e, 'subir el archivo'));
      setPctSubida(null);
    } finally {
      setEnviando(false);
      abortRef.current = null;
    }
  }

  async function aplicar() {
    if (!cargaId) return;
    const ok = window.confirm(
      'Vas a aplicar la carga: los datos entran a la base y quedan visibles para todos.\n\n'
      + 'Mientras se aplica, el portal queda en solo lectura unos segundos: nadie más '
      + 'puede guardar cambios hasta que termine.\n\n'
      + '¿Confirmás?',
    );
    if (!ok) return;
    setError(null); setEnviando(true); setReenviando(false); setPctSubida(null);
    abortRef.current = new AbortController();
    try {
      const r = await apiAplicarCarga(cargaId, archivo, {
        signal: abortRef.current.signal,
        // Solo si el servidor todavía no tiene la ruta que reusa el archivo.
        onReenvio: () => { setReenviando(true); setPctSubida(0); },
        onUploadProgress: (e) => {
          if (e.total) setPctSubida(Math.round((e.loaded * 100) / e.total));
        },
      });
      if (r?.id && r.id !== cargaId) setCargaId(r.id);
      else refrescar();
    } catch (e) {
      setError(describirError(e, 'aplicar la carga'));
    } finally {
      setEnviando(false);
      setReenviando(false);
      setPctSubida(null);
      abortRef.current = null;
    }
  }

  function cancelarSubida() {
    abortRef.current?.abort();
    abortRef.current = null;
    setEnviando(false);
    setReenviando(false);
    setPctSubida(null);
  }

  const enProceso = carga && !esFinal(carga.estado);
  const estadoBadge = carga ? (ESTADO_CARGA[carga.estado] || { texto: carga.estado, clase: 'badge-neutral' }) : null;
  const esPreview = carga?.modo === 'PREVIEW';
  // El backend guarda el Excel de la previsualización solo unas horas (trae
  // DPI en claro) y expone si todavía lo tiene (`archivo_disponible`). Ofrecer
  // "Aplicar" sin fijarse en esto llevaba a un clic que solo podía fallar: si
  // además el navegador ya no tiene el archivo en memoria (se recargó la
  // página, o se abrió esta carga desde el historial), no hay de dónde
  // reenviarlo. Con el archivo en memoria SIEMPRE se puede —el 410 dispara un
  // reenvío automático— así que ese caso sí habilita el botón.
  const archivoDisponible = Boolean(archivo) || Boolean(carga?.archivo_disponible);
  const puedeAplicar = carga?.estado === 'OK' && esPreview && !soloLectura && canWrite
    && !enviando && archivoDisponible;
  const archivoVencidoSinLocal = carga?.estado === 'OK' && esPreview && !soloLectura
    && canWrite && !archivoDisponible;

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Carga de datos</h1>
        <p className="text-sm text-fg-muted max-w-3xl">
          Subí el Excel maestro <b>BASE_EPIDE</b> y el sistema actualiza todo de una sola vez:
          epidemiología, jornadas, empresas, personal, viáticos y laboratorio. Primero vas a ver
          una previsualización de lo que entraría; nada se guarda hasta que lo aplicás.
        </p>
      </header>

      {!canWrite && (
        <div className="rounded-lg border border-info/40 bg-info-soft/40 p-3 text-sm space-y-1">
          <p>
            <b className="text-info">Tu usuario es de solo lectura.</b> Podés revisar el historial
            de cargas y abrir el detalle de cualquiera de ellas.
          </p>
          <p className="text-fg-muted text-xs">
            Subir el Excel maestro reescribe jornadas, empresas, viáticos y fichas de personas, así
            que está reservado a un administrador con permiso de edición. Por eso no aparece acá el
            formulario de carga: pedirle el archivo al servidor sería un rechazo seguro.
          </p>
        </div>
      )}

      {/* ── Paso 1: elegir el archivo (solo quien puede cargar) ────── */}
      {canWrite && (
        <section className="card p-4 space-y-3">
          <h2 className="font-semibold text-fg">1. Elegí el archivo</h2>
          <div className="flex flex-wrap items-center gap-3">
            {/* El botón nativo del navegador dice "Choose File" en inglés: se
                oculta el input y se usa una etiqueta propia, en español. */}
            <label className={`btn-secondary inline-flex items-center gap-2 ${
              (enviando || enProceso) ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
              <input
                ref={inputRef} type="file" accept=".xlsx,.xlsm" className="sr-only"
                disabled={enviando || enProceso}
                onChange={(e) => elegir(e.target.files?.[0])}
              />
              Elegir archivo…
            </label>
            {archivo ? (
              <span className="text-sm text-fg">
                {archivo.name} <span className="text-fg-muted text-xs">· {fmtBytes(archivo.size)}</span>
              </span>
            ) : (
              <span className="text-sm text-fg-muted">Ningún archivo elegido</span>
            )}
            {(archivo || cargaId) && (
              <button type="button" className="btn-secondary text-xs"
                onClick={limpiar} disabled={enviando}>
                Empezar de nuevo
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary"
              onClick={previsualizar}
              disabled={!archivo || enviando || enProceso}>
              {enviando && pctSubida !== null ? 'Subiendo…' : 'Previsualizar la carga'}
            </button>
            <p className="text-xs text-fg-muted">
              La previsualización no guarda nada: te muestra qué entraría y qué cambiaría antes de
              decidir. Se sube una sola vez — al aplicar se reusa este mismo archivo.
            </p>
          </div>

          {pctSubida !== null && enviando && (
            <div className="space-y-1">
              <Barra pct={pctSubida} />
              <div className="flex items-center justify-between text-xs text-fg-muted">
                <span>Subiendo el archivo… {pctSubida}%</span>
                <button type="button" className="text-danger hover:underline" onClick={cancelarSubida}>
                  Cancelar
                </button>
              </div>
              {reenviando && (
                <p className="text-[11px] text-fg-subtle">
                  Este servidor todavía no reusa el archivo de la previsualización, así que hay que
                  enviarlo otra vez. Es la parte lenta: no cierres la pantalla.
                </p>
              )}
            </div>
          )}

          {error && <BannerError error={error} />}
        </section>
      )}

      {/* ── Paso 2: avance del proceso ────────────────────────────── */}
      {carga && (
        <section className="card p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-fg">
              {canWrite ? '2. ' : ''}Proceso {soloLectura ? `de la carga #${carga.id}` : 'en el servidor'}
            </h2>
            <div className="flex items-center gap-2 text-xs">
              {estadoBadge && <span className={estadoBadge.clase}>{estadoBadge.texto}</span>}
              <span className="text-fg-subtle">carga #{carga.id}</span>
            </div>
          </div>

          {enProceso && (
            <div className="space-y-1">
              <Barra pct={carga.progreso || 0} />
              <div className="flex items-center justify-between text-xs text-fg-muted">
                <span>{carga.etapa || 'Preparando…'}</span>
                <span className="tabular-nums">{carga.progreso ?? 0}%</span>
              </div>
              <p className="text-[11px] text-fg-subtle">
                El proceso corre en el servidor y toma la base entera mientras dura: durante esos
                segundos el portal queda <b>en solo lectura</b> —se puede consultar, pero nadie
                puede guardar cambios—. Podés cerrar esta pantalla: al volver lo encontrás en el
                historial, abajo.
              </p>
            </div>
          )}

          {!canWrite && !enProceso && (
            <p className="text-xs text-fg-muted">
              Estás viendo el resultado de una carga que hizo otra persona.
            </p>
          )}

          {errorSondeo && (
            <BannerError error={describirError(errorSondeo, 'consultar el avance')}
              accion={<button type="button" className="btn-secondary text-xs" onClick={refrescar}>
                Reintentar
              </button>} />
          )}

          {!enProceso && !sondeando && carga.estado === 'FALLIDA' && (
            <div className="rounded-lg border border-danger/40 bg-danger-soft/40 p-3 space-y-2">
              <h3 className="font-semibold text-danger">La carga falló y no se guardó nada</h3>
              {carga.error && (
                <p className="text-sm text-fg-muted break-words">{carga.error}</p>
              )}
              <p className="text-xs text-fg-muted">
                La base quedó como estaba. Si el mensaje no dice qué corregir en el archivo,
                avisale al equipo técnico con el número de carga y la hora.
              </p>
              {archivo && canWrite && (
                <button type="button" className="btn-secondary text-xs" onClick={previsualizar}>
                  Reintentar con el mismo archivo
                </button>
              )}
            </div>
          )}

          {carga.estado === 'BLOQUEADA' && (
            <BloqueosCarga
              bloqueos={carga.bloqueos}
              canWrite={canWrite}
              onReintentar={archivo && canWrite ? previsualizar : null}
            />
          )}

          {carga.estado === 'OK' && (
            <div className="space-y-4">
              <BannerResultado carga={carga} esPreview={esPreview} />

              {/* Primero lo que toca datos que ya estaban en la base. */}
              <ConflictosCarga conflictos={carga.conflictos} aplicado={!esPreview} />

              {puedeAplicar && (
                <div className="space-y-2 border-t border-line-subtle pt-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" className="btn-primary" onClick={aplicar} disabled={enviando}>
                      {enviando ? 'Aplicando…' : 'Aplicar la carga'}
                    </button>
                    <button type="button" className="btn-secondary" onClick={limpiar} disabled={enviando}>
                      Descartar
                    </button>
                  </div>
                  <p className="text-xs text-fg-muted max-w-3xl">
                    Se aplica con el archivo que ya subiste: no hay que volver a subirlo. Mientras
                    se aplica, el portal queda <b>en solo lectura</b> unos segundos —las demás
                    personas pueden consultar, pero no guardar—. Antes de escribir, el sistema saca
                    un respaldo de la base.
                  </p>
                </div>
              )}

              {archivoVencidoSinLocal && (
                <div className="rounded-lg border border-warning/50 bg-warning-soft/40 p-3 text-sm">
                  <p className="font-semibold text-warning">
                    El archivo de esta previsualización ya venció
                  </p>
                  <p className="mt-1 text-xs text-fg-muted max-w-3xl">
                    Por seguridad (trae datos personales) el servidor lo guarda solo unas horas y ya
                    lo borró. Los números de arriba siguen siendo válidos como referencia, pero para
                    aplicarlos hay que elegir el archivo otra vez y previsualizar de nuevo.
                  </p>
                </div>
              )}

              {/* Después, el comprobante: es informativo, no decide nada. */}
              <ResumenCarga resumen={carga.resumen} aplicado={!esPreview} />

              {!esPreview && (
                <div className="flex flex-wrap items-center gap-3 border-t border-line-subtle pt-3 text-sm">
                  <span className="text-fg-muted">Revisá el resultado en:</span>
                  <Link className="btn-secondary text-xs" to="/hallazgos">Epidemiología</Link>
                  <Link className="btn-secondary text-xs" to="/jornadas">Jornadas</Link>
                  <Link className="btn-secondary text-xs" to="/viaticos">Viáticos</Link>
                  <Link className="btn-secondary text-xs" to="/empresas">Empresas</Link>
                  {canWrite && (
                    <button type="button" className="btn-secondary text-xs" onClick={limpiar}>
                      Cargar otro archivo
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* El detalle todavía no llegó: pidiéndolo, o no se pudo. Sin esto, un
          403 o un 404 al abrir una carga del historial dejaba la pantalla
          exactamente igual que antes de hacer clic. */}
      {cargaId && !carga && (
        <section className="card p-4">
          {errorSondeo ? (
            <BannerError error={describirError(errorSondeo, 'abrir el detalle de la carga')}
              accion={<button type="button" className="btn-secondary text-xs" onClick={refrescar}>
                Reintentar
              </button>} />
          ) : (
            <p className="text-sm text-fg-muted">Abriendo el detalle de la carga #{cargaId}…</p>
          )}
        </section>
      )}

      {/* ── Historial ─────────────────────────────────────────────── */}
      <HistorialCargas
        recargarToken={tokenHistorial}
        onVerCarga={(id) => {
          setSoloLectura(true);
          setError(null);
          setCargaId(id);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </div>
  );
}

/**
 * Qué pasó, mirando las DOS capas.
 *
 * La capa epidemiológica es idempotente por archivo y avisa con `NOOP` cuando
 * reconoce uno ya cargado. La operativa no: vuelve a escribir jornadas,
 * empresas, viáticos y fichas. Anunciar «este archivo ya se había cargado, no
 * se duplicó nada» mirando solo el epi es faltar a la verdad justo cuando se
 * acaban de sobrescribir seis jornadas.
 */
function BannerResultado({ carga, esPreview }) {
  const res = resultadoCarga(carga.resumen);

  if (res.sinNingunCambio) {
    return (
      <Aviso tono="info" titulo="No hay nada que cambiar">
        Ni el tamizaje ni la parte operativa tienen novedades respecto de lo que ya está en el
        sistema{res.epiNoop ? ', y este archivo ya se había cargado antes' : ''}. Si esperabas datos
        nuevos, revisá que el Excel sea el del mes que querés cargar.
      </Aviso>
    );
  }

  if (res.epiNoop) {
    return (
      <Aviso tono="warning" titulo="El tamizaje de este archivo ya estaba cargado">
        No se duplica ninguna persona ni ningún hallazgo
        {res.lotePrevio != null ? ` (ya entró con el lote ${res.lotePrevio})` : ''}.{' '}
        {res.operativaVolvioAEscribir ? (
          <>
            Pero la carga <b>no es inocua</b>: la parte operativa —jornadas, empresas, viáticos y
            fichas— {esPreview ? 'se vuelve a escribir' : 'se volvió a escribir'} igual.
            {res.cambiosJornadas > 0 && (
              <> {esPreview ? 'Cambian' : 'Cambiaron'} <b>{fmtN(res.cambiosJornadas)}</b>{' '}
                {res.cambiosJornadas === 1 ? 'jornada' : 'jornadas'} que ya estaban guardadas.</>
            )}
            {res.cambiosJornadas === 0 && res.repaso > 0 && (
              <> Ninguna jornada cambia de contenido.</>
            )}
            {res.familiasSinMedir.length > 0 && (
              <> El servidor no informa cuántas empresas, fichas o registros de personal cambian de
                verdad: solo que se repasaron uno por uno contra el archivo.</>
            )}
            {' '}El detalle está abajo.
          </>
        ) : (
          <>La parte operativa tampoco cambia nada.</>
        )}
      </Aviso>
    );
  }

  return esPreview ? (
    <Aviso tono="neutral" titulo="Previsualización lista. Todavía no se escribió nada.">
      Revisá primero lo que se sobrescribe y después el comprobante; nada entra hasta que aplicás.
    </Aviso>
  ) : (
    <Aviso tono="success" titulo="Carga aplicada. Los datos ya están en el sistema.">
      Antes de escribir se guardó un respaldo de la base.
    </Aviso>
  );
}

const TONOS = {
  info: { caja: 'border-info/40 bg-info-soft/40', titulo: 'text-info' },
  warning: { caja: 'border-warning/40 bg-warning-soft/40', titulo: 'text-warning' },
  success: { caja: 'border-success/40 bg-success-soft/40', titulo: 'text-success' },
  neutral: { caja: 'border-line bg-surface-elev', titulo: 'text-fg' },
};

function Aviso({ tono = 'neutral', titulo, children }) {
  const t = TONOS[tono] || TONOS.neutral;
  return (
    <div className={`rounded-lg border p-3 text-sm ${t.caja}`}>
      <b className={t.titulo}>{titulo}</b>{' '}
      <span className="text-fg-muted">{children}</span>
    </div>
  );
}

function Barra({ pct }) {
  const v = Math.max(0, Math.min(100, Number(pct) || 0));
  return (
    <div className="h-2 w-full rounded-full bg-sunken overflow-hidden"
      role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full bg-accent transition-[width] duration-300 ease-out"
        style={{ width: `${v}%` }} />
    </div>
  );
}

function BannerError({ error, accion }) {
  return (
    <div className="rounded-lg border border-danger/40 bg-danger-soft/40 p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-danger">{error.titulo}</div>
          {error.detalle && <div className="text-fg-muted mt-0.5 break-words">{error.detalle}</div>}
          {error.sugerencia && <div className="text-xs text-fg-muted mt-1">{error.sugerencia}</div>}
        </div>
        {accion}
      </div>
    </div>
  );
}
