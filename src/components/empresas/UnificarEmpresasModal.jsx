import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  apiListEmpresas, apiNoSonLaMisma, apiPlanUnificacion, apiSugerenciasUnificacion,
  apiUnificarEmpresa,
} from '../../api/endpoints';
import { mensajeDeError } from '../../utils/apiError';
import { fmtN } from '../../utils/format';
import Modal from '../forms/Modal';

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Error del servidor tal cual: `detail` como texto o como {codigo, mensaje}. */
function textoError(e, accion) {
  const d = e?.response?.data?.detail;
  if (typeof d === 'string' && d) return d;
  if (d && typeof d === 'object' && d.mensaje) return d.mensaje;
  return mensajeDeError(e, accion);
}

/** Clave `tabla.columna` → texto legible. */
function legible(clave) {
  if (clave === 'jornadas.empresa_id') return 'jornadas';
  const tabla = String(clave).split('.')[0] || String(clave);
  return tabla.replace(/_/g, ' ');
}

// Nombre de cada dato de la ficha tal como lo lee una persona.
const ETIQUETAS = {
  nombre_comercial: 'Nombre comercial', nit: 'NIT', sector: 'Sector',
  n_empleados_estimado: 'Empleados (estimado)', n_empleados_planilla: 'Empleados en planilla',
  numero_patronal: 'Número patronal', unidad_adscripcion: 'Unidad de adscripción', grupo: 'Grupo',
  departamento: 'Departamento', municipio: 'Municipio', zona: 'Zona', direccion: 'Dirección',
  contacto_nombre: 'Nombre del contacto', contacto_cargo: 'Cargo del contacto',
  contacto_telefono: 'Teléfono del contacto', contacto_email: 'Correo del contacto',
  fecha_convenio: 'Fecha del convenio', fecha_inauguracion: 'Fecha de inauguración',
  inauguracion_fecha_fin: 'Fin de la inauguración', inauguracion_hora_inicio: 'Hora de inicio de la inauguración',
  inauguracion_hora_fin: 'Hora de fin de la inauguración', inauguracion_lugar: 'Lugar de la inauguración',
  tiene_clinica_amarrada: 'Clínica amarrada', fecha_amarre: 'Fecha del amarre',
  jornada_origen_amarre_id: 'Jornada que originó el amarre', notas: 'Notas',
};
const etiqueta = (campo) => ETIQUETAS[campo] || String(campo).replace(/_/g, ' ');
const sinPunto = (t) => String(t || '').replace(/\.+$/, '');

const nombreEmpresa = (e) => e?.nombre_legal || e?.nombre_comercial || `Empresa ${e?.id ?? ''}`;
const MOTIVO_MIN = 10;

