import { api } from './client';
import { subirReanudable } from './subidaReanudable';

export { descartarSubida } from './subidaReanudable';

// ── Auth ────────────────────────────────────────────────────────────
export const apiLogin = (username, password) =>
  api.post('/api/auth/login', { username, password }).then((r) => r.data);

export const apiMe = () => api.get('/api/auth/me').then((r) => r.data);

// ── Empresas ────────────────────────────────────────────────────────
export const apiListEmpresas = (params = {}) =>
  api.get('/api/empresas', { params }).then((r) => r.data);

export const apiCreateEmpresa = (body) =>
  api.post('/api/empresas', body).then((r) => r.data);

export const apiUpdateEmpresa = (id, body) =>
  api.put(`/api/empresas/${id}`, body).then((r) => r.data);

// CE: inauguración de la clínica (fecha/lugar/horario) → alimenta el calendario
export const apiSetInauguracion = (id, body) =>
  api.patch(`/api/empresas/${id}/inauguracion`, body).then((r) => r.data);

// A5: valores de 'grupo' para el combobox abierto
export const apiEmpresaGrupos = () =>
  api.get('/api/empresas/grupos').then((r) => r.data);

// Catálogos CE
export const apiCatalogoSectores = () =>
  api.get('/api/catalogos/sectores').then((r) => r.data);
export const apiCatalogoUnidadesAdscripcion = () =>
  api.get('/api/catalogos/unidades-adscripcion').then((r) => r.data);

// ── Personal ────────────────────────────────────────────────────────
export const apiListPersonal = (params = {}) =>
  api.get('/api/personal', { params }).then((r) => r.data);

export const apiCreatePersonal = (body) =>
  api.post('/api/personal', body).then((r) => r.data);

export const apiUpdatePersonal = (id, body) =>
  api.put(`/api/personal/${id}`, body).then((r) => r.data);

// ── Jornadas ────────────────────────────────────────────────────────
export const apiListJornadas = (params = {}) =>
  api.get('/api/jornadas', { params }).then((r) => r.data);

export const apiGetJornada = (id) =>
  api.get(`/api/jornadas/${id}`).then((r) => r.data);

export const apiCreateJornada = (body) =>
  api.post('/api/jornadas', body).then((r) => r.data);

export const apiUpdateJornada = (id, body) =>
  api.put(`/api/jornadas/${id}`, body).then((r) => r.data);

export const apiCerrarJornada = (id, body) =>
  api.post(`/api/jornadas/${id}/cerrar`, body).then((r) => r.data);

// Rescate del amarre de clínica cuando una inauguración se cerró sin confirmarlo
// (/cerrar ya devuelve 409). Amarra la empresa en cualquier estado, idempotente.
export const apiAmarrarClinica = (id) =>
  api.post(`/api/jornadas/${id}/amarrar-clinica`).then((r) => r.data);

export const apiCancelarJornada = (id, body) =>
  api.post(`/api/jornadas/${id}/cancelar`, body).then((r) => r.data);

export const apiReprogramarJornada = (id, body) =>
  api.post(`/api/jornadas/${id}/reprogramar`, body).then((r) => r.data);

// F1: material entregado (solo Berkin en backend)
export const apiSetMaterial = (id, entregado) =>
  api.patch(`/api/jornadas/${id}/material`, { entregado }).then((r) => r.data);

// D4: reemplazar las charlas de una jornada
export const apiSetCharlas = (id, charlas) =>
  api.put(`/api/jornadas/${id}/charlas`, { charlas }).then((r) => r.data);

// D2: catálogo fijo de charlas (15)
export const apiCatalogoCharlas = () =>
  api.get('/api/catalogos/charlas').then((r) => r.data);

// ── Admin (usuarios + auditoría) ────────────────────────────────────
export const apiAdminUsers = (params = {}) =>
  api.get('/api/admin/users', { params }).then((r) => r.data);
export const apiAdminActivateUser = (id) =>
  api.post(`/api/admin/users/${id}/activar`).then((r) => r.data);
export const apiAdminDeactivateUser = (id) =>
  api.post(`/api/admin/users/${id}/desactivar`).then((r) => r.data);
export const apiAdminResetPassword = (id) =>
  api.post(`/api/admin/users/${id}/reset-password`).then((r) => r.data);
