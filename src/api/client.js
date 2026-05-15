import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8513';

export const api = axios.create({ baseURL, timeout: 15000 });

// Inyecta el JWT en cada request
api.interceptors.request.use((cfg) => {
  const tok = localStorage.getItem('jornadas_token');
  if (tok) cfg.headers.Authorization = `Bearer ${tok}`;
  return cfg;
});

// Si 401, limpia sesión y redirige respetando base path (GitHub Pages /clinicas-jornadas/)
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('jornadas_token');
      localStorage.removeItem('jornadas_user');
      const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
      const loginPath = `${base}/login`;
      if (window.location.pathname !== loginPath) {
        window.location.href = loginPath;
      }
    }
    return Promise.reject(err);
  },
);
