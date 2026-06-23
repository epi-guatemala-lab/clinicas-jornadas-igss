import { useEffect, useState } from 'react';
import { apiListPersonal, apiCreatePersonal, apiUpdatePersonal } from '../api/endpoints';
import { useAuth } from '../hooks/useAuth';
import { fmtQ } from '../utils/format';

/**
 * Muestra costo diario derivado del salario ingresado + renglón.
 *
 * Para 011/022 (personal permanente/contrato): el usuario ingresa SALARIO ANUAL.
 *   diario = (anual × 1.20) / 365  — incluye 20% prestaciones (aguinaldo, bono14, indemnización)
 *
 * Para 029 (honorarios): el usuario ingresa SALARIO MENSUAL.
 *   diario = mensual / 30
 *
 * Recibe `salarioInput` (lo que el usuario tipea) y `renglon`. Internamente
 * decide si es anual o mensual.
 */
function CostoDiarioPreview({ salarioInput, renglon }) {
  const v = Number(salarioInput) || 0;
  if (!v) return null;
  const conPrestaciones = renglon === '011' || renglon === '022';
  let anual, mensual, diario;
  if (conPrestaciones) {
    // 011/022: el input ES el salario anual
    anual = v * 1.20;        // anual + 20% prestaciones
    mensual = v / 12;        // mensual equivalente (sin prestaciones, base)
    diario = anual / 365;
  } else {
    // 029: el input ES el salario mensual
    mensual = v;
    anual = v * 12;
    diario = v / 30;
  }
  return (
    <div className="mt-2 text-xs bg-surface-elev rounded-lg p-2.5 border border-line-subtle">
      <div className="font-semibold text-fg mb-1 flex items-center gap-1">
        💰 Costo diario derivado · partida {renglon || '—'}
      </div>
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <div className="text-fg-muted">Diario prorrateado</div>
          <div className="font-bold tabular-nums text-accent text-sm">{fmtQ(diario)}</div>
        </div>
        <div>
          <div className="text-fg-muted">{conPrestaciones ? 'Mensual base' : 'Mensual'}</div>
          <div className="font-semibold tabular-nums">{fmtQ(mensual)}</div>
        </div>
        <div>
          <div className="text-fg-muted">Anual{conPrestaciones && ' +20%'}</div>
          <div className="font-semibold tabular-nums">{fmtQ(anual)}</div>
        </div>
      </div>
      <div className="mt-1.5 text-[10px] text-fg-muted leading-tight">
        {conPrestaciones
          ? 'Fórmula: (salario anual × 1.20) / 365 — incluye aguinaldo, bono 14 e indemnización (20%).'
          : 'Fórmula: salario mensual / 30 — honorarios sin prestaciones.'}
      </div>
    </div>
  );
}

const ROLES = ['LIDER', 'MEDICO', 'ADMIN', 'ENFERMERIA', 'LABORATORISTA', 'DIGITADOR', 'ENCUESTADOR'];