export const apiAdminAuditJornadas = (params = {}) =>
  api.get('/api/admin/audit/jornadas', { params }).then((r) => r.data);
export const apiAdminAuditAuth = (params = {}) =>
  api.get('/api/admin/audit/auth', { params }).then((r) => r.data);

// Config editable (módulo admin): meta mensual de afiliados
export const apiGetConfig = () =>
  api.get('/api/config').then((r) => r.data);
export const apiSetMetaAfiliados = (valor) =>
  api.put('/api/config/meta-afiliados', { valor }).then((r) => r.data);

export const apiCalendario = (desde, hasta, seccion) =>
  api.get('/api/jornadas/calendario', {
    params: { desde, hasta, seccion },
  }).then((r) => r.data);

// ── Viáticos ────────────────────────────────────────────────────────
export const apiListViaticos = (params = {}) =>
  api.get('/api/viaticos', { params }).then((r) => r.data);

export const apiNextCorrelativo = () =>
  api.get('/api/viaticos/next-correlativo').then((r) => r.data);

export const apiCreateViatico = (body) =>
  api.post('/api/viaticos', body).then((r) => r.data);

export const apiUpdateViatico = (id, body) =>
  api.put(`/api/viaticos/${id}`, body).then((r) => r.data);

// ── Kit lab ─────────────────────────────────────────────────────────
export const apiKitTotal = (fecha) =>
  api.get('/api/kit-lab/total', { params: { fecha } }).then((r) => r.data);

export const apiListKitPrecios = (params = {}) =>
  api.get('/api/kit-lab', { params }).then((r) => r.data);

// ── Metas ───────────────────────────────────────────────────────────
export const apiListMetas = (params = {}) =>
  api.get('/api/metas', { params }).then((r) => r.data);

export const apiCreateMeta = (body) =>
  api.post('/api/metas', body).then((r) => r.data);

export const apiMetasPorEmpresa = (params = {}) =>
  api.get('/api/metas/empresas', { params }).then((r) => r.data);

// ── Dashboards ──────────────────────────────────────────────────────
export const apiDashboard = (rol, params = {}) =>
  api.get(`/api/dashboard/${rol}`, { params }).then((r) => r.data);

// ── Charts ──────────────────────────────────────────────────────────
export const apiAlertasUnificadas = (params = {}) =>
  api.get('/api/charts/alertas-unificadas', { params }).then((r) => r.data);

export const apiSerieDiariaMes = (params = {}) =>
  api.get('/api/charts/serie-diaria-mes', { params }).then((r) => r.data);

// ── Carga del Excel maestro (solo admin + editor) ───────────────────
// El servidor procesa en segundo plano: POST devuelve 202 con el id de la
// carga y el avance se consulta con apiGetCarga. El archivo pesa ~34 MB, así
// que la subida lleva su tiempo: timeout amplio + progreso de subida real.
const SUBIDA_TIMEOUT_MS = 15 * 60 * 1000;   // 15 min: red institucional lenta

/**
 * Sube el Excel y encola la carga.
 * @param {File} fileObj archivo elegido por el usuario
 * @param {'PREVIEW'|'APLICAR'} modo
 * Va por la subida REANUDABLE en trozos (`/api/subidas`): el archivo de cierre
 * pesa ~37 MB y en un solo POST se moría a los 15 segundos desde la red del
 * IGSS, sin dejar rastro en el servidor y sin nada que reanudar.
 *
 * @param {{onProgreso?:Function, onEstado?:Function, onSesion?:Function,
 *          onUploadProgress?:Function, signal?:AbortSignal, jornadaId?:number,
 *          confirmarEmpresa?:boolean}} opts
 * @returns {Promise<{id:number, estado:string, mensaje?:string}>}
 */
const _subirEnUnPost = (fileObj, modo, opts) => {
  const fd = new FormData();
  fd.append('file', fileObj);
  // opts.jornadaId → la carga es el CIERRE de ESA jornada (el backend registra
  // tipo='CIERRE_JORNADA' y ancla el job a la jornada operativa).
  // opts.confirmarEmpresa → la operadora YA respondió «sí, es la misma empresa»
  // para ESTE archivo y esta jornada, y el archivo que tenía el servidor venció
  // (se guarda unas horas porque trae datos personales), así que hay que
  // subirlo de nuevo. El servidor solo se salta esa comprobación —fecha, DPI y
  // el resto se revisan igual— y deja constancia en la auditoría.
  const url = opts.jornadaId
    ? `/api/jornadas/${opts.jornadaId}/carga-cierre?modo=${modo}${
      opts.confirmarEmpresa ? '&confirmar_empresa=true' : ''}`
    : `/api/cargas?modo=${modo}`;
  return api.post(url, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: SUBIDA_TIMEOUT_MS,
    onUploadProgress: opts.onUploadProgress,
    signal: opts.signal,
  }).then((r) => r.data);
};

