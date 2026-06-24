import { useEffect, useState } from 'react';
import {
  apiAdminUsers, apiAdminActivateUser, apiAdminDeactivateUser,
  apiAdminResetPassword, apiAdminAuditJornadas, apiAdminAuditAuth,
} from '../api/endpoints';
import { useAuth } from '../hooks/useAuth';

function Pill({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition border ${
        active ? 'bg-igss-primary text-white border-igss-primary' : 'bg-surface text-fg-muted border-line hover:text-fg'
      }`}>{children}</button>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const canWrite = user?.permiso === 'editor';
  const [tab, setTab] = useState('usuarios');
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Administración</h1>
        <div className="flex gap-1.5">
          <Pill active={tab === 'usuarios'} onClick={() => setTab('usuarios')}>Usuarios</Pill>
          <Pill active={tab === 'audit'} onClick={() => setTab('audit')}>Auditoría</Pill>
        </div>
      </div>
      {tab === 'usuarios' ? <Usuarios canWrite={canWrite} /> : <Auditoria />}
    </div>
  );
}

function Usuarios({ canWrite }) {
  const [list, setList] = useState([]);
  const [pw, setPw] = useState(null);   // {username, new_password}
  const [busy, setBusy] = useState(null);
  function reload() { apiAdminUsers().then(setList).catch(() => setList([])); }
  useEffect(reload, []);

  async function toggle(u) {
    setBusy(u.id);
    try {
      await (u.activo ? apiAdminDeactivateUser(u.id) : apiAdminActivateUser(u.id));
      reload();
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
    finally { setBusy(null); }
  }
  async function reset(u) {
    if (!confirm(`¿Resetear la contraseña de ${u.username}? Se mostrará UNA vez.`)) return;
    setBusy(u.id);
    try { const d = await apiAdminResetPassword(u.id); setPw(d); }
    catch (e) { alert(e.response?.data?.detail || 'Error'); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-3">
      {pw && (
        <div className="rounded-xl border border-warning/40 bg-warning-soft p-3 text-sm">
          <div className="font-semibold text-warning">Contraseña nueva de {pw.username} (guardala ahora, no se vuelve a mostrar):</div>
          <code className="block mt-1 text-base font-mono select-all">{pw.new_password}</code>
          <button className="btn-secondary text-xs mt-2" onClick={() => setPw(null)}>Cerrar</button>
        </div>
      )}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-elev text-fg-muted uppercase text-xs">
            <tr>
              <th className="text-left p-2">Usuario</th><th className="text-left p-2">Nombre</th>
              <th className="text-left p-2">Rol</th><th className="text-left p-2">Sección</th>
              <th className="text-left p-2">Estado</th><th className="text-left p-2">Último acceso</th>
              {canWrite && <th className="p-2">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id} className="border-t border-line-subtle hover:bg-surface-elev">
                <td className="p-2 font-mono text-xs">{u.username}</td>
                <td className="p-2">{u.nombre_completo}</td>
                <td className="p-2">{u.rol}</td>
                <td className="p-2 text-fg-muted">{u.seccion || '—'}</td>
                <td className="p-2">
                  <span className={u.activo ? 'text-success' : 'text-danger'}>{u.activo ? '● Activo' : '○ Inactivo'}</span>
                </td>
                <td className="p-2 text-fg-muted text-xs">{u.ultimo_acceso || '—'}</td>
                {canWrite && (
                  <td className="p-2 whitespace-nowrap">
                    <button className="text-accent hover:underline text-xs mr-3" disabled={busy === u.id}
                      onClick={() => toggle(u)}>{u.activo ? 'Desactivar' : 'Activar'}</button>
                    <button className="text-igss-primary hover:underline text-xs" disabled={busy === u.id}
                      onClick={() => reset(u)}>Reset pass</button>
                  </td>
                )}
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan="7" className="p-6 text-center text-fg-subtle">Sin usuarios</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Auditoria() {
  const [src, setSrc] = useState('jornadas');  // jornadas | auth
  const [rows, setRows] = useState([]);
  useEffect(() => {
    const fn = src === 'jornadas' ? apiAdminAuditJornadas : apiAdminAuditAuth;
    fn({ limit: 200 }).then(setRows).catch(() => setRows([]));
  }, [src]);
  const cols = src === 'jornadas'
    ? ['timestamp', 'tabla', 'registro_id', 'accion', 'username', 'cambios_json']
    : ['timestamp', 'accion', 'username', 'detalle', 'ip'];
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        <Pill active={src === 'jornadas'} onClick={() => setSrc('jornadas')}>Operaciones</Pill>
        <Pill active={src === 'auth'} onClick={() => setSrc('auth')}>Accesos / Auth</Pill>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-surface-elev text-fg-muted uppercase">
            <tr>{cols.map((c) => <th key={c} className="text-left p-2">{c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id ?? i} className="border-t border-line-subtle hover:bg-surface-elev align-top">
                {cols.map((c) => (
                  <td key={c} className="p-2 max-w-[280px] truncate" title={String(r[c] ?? '')}>{String(r[c] ?? '—')}</td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={cols.length} className="p-6 text-center text-fg-subtle">Sin registros</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
