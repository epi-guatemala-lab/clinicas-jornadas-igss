import { createContext, useContext, useEffect, useState } from 'react';
import { apiLogin, apiMe } from '../api/endpoints';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('jornadas_user') || 'null'); }
    catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  // Si hay token guardado, RE-VALIDA contra /me al cargar (siempre, no solo si
  // falta en localStorage): así un cambio de rol/permiso (visor↔editor) toma
  // efecto al recargar y no queda cacheado con permisos viejos.
  useEffect(() => {
    const tok = localStorage.getItem('jornadas_token');
    if (tok) {
      apiMe().then((u) => {
        setUser(u);
        localStorage.setItem('jornadas_user', JSON.stringify(u));
      }).catch(() => logout());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(username, password) {
    setLoading(true);
    try {
      const data = await apiLogin(username, password);
      localStorage.setItem('jornadas_token', data.token);
      localStorage.setItem('jornadas_user', JSON.stringify(data.user));
      setUser(data.user);
      return data.user;
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem('jornadas_token');
    localStorage.removeItem('jornadas_user');
    setUser(null);
  }

  // canWrite: el permiso (no el rol) decide si el usuario puede modificar datos.
  // Espejo del guard require_write del backend; el enforcement real es la API.
  const canWrite = user?.permiso === 'editor';

  return (
    <AuthCtx.Provider value={{ user, login, logout, loading, canWrite }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);

export const ROL_LABELS = {
  admin: 'Administrador',
  gerencia: 'Gerencia / Subgerencia',
  ce: 'Clínicas de Empresa',
  sipresalud: 'SIPRESALUD',
};
