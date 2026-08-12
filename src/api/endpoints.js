import { api } from './client';

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
 * @param {{onUploadProgress?:Function, signal?:AbortSignal}} opts
 * @returns {Promise<{id:number, estado:string, mensaje?:string}>}
 */
export const apiCrearCarga = (fileObj, modo = 'PREVIEW', opts = {}) => {
  const fd = new FormData();
  fd.append('file', fileObj);
  return api.post(`/api/cargas?modo=${modo}`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: SUBIDA_TIMEOUT_MS,
    onUploadProgress: opts.onUploadProgress,
    signal: opts.signal,
  }).then((r) => r.data);
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
