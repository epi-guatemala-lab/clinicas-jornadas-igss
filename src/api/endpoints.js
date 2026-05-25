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
