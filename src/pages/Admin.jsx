import { useEffect, useMemo, useState } from 'react';
import {
  apiAdminUsers, apiAdminActivateUser, apiAdminDeactivateUser,
  apiAdminResetPassword, apiAdminAuditJornadas, apiAdminAuditAuth,
  apiListPatologias, apiCreatePatologia, apiUpdatePatologia,
} from '../api/endpoints';
import { useAuth } from '../hooks/useAuth';
import SearchInput from '../components/filters/SearchInput';
import { normIncludes } from '../utils/norm';
import { useDebounce } from '../hooks/useDebounce';
import { mensajeDeError } from '../utils/apiError';

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
          <Pill active={tab === 'patologias'} onClick={() => setTab('patologias')}>Patologías</Pill>
          <Pill active={tab === 'audit'} onClick={() => setTab('audit')}>Auditoría</Pill>
        </div>
      </div>
      {tab === 'usuarios' && <Usuarios canWrite={canWrite} />}
      {tab === 'patologias' && <Patologias canWrite={canWrite} />}
      {tab === 'audit' && <Auditoria />}
    </div>
  );
}

/**
 * Catálogo de patologías de tamizaje.
 *
 * Vive en la base de datos: una patología nueva en el Excel se da de alta acá
 * (o desde la pantalla de carga cuando frena una carga) y no hace falta tocar
 * código ni volver a desplegar el sistema.
 */
