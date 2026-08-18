import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  apiAplicarCarga, apiConfirmarEmpresaCierre, apiCrearCarga, apiGetCierreJornada,
  apiGetJornada, apiGetReferidos,
} from '../api/endpoints';
import { useAuth } from '../hooks/useAuth';
import { useCargaJob, esFinal } from '../hooks/useCargaJob';
import { describirError } from '../utils/apiError';
import { ESTADO_CARGA, etiquetaDeClave, fmtBytes, separarBloqueoEmpresa } from '../utils/carga';
import { avisoSiHayCargaEnCurso } from '../utils/carrilCarga';
import { leerAvisosProceso, leerCotejo, textoParaReportar } from '../utils/divergencias';
import { fmtN } from '../utils/format';
import BloqueosCarga from '../components/cargas/BloqueosCarga';
import ConfirmarEmpresaCierre from '../components/cargas/ConfirmarEmpresaCierre';
import ConflictosCarga from '../components/cargas/ConflictosCarga';

const EXTENSIONES = ['.xlsx', '.xlsm'];
const LIMITE_MB = 60;    // config.CIERRE_MAX_MB del backend
const TIPOS_CON_ANALISIS = ['SIPRESALUD_JORNADA', 'CE_JORNADA'];

/**
 * Análisis de cierre de UNA jornada — «N - Análisis de Datos …».xlsm.
 *
 * La ficha de la jornada (JornadaModal) trae el botón que abre esta página: el
 * flujo de subida (previsualizar → aplicar, avance en el servidor, bloqueos con
 * alta de patologías) es el MISMO del maestro, así que se reutilizan sus
 * componentes; lo que cambia es el ancla (los datos entran a ESTA jornada, no a
 * la base histórica) y el comprobante, que muestra el universo de la jornada:
 * triaje, encuesta, laboratorio y hallazgos referibles.
 *
 * Al final queda el listado de colaboradores con hallazgos para referir —la
 * hoja que Sipresalud imprimía del Excel— regenerado desde el portal.
 */