export const apiCrearCarga = async (fileObj, modo = 'PREVIEW', opts = {}) => {
  // Camino de «confirmar empresa» reenviando el archivo: sigue yendo por el
  // POST de una sola vez. El servidor amarra esa confirmación al SHA-256 de una
  // carga BLOQUEADA anterior —es lo que impide meter el archivo de una empresa
  // en la jornada de otra— y ese cotejo todavía no existe en `/finalizar`.
  // Reimplementarlo a medias sería aflojar justo el invariante que protege.
  // Es además el caso raro: lo normal es confirmar SIN reenviar nada
  // (POST …/carga-cierre/{carga_id}/confirmar-empresa reusa el archivo).
  if (opts.confirmarEmpresa) return _subirEnUnPost(fileObj, modo, opts);

  try {
    return await subirReanudable(fileObj, {
      tipo: opts.jornadaId ? 'CIERRE_JORNADA' : 'MAESTRO',
      jornadaId: opts.jornadaId || null,
      modo,
      onProgreso: opts.onProgreso,
      onEstado: opts.onEstado,
      onSesion: opts.onSesion,
      signal: opts.signal,
    });
  } catch (e) {
    // Plan B para un único caso: que el backend desplegado todavía no exponga
    // `/api/subidas`. Así el portal no se rompe si el frontend llega antes que
    // el backend. Cualquier OTRO error se propaga tal cual — reintentar 37 MB
    // por el camino que ya se sabe que falla sería cambiar un error claro por
    // una espera larga y el mismo error.
    const esBackendViejo = e?.response?.status === 404
      && String(e?.config?.url || '').includes('/api/subidas');
    if (!esBackendViejo) throw e;
    return _subirEnUnPost(fileObj, modo, opts);
  }
};

/**
 * Aplica una carga YA previsualizada REUSANDO el archivo que el servidor
 * guardó, sin volver a subir los 34 MB.
 *
 * Subir el archivo desde una máquina real toma unos 80 segundos, así que
 * hacerlo dos veces (previsualizar y aplicar) es minuto y medio de espera
 * evitable. El camino normal es un POST vacío a `/aplicar`.
 *
 * El servidor devuelve 410 (Gone) cuando el archivo de esa previsualización
 * ya venció o no se puede leer —el caso FRECUENTE: el TTL son 4 horas y
 * revisar una carga real (90+ jornadas) toma tiempo—. Ahí SÍ conviene
 * reenviar solo: el navegador todavía tiene el archivo en memoria, así que
 * en vez de dejar a quien aplica sin salida se reenvía automáticamente
 * (avisando por `onReenvio`) y el servidor vuelve a exigir el SHA256 antes
 * de escribir nada, con lo cual la garantía de "se aplica lo que se
 * previsualizó" se mantiene igual de estricta.
 *
 * 404 ("esa carga no existe") es un caso genuinamente distinto —la fila se
 * borró o el id es viejo— y NO se reintenta solo: mezclarlo con el 410 fue
 * justamente el bug (reenviaba sobre CUALQUIER 404, incluida una ruta
 * verdaderamente inexistente, saltándose la verificación del archivo). Ahí
 * se muestra el error del servidor tal cual y el usuario empieza de nuevo.
 *
 * @returns {Promise<{id:number, estado:string, mensaje?:string, reenviado:boolean}>}
 */
export const apiAplicarCarga = async (cargaId, fileObj, opts = {}) => {
  try {
    const r = await api.post(`/api/cargas/${cargaId}/aplicar`, null, {
      timeout: SUBIDA_TIMEOUT_MS,
      signal: opts.signal,
    });
    return { ...(r.data || {}), reenviado: false };
  } catch (e) {
    const st = e.response?.status;
    if (st !== 410 || !fileObj) throw e;
    opts.onReenvio?.();
    const d = await apiCrearCarga(fileObj, 'APLICAR', opts);
    return { ...d, reenviado: true };
  }
};

