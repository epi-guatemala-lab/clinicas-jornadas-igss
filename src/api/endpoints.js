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
