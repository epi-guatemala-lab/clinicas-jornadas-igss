import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  apiAplicarCarga, apiCrearCarga, apiGetCierreJornada, apiGetJornada, apiGetReferidos,
} from '../api/endpoints';
import { useAuth } from '../hooks/useAuth';
import { useCargaJob, esFinal } from '../hooks/useCargaJob';
import { describirError } from '../utils/apiError';
import { ESTADO_CARGA, fmtBytes } from '../utils/carga';
import { fmtN } from '../utils/format';
import BloqueosCarga from '../components/cargas/BloqueosCarga';
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

  const limpiar = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setArchivo(null); setCargaId(null); setPctSubida(null);
    setEnviando(false); setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  function elegir(f) {
    setError(null); setCargaId(null); setPctSubida(null);
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
    setError(null); setEnviando(true); setPctSubida(0); setCargaId(null);
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
    setError(null); setEnviando(true); setPctSubida(null);
    abortRef.current = new AbortController();
    try {
      const r = await apiAplicarCarga(cargaId, archivo, {
        jornadaId,
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

      {!tipoValido && (
        <Aviso tono="warning" titulo="Esta jornada no lleva análisis de cierre">
          Es de tipo «{jornada.tipo}»: solo las jornadas de clínica (SIPRESALUD / Clínicas de
          Empresa) generan el archivo de análisis de datos.
        </Aviso>
      )}
      {cancelada && (
        <Aviso tono="warning" titulo="La jornada está cancelada">
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

          {error && <BannerError error={error} />}
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
            <BloqueosCarga
              bloqueos={carga.bloqueos}
              canWrite={canWrite}
              onReintentar={archivo && canWrite ? previsualizar : null}
            />
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

              {resumenCierre && <ComprobanteCierre r={resumenCierre} aplicado={!esPreview} />}

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
function ComprobanteCierre({ r, aplicado }) {
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
  const defectos = Object.entries(r.defectos || {}).filter(([, v]) => v);
  const avisos = (r.avisos_base_resumen || []).slice(0, 10);

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

      {avisos.length > 0 && (
        <div className="rounded-lg border border-warning/40 bg-warning-soft/40 p-3 text-sm space-y-1">
          <b className="text-warning">
            El motor del portal calculó {avisos.length}
            {r.divergencias_base_resumen > avisos.length
              ? ` de ${fmtN(r.divergencias_base_resumen)} ` : ' '}
            diferencia(s) contra la hoja «Base Resumen» del archivo
          </b>
          <p className="text-xs text-fg-muted">
            Los datos guardados son los del MOTOR DEL PORTAL. Las diferencias más comunes son
            un archivo sin recalcular o un umbral clínico que Sipresalud cambió en el Excel —
            si es eso, avisá al equipo técnico para actualizar el motor.
          </p>
          <ul className="text-xs text-fg-muted list-disc pl-4">
            {avisos.slice(0, 5).map((a, i) => (
              <li key={i}>{a.dpi} · {a.campo}: archivo «{a.en_archivo}» vs calculado «{a.calculado_portal}»</li>
            ))}
          </ul>
        </div>
      )}

      {defectos.length > 0 && (
        <details className="text-xs text-fg-muted">
          <summary className="cursor-pointer">
            Detalle del proceso ({defectos.length} avisos)
          </summary>
          <ul className="list-disc pl-4 mt-1">
            {defectos.map(([k, v]) => (
              <li key={k}>{ETIQUETAS_DEFECTOS[k] || k}: {fmtN(v)}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

const ETIQUETAS_DEFECTOS = {
  encuesta_dpi_reasignado_afiliacion: 'Encuestas con la afiliación escrita en el campo DPI (reasignadas)',
  encuesta_duplicada_misma_persona: 'Personas que llenaron la encuesta dos veces',
  atendidos_rellenados: 'Se completó «atendidos» de la jornada (estaba vacío)',
  pacientes_sin_laboratorio: 'Pacientes del triaje sin laboratorio',
  pacientes_sin_triaje: 'Pacientes con laboratorio pero sin triaje',
  divergencias_vs_base_resumen: 'Diferencias contra la hoja «Base Resumen»',
  hallazgos_preexistentes_del_maestro: 'Hallazgos previos del maestro conservados',
};

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
