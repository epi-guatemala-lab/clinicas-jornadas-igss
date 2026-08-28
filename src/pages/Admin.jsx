import { useEffect, useMemo, useState } from 'react';
import {
  apiAdminUsers, apiAdminActivateUser, apiAdminDeactivateUser,
  apiAdminResetPassword, apiAdminAuditJornadas, apiAdminAuditAuth,
  apiAdminCreateUser, apiAdminPatchUser, apiListPersonal,
  apiListPatologias, apiCreatePatologia, apiUpdatePatologia,
} from '../api/endpoints';
import { useAuth } from '../hooks/useAuth';
import SearchInput from '../components/filters/SearchInput';
import SearchableSelect from '../components/filters/SearchableSelect';
import Modal from '../components/forms/Modal';
import Field from '../components/forms/Field';
import { normIncludes } from '../utils/norm';
import { useDebounce } from '../hooks/useDebounce';
import { mensajeDeError } from '../utils/apiError';
import { fmtFechaHora } from '../utils/format';

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

// Roles que se dan de alta desde el portal. «gerencia» NO está y no es un
// olvido: esas cuentas ven salarios y costos, el servidor rechaza crearlas o
// promoverlas por API, y siguen siendo altas manuales. Ofrecerla acá sería
// prometer algo que termina en un rechazo.
const ROLES_ALTA = [
  ['sipresalud', 'SIPRESALUD'],
  ['ce', 'Clínicas de Empresa (CE)'],
  ['admin', 'Administración del portal'],
];

// El otro eje: quién puede ESCRIBIR. Arranca siempre en visor — dar edición es
// una decisión que alguien toma, no el default que se deja sin mirar.
const PERMISOS = [
  ['viewer', 'Visor (solo consulta)'],
  ['editor', 'Editor (puede modificar)'],
];
const PERMISO_LABEL = { viewer: 'visor', editor: 'editor' };

const SECCIONES = [['', '— Sin sección —'], ['SIPRESALUD', 'SIPRESALUD'], ['CE', 'CE']];

// Sección que le toca a cada rol; el servidor exige que cuadren. Administración
// no pertenece a ninguna de las dos, así que ahí se respeta lo que se elija.
const SECCION_DE_ROL = { sipresalud: 'SIPRESALUD', ce: 'CE' };

/**
 * Mensaje del servidor TAL CUAL cuando lo hay. Los rechazos de esta pantalla
 * («es el último administrador con edición», «gerencia no se da de alta por
 * acá») dicen exactamente qué pasó y qué hacer; reemplazarlos por un texto
 * genérico deja al administrador sin saber por qué no lo dejó.
 */
function errorDeAdmin(e, accion) {
  const d = e?.response?.data?.detail;
  if (typeof d === 'string' && d.trim()) return d.trim();
  return mensajeDeError(e, accion);
}