export default function AnalisisJornada() {
  const { id } = useParams();
  const jornadaId = Number(id);
  const navigate = useNavigate();
  const { canWrite } = useAuth();
  const [jornada, setJornada] = useState(null);
  const [cierre, setCierre] = useState(null);
  const [cierreToken, setCierreToken] = useState(0);

  const [archivo, setArchivo] = useState(null);
  const [cargaId, setCargaId] = useState(null);
  const [pctSubida, setPctSubida] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  // Acción que quedó sin hacer porque el servidor estaba ocupado, para poder
  // ofrecer «Reintentar» sin que haya que volver a elegir el archivo.
  const [reintento, setReintento] = useState(null);   // 'previsualizar' | 'aplicar' | null
  const [confirmandoEmpresa, setConfirmandoEmpresa] = useState(false);
  const [errorEmpresa, setErrorEmpresa] = useState(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  const { carga, error: errorSondeo, sondeando, refrescar } = useCargaJob(cargaId);

  useEffect(() => {
    apiGetJornada(jornadaId).then(setJornada).catch(() => setJornada(null));
  }, [jornadaId]);

  useEffect(() => {
    apiGetCierreJornada(jornadaId).then(setCierre).catch(() => setCierre(null));
  }, [jornadaId, cierreToken]);

  // Al llegar a estado final, refrescar el estado del cierre (KPIs de la ficha).
  const estadoPrevio = useRef(null);
  useEffect(() => {
    if (carga && esFinal(carga.estado) && estadoPrevio.current !== carga.id + carga.estado) {
      estadoPrevio.current = carga.id + carga.estado;
      setCierreToken((t) => t + 1);
    }
  }, [carga]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // El cotejo de empresa es el ÚNICO bloqueo que no se arregla corrigiendo el
  // archivo, sino decidiendo: se aparta del resto para mostrarlo con los dos
  // nombres y las dos salidas explícitas.
  const { empresa: bloqueoEmpresa, resto: bloqueosRestantes } = useMemo(
    () => separarBloqueoEmpresa(carga?.bloqueos), [carga?.bloqueos]);
  // ¿Esta previsualización se corrió con la empresa confirmada a mano? Se lee
  // de lo que devolvió el servidor (no de una variable de la pantalla): está
  // atado al archivo exacto que se revisó.
  const empresaConfirmadaEnPreview = Boolean(
    carga?.resumen?.cierre?.empresa_match?.confirmada);

  const limpiar = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setArchivo(null); setCargaId(null); setPctSubida(null);
    setEnviando(false); setError(null); setErrorEmpresa(null); setReintento(null);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  function elegir(f) {
    setError(null); setErrorEmpresa(null); setCargaId(null); setPctSubida(null);
    setReintento(null);
    if (!f) { setArchivo(null); return; }
    const nombre = f.name.toLowerCase();
    if (!EXTENSIONES.some((x) => nombre.endsWith(x))) {
      setArchivo(null);
      setError({
        titulo: 'Ese archivo no es un Excel',
        detalle: `Elegiste «${f.name}».`,
        sugerencia: 'Tiene que ser el archivo de cierre («N - Análisis de Datos …») con extensión .xlsx o .xlsm.',
      });
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    if (f.size > LIMITE_MB * 1024 * 1024) {
      setArchivo(null);
      setError({
        titulo: 'El archivo es demasiado grande',
        detalle: `Pesa ${fmtBytes(f.size)} y el límite para un cierre de jornada es de ${LIMITE_MB} MB.`,
        sugerencia: `Un cierre pesa unos 35 MB. Si el tuyo pesa más, revisá que no sea el Excel MAESTRO
          (ese se sube en «Carga de datos»).`,
      });
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setArchivo(f);
  }

  async function previsualizar() {
    if (!archivo) return;
    setError(null); setReintento(null); setEnviando(true); setPctSubida(null);
    // El servidor atiende UNA carga por vez. Preguntarle antes de empezar
    // ahorra subir 35 MB para que los rechace, y sobre todo evita que el
    // rechazo llegue a mitad de la subida: ahí el navegador no lo muestra y la
    // barra queda congelada (ver utils/carrilCarga).
    const ocupado = await avisoSiHayCargaEnCurso();
    if (ocupado) {
      setError(ocupado); setReintento('previsualizar'); setEnviando(false);
      return;
    }
    setPctSubida(0); setCargaId(null);
    abortRef.current = new AbortController();
    try {
      const r = await apiCrearCarga(archivo, 'PREVIEW', {
        jornadaId,
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
      'Vas a aplicar la carga del análisis de cierre: los datos entran a la base y quedan '
      + 'visibles para todos.\n\nMientras se aplica, el portal queda en solo lectura unos segundos.\n\n¿Confirmás?',
    );
    if (!ok) return;
    setError(null); setReintento(null); setEnviando(true); setPctSubida(null);
    // Igual que al previsualizar: si el servidor está ocupado, ni siquiera
    // empezamos (aplicar puede terminar reenviando el archivo si el del
    // servidor venció, así que también puede quedar colgado a mitad).
    const ocupado = await avisoSiHayCargaEnCurso();
    if (ocupado) {
      setError(ocupado); setReintento('aplicar'); setEnviando(false);
      return;
    }
    abortRef.current = new AbortController();
    try {
      const r = await apiAplicarCarga(cargaId, archivo, {
        jornadaId,
        // Si esta previsualización se corrió con la empresa confirmada por la
        // operadora, aplicar tiene que llevar la misma confirmación: es el
        // MISMO archivo. Solo hace falta en el camino de excepción (el archivo
        // del servidor venció y hay que volver a subirlo); por el camino normal
        // el servidor lo lee del resumen de la previsualización.
        confirmarEmpresa: empresaConfirmadaEnPreview,
        signal: abortRef.current.signal,
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
      setPctSubida(null);
      abortRef.current = null;
    }
  }

  /**
   * «Sí, es la misma empresa»: repite la carga bloqueada con la confirmación.
   *
   * Camino normal: el servidor conservó el .xlsm de la carga bloqueada, así que
   * no se vuelve a subir nada (35 MB son ~80 s). Si ese archivo ya caducó
   * —se guarda unas horas porque trae datos personales— el servidor responde
   * 410; ahí, si el navegador todavía tiene el archivo elegido, se sube de
   * nuevo llevando la confirmación que la operadora acaba de dar, en vez de
   * dejarla sin salida (mismo criterio que aplicar una previsualización).
   *
   * Siempre en PREVIEW, aunque la carga detenida fuera un APLICAR: confirmar la
   * empresa no puede convertirse en escribir sin revisar. Después se aplica con
   * el botón de siempre.
   */
  async function confirmarEmpresa() {
    if (!cargaId || !canWrite) return;
    setErrorEmpresa(null); setConfirmandoEmpresa(true);
    try {
      const r = await apiConfirmarEmpresaCierre(jornadaId, cargaId);
      if (r?.id) setCargaId(r.id); else refrescar();
    } catch (e) {
      if (e?.response?.status === 410 && archivo) {
        try {
          setPctSubida(0); setEnviando(true);
          const r = await apiCrearCarga(archivo, 'PREVIEW', {
            jornadaId,
            confirmarEmpresa: true,
            onUploadProgress: (ev) => {
              if (ev.total) setPctSubida(Math.round((ev.loaded * 100) / ev.total));
            },
          });
          setPctSubida(100);
          setCargaId(r.id);
        } catch (e2) {
          setErrorEmpresa(describirError(e2, 'confirmar la empresa'));
        } finally {
          setEnviando(false);
        }
      } else {
        setErrorEmpresa(describirError(e, 'confirmar la empresa'));
      }
    } finally {
      setConfirmandoEmpresa(false);
    }
  }

  /** «No, me equivoqué de jornada»: no se escribe nada y vuelve al listado. */
  function rechazarEmpresa() {
    limpiar();
    navigate('/jornadas');
  }

  if (!jornada) {
    return (
      <div className="space-y-4">
        <VolverJornadas />
        <p className="text-sm text-fg-muted">Cargando la jornada…</p>
      </div>
    );
  }

  const tipoValido = TIPOS_CON_ANALISIS.includes(jornada.tipo);
  const cancelada = jornada.estado === 'CANCELADA';
  const puedeCargar = canWrite && tipoValido && !cancelada;

  const enProceso = carga && !esFinal(carga.estado);
  const estadoBadge = carga ? (ESTADO_CARGA[carga.estado] || { texto: carga.estado, clase: 'badge-neutral' }) : null;
  const esPreview = carga?.modo === 'PREVIEW';
  const archivoDisponible = Boolean(archivo) || Boolean(carga?.archivo_disponible);
  const puedeAplicar = carga?.estado === 'OK' && esPreview && canWrite
    && !enviando && archivoDisponible;
  const resumenCierre = carga?.resumen?.cierre || null;

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-sm">
          <button type="button" className="text-igss-primary hover:underline"
            onClick={() => navigate('/jornadas')}>
            ← Jornadas
          </button>
        </div>
        <h1 className="text-2xl font-bold">Análisis de cierre · {jornada.codigo}</h1>
        <p className="text-sm text-fg-muted max-w-3xl">
          {jornada.empresa_nombre}{jornada.tema ? ` · ${jornada.tema}` : ''} ·{' '}
          {jornada.fecha_inicio}
          {jornada.fecha_fin && jornada.fecha_fin !== jornada.fecha_inicio ? ` al ${jornada.fecha_fin}` : ''}.
          Acá se sube el archivo «N - Análisis de Datos …» que genera Sipresalud al cerrar la
          jornada: triaje, encuesta, laboratorio y hallazgos quedan asociados a ESTA jornada.
        </p>
      </header>

      {cierre?.carga_id && <EstadoCierre cierre={cierre} jornada={jornada} />}

      {/* Informativos, no alarmas: acá no hay nada que la operadora pueda hacer
          —ni siquiera se muestra el formulario de subida—, así que van en azul.
          El naranja queda reservado para lo que se resuelve apretando algo. */}
      {!tipoValido && (
        <Aviso tono="info" titulo="Esta jornada no lleva análisis de cierre">
          Es de tipo «{jornada.tipo}»: solo las jornadas de clínica (SIPRESALUD / Clínicas de
          Empresa) generan el archivo de análisis de datos.
        </Aviso>
      )}
      {cancelada && (
        <Aviso tono="info" titulo="La jornada está cancelada">
          Una jornada cancelada no admite carga de análisis.
        </Aviso>
      )}
      {!canWrite && tipoValido && !cancelada && (
        <Aviso tono="info" titulo="Tu usuario es de solo lectura">
          Podés ver el estado del análisis de esta jornada, pero no subir archivos.
        </Aviso>
      )}

      {/* ── Subida (solo quien puede) ─────────────────────────────── */}
      {puedeCargar && (
        <section className="card p-4 space-y-3">
          <h2 className="font-semibold text-fg">Subir el archivo de cierre</h2>
          <div className="flex flex-wrap items-center gap-3">
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
              <span className="text-sm text-fg-muted">
                El archivo tal como lo genera Sipresalud (~35 MB), sin convertirlo
              </span>
            )}
            {(archivo || cargaId) && (
              <button type="button" className="btn-secondary text-xs"
                onClick={limpiar} disabled={enviando}>
                Empezar de nuevo
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary" onClick={previsualizar}
              disabled={!archivo || enviando || enProceso}>
              {enviando && pctSubida !== null ? 'Subiendo…' : 'Previsualizar la carga'}
            </button>
            <p className="text-xs text-fg-muted">
              La previsualización no guarda nada: muestra qué entraría. El sistema valida que el
              archivo corresponda a esta jornada (empresa y fecha) antes de escribir.
            </p>
          </div>

          {pctSubida !== null && enviando && (
            <div className="space-y-1">
              <Barra pct={pctSubida} />
              <div className="flex items-center justify-between text-xs text-fg-muted">
                <span>Subiendo el archivo… {pctSubida}%</span>
                <button type="button" className="text-danger hover:underline"
                  onClick={() => { abortRef.current?.abort(); abortRef.current = null; setEnviando(false); setPctSubida(null); }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {error && (
            <BannerError
              error={error}
              accion={reintento && (
                <button type="button" className="btn-secondary text-xs whitespace-nowrap"
                  disabled={enviando}
                  onClick={() => (reintento === 'aplicar' ? aplicar() : previsualizar())}>
                  Reintentar
                </button>
              )}
            />
          )}
        </section>
      )}

      {/* ── Avance y resultado ────────────────────────────────────── */}
      {carga && (
        <section className="card p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-fg">Proceso en el servidor</h2>
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
                Corre en el servidor y toma la base unos segundos. Podés cerrar esta pantalla y
                volver: el resultado queda en el historial de «Carga de datos».
              </p>
            </div>
          )}

          {errorSondeo && (
            <BannerError error={describirError(errorSondeo, 'consultar el avance')}
              accion={<button type="button" className="btn-secondary text-xs" onClick={refrescar}>
                Reintentar
              </button>} />
          )}

          {carga.estado === 'FALLIDA' && (
            <div className="rounded-lg border border-danger/40 bg-danger-soft/40 p-3 space-y-2">
              <h3 className="font-semibold text-danger">La carga falló y no se guardó nada</h3>
              {carga.error && <p className="text-sm text-fg-muted break-words">{carga.error}</p>}
              {archivo && canWrite && (
                <button type="button" className="btn-secondary text-xs" onClick={previsualizar}>
                  Reintentar con el mismo archivo
                </button>
              )}
            </div>
          )}

          {carga.estado === 'BLOQUEADA' && (
            <div className="space-y-4">
              {bloqueoEmpresa && (
                <ConfirmarEmpresaCierre
                  bloqueo={bloqueoEmpresa}
                  canWrite={canWrite}
                  confirmando={confirmandoEmpresa || enviando}
                  error={errorEmpresa}
                  onConfirmar={confirmarEmpresa}
                  onCancelar={rechazarEmpresa}
                />
              )}
              {(!bloqueoEmpresa
                || (Array.isArray(bloqueosRestantes) && bloqueosRestantes.length > 0)) && (
                <BloqueosCarga
                  bloqueos={bloqueoEmpresa ? bloqueosRestantes : carga.bloqueos}
                  canWrite={canWrite}
                  onReintentar={archivo && canWrite ? previsualizar : null}
                />
              )}
            </div>
          )}

          {carga.estado === 'OK' && (
            <div className="space-y-4">
              {resumenCierre?.status === 'NOOP' ? (
                <Aviso tono="info" titulo="Este archivo ya estaba cargado">
                  No se duplica nada{resumenCierre.batch_previo != null
                    ? ` (ya entró con el lote ${resumenCierre.batch_previo})` : ''}.
                </Aviso>
              ) : esPreview ? (
                <Aviso tono="neutral" titulo="Previsualización lista. Todavía no se escribió nada.">
                  Revisá el comprobante: nada entra hasta que aplicás.
                </Aviso>
              ) : (
                <Aviso tono="success" titulo="Cierre aplicado. Los datos ya están en el sistema.">
                  Antes de escribir se guardó un respaldo de la base.
                </Aviso>
              )}

              {/* Constancia de una decisión que YA se tomó: no queda nada por
                  hacer, así que es informativa y no una alarma. */}
              {empresaConfirmadaEnPreview && (
                <Aviso tono="info" titulo="Con la empresa confirmada a mano.">
                  El nombre de empresa del archivo no coincidía con el de esta jornada y alguien
                  confirmó que eran la misma. Quedó registrado en la auditoría, con los dos
                  nombres y el usuario que lo confirmó.
                </Aviso>
              )}

              {resumenCierre && (
                <ComprobanteCierre
                  r={resumenCierre}
                  aplicado={!esPreview}
                  jornadaCodigo={jornada.codigo}
                  cargaId={carga.id}
                  archivo={carga.archivo_nombre || archivo?.name || null}
                />
              )}

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
                    Se aplica con el archivo que ya subiste. Mientras se aplica, el portal queda en{' '}
                    <b>solo lectura</b> unos segundos.
                  </p>
                </div>
              )}

              {!esPreview && (
                <div className="flex flex-wrap items-center gap-3 border-t border-line-subtle pt-3 text-sm">
                  <span className="text-fg-muted">Revisá el resultado en:</span>
                  {jornada.epi_jornada_codigo && (
                    <Link className="btn-secondary text-xs"
                      to={`/hallazgos?jornada=${jornada.codigo}`}>
                      Epidemiología de esta jornada
                    </Link>
                  )}
                  <button type="button" className="btn-secondary text-xs" onClick={limpiar}>
                    Cargar otro archivo
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Listado referible ─────────────────────────────────────── */}
      {cierre?.carga_id && <Referidos jornadaId={jornadaId} puedeVer={canWrite} />}
    </div>
  );
}

function VolverJornadas() {
  return (
    <Link to="/jornadas" className="text-sm text-igss-primary hover:underline">← Jornadas</Link>
  );
}

/** Estado resumido del cierre (KPIs de la ficha, a página completa). */
function EstadoCierre({ cierre, jornada }) {
  return (
    <section className="card p-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-fg">
          Análisis cargado
          {cierre.epi_jornada_codigo && (
            <span className="text-fg-muted text-sm font-normal">
              {' '}· código epidemiológico {cierre.epi_jornada_codigo}
            </span>
          )}
        </h2>
        <div className="text-xs text-fg-muted">
          {cierre.archivo} · {cierre.cargado_por} · {cierre.cargado_at}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <Kpi etiqueta="Tamizados" valor={cierre.personas} />
        <Kpi etiqueta="Con hallazgos" valor={cierre.con_hallazgo} />
        <Kpi etiqueta="Hallazgos" valor={cierre.hallazgos} />
        <Kpi etiqueta="Por referir" valor={cierre.referibles} />
      </div>
      {jornada.epi_jornada_codigo && (
        <Link className="btn-secondary text-xs self-start" to={`/hallazgos?jornada=${jornada.codigo}`}>
          Ver la epidemiología de esta jornada
        </Link>
      )}
    </section>
  );
}

function Kpi({ etiqueta, valor }) {
  return (
    <div className="rounded-lg bg-sunken/50 px-3 py-2">
      <div className="text-xs text-fg-muted">{etiqueta}</div>
      <div className="text-lg font-semibold tabular-nums">{valor == null ? '—' : fmtN(valor)}</div>
    </div>
  );
}

/** Comprobante específico del cierre: el universo de la jornada. */
function ComprobanteCierre({ r, aplicado, jornadaCodigo, cargaId, archivo }) {
  const cotejo = useMemo(() => leerCotejo(r), [r]);
  const avisos = useMemo(() => leerAvisosProceso(r, etiquetaDeClave, aplicado), [r, aplicado]);
  const filas = [
    ['Pacientes con triaje (hoja «Pacientes»)', r.pacientes_triaje],
    ['Con laboratorio (hoja «Base Extraída»)', r.con_laboratorio],
    ['Personas del tamizaje (universo epidemiológico)', r.totales?.personas],
    ['Fichas de triaje nuevas (presión, IMC)', r.triaje_insertadas],
    ['Resultados de laboratorio', r.totales?.labs ?? r.labs_insertados],
    ['Hallazgos', r.totales?.hallazgos ?? r.hallazgos_insertados],
    ['Personas con al menos un hallazgo', r.personas_con_hallazgo],
    ['Encuestas importadas (incluye no asistentes)', r.encuestas_insertadas],
    ['Encuestados que no asistieron', r.encuestados_sin_asistir],
  ];

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {filas.map(([etiqueta, valor]) => (
              <tr key={etiqueta} className="border-b border-line-subtle">
                <td className="py-1.5 pr-4 text-fg-muted">{etiqueta}</td>
                <td className="py-1.5 text-right tabular-nums font-semibold">
                  {valor == null ? '—' : fmtN(valor)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {r.hallazgos_por_patologia && Object.keys(r.hallazgos_por_patologia).length > 0 && (
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-fg">Hallazgos por patología</h3>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(r.hallazgos_por_patologia).map(([pat, n]) => (
              <span key={pat} className="rounded-full bg-sunken px-2.5 py-1 text-xs">
                {pat} <b className="tabular-nums">{fmtN(n)}</b>
              </span>
            ))}
          </div>
        </div>
      )}

      <CotejoConElArchivo
        cotejo={cotejo} aplicado={aplicado}
        jornadaCodigo={jornadaCodigo} cargaId={cargaId} archivo={archivo}
      />

      <AvisosDelProceso avisos={avisos} aplicado={aplicado} />
    </div>
  );
}

/**
 * Cómo le fue al portal comprobando su propio cálculo contra el archivo.
 *
 * Tres cajas, en este orden y con este color, porque el color significa UNA
 * cosa: qué tiene que hacer ella.
 *
 *   VERDE   → lo que se verificó bien. Va primero: es la mayoría abrumadora
 *             (2,873 de 2,877 en la carga que originó este rediseño) y antes no
 *             se mostraba nunca, así que una validación exitosa se leía como
 *             una alarma de seis renglones.
 *   AZUL    → diferencias con una causa que el equipo ya entendió. No hay nada
 *             que corregir; se dice explícitamente que puede aplicar y que no
 *             tiene que avisar nada. Informativo, nunca naranja.
 *   NARANJA → lo único sin explicación. Es naranja porque acá SÍ hay algo que
 *             ella puede apretar: el botón que copia el detalle para el equipo
 *             técnico. Si esto no aparece, no hay nada que reportar.
 *
 * Los números salen todos del cotejo que manda el servidor. Ninguno se calcula
 * ni se estima acá.
 */
function CotejoConElArchivo({ cotejo, aplicado, jornadaCodigo, cargaId, archivo }) {
  if (!cotejo) return null;
  // Se decide con los DOS números que la frase imprime, no con las cubetas de
  // al lado: así la oración no puede contradecir a los números que tiene
  // pegados. Si el servidor mandara un bloque descuadrado, se cae en la forma
  // «X de Y», que sigue siendo cierta, en vez de afirmar un «coinciden todos».
  const todoCoincide = cotejo.coinciden != null && cotejo.coinciden >= cotejo.comparaciones;

  return (
    <section className="space-y-2">
      {/* No hubo ni una celda que comparar. Se dice en una línea neutra:
          callarlo hacía que «no hubo verificación» se viera igual que «la
          verificación salió perfecta», que son lo contrario.
          El texto NO afirma por qué —puede ser que el archivo no trajera la
          hoja, que ninguna fila cruzara, o que el servidor mandara el bloque de
          otra forma—, porque desde acá no se puede saber cuál de las tres fue y
          adivinar mal es peor que no decirlo. */}
      {cotejo.nadaQueCotejar && (
        <div className="rounded-lg border border-line bg-sunken/50 p-3 text-sm">
          <b className="text-fg">Esta vez el portal no pudo compararse contra el archivo.</b>{' '}
          <span className="text-fg-muted">
            Los datos entran igual —el portal los calcula de los resultados de laboratorio, no de
            la hoja «Base Resumen» del Excel—, pero esta carga no lleva la comprobación de que
            los dos den lo mismo.
          </span>
        </div>
      )}

      {cotejo.completo && (
        <div className="rounded-lg border border-success/40 bg-success-soft/40 p-3 text-sm">
          <b className="text-success">
            {todoCoincide
              ? `Comprobación con el archivo: coinciden los ${fmtN(cotejo.comparaciones)} valores`
              : `Comprobación con el archivo: ${fmtN(cotejo.coinciden)} de `
                + `${fmtN(cotejo.comparaciones)} valores coinciden`}
            {cotejo.porcentaje ? ` (${cotejo.porcentaje})` : ''}.
          </b>
          <p className="mt-1 text-xs text-fg-muted">
            El portal recalculó los resultados
            {cotejo.personas ? ` de ${fmtN(cotejo.personas)} personas` : ''}
            {cotejo.campos ? `, ${fmtN(cotejo.campos)} columnas cada una,` : ''}
            {' '}y los comparó uno por uno con lo que trae el archivo. Lo que se guarda es
            siempre lo que calculó el portal.
          </p>
        </div>
      )}

      {cotejo.explicadasTotal > 0 && (
        <div className="rounded-lg border border-info/40 bg-info-soft/30 p-3 text-sm space-y-2">
          <div>
            <b className="text-info">
              {cotejo.explicadasTotal === 1
                ? 'Un valor se calculó distinto'
                : `${fmtN(cotejo.explicadasTotal)} valores se calcularon distinto`}
              {cotejo.explicadas.length > 1
                ? ', por motivos ya conocidos.' : ', por un motivo ya conocido.'}
            </b>{' '}
            <span className="text-fg-muted">
              {/* Cuando además hay algo sin explicación, la caja naranja de
                  abajo ya dice que igual puede aplicar: repetirlo acá deja dos
                  «podés aplicar» seguidos que se leen como duda. */}
              {aplicado || cotejo.hayQueReportar
                ? 'No hay nada que corregir.'
                : 'No hay nada que corregir y podés aplicar la carga.'}
            </span>
          </div>
          {cotejo.explicadas.length > 0 && (
            <ul className="space-y-1.5 text-xs text-fg-muted">
              {cotejo.explicadas.map((e) => (
                <li key={e.causa} className="border-l-2 border-info/40 pl-2">
                  <b className="text-fg tabular-nums">
                    {fmtN(e.total)} {e.total === 1 ? 'caso' : 'casos'}
                  </b>
                  {' · '}
                  <b className="text-fg">
                    {e.titulo || 'diferencia con una causa ya identificada'}
                  </b>
                  {e.explicacion && <div className="mt-0.5">{e.explicacion}</div>}
                  {e.campos.length > 0 && (
                    <div className="mt-0.5 text-fg-subtle">
                      {e.campos.length === 1 ? 'Columna: ' : 'Columnas: '}
                      {/* Con una sola columna el número ya se dijo dos renglones
                          arriba («4 casos»): repetirlo es el ruido numérico que
                          este rediseño vino a sacar. */}
                      {e.campos.length === 1
                        ? e.campos[0].campo
                        : e.campos.map((c) => `${c.campo} (${fmtN(c.total)})`).join(' · ')}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-fg-muted">
            {cotejo.hayQueReportar
              ? 'Estas no hace falta que las avises.'
              : 'No hace falta que avises nada.'}
          </p>
        </div>
      )}

      {cotejo.hayQueReportar && (
        <DiferenciasSinExplicacion
          cotejo={cotejo} aplicado={aplicado}
          jornadaCodigo={jornadaCodigo} cargaId={cargaId} archivo={archivo}
        />
      )}
    </section>
  );
}

/**
 * Lo único del cotejo que merece la atención de alguien: valores que no
 * coinciden y para los que el motor no tiene una causa identificada.
 *
 * El texto explicativo lo escribe el SERVIDOR (`nota`): es el que sabe qué
 * comparó. Antes la pantalla lo descartaba y escribía uno propio, peor, así que
 * había dos textos para lo mismo y ganaba el peor.
 */
function DiferenciasSinExplicacion({ cotejo, aplicado, jornadaCodigo, cargaId, archivo }) {
  const [copiado, setCopiado] = useState(false);
  const [falloCopiar, setFalloCopiar] = useState(false);
  const reporte = useMemo(
    () => textoParaReportar({ jornada: jornadaCodigo, cargaId, archivo, cotejo }),
    [jornadaCodigo, cargaId, archivo, cotejo]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(reporte);
      setCopiado(true); setFalloCopiar(false);
      setTimeout(() => setCopiado(false), 4000);
    } catch {
      // Sin portapapeles (navegador viejo o página sin HTTPS): se abre el texto
      // para que lo seleccione a mano en vez de dejarla sin forma de reportar.
      setFalloCopiar(true);
    }
  }

  const n = cotejo.sinExplicacion;
  // El conteo por columna existe para UNA cosa: ser el total completo cuando la
  // muestra de ejemplos viene topada, o repartir el total entre varias columnas.
  // Con una sola columna y la muestra entera repite exactamente lo que dicen los
  // ejemplos de abajo, y dos listas iguales seguidas se leen como dos problemas.
  const muestraPorCampo = cotejo.porCampo.length > 0
    && (cotejo.ejemplosNoListados > 0 || cotejo.porCampo.length > 1);
  return (
    <div className="rounded-lg border border-warning/50 bg-warning-soft/40 p-3 text-sm space-y-2">
      <b className="text-warning">
        {n === 1
          ? 'Un valor no coincide con el archivo y el portal no sabe por qué.'
          : `${fmtN(n)} valores no coinciden con el archivo y el portal no sabe por qué.`}
      </b>
      <p className="text-xs text-fg-muted">
        {cotejo.nota
          || ('Lo que se guarda es lo que calculó el portal, así que la carga está bien hecha y '
            + 'no hay nada que corregir en el archivo. Pasale este detalle al equipo técnico.')}
      </p>

      {/* Sin este encabezado la lista quedaba colgando debajo del párrafo, sin
          decir qué se está contando ni que este conteo sí es el total. */}
      {muestraPorCampo && (
        <div className="text-xs text-fg-muted space-y-1">
          <div className="text-fg-subtle">En qué columnas, y cuántas en cada una:</div>
          <ul className="list-disc pl-4">
            {cotejo.porCampo.map((c) => (
              <li key={c.campo}>
                {c.campo}: <b className="tabular-nums">{fmtN(c.total)}</b>{' '}
                {c.total === 1 ? 'caso' : 'casos'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {cotejo.ejemplos.length > 0 && (
        <div className="text-xs text-fg-muted space-y-1">
          <div className="text-fg-subtle">Así se ven las diferencias:</div>
          <ul className="list-disc pl-4">
            {cotejo.ejemplos.map((g) => (
              <li key={g.id}>
                {g.campo}: el archivo dice «{g.enArchivo}» y el portal calculó «{g.calculado}»
                {' '}— {fmtN(g.casos)} {g.casos === 1 ? 'caso' : 'casos'}
              </li>
            ))}
          </ul>
          {/* El encabezado anunciaba 6 y la lista mostraba 5: contaba y no le
              cuadraba. Lo que falta se dice, no se recorta en silencio.
              El paréntesis solo se promete si la lista por columna está: en una
              carga guardada por el backend viejo ese conteo no viaja, y la
              frase mandaba a buscar una tabla que no estaba en la pantalla. */}
          {cotejo.ejemplosNoListados > 0 && (
            <div>
              {cotejo.ejemplosNoListados === 1
                ? 'y 1 caso más que no se lista acá'
                : `y ${fmtN(cotejo.ejemplosNoListados)} casos más que no se listan acá`}
              {muestraPorCampo ? ' (el conteo por columna sí está completo).' : '.'}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-secondary text-xs" onClick={copiar}>
          {copiado ? 'Copiado ✓' : 'Copiar el detalle para el equipo técnico'}
        </button>
        <span className="text-xs text-fg-muted">
          {aplicado
            ? 'Los datos ya entraron: esto es para que el equipo revise el motor.'
            : 'Podés aplicar igual: esto no cambia lo que se guarda.'}
        </span>
      </div>
      {falloCopiar && (
        <textarea
          className="input font-mono text-[11px] h-32" readOnly value={reporte}
          onFocus={(e) => e.target.select()}
        />
      )}
    </div>
  );
}

/**
 * Cómo salió el proceso: notas que no son diferencias con el archivo.
 *
 * Se separan por lo que exigen de ella, no por de dónde salen. Ninguna es
 * naranja porque ninguna se resuelve apretando algo en esta pantalla; las que
 * conviene mirar antes de aplicar van abiertas y las demás, plegadas.
 */
function AvisosDelProceso({ avisos, aplicado }) {
  const { revisar, info } = avisos;
  if (!revisar.length && !info.length) return null;
  // «antes de aplicar» solo mientras aplicar siga siendo algo que puede pasar:
  // en el comprobante de una carga YA aplicada mandaba a hacer a tiempo algo
  // que ya se hizo, que es la clase de instrucción que enseña a no leer.
  const cuando = aplicado ? '' : ' antes de aplicar';
  return (
    <section className="space-y-2">
      {revisar.length > 0 && (
        <div className="rounded-lg border border-info/40 bg-info-soft/30 p-3 text-sm space-y-1">
          <b className="text-info">
            {revisar.length === 1
              ? `Un aviso del proceso, conviene mirarlo${cuando}`
              : `${revisar.length} avisos del proceso, conviene mirarlos${cuando}`}
          </b>
          <ul className="space-y-1.5 text-xs text-fg-muted">
            {revisar.map((a) => (
              <li key={a.clave} className="border-l-2 border-info/40 pl-2">
                <span className="text-fg">{a.texto}</span>
                {a.queHacer && <div className="mt-0.5">{a.queHacer}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {info.length > 0 && (
        <details className="text-xs text-fg-muted">
          <summary className="cursor-pointer">
            Cómo salió el proceso ({info.length}{' '}
            {info.length === 1 ? 'aviso' : 'avisos'}, ninguno pide nada)
          </summary>
          <ul className="list-disc pl-4 mt-1 space-y-1">
            {info.map((a) => <li key={a.clave}>{a.texto}</li>)}
          </ul>
        </details>
      )}
    </section>
  );
}

/** Listado de colaboradores con hallazgos para referir (imprimible). */
function Referidos({ jornadaId, puedeVer }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [abierto, setAbierto] = useState(false);

  async function cargar() {
    setCargando(true); setError(null);
    try {
      setData(await apiGetReferidos(jornadaId));
      setAbierto(true);
    } catch (e) {
      setError(describirError(e, 'consultar el listado de referidos'));
    } finally {
      setCargando(false);
    }
  }

  if (!puedeVer) return null;

  return (
    <section className="card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-fg">Colaboradores con hallazgos para referir</h2>
          <p className="text-xs text-fg-muted max-w-2xl">
            El listado que antes se imprimía del Excel, regenerado desde el portal. Muestra nombre,
            documento y hallazgos de cada persona: el acceso queda registrado en la auditoría.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {abierto && data && (
            <button type="button" className="btn-secondary text-xs" onClick={() => window.print()}>
              Imprimir
            </button>
          )}
          <button type="button" className="btn-secondary text-xs" onClick={cargar} disabled={cargando}>
            {cargando ? 'Consultando…' : abierto ? 'Refrescar' : 'Ver el listado'}
          </button>
        </div>
      </div>

      {error && <BannerError error={error} />}

      {abierto && data && (
        data.length === 0 ? (
          <p className="text-sm text-fg-muted">Ninguna persona con hallazgos en esta jornada.</p>
        ) : (
          <div className="overflow-x-auto print:border-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-fg-muted uppercase tracking-wide">
                  <th className="py-1.5 pr-3">#</th>
                  <th className="py-1.5 pr-3">Nombre</th>
                  <th className="py-1.5 pr-3">DPI</th>
                  <th className="py-1.5 pr-3">Sexo</th>
                  <th className="py-1.5 pr-3">Edad</th>
                  <th className="py-1.5 pr-3">IMC</th>
                  <th className="py-1.5 pr-3">PA</th>
                  <th className="py-1.5 pr-3">Hallazgos</th>
                  <th className="py-1.5">Valores alterados</th>
                </tr>
              </thead>
              <tbody>
                {data.map((p, i) => (
                  <tr key={p.dpi || i} className="border-b border-line-subtle align-top">
                    <td className="py-1.5 pr-3 text-fg-muted tabular-nums">{i + 1}</td>
                    <td className="py-1.5 pr-3 font-medium">{p.nombre || '—'}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{p.dpi || '—'}</td>
                    <td className="py-1.5 pr-3">{p.sexo || '—'}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{p.edad ?? '—'}</td>
                    <td className="py-1.5 pr-3">
                      {p.imc ?? '—'}{p.clasificacion_imc ? ` (${p.clasificacion_imca || p.clasificacion_imc})` : ''}
                    </td>
                    <td className="py-1.5 pr-3 tabular-nums">
                      {p.sistolica ? `${p.sistolica}/${p.diastolica}` : '—'}
                    </td>
                    <td className="py-1.5 pr-3">
                      <div className="flex flex-wrap gap-1">
                        {p.patologias.map((x) => (
                          <span key={x} className="rounded-full bg-warning-soft px-2 py-0.5 text-xs">{x}</span>
                        ))}
                      </div>
                    </td>
                    <td className="py-1.5 text-xs text-fg-muted">
                      {p.valores_alterados.map((v) => (
                        <div key={v.examen}>
                          {v.examen}: <b className={v.bandera === 'ALTO' ? 'text-danger' : 'text-info'}>
                            {v.valor}
                          </b> {v.unidad} ({v.bandera.toLowerCase()})
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </section>
  );
}

/*
 * El color dice UNA sola cosa: qué tiene que hacer la operadora.
 *
 *   rojo (BannerError / carga fallida) → falló y no se guardó nada.
 *   warning  → solo si hay un botón que ella puede apretar para resolverlo
 *              (un bloqueo, confirmar la empresa, copiar el detalle para el
 *              equipo técnico). Si no hay acción suya, NO es warning. Nunca.
 *   info     → informativo, y abre diciéndole que puede aplicar.
 *   success  → lo que se verificó bien.
 *
 * Se llegó a esta regla porque el mismo naranja hacía tres trabajos a la vez
 * —«la carga se detuvo en seco», «tenés que decidir vos» y «dos sistemas
 * escriben lo mismo distinto»— y entrenaba a ignorarlo.
 */
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
