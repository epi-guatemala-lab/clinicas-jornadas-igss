import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const { login, loading } = useAuth();
  const nav = useNavigate();
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setErr('');
    try {
      await login(u, p);
      nav('/dashboard');
    } catch (e) {
      setErr(e.response?.data?.detail || 'Error al iniciar sesión');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-igss-light to-igss-primary/20 p-4">
      <div className="card max-w-md w-full p-8">
        <div className="flex flex-col items-center mb-6">
          <img src={`${import.meta.env.BASE_URL}logo_igss.png`} alt="IGSS"
               className="h-16 w-16 mb-3"
               onError={(e)=>{e.target.style.display='none';}} />
          <h1 className="text-2xl font-bold text-igss-dark text-center">
            Clínicas de Empresa & SIPRESALUD
          </h1>
          <p className="text-sm text-slate-600 text-center mt-1">
            Subgerencia de Prestaciones en Salud<br/>Departamento de Medicina Preventiva
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Usuario</label>
            <input className="input" value={u} onChange={(e) => setU(e.target.value)}
              autoFocus required />
          </div>
          <div>
            <label className="label">Contraseña</label>
            <input className="input" type="password" value={p}
              onChange={(e) => setP(e.target.value)} required />
          </div>
          {err && <div className="bg-red-50 text-red-700 text-sm p-2 rounded">{err}</div>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Entrando…' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}