function Patologias({ canWrite }) {
  const [list, setList] = useState([]);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [cargando, setCargando] = useState(true);
  const [nueva, setNueva] = useState({ nombre_canonico: '', grupo: '' });
  const [guardando, setGuardando] = useState(false);
  const [editando, setEditando] = useState(null);   // {id, grupo}

  function reload() {
    setCargando(true);
    apiListPatologias()
      .then((r) => { setList(Array.isArray(r) ? r : (r?.data || [])); setErr(''); })
      .catch((e) => setErr(mensajeDeError(e, 'leer el catálogo')))
      .finally(() => setCargando(false));
  }
  useEffect(reload, []);

  const grupos = useMemo(
    () => [...new Set(list.map((p) => p.grupo).filter(Boolean))].sort(),
    [list],
  );
  const filtered = useMemo(
    () => list.filter((p) => !q || normIncludes(p.nombre_canonico, q) || normIncludes(p.grupo, q)),
    [list, q],
  );

  async function crear(e) {
    e.preventDefault(); setErr('');
    const nombre = nueva.nombre_canonico.trim();
    const grupo = nueva.grupo.trim();
    if (!nombre) { setErr('Escribí el nombre de la patología, tal como viene en el Excel.'); return; }
    if (!grupo) { setErr('Indicá a qué grupo clínico pertenece.'); return; }
    setGuardando(true);
    try {
      await apiCreatePatologia({ nombre_canonico: nombre, grupo });
      setNueva({ nombre_canonico: '', grupo: '' });
      reload();
    } catch (e2) { setErr(mensajeDeError(e2, 'dar de alta la patología')); }
    finally { setGuardando(false); }
  }

  async function guardarGrupo() {
    if (!editando) return;
    const grupo = (editando.grupo || '').trim();
    if (!grupo) { setErr('El grupo no puede quedar vacío.'); return; }
    setGuardando(true); setErr('');
    try {
      await apiUpdatePatologia(editando.id, { grupo });
      setEditando(null);
      reload();
    } catch (e) { setErr(mensajeDeError(e, 'guardar el grupo')); }
    finally { setGuardando(false); }
  }

  async function alternarActivo(p) {
    setGuardando(true); setErr('');
    try {
      await apiUpdatePatologia(p.id, { activo: p.activo ? 0 : 1 });
      reload();
    } catch (e) { setErr(mensajeDeError(e, 'cambiar el estado de la patología')); }
    finally { setGuardando(false); }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-fg-muted max-w-3xl">
        Lo que el Excel de tamizaje trae como patología tiene que estar en esta lista. Si llega una
        que no está, la carga se detiene sin escribir nada y la reporta; se da de alta acá o en la
        misma pantalla de carga, y no vuelve a frenar.
      </p>

      {err && <div className="rounded-lg border border-danger/40 bg-danger-soft/40 p-2.5 text-sm text-danger">{err}</div>}

      {canWrite && (
        <form onSubmit={crear} className="card p-3 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[14rem]">
            <label className="label">Nombre de la patología</label>
            <input className="input" value={nueva.nombre_canonico}
              placeholder="tal como aparece en el Excel"
              onChange={(e) => setNueva((n) => ({ ...n, nombre_canonico: e.target.value }))} />
          </div>
          <div className="flex-1 min-w-[12rem]">
            <label className="label">Grupo clínico</label>
            <input className="input" list="grupos-catalogo" value={nueva.grupo}
              placeholder="ej. Lípidos"
              onChange={(e) => setNueva((n) => ({ ...n, grupo: e.target.value }))} />
            <datalist id="grupos-catalogo">
              {grupos.map((g) => <option key={g} value={g} />)}
            </datalist>
          </div>
          <button className="btn-primary" type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Dar de alta'}
          </button>
        </form>
      )}

      <SearchInput value={q} onChange={setQ} placeholder="Buscar por patología o grupo…"
        className="max-w-md" />

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-elev text-fg-muted uppercase text-xs">
            <tr>
              <th className="text-left p-2">Patología</th>
              <th className="text-left p-2">Grupo clínico</th>
              <th className="text-left p-2">Estado</th>
              {canWrite && <th className="text-left p-2">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-line-subtle hover:bg-surface-elev">
                <td className="p-2 font-medium">{p.nombre_canonico}</td>
                <td className="p-2">
                  {editando?.id === p.id ? (
                    <input className="input max-w-[14rem]" list="grupos-catalogo" autoFocus
                      value={editando.grupo}
                      onChange={(e) => setEditando({ id: p.id, grupo: e.target.value })} />
                  ) : (p.grupo || <span className="text-fg-subtle">sin grupo</span>)}
                </td>
                <td className="p-2">
                  <span className={p.activo ? 'text-success' : 'text-fg-subtle'}>
                    {p.activo ? '● Activa' : '○ Inactiva'}
                  </span>
                </td>
                {canWrite && (
                  <td className="p-2 whitespace-nowrap text-xs">
                    {editando?.id === p.id ? (
                      <>
                        <button className="text-accent hover:underline mr-3" disabled={guardando}
                          onClick={guardarGrupo}>Guardar</button>
                        <button className="text-fg-muted hover:underline"
                          onClick={() => setEditando(null)}>Cancelar</button>
                      </>
                    ) : (
                      <>
                        <button className="text-accent hover:underline mr-3" disabled={guardando}
                          onClick={() => setEditando({ id: p.id, grupo: p.grupo || '' })}>
                          Editar grupo
                        </button>
                        <button className="text-igss-primary hover:underline" disabled={guardando}
                          onClick={() => alternarActivo(p)}>
                          {p.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {!cargando && filtered.length === 0 && (
              <tr>
                <td colSpan={canWrite ? 4 : 3} className="p-6 text-center text-fg-subtle">
                  {list.length === 0 ? 'El catálogo está vacío.' : 'Ninguna patología coincide con la búsqueda.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Usuarios({ canWrite }) {
  const [list, setList] = useState([]);
  const [pw, setPw] = useState(null);   // {username, new_password}
  const [busy, setBusy] = useState(null);
  function reload() { apiAdminUsers().then(setList).catch(() => setList([])); }
  useEffect(reload, []);
  const [q, setQ] = useState('');
  const filtered = useMemo(() => list.filter((u) => !q
    || ['username', 'nombre_completo', 'email'].some((f) => normIncludes(u[f], q))), [list, q]);

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
      <SearchInput value={q} onChange={setQ} placeholder="Buscar por usuario, nombre, email…"
        className="max-w-md" />
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
            {filtered.map((u) => (
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
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 300);
  useEffect(() => {
    const fn = src === 'jornadas' ? apiAdminAuditJornadas : apiAdminAuditAuth;
    fn({ limit: 200, ...(dq ? { q: dq } : {}) }).then(setRows).catch(() => setRows([]));
  }, [src, dq]);
  const cols = src === 'jornadas'
    ? ['timestamp', 'tabla', 'registro_id', 'accion', 'username', 'cambios_json']
    : ['timestamp', 'accion', 'username', 'detalle', 'ip'];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Pill active={src === 'jornadas'} onClick={() => setSrc('jornadas')}>Operaciones</Pill>
        <Pill active={src === 'auth'} onClick={() => setSrc('auth')}>Accesos / Auth</Pill>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar por usuario, acción, ip…"
          className="ml-auto min-w-[16rem]" />
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