export default function Personal() {
  const { user, canWrite } = useAuth();
  // Personal (datos de RRHH/salarios) solo lo edita un admin editor; el resto
  // (sipresalud/ce/gerencia) ve el roster pero no lo modifica. Espeja require_admin_write.
  const canEditPersonal = canWrite && user.rol === 'admin';
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState({ seccion: '' });
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  function reload() {
    apiListPersonal({ ...filter, activo: true }).then(setList);
  }
  useEffect(reload, [filter]); // eslint-disable-line

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Personal IGSS</h1>
        {canEditPersonal && (
          <button className="btn-primary" onClick={() => setCreating(true)}>+ Agregar</button>
        )}
      </div>

      <div className="flex gap-2">
        {['', 'CE', 'SIPRESALUD'].map((s) => (
          <button key={s||'all'} onClick={()=>setFilter({ seccion: s })}
            className={`px-3 py-1.5 rounded border ${filter.seccion === s
              ? 'bg-accent text-white border-accent' : 'bg-surface border-line'}`}>
            {s || 'Todas'}
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-elev text-xs uppercase text-fg-muted">
            <tr>
              <th className="text-left p-2">Nombre</th>
              <th className="text-left p-2">Sección</th>
              <th className="text-left p-2">Rol default</th>
              <th className="text-left p-2">Partida (renglón)</th>
              <th className="text-right p-2">Salario mensual (Q)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-2 font-medium">{p.nombre_completo}<div className="text-xs text-fg-muted">NIT: {p.nit || '—'}</div></td>
                <td className="p-2">{p.seccion}</td>
                <td className="p-2">{p.rol_default}</td>
                <td className="p-2">{p.renglon} {p.ibm && <span className="text-fg-muted text-xs">({p.ibm})</span>}</td>
                <td className="p-2 text-right font-mono">{fmtQ(p.compensacion)}</td>
                <td className="p-2">{canEditPersonal && <button className="text-accent text-xs hover:underline" onClick={()=>setEditing(p)}>Editar</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {creating && <PersonalForm onClose={()=>setCreating(false)} onSave={()=>{setCreating(false); reload();}} />}
      {editing && <PersonalForm initial={editing} onClose={()=>setEditing(null)} onSave={()=>{setEditing(null); reload();}} />}
    </div>
  );
}

function PersonalForm({ initial, onClose, onSave }) {
  // La BD guarda `compensacion` SIEMPRE en mensual (Q/mes), independiente del renglón.
  // En la UI:
  //   - 011/022 (planilla): el usuario ingresa SALARIO ANUAL — al guardar dividimos /12.
  //   - 029 (honorarios): el usuario ingresa SALARIO MENSUAL — se guarda directo.
  // Al cargar para edición, multiplicamos la compensacion mensual × 12 si es 011/022
  // para que el input muestre el valor anual que el usuario espera ver.
  const initialRenglon = initial?.renglon || '029';
  const initialSalarioInput =
    initial?.compensacion != null
      ? ((initialRenglon === '011' || initialRenglon === '022')
          ? initial.compensacion * 12   // mensual BD → anual UI
          : initial.compensacion)
      : '';

  const [form, setForm] = useState({
    nombre_completo: initial?.nombre_completo || '',
    nit: initial?.nit || '',
    renglon: initialRenglon,
    ibm: initial?.ibm || '',
    rol_default: initial?.rol_default || 'MEDICO',
    seccion: initial?.seccion || 'SIPRESALUD',
    salarioInput: initialSalarioInput,    // lo que muestra el input (anual o mensual según renglón)
    email: initial?.email || '',
    telefono: initial?.telefono || '',
  });
  const [err, setErr] = useState('');
  const set = (k,v)=>setForm(f=>({...f, [k]:v}));

  const esPlanilla = form.renglon === '011' || form.renglon === '022';
  const labelSalario = esPlanilla
    ? 'Salario ANUAL en Quetzales · 011 / 022'
    : 'Salario MENSUAL en Quetzales · 029 honorarios';
  const placeholderSalario = esPlanilla ? 'ej. 180000.00 (anual)' : 'ej. 15000.00 (mensual)';

  async function submit(e) {
    e.preventDefault(); setErr('');
    try {
      const inputVal = form.salarioInput === '' ? null : Number(form.salarioInput);
      // Convertir a mensual antes de guardar en BD (contrato existente)
      const compensacion = inputVal == null
        ? null
        : (esPlanilla ? inputVal / 12 : inputVal);
      const body = {
        nombre_completo: form.nombre_completo,
        nit: form.nit,
        renglon: form.renglon,
        ibm: form.ibm,
        rol_default: form.rol_default,
        seccion: form.seccion,
        compensacion,
        email: form.email,
        telefono: form.telefono,
      };
      if (initial) await apiUpdatePersonal(initial.id, body);
      else await apiCreatePersonal(body);
      onSave();
    } catch (e) { setErr(e.response?.data?.detail || 'Error'); }
  }
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form className="bg-surface rounded-2xl shadow-2xl max-w-xl w-full border border-line dark:shadow-glow-accent" onClick={(e)=>e.stopPropagation()} onSubmit={submit}>
        <div className="border-b border-line-subtle p-4"><h2 className="text-xl font-bold">{initial ? 'Editar persona' : 'Nueva persona'}</h2></div>
        <div className="p-4 grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="label">Nombre completo *</label>
            <input className="input" value={form.nombre_completo} onChange={(e)=>set('nombre_completo', e.target.value)} required /></div>
          <div><label className="label">NIT</label>
            <input className="input" value={form.nit || ''} onChange={(e)=>set('nit', e.target.value)} /></div>
          <div><label className="label">Partida presupuestaria (renglón)</label>
            <select className="input" value={form.renglon || ''} onChange={(e)=>set('renglon', e.target.value)}>
              <option value="011">011 — Personal permanente</option>
              <option value="022">022 — Personal por contrato</option>
              <option value="029">029 — Honorarios</option>
            </select></div>
          <div><label className="label">Código interno IGSS</label>
            <input className="input" value={form.ibm || ''} onChange={(e)=>set('ibm', e.target.value)} placeholder="ej. IBM o código de planilla" /></div>
          <div><label className="label">Rol default</label>
            <select className="input" value={form.rol_default} onChange={(e)=>set('rol_default', e.target.value)}>
              {ROLES.map((r)=><option key={r} value={r}>{r}</option>)}
            </select></div>
          <div><label className="label">Sección *</label>
            <select className="input" value={form.seccion} onChange={(e)=>set('seccion', e.target.value)}>
              <option value="SIPRESALUD">SIPRESALUD</option><option value="CE">CE</option>
            </select></div>
          <div className="col-span-2"><label className="label">{labelSalario}</label>
            <input className="input" type="number" step="0.01"
                   value={form.salarioInput}
                   onChange={(e)=>set('salarioInput', e.target.value)}
                   placeholder={placeholderSalario} />
            <p className="text-[10px] text-fg-subtle mt-1">
              {esPlanilla
                ? 'Las partidas 011 y 022 se ingresan como salario anual. El sistema lo convierte automáticamente al guardar.'
                : 'Los honorarios (029) se ingresan como salario mensual.'}
              {' '}Se guarda cifrado en la BD. Solo gerencia y admin pueden ver el valor.
            </p>
            <CostoDiarioPreview salarioInput={form.salarioInput} renglon={form.renglon} />
          </div>
          <div><label className="label">Email</label>
            <input className="input" type="email" value={form.email || ''} onChange={(e)=>set('email', e.target.value)} /></div>
          <div><label className="label">Teléfono</label>
            <input className="input" value={form.telefono || ''} onChange={(e)=>set('telefono', e.target.value)} /></div>
          {err && <div className="col-span-2 bg-danger-soft text-danger p-2 rounded text-sm">{err}</div>}
        </div>
        <div className="border-t border-line-subtle p-3 flex justify-end gap-2 bg-surface-elev">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary">{initial ? 'Guardar' : 'Crear'}</button>
        </div>
      </form>
    </div>
  );
}
