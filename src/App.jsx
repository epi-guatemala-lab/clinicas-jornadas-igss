import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Calendario from './pages/Calendario';
import Jornadas from './pages/Jornadas';
import Empresas from './pages/Empresas';
import Personal from './pages/Personal';
import Viaticos from './pages/Viaticos';
import Metas from './pages/Metas';

function Protected({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.rol)) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="*" element={
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
            <Route path="/calendario" element={<Protected><Calendario /></Protected>} />
            <Route path="/jornadas" element={<Protected><Jornadas /></Protected>} />
            <Route path="/empresas" element={<Protected><Empresas /></Protected>} />
            <Route path="/viaticos" element={<Protected roles={['admin','gerencia']}><Viaticos /></Protected>} />
            <Route path="/personal" element={<Protected roles={['admin','gerencia']}><Personal /></Protected>} />
            <Route path="/metas" element={<Protected roles={['admin','gerencia']}><Metas /></Protected>} />
          </Routes>
        </Layout>
      } />
    </Routes>
  );
}
