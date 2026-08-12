import { useEffect, useState } from 'react';
import {
  apiListViaticos, apiCreateViatico, apiUpdateViatico, apiNextCorrelativo,
  apiListPersonal, apiListJornadas,
} from '../api/endpoints';
import { useAuth } from '../hooks/useAuth';
import { fmtQ, fmtN, isoLocalDate } from '../utils/format';
import { mensajeDeError } from '../utils/apiError';
import SearchableSelect from '../components/filters/SearchableSelect';
import SearchInput from '../components/filters/SearchInput';
import { useDebounce } from '../hooks/useDebounce';

// INCOMPLETO lo pone la carga del Excel maestro: son viáticos reales que
// llegaron sin correlativo. El correlativo tiene valor legal, así que el
// sistema NUNCA lo inventa: la fila entra marcada y alguien la completa acá.
const STATUS = ['INCOMPLETO', 'PENDIENTE', 'UTILIZADO', 'ANULADO', 'EXTRAVIADO'];
const STATUS_COMPLETABLES = ['PENDIENTE', 'UTILIZADO', 'ANULADO', 'EXTRAVIADO'];
const STATUS_BG = {
  INCOMPLETO: 'bg-warning-soft text-warning',
  PENDIENTE: 'bg-neutral-soft text-fg-muted',
  UTILIZADO: 'bg-success-soft text-success',
  ANULADO: 'bg-warning-soft text-warning',
  EXTRAVIADO: 'bg-danger-soft text-danger',
};