function Usuarios({ canWrite }) {
  const [list, setList] = useState([]);
  const [pw, setPw] = useState(null);   // {username, new_password, alta?}
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState('');
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState(null);   // usuario cuyo rol/permiso se cambia
  function reload() { apiAdminUsers().then(setList).catch(() => setList([])); }
  useEffect(reload, []);
  const [q, setQ] = useState('');
  const filtered = useMemo(() => list.filter((u) => !q
    || ['username', 'nombre_completo', 'email'].some((f) => normIncludes(u[f], q))), [list, q]);

  async function toggle(u) {
    setBusy(u.id); setErr('');
    try {
      await (u.activo ? apiAdminDeactivateUser(u.id) : apiAdminActivateUser(u.id));
      reload();
    } catch (e) { setErr(errorDeAdmin(e, 'cambiar el estado del usuario')); }
    finally { setBusy(null); }
  }
  async function reset(u) {
    if (!confirm(`¿Resetear la contraseña de ${u.username}? Se mostrará UNA vez.`)) return;
    setBusy(u.id); setErr('');
    try { const d = await apiAdminResetPassword(u.id); setPw(d); }
    catch (e) { setErr(errorDeAdmin(e, 'resetear la contraseña')); }
    finally { setBusy(null); }
  }

  // El alta devuelve la contraseña generada UNA sola vez: se muestra en el mismo
  // banner del reset. Si el servidor no la devolviera, decirlo — la cuenta existe
  // pero nadie puede entrar con ella hasta resetearla.
  function usuarioCreado(datos) {
    setCreando(false); setErr('');
    reload();
    if (datos.new_password) setPw({ ...datos, alta: true });
    else setErr(`El usuario ${datos.username} quedó creado, pero el servidor no devolvió la contraseña. `
      + 'Generala con «Reset pass» en su fila.');
  }

  return (
    <div className="space-y-3">
      {pw && (
        <div className="rounded-xl border border-warning/40 bg-warning-soft p-3 text-sm">
          <div className="font-semibold text-warning">
            {pw.alta ? `Contraseña del usuario nuevo ${pw.username}` : `Contraseña nueva de ${pw.username}`}
            {' '}(guardala ahora, no se vuelve a mostrar):
          </div>
          <code className="block mt-1 text-base font-mono select-all">{pw.new_password}</code>
          <button className="btn-secondary text-xs mt-2" onClick={() => setPw(null)}>Cerrar</button>
        </div>
      )}
      {err && <div className="rounded-lg border border-danger/40 bg-danger-soft/40 p-2.5 text-sm text-danger">{err}</div>}
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Buscar por usuario, nombre, email…"
          className="max-w-md flex-1 min-w-[14rem]" />
        {canWrite && (
          <button className="btn-primary ml-auto" onClick={() => { setErr(''); setCreando(true); }}>
            + Nuevo usuario
          </button>
        )}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-elev text-fg-muted uppercase text-xs">
            <tr>
              <th className="text-left p-2">Usuario</th><th className="text-left p-2">Nombre</th>
              <th className="text-left p-2">Rol</th><th className="text-left p-2">Permiso</th>
              <th className="text-left p-2">Sección</th>
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
                <td className="p-2">
                  {/* Si el servidor no manda el permiso NO se asume «visor»: una
                      raya deja ver que falta el dato; decir «visor» de alguien que
                      escribe es una respuesta falsa a la pregunta que trae acá. */}
                  {u.permiso ? (
                    <span className={`badge ${u.permiso === 'editor'
                      ? 'bg-accent-soft text-accent' : 'bg-neutral-soft text-fg-muted'}`}>
                      {PERMISO_LABEL[u.permiso] || u.permiso}
                    </span>
                  ) : <span className="text-fg-subtle">—</span>}
                </td>
                <td className="p-2 text-fg-muted">{u.seccion || '—'}</td>
                <td className="p-2">
                  <span className={u.activo ? 'text-success' : 'text-danger'}>{u.activo ? '● Activo' : '○ Inactivo'}</span>
                </td>
                <td className="p-2 text-fg-muted text-xs">{fmtFechaHora(u.ultimo_acceso)}</td>
                {canWrite && (
                  <td className="p-2 whitespace-nowrap">
                    {/* Las cuentas de gerencia no se administran desde acá (el
                        servidor las bloquea en las dos direcciones): el botón se
                        deshabilita en vez de ofrecer algo que siempre rebota. */}
                    <button className="text-accent hover:underline text-xs mr-3 disabled:no-underline disabled:opacity-40"
                      disabled={busy === u.id || u.rol === 'gerencia'}
                      title={u.rol === 'gerencia' ? 'Las cuentas de gerencia se administran fuera del portal.' : undefined}
                      onClick={() => { setErr(''); setEditando(u); }}>Editar</button>
                    <button className="text-accent hover:underline text-xs mr-3" disabled={busy === u.id}
                      onClick={() => toggle(u)}>{u.activo ? 'Desactivar' : 'Activar'}</button>
                    <button className="text-igss-primary hover:underline text-xs" disabled={busy === u.id}
                      onClick={() => reset(u)}>Reset pass</button>
                  </td>
                )}
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={canWrite ? 8 : 7} className="p-6 text-center text-fg-subtle">Sin usuarios</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {creando && <NuevoUsuarioForm onClose={() => setCreando(false)} onCreado={usuarioCreado} />}
      {editando && (
        <EditarUsuarioForm usuario={editando}
          onClose={() => setEditando(null)}
          onSave={() => { setEditando(null); reload(); }} />
      )}
    </div>
  );
}

/**
 * Selector de la persona del roster a la que corresponde el usuario. La sección
 * va en la etiqueta a propósito: el servidor exige que la de la persona y la del
 * usuario coincidan, y así se ve antes de elegir y no en el rechazo.
 */