export default function UnificarEmpresasModal({ open, onClose, onUnificada }) {
  const [empresas, setEmpresas] = useState([]);
  const [sugerencias, setSugerencias] = useState([]);
  const [errLista, setErrLista] = useState('');
  const [conservar, setConservar] = useState(null);   // objeto empresa
  const [absorber, setAbsorber] = useState(null);
  const [plan, setPlan] = useState(null);
  const [errPlan, setErrPlan] = useState('');
  const [cargandoPlan, setCargandoPlan] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [palabra, setPalabra] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errEnvio, setErrEnvio] = useState('');
  const [resultado, setResultado] = useState(null);

  const cargarSugerencias = useCallback(() => {
    apiSugerenciasUnificacion().then(setSugerencias)
      .catch((e) => setErrLista(textoError(e, 'cargar las sugerencias')));
  }, []);

  useEffect(() => {
    if (!open) return;
    setErrLista(''); setResultado(null);
    apiListEmpresas({ activa: true }).then((d) => setEmpresas(Array.isArray(d) ? d : (d?.data || [])))
      .catch((e) => setErrLista(textoError(e, 'cargar las empresas')));
    cargarSugerencias();
  }, [open, cargarSugerencias]);

  // Cualquier cambio de selección invalida el plan y la confirmación.
  useEffect(() => {
    setPlan(null); setErrPlan(''); setMotivo(''); setPalabra(''); setErrEnvio('');
  }, [conservar?.id, absorber?.id]);

  const porId = useMemo(() => new Map(empresas.map((e) => [e.id, e])), [empresas]);
  const aEmpresa = (x) => porId.get(x.id) || x;

  function revisar(par) {
    setResultado(null);
    setConservar(aEmpresa(par.a)); setAbsorber(aEmpresa(par.b));
  }

  async function noSonLaMisma(par) {
    try {
      await apiNoSonLaMisma(par.a.id, par.b.id);
      setSugerencias((s) => s.filter((p) => p !== par));
    } catch (e) {
      setErrLista(textoError(e, 'registrar que no son la misma'));
    }
  }

  async function verPlan() {
    setCargandoPlan(true); setErrPlan(''); setPlan(null);
    try {
      setPlan(await apiPlanUnificacion(conservar.id, absorber.id));
    } catch (e) {
      setErrPlan(textoError(e, 'calcular el plan'));
    } finally {
      setCargandoPlan(false);
    }
  }

  async function unificar() {
    setEnviando(true); setErrEnvio('');
    try {
      const r = await apiUnificarEmpresa(conservar.id, {
        absorber_id: absorber.id, motivo: motivo.trim(), confirmacion: palabra.trim(),
      });
      setResultado({ ...r, conservada: nombreEmpresa(conservar), absorbida: nombreEmpresa(absorber) });
      setConservar(null); setAbsorber(null);
      cargarSugerencias();
      onUnificada?.();
      apiListEmpresas({ activa: true }).then((d) => setEmpresas(Array.isArray(d) ? d : (d?.data || []))).catch(() => {});
    } catch (e) {
      setErrEnvio(textoError(e, 'unificar las empresas'));
    } finally {
      setEnviando(false);
    }
  }

  const mismas = conservar && absorber && conservar.id === absorber.id;
  const listoParaPlan = conservar && absorber && !mismas;
  const puedeUnificar = plan && motivo.trim().length >= MOTIVO_MIN && palabra.trim() === 'UNIFICAR' && !enviando;

  return (
    <Modal open={open} onClose={onClose} title="Unificar empresas" size="xl">
      <div className="space-y-5 text-sm">
        <p className="text-xs text-fg-muted">
          La empresa absorbida no se borra: queda desactivada con una nota y su nombre se reconoce
          en las próximas cargas.
        </p>

        {resultado && (
          <div className="rounded-lg border border-success/40 bg-success-soft/40 p-3 space-y-1">
            <p className="font-semibold text-success">Empresas unificadas</p>
            <p className="text-fg-muted">
              «{resultado.absorbida}» quedó dentro de «{resultado.conservada}».
            </p>
            <ResumenMueve mueve={resultado.mueve} completa={resultado.completa} />
          </div>
        )}

        {errLista && <p className="text-danger break-words">{errLista}</p>}

        <section className="space-y-2">
          <h3 className="font-semibold text-fg">Posibles repetidas</h3>
          {sugerencias.length === 0 ? (
            <p className="text-fg-muted text-xs">No hay sugerencias pendientes.</p>
          ) : (
            <ul className="divide-y divide-line-subtle max-h-64 overflow-y-auto">
              {sugerencias.map((p) => (
                <li key={`${p.a.id}-${p.b.id}`} className="py-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <MiniEmpresa e={p.a} />
                    <MiniEmpresa e={p.b} />
                    <p className="text-[11px] text-fg-subtle">
                      Parecido: {typeof p.parecido === 'number'
                        ? `${fmtN(Math.round(p.parecido <= 1 ? p.parecido * 100 : p.parecido))} %`
                        : (p.parecido ?? '—')}
                      {p.motivo ? ` · ${p.motivo}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="btn-secondary text-xs" onClick={() => revisar(p)}>Revisar</button>
                    <button type="button" className="btn-secondary text-xs" onClick={() => noSonLaMisma(p)}>No son la misma</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold text-fg">Elegir las dos empresas</h3>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start">
            <Buscador titulo="Se conserva" empresas={empresas} elegida={conservar} onElegir={setConservar} />
            <button type="button" className="btn-secondary text-xs md:mt-6"
              disabled={!conservar && !absorber}
              onClick={() => { setConservar(absorber); setAbsorber(conservar); }}
              aria-label="Intercambiar cuál se conserva">
              ⇄ Intercambiar
            </button>
            <Buscador titulo="Se absorbe (queda desactivada)" empresas={empresas} elegida={absorber} onElegir={setAbsorber} />
          </div>
          {mismas && <p className="text-danger text-xs">Elegiste la misma empresa dos veces.</p>}
          <button type="button" className="btn-primary" disabled={!listoParaPlan || cargandoPlan} onClick={verPlan}>
            {cargandoPlan ? 'Calculando…' : 'Ver qué pasaría'}
          </button>
          {errPlan && <p className="text-danger break-words">{errPlan}</p>}
        </section>

        {plan && (
          <section className="space-y-3 border-t border-line-subtle pt-3">
            <h3 className="font-semibold text-fg">Qué pasaría</h3>
            <p className="text-fg-muted">
              Se conserva <b>{nombreEmpresa(plan.conserva || conservar)}</b> y se absorbe{' '}
              <b>{sinPunto(nombreEmpresa(plan.absorbe || absorber))}</b>.
            </p>
            <ResumenMueve mueve={plan.mueve} completa={plan.completa} />

            {Array.isArray(plan.conflictos) && plan.conflictos.length > 0 && (
              <div className="rounded-lg border border-warning/40 bg-warning-soft/40 p-3">
                <p className="font-semibold text-warning mb-1">Datos distintos: se queda el de la empresa que se conserva</p>
                <table className="w-full text-xs">
                  <thead className="text-left text-fg-muted">
                    <tr><th className="py-1 pr-2">Dato</th><th className="pr-2">Se queda</th><th>Se descarta</th></tr>
                  </thead>
                  <tbody>
                    {plan.conflictos.map((c) => (
                      <tr key={c.campo} className="border-t border-line-subtle">
                        <td className="py-1 pr-2">{etiqueta(c.campo)}</td>
                        <td className="pr-2">{valor(c.conserva)}</td>
                        <td className="text-fg-muted">{valor(c.absorbe)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {Array.isArray(plan.jornadas_mismo_dia) && plan.jornadas_mismo_dia.length > 0 && (
              <div className="rounded-lg border border-warning/40 bg-warning-soft/40 p-3">
                <p className="font-semibold text-warning mb-1">Jornadas que quedarían el mismo día</p>
                <ul className="text-xs space-y-0.5">
                  {plan.jornadas_mismo_dia.map((j) => (
                    <li key={j.fecha}>{j.fecha}: {(j.codigos || []).join(', ')}</li>
                  ))}
                </ul>
              </div>
            )}

            {Array.isArray(plan.avisos) && plan.avisos.length > 0 && (
              <ul className="list-disc pl-5 text-xs text-warning space-y-0.5">
                {plan.avisos.map((a, i) => <li key={i}>{typeof a === 'string' ? a : (a?.mensaje || JSON.stringify(a))}</li>)}
              </ul>
            )}

            <div className="space-y-2 border-t border-line-subtle pt-3">
              <div>
                <label className="label" htmlFor="unif-motivo">
                  Motivo (mínimo {MOTIVO_MIN} caracteres)
                </label>
                <textarea id="unif-motivo" className="input" rows={2} value={motivo}
                  onChange={(e) => setMotivo(e.target.value)} disabled={enviando} />
                <p className="text-[11px] text-fg-subtle mt-0.5">{motivo.trim().length} / {MOTIVO_MIN}</p>
              </div>
              <div>
                <label className="label" htmlFor="unif-palabra">
                  Para confirmar, escribí <b>UNIFICAR</b>
                </label>
                <input id="unif-palabra" className="input max-w-xs" autoComplete="off" value={palabra}
                  onChange={(e) => setPalabra(e.target.value)} disabled={enviando} />
              </div>
              {errEnvio && <p className="text-danger break-words">{errEnvio}</p>}
              <button type="button" className="btn-danger" disabled={!puedeUnificar} onClick={unificar}>
                {enviando ? 'Unificando…' : 'Unificar empresas'}
              </button>
            </div>
          </section>
        )}

        <div className="flex justify-end">
          <button type="button" className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </Modal>
  );
}

const valor = (v) => (v === null || v === undefined || v === '' ? '—' : String(v));

function MiniEmpresa({ e }) {
  return (
    <p className="text-sm break-words min-w-0">
      <b>{nombreEmpresa(e)}</b>
      {e.nombre_comercial && e.nombre_comercial !== e.nombre_legal && (
        <span className="text-fg-muted"> ({e.nombre_comercial})</span>
      )}
      <span className="text-fg-muted text-xs"> · NIT {e.nit || '—'}{e.jornadas != null && ` · ${fmtN(Number(e.jornadas))} ${Number(e.jornadas) === 1 ? 'jornada' : 'jornadas'}`}</span>
    </p>
  );
}

function ResumenMueve({ mueve, completa }) {
  const mov = Object.entries(mueve || {}).filter(([, n]) => Number(n) > 0);
  const comp = Object.entries(completa || {});
  return (
    <div className="space-y-1 text-xs text-fg-muted">
      {mov.length > 0 ? (
        <p>Se mueven: {mov.map(([k, n]) => `${fmtN(Number(n))} ${legible(k)}`).join(', ')}.</p>
      ) : (
        <p>No hay jornadas ni registros que mover.</p>
      )}
      {comp.length > 0 && (
        <p>Se completan datos vacíos: {comp.map(([k, v]) => `${etiqueta(k)} (${valor(v)})`).join(', ')}.</p>
      )}
    </div>
  );
}

function Buscador({ titulo, empresas, elegida, onElegir }) {
  const [q, setQ] = useState('');
  const resultados = useMemo(() => {
    const n = norm(q).trim();
    if (n.length < 2) return [];
    return empresas
      .filter((e) => norm(e.nombre_legal).includes(n) || norm(e.nombre_comercial).includes(n))
      .slice(0, 8);
  }, [q, empresas]);

  return (
    <div className="space-y-1 min-w-0">
      <label className="label">{titulo}</label>
      {elegida ? (
        <div className="rounded-md border border-line bg-surface-elev p-2 flex items-start justify-between gap-2">
          <MiniEmpresa e={elegida} />
          <button type="button" className="text-xs text-accent hover:underline whitespace-nowrap"
            onClick={() => { onElegir(null); setQ(''); }}>Cambiar</button>
        </div>
      ) : (
        <>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre legal o comercial…" />
          {resultados.length > 0 && (
            <ul className="rounded-md border border-line divide-y divide-line-subtle max-h-48 overflow-y-auto bg-surface">
              {resultados.map((e) => (
                <li key={e.id}>
                  <button type="button" className="w-full text-left p-2 hover:bg-surface-elev"
                    onClick={() => { onElegir(e); setQ(''); }}>
                    <MiniEmpresa e={e} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