export default function Viaticos() {
  const { canWrite } = useAuth();
  const [list, setList] = useState([]);
  const [creating, setCreating] = useState(false);
  const [completando, setCompletando] = useState(null);   // viático a completar
  const [filter, setFilter] = useState({ status: '' });
  const [q, setQ] = useState('');
  const [incompletos, setIncompletos] = useState(0);
  const dq = useDebounce(q, 300);

  function reload() {
    const p = {}; if (filter.status) p.status = filter.status;
    if (dq) p.q = dq;
    apiListViaticos(p).then(setList);
    // Conteo aparte: el aviso tiene que verse aunque el filtro activo sea otro.
    apiListViaticos({ status: 'INCOMPLETO' })
      .then((r) => setIncompletos(Array.isArray(r) ? r.length : 0))
      .catch(() => setIncompletos(0));
  }
  useEffect(reload, [filter, dq]); // eslint-disable-line

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Viáticos · Correlativo {new Date().getFullYear()}</h1>
        {canWrite && (
          <button className="btn-primary" onClick={()=>setCreating(true)}>+ Nuevo viático</button>
        )}
      </div>

      {incompletos > 0 && filter.status !== 'INCOMPLETO' && (
        <div className="rounded-lg border border-warning/40 bg-warning-soft/40 p-3 text-sm flex flex-wrap items-center justify-between gap-2">
          <div>
            <b className="text-warning">
              {fmtN(incompletos)} {incompletos === 1 ? 'viático incompleto' : 'viáticos incompletos'}
            </b>{' '}
            <span className="text-fg-muted">
              — llegaron del Excel sin correlativo. Hay que ponerles el correlativo y el monto;
              el sistema no los inventa.
            </span>
          </div>
          <button className="btn-secondary text-xs whitespace-nowrap"
            onClick={() => setFilter({ status: 'INCOMPLETO' })}>
            Ver los incompletos
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {['', ...STATUS].map((s) => (
          <button key={s||'all'} onClick={()=>setFilter({ status: s })}
            className={`px-3 py-1.5 rounded border text-sm ${filter.status === s
              ? 'bg-accent text-white border-accent' : 'bg-surface border-line'}`}>
            {s || 'Todos'}
            {s === 'INCOMPLETO' && incompletos > 0 && filter.status !== s && (
              <span className="ml-1.5 text-xs text-warning font-semibold">{fmtN(incompletos)}</span>
            )}
          </button>
        ))}
        <SearchInput value={q} onChange={setQ} placeholder="Buscar por correlativo, nombramiento, servidor…"
          className="ml-auto min-w-[16rem]" />
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-elev text-xs uppercase text-fg-muted">
            <tr>
              <th className="text-left p-2">#</th>
              <th className="text-left p-2">Mes</th>
              <th className="text-left p-2">Servidor</th>
              <th className="text-left p-2">Nombramiento</th>
              <th className="text-right p-2">Monto</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Jornada</th>
              {canWrite && <th className="text-left p-2">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {list.map((v) => {
              const incompleto = v.status === 'INCOMPLETO' || v.correlativo == null;
              return (
                <tr key={v.id}
                  className={`border-t ${incompleto ? 'bg-warning-soft/30' : ''}`}>
                  <td className="p-2 font-mono">
                    {v.correlativo != null
                      ? v.correlativo
                      : <span className="text-warning font-sans text-xs">sin correlativo</span>}
                  </td>
                  <td className="p-2">{v.mes_anio}</td>
                  <td className="p-2">{v.personal_nombre || '—'}</td>
                  <td className="p-2 text-xs">{v.nombramiento} {v.fecha_nombramiento && <span className="text-fg-muted">({v.fecha_nombramiento})</span>}</td>
                  <td className="p-2 text-right font-mono">{fmtQ(v.monto)}</td>
                  <td className="p-2">
                    <span className={`badge ${STATUS_BG[v.status] || 'bg-neutral-soft text-fg-muted'}`}>
                      {v.status}
                    </span>
                    {incompleto && (
                      <div className="text-[11px] text-warning mt-0.5">
                        {v.monto == null ? 'Falta correlativo y monto' : 'Falta el correlativo'}
                      </div>
                    )}
                  </td>
                  <td className="p-2 text-xs">{v.jornada_id ? `#${v.jornada_id}` : '—'}</td>
                  {canWrite && (
                    <td className="p-2 text-xs">
                      {incompleto && (
                        <button className="text-accent hover:underline"
                          onClick={() => setCompletando(v)}>
                          Completar
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr><td colSpan={canWrite ? 8 : 7} className="p-6 text-center text-fg-subtle">Sin viáticos</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {creating && <NuevoViatico onClose={()=>setCreating(false)} onSaved={()=>{setCreating(false); reload();}} />}
      {completando && (
        <CompletarViatico viatico={completando}
          onClose={()=>setCompletando(null)}
          onSaved={()=>{ setCompletando(null); reload(); }} />
      )}
    </div>
  );
}

/**
 * Completar un viático que la carga dejó marcado como INCOMPLETO: se le pone
 * el correlativo real (dato con valor legal, nunca autogenerado a ciegas) y el
 * monto. Al guardarlo deja de estar incompleto.
 */
function CompletarViatico({ viatico, onClose, onSaved }) {
  const [form, setForm] = useState({
    correlativo: viatico.correlativo ?? '',
    monto: viatico.monto ?? '',
    status: 'PENDIENTE',
    nombramiento: viatico.nombramiento || '',
    fecha_nombramiento: viatico.fecha_nombramiento || '',
  });
  const [next, setNext] = useState(null);
  const [err, setErr] = useState('');
  const [guardando, setGuardando] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => { apiNextCorrelativo().then((r) => setNext(r.siguiente)).catch(() => {}); }, []);

  async function submit(e) {
    e.preventDefault(); setErr('');
    if (form.correlativo === '' || form.correlativo == null) {
      setErr('Escribí el correlativo del viático. Es el número del formulario físico y no se puede inventar.');
      return;
    }
    setGuardando(true);
    try {
      await apiUpdateViatico(viatico.id, {
        mes_anio: viatico.mes_anio,
        jornada_id: viatico.jornada_id || null,
        personal_id: viatico.personal_id || null,
        notas: viatico.notas || null,
        correlativo: Number(form.correlativo),
        monto: form.monto === '' ? null : Number(form.monto),
        status: form.status,
        nombramiento: form.nombramiento || null,
        fecha_nombramiento: form.fecha_nombramiento || null,
      });
      onSaved();
    } catch (e2) {
      setErr(mensajeDeError(e2, 'guardar el viático'));
    } finally { setGuardando(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form className="bg-surface rounded-2xl shadow-2xl max-w-lg w-full border border-line dark:shadow-glow-accent"
        onClick={(e)=>e.stopPropagation()} onSubmit={submit}>
        <div className="border-b border-line-subtle p-4">
          <h2 className="text-xl font-bold">Completar viático</h2>
          <div className="text-xs text-fg-muted mt-0.5">
            {viatico.personal_nombre || 'Sin servidor asignado'} · {viatico.mes_anio}
            {viatico.jornada_id ? ` · jornada #${viatico.jornada_id}` : ''}
          </div>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          <div>
            <label className="label">Correlativo</label>
            <input className="input" type="number" autoFocus
              placeholder={next ? `sugerido: ${next}` : ''}
              value={form.correlativo} onChange={(e)=>set('correlativo', e.target.value)} />
            {next && <div className="text-[11px] text-fg-muted mt-1">
              El siguiente libre es <b>{next}</b>, pero escribí el del formulario físico.
            </div>}
          </div>
          <div>
            <label className="label">Monto Q</label>
            <input className="input" type="number" step="0.01"
              value={form.monto} onChange={(e)=>set('monto', e.target.value)} />
          </div>
          <div>
            <label className="label">Nombramiento</label>
            <input className="input" placeholder="ej 223/2026"
              value={form.nombramiento} onChange={(e)=>set('nombramiento', e.target.value)} />
          </div>
          <div>
            <label className="label">Fecha del nombramiento</label>
            <input className="input" type="date"
              value={form.fecha_nombramiento} onChange={(e)=>set('fecha_nombramiento', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="label">Status al completarlo</label>
            <select className="input" value={form.status} onChange={(e)=>set('status', e.target.value)}>
              {STATUS_COMPLETABLES.map((s)=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {err && <div className="col-span-2 bg-danger-soft text-danger p-2 rounded text-sm">{err}</div>}
        </div>
        <div className="border-t p-3 flex justify-end gap-2 bg-surface-elev">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}

function NuevoViatico({ onClose, onSaved }) {
  const [form, setForm] = useState({
    mes_anio: monthLabel(new Date()),
    correlativo: '',
    monto: '',
    status: 'PENDIENTE',
    nombramiento: '',
    fecha_nombramiento: isoLocalDate(),
  });
  const [next, setNext] = useState(null);
  const [personal, setPersonal] = useState([]);
  const [jornadas, setJornadas] = useState([]);
  const [err, setErr] = useState('');
  const set = (k,v)=>setForm(f=>({...f,[k]:v}));

  useEffect(() => {
    apiNextCorrelativo().then((r) => setNext(r.siguiente));
    apiListPersonal({ activo: true }).then(setPersonal);
    apiListJornadas({}).then(setJornadas);
  }, []);

  async function submit(e) {
    e.preventDefault(); setErr('');
    try {
      await apiCreateViatico({
        ...form,
        correlativo: form.correlativo === '' ? null : Number(form.correlativo),
        monto: form.monto === '' ? null : Number(form.monto),
        personal_id: form.personal_id || null,
        jornada_id: form.jornada_id || null,
      });
      onSaved();
    } catch (e) { setErr(e.response?.data?.detail || 'Error'); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form className="bg-surface rounded-2xl shadow-2xl max-w-xl w-full border border-line dark:shadow-glow-accent" onClick={(e)=>e.stopPropagation()} onSubmit={submit}>
        <div className="border-b border-line-subtle p-4"><h2 className="text-xl font-bold">Nuevo viático</h2>
          {next && <div className="text-xs text-fg-muted mt-0.5">Siguiente correlativo automático: <b>{next}</b> (podés cambiarlo)</div>}
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          <div><label className="label">Correlativo</label>
            <input className="input" type="number" placeholder={next ? `auto: ${next}` : ''}
              value={form.correlativo} onChange={(e)=>set('correlativo', e.target.value)} /></div>
          <div><label className="label">Mes</label>
            <input className="input" value={form.mes_anio} onChange={(e)=>set('mes_anio', e.target.value)} /></div>
          <div><label className="label">Servidor público</label>
            <SearchableSelect value={form.personal_id || ''}
              onChange={(v) => set('personal_id', v ? Number(v) : null)}
              placeholder="—"
              options={personal.map((p) => ({ value: p.id, label: p.nombre_completo }))} />
          </div>
          <div><label className="label">Jornada (opcional)</label>
            <SearchableSelect value={form.jornada_id || ''}
              onChange={(v) => set('jornada_id', v ? Number(v) : null)}
              placeholder="—"
              options={jornadas.map((j) => ({ value: j.id, label: `${j.codigo} · ${j.fecha_inicio}` }))} />
          </div>
          <div><label className="label">Nombramiento</label>
            <input className="input" placeholder="ej 223/2026" value={form.nombramiento} onChange={(e)=>set('nombramiento', e.target.value)} /></div>
          <div><label className="label">Fecha nombramiento</label>
            <input className="input" type="date" value={form.fecha_nombramiento} onChange={(e)=>set('fecha_nombramiento', e.target.value)} /></div>
          <div><label className="label">Monto Q</label>
            <input className="input" type="number" step="0.01" value={form.monto} onChange={(e)=>set('monto', e.target.value)} /></div>
          <div><label className="label">Status</label>
            <select className="input" value={form.status} onChange={(e)=>set('status', e.target.value)}>
              {STATUS.map((s)=><option key={s} value={s}>{s}</option>)}
            </select></div>
          {err && <div className="col-span-2 bg-danger-soft text-danger p-2 rounded text-sm">{err}</div>}
        </div>
        <div className="border-t p-3 flex justify-end gap-2 bg-surface-elev">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary">Crear viático</button>
        </div>
      </form>
    </div>
  );
}

function monthLabel(d) {
  const meses = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
  return `${meses[d.getMonth()]}-${d.getFullYear()}`;
}
