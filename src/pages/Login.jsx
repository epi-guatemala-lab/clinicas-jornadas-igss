import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Field from '../components/forms/Field';

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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-canvas">
      {/* Background ornamental — gradient vibrante coral→teal en light, sutil en dark */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 -left-32 h-96 w-96 rounded-full opacity-30 blur-3xl"
             style={{ background: 'rgb(var(--accent-primary))' }} />
        <div className="absolute bottom-1/4 -right-32 h-96 w-96 rounded-full opacity-25 blur-3xl"
             style={{ background: 'rgb(var(--accent-secondary))' }} />
        <div className="absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-10 blur-3xl"
             style={{ background: 'rgb(var(--accent-tertiary))' }} />
      </div>

      <div className="card max-w-md w-full p-8 backdrop-blur-sm bg-surface/95 dark:shadow-glow-accent-lg">
        <div className="flex flex-col items-center mb-6">
          <img src={`${import.meta.env.BASE_URL}logo_igss.png`} alt="IGSS"
               className="h-16 w-16 mb-3"
               onError={(e)=>{e.target.style.display='none';}} />
          <h1 className="text-2xl font-bold text-fg text-center">
            Clínicas de Empresa & SIPRESALUD
          </h1>
          <p className="text-sm text-fg-muted text-center mt-1">
            Subgerencia de Prestaciones en Salud<br/>Departamento de Medicina Preventiva
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Field label="Usuario" value={u} onChange={(e) => setU(e.target.value)}
                 required inputClassName="autofocus" />
          <Field label="Contraseña" type="password" value={p} onChange={(e) => setP(e.target.value)}
                 required />
          {err && <div className="bg-danger-soft text-danger text-sm p-2 rounded">{err}</div>}
          <button type="submit"
                  className="btn-primary w-full py-3 text-base font-semibold shadow-md dark:shadow-glow-accent"
                  disabled={loading}>
            {loading ? 'Entrando…' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}