function PersonalSelect({ id, value, onChange, personal }) {
  return (
    <SearchableSelect
      id={id} name={id}
      value={value}
      onChange={(v) => onChange(v)}
      placeholder="— Sin vincular —"
      options={personal.map((p) => ({
        value: p.id,
        label: p.seccion ? `${p.nombre_completo} · ${p.seccion}` : p.nombre_completo,
      }))} />
  );
}

/**
 * Alta de usuario del portal.
 *
 * La contraseña NO se escribe acá: la genera el servidor y la devuelve una sola
 * vez. Así nadie elige «12345678» ni queda anotada en la pantalla de quien da
 * el alta, y el que la recibe la cambia si quiere.
 */
function NuevoUsuarioForm({ onClose, onCreado }) {
  const [form, setForm] = useState({
    username: '', nombre_completo: '', rol: 'sipresalud',
    permiso: 'viewer', seccion: 'SIPRESALUD', personal_id: '',
  });
  const [personal, setPersonal] = useState([]);
  const [err, setErr] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    apiListPersonal({ activo: true }).then((d) => setPersonal(Array.isArray(d) ? d : []))
      .catch(() => setPersonal([]));
  }, []);

  const set = (k) => (e) => setForm((f) => {
    const val = e?.target ? e.target.value : e;
    const next = { ...f, [k]: val };
    if (k === 'rol' && SECCION_DE_ROL[val]) next.seccion = SECCION_DE_ROL[val];
    return next;
  });

  async function submit(e) {
    e.preventDefault(); setErr('');
    const username = form.username.trim();
    const nombre = form.nombre_completo.trim();
    if (username.length < 3) { setErr('Escribí el usuario con el que va a entrar al portal (3 caracteres o más).'); return; }
    if (nombre.length < 3) { setErr('Escribí el nombre completo de la persona.'); return; }
    setGuardando(true);
    try {
      const d = await apiAdminCreateUser({
        username,
        nombre_completo: nombre,
        rol: form.rol,
        permiso: form.permiso,
        seccion: form.seccion || null,
        personal_id: form.personal_id === '' ? null : Number(form.personal_id),
      });
      onCreado({
        username: d?.username || username,
        new_password: d?.new_password ?? d?.password ?? null,
      });
    } catch (e2) { setErr(errorDeAdmin(e2, 'crear el usuario')); }
    finally { setGuardando(false); }
  }

  return (
    <Modal open onClose={onClose} title="Nuevo usuario del portal" size="lg"
      footer={<>
        <button type="button" className="btn-secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
        <button type="submit" form="usuario-form" className="btn-primary" disabled={guardando}>
          {guardando ? 'Creando…' : 'Crear usuario'}
        </button>
      </>}>
      <form id="usuario-form" onSubmit={submit} className="grid grid-cols-2 gap-3">
        <Field label="Usuario" name="username" required
               placeholder="Nombre.Apellido"
               hint="Con esto entra al portal. Convención: Nombre.Apellido"
               value={form.username} onChange={set('username')} />
        <Field label="Nombre completo" name="nombre_completo" required
               value={form.nombre_completo} onChange={set('nombre_completo')} />
        <Field label="Rol" type="select" name="rol" value={form.rol} onChange={set('rol')}
               hint="Gerencia no se da de alta desde acá."
               options={ROLES_ALTA} />
        <Field label="Permiso" type="select" name="permiso" value={form.permiso} onChange={set('permiso')}
               hint="Editor solo si de verdad tiene que modificar datos."
               options={PERMISOS} />
        <Field label="Sección" type="select" name="seccion" value={form.seccion} onChange={set('seccion')}
               options={SECCIONES} />
        <Field label="Personal vinculado (opcional)" name="personal_id"
               hint="Para ligar la cuenta con la persona del listado de personal.">
          <PersonalSelect id="personal_id" value={form.personal_id}
                          onChange={(v) => set('personal_id')(v)} personal={personal} />
        </Field>
        <p className="col-span-2 text-[11px] text-fg-subtle">
          La contraseña la genera el sistema y se muestra una sola vez al crear la cuenta.
        </p>
        {err && <div className="col-span-2 bg-danger-soft text-danger text-sm p-2 rounded">{err}</div>}
      </form>
    </Modal>
  );
}

/**
 * Cambiar rol, permiso, sección o persona vinculada de un usuario existente.
 * El servidor es el que decide: si el cambio dejaría al portal sin ningún
 * administrador con edición, o si intenta llevar a alguien a gerencia, lo
 * rechaza y ese mensaje se muestra tal cual.
 */
