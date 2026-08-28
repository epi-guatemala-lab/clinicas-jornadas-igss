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
        // El token dura horas y NO se renueva: con la pestaña abierta del día
        // anterior la pantalla se ve normal (estado cacheado) y el primer clic
        // dispara el 401. Este redirect es una recarga completa, así que sin
        // apuntar dónde estaba, quien venía trabajando en una ficha reaparece
        // en el tablero sin explicación (el «se sale» que reportó la sección).
        // Se guarda la ruta RELATIVA al basename de GitHub Pages, que es como
        // navega el router; sessionStorage muere con la pestaña.
        const ruta = window.location.pathname.startsWith(base)
          ? window.location.pathname.slice(base.length)
          : window.location.pathname;
        const destino = `${ruta || '/'}${window.location.search}${window.location.hash}`;
        try {
          if (destino !== '/login') sessionStorage.setItem('post_login', destino);
        } catch { /* navegación privada sin almacenamiento: se pierde el regreso, no la sesión */ }
        window.location.href = loginPath;
      }
    }
    return Promise.reject(err);
  },
);
