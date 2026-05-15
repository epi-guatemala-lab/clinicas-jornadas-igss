import { createContext, useContext, useEffect, useState } from 'react';
import { apiLogin, apiMe } from '../api/endpoints';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('jornadas_user') || 'null'); }
    catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  // Si hay token guardado, refresca user al cargar
  useEffect(() => {
    const tok = localStorage.getItem('jornadas_token');
    if (tok && !user) {
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

  return (
    <AuthCtx.Provider value={{ user, login, logout, loading }}>
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