function EditarUsuarioForm({ usuario, onClose, onSave }) {
  // El estado con el que se abrió, guardado aparte: al guardar se manda SOLO lo
  // que se tocó. El servidor distingue «no lo mandé» de «mandé null», así que
  // omitir es no tocar — y eso evita el peor caso: si un día la lista llegara
  // sin `permiso`, cambiar la sección de un editor lo dejaría en visor.
  const [inicial] = useState(() => ({
    rol: usuario.rol || 'sipresalud',
    permiso: usuario.permiso || 'viewer',
    seccion: usuario.seccion || '',
    personal_id: usuario.personal_id ?? '',
  }));
  const [form, setForm] = useState(inicial);
  const [personal, setPersonal] = useState([]);
  const [err, setErr] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    apiListPersonal({ activo: true }).then((d) => setPersonal(Array.isArray(d) ? d : []))
      .catch(() => setPersonal([]));
  }, []);

  const set = (k) => (e) => setForm((f) => {
    const val = e?.target ? e.target.value : e;
    const next = { ...f, [k]: val };
    if (k === 'rol' && SECCION_DE_ROL[val]) next.seccion = SECCION_DE_ROL[val];
    return next;
  });

  // Red de seguridad: si el usuario tuviera un rol que esta pantalla no ofrece,
  // el desplegable mostraría el primero de la lista y guardar se lo cambiaría sin
  // que nadie lo pidiera. Se agrega su rol actual como opción para conservarlo.
  const rolOptions = ROLES_ALTA.some(([v]) => v === form.rol)
    ? ROLES_ALTA
    : [...ROLES_ALTA, [form.rol, `${form.rol} (actual)`]];

  async function submit(e) {
    e.preventDefault(); setErr('');
    const cambios = {};
    if (form.rol !== inicial.rol) cambios.rol = form.rol;
    if (form.permiso !== inicial.permiso) cambios.permiso = form.permiso;
    if (form.seccion !== inicial.seccion) cambios.seccion = form.seccion || null;
    // El desplegable devuelve texto y el listado un número: comparar como texto.
    if (String(form.personal_id) !== String(inicial.personal_id)) {
      cambios.personal_id = form.personal_id === '' ? null : Number(form.personal_id);
    }
    if (Object.keys(cambios).length === 0) { setErr('No cambiaste nada.'); return; }
    setGuardando(true);
    try {
      await apiAdminPatchUser(usuario.id, cambios);
      onSave();
    } catch (e2) { setErr(errorDeAdmin(e2, 'guardar los cambios del usuario')); }
    finally { setGuardando(false); }
  }

  return (
    <Modal open onClose={onClose} title={`Editar · ${usuario.username}`} size="lg"
      footer={<>
        <button type="button" className="btn-secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
        <button type="submit" form="usuario-edit-form" className="btn-primary" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </>}>
      <form id="usuario-edit-form" onSubmit={submit} className="grid grid-cols-2 gap-3">
        <p className="col-span-2 text-xs text-fg-muted">{usuario.nombre_completo}</p>
        <Field label="Rol" type="select" name="rol-edit" value={form.rol} onChange={set('rol')}
               options={rolOptions} />
        <Field label="Permiso" type="select" name="permiso-edit" value={form.permiso} onChange={set('permiso')}
               options={PERMISOS} />
        <Field label="Sección" type="select" name="seccion-edit" value={form.seccion} onChange={set('seccion')}
               options={SECCIONES} />
        <Field label="Personal vinculado" name="personal-edit"
               hint="Vaciar el campo desvincula la cuenta de la persona.">
          <PersonalSelect id="personal-edit" value={form.personal_id}
                          onChange={(v) => set('personal_id')(v)} personal={personal} />
        </Field>
        {err && <div className="col-span-2 bg-danger-soft text-danger text-sm p-2 rounded">{err}</div>}
      </form>
    </Modal>
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
                {cols.map((c) => {
                  // Los sellos de tiempo los guarda SQLite en UTC: mostrarlos
                  // crudos adelantaba seis horas cada línea de la bitácora.
                  const val = c === 'timestamp' ? fmtFechaHora(r[c]) : String(r[c] ?? '—');
                  return (
                    <td key={c} className="p-2 max-w-[280px] truncate" title={String(r[c] ?? '')}>{val}</td>
                  );
                })}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={cols.length} className="p-6 text-center text-fg-subtle">Sin registros</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
