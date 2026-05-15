import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth, ROL_LABELS } from '../hooks/useAuth';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return children;

  const navLinks = [
    { to: '/dashboard', label: 'Dashboard', roles: ['admin', 'gerencia', 'ce', 'sipresalud'] },
    { to: '/calendario', label: 'Calendario', roles: ['admin', 'gerencia', 'ce', 'sipresalud'] },
    { to: '/jornadas', label: 'Jornadas', roles: ['admin', 'gerencia', 'ce', 'sipresalud'] },
    { to: '/empresas', label: 'Empresas', roles: ['admin', 'gerencia', 'ce', 'sipresalud'] },
    // Viáticos: solo gerencia/admin (montos sensibles)
    { to: '/viaticos', label: 'Viáticos', roles: ['admin', 'gerencia'] },
    // Personal: solo gerencia/admin (compensaciones cifradas)
    { to: '/personal', label: 'Personal', roles: ['admin', 'gerencia'] },
    // Metas: solo gerencia/admin (cambios estratégicos)
    { to: '/metas', label: 'Metas', roles: ['admin', 'gerencia'] },
  ];
  const visibles = navLinks.filter((l) => l.roles.includes(user.rol));

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-igss-primary text-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}logo_igss.png`}
                  alt="IGSS" className="h-10 w-10 bg-white rounded-full p-0.5"
                  onError={(e)=>{e.target.style.display='none';}} />
            <div>
              <div className="font-bold text-lg leading-tight">Clínicas de Empresa & SIPRESALUD</div>
              <div className="text-xs opacity-90">
                Subgerencia de Prestaciones en Salud · Medicina Preventiva
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <div className="text-right">
              <div className="font-medium">{user.nombre_completo}</div>
              <div className="opacity-80 text-xs">{ROL_LABELS[user.rol]}</div>
            </div>
            <button onClick={() => { logout(); navigate('/login'); }}
              className="bg-igss-dark hover:bg-black/30 px-3 py-1.5 rounded text-xs font-medium">
              Salir
            </button>
          </div>
        </div>
        {/* Nav */}
        <nav className="bg-igss-dark">
          <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
            {visibles.map((l) => (
              <NavLink key={l.to} to={l.to}
                className={({ isActive }) =>
                  `px-4 py-2.5 text-sm font-medium transition border-b-2 whitespace-nowrap ${
                    isActive ? 'border-white text-white' : 'border-transparent text-white/80 hover:text-white'
                  }`}>
                {l.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-6">
        {children}
      </main>

      <footer className="text-center text-xs text-slate-500 py-4 border-t">
        IGSS · Subgerencia de Prestaciones en Salud · Departamento de Medicina Preventiva
      </footer>
    </div>
  );
}