// El contrato devuelve `resumen`/`conflictos`/`bloqueos` ya interpretados. Se
// aceptan además las columnas crudas (`*_json`, texto) para que la pantalla no
// quede en blanco si el servidor entrega la fila tal como está en la tabla.
function _campo(carga, nombre) {
  const v = carga[nombre] !== undefined ? carga[nombre] : carga[`${nombre}_json`];
  if (typeof v !== 'string') return v ?? null;
  if (!v.trim()) return null;
  try { return JSON.parse(v); } catch { return v; }
}

function _normalizarCarga(carga) {
  if (!carga || typeof carga !== 'object') return carga;
  return {
    ...carga,
    resumen: _campo(carga, 'resumen'),
    conflictos: _campo(carga, 'conflictos'),
    bloqueos: _campo(carga, 'bloqueos'),
  };
}

export const apiGetCarga = (cargaId) =>
  api.get(`/api/cargas/${cargaId}`).then((r) => _normalizarCarga(r.data));

/**
 * ¿Hay una carga ocupando el servidor AHORA MISMO?
 *
 * El servidor procesa una carga por vez (SQLite tiene un solo escritor), así
 * que mientras dura una, la siguiente subida termina rechazada. Este endpoint
 * —barato, en memoria, y lo puede consultar cualquier usuario— existe para
 * preguntarlo ANTES de empezar a mandar 35 MB. Ver `utils/carrilCarga`.
 *
 * @returns {Promise<{activa:boolean, carga_id:?number, modo:?string,
 *                    etapa:?string, progreso:number, mensaje:?string}>}
 */
export const apiEstadoCarga = () =>
  api.get('/api/cargas/estado').then((r) => r.data);

export const apiListCargas = (limit = 20) =>
  api.get('/api/cargas', { params: { limit } })
    .then((r) => (Array.isArray(r.data) ? r.data : (r.data?.data || [])));

// ── Catálogo de patologías (alta desde el portal, sin redespliegue) ──
export const apiListPatologias = () =>
  api.get('/api/admin/patologias').then((r) => r.data);

export const apiCreatePatologia = (body) =>
  api.post('/api/admin/patologias', body).then((r) => r.data);

export const apiUpdatePatologia = (id, body) =>
  api.put(`/api/admin/patologias/${id}`, body).then((r) => r.data);

// ── Cierre de jornada: análisis de datos ─────────────────────────────
// Estado del análisis cargado de UNA jornada (para la ficha): última carga
// aplicada tipo CIERRE + mini-KPIs del resumen.
export const apiGetCierreJornada = (jornadaId) =>
  api.get(`/api/jornadas/${jornadaId}/cierre`).then((r) => r.data);

// Listado de colaboradores con hallazgos para REFERIR (nombres descifrados;
// mismo permiso que subir el cierre, acceso auditado en el servidor).
export const apiGetReferidos = (jornadaId) =>
  api.get(`/api/jornadas/${jornadaId}/referidos`).then((r) => r.data);

/**
 * «Sí, es la misma empresa»: repite una carga de cierre que quedó BLOQUEADA
 * porque el nombre de la empresa del archivo no cuadraba con el de la jornada.
 *
 * NO vuelve a subir el archivo: el servidor conservó el .xlsm de esa carga
 * (con su caducidad de siempre, porque trae datos personales) y lo comprueba
 * antes de reusarlo. Devuelve la carga NUEVA que hay que seguir sondeando.
 *
 * El servidor responde 410 si el archivo ya venció; ahí toca volver a subirlo
 * con `apiCrearCarga(..., {confirmarEmpresa: true})` — y ese camino solo lo
 * acepta si existe una previsualización DEL MISMO archivo (por SHA-256) que
 * haya quedado detenida por este motivo.
 *
 * Siempre previsualiza: el modo no es parámetro. Confirmar la empresa no puede
 * convertirse en escribir sin revisar; para escribir hay que pasar después por
 * «aplicar».
 *
 * @returns {Promise<{id:number, estado:string, mensaje?:string}>}
 */
export const apiConfirmarEmpresaCierre = (jornadaId, cargaId) =>
  api.post(
    `/api/jornadas/${jornadaId}/carga-cierre/${cargaId}/confirmar-empresa`,
  ).then((r) => r.data);
