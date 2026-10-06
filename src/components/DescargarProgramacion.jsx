import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Modal from './forms/Modal';
import SearchableSelect from './filters/SearchableSelect';
import { apiDescargarProgramacion, apiListPersonal } from '../api/endpoints';
import { mensajeDeError } from '../utils/apiError';

const mesAnio = (d) =>
  format(d, 'MMMM yyyy', { locale: es }).replace(/^\w/, (c) => c.toUpperCase());

// Con `responseType: 'blob'` el error también llega como Blob: hay que leerlo
// para que se vea el mensaje del servidor y no «Código 503».
async function errorLegible(e) {
  const data = e?.response?.data;
  if (data instanceof Blob) {
    try {
      const texto = await data.text();
      e.response.data = JSON.parse(texto);
    } catch { /* no era JSON: queda el código */ }
  }
  return mensajeDeError(e, 'generar el reporte');
}

function guardar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/**
 * Programación del mes para imprimir (PDF) o editar (Excel): la hoja que
 * coordinación armaba a mano, generada con lo que está en la plataforma.
 */
export default function DescargarProgramacion({ month }) {
  const [abierto, setAbierto] = useState(false);
  const [contenido, setContenido] = useState('completo');   // completo | resumen
  const [papel, setPapel] = useState('carta');
  const [persona, setPersona] = useState('');
  const [personal, setPersonal] = useState([]);
  const [generando, setGenerando] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!abierto || personal.length) return;
    apiListPersonal({ seccion: 'SIPRESALUD', activo: true })
      .then((l) => setPersonal((l || []).slice().sort((a, b) =>
        (a.nombre_corto || a.nombre_completo).localeCompare(b.nombre_corto || b.nombre_completo, 'es'))))
      .catch(() => setPersonal([]));
  }, [abierto, personal.length]);

  const mes = format(month, 'yyyy-MM');
  const elegida = personal.find((p) => String(p.id) === String(persona));
  const nombreArchivo = (ext) => {
    const base = elegida
      ? `Agenda de ${elegida.nombre_corto || elegida.nombre_completo}`
      : 'Programación de jornadas';
    const sufijo = ext === 'pdf' && contenido === 'resumen' ? ' (resumen)' : '';
    return `${base} - ${mesAnio(month)}${sufijo}.${ext}`;
  };

  async function descargar(formato) {
    setErr(''); setGenerando(formato);
    try {
      const blob = await apiDescargarProgramacion({
        mes, formato, papel,
        personal_id: persona || undefined,
        solo_resumen: formato === 'pdf' && contenido === 'resumen' ? true : undefined,
      });
      guardar(blob, nombreArchivo(formato));
    } catch (e) {
      setErr(await errorLegible(e));
    } finally { setGenerando(''); }
  }

  const opcion = (valor, actual, set, titulo, ayuda) => (
    <label className={`flex gap-2 rounded-lg border p-2.5 cursor-pointer transition ${
      actual === valor ? 'border-igss-primary bg-igss-primary/5' : 'border-line hover:border-fg-subtle'}`}>
      <input type="radio" className="mt-0.5" checked={actual === valor} onChange={() => set(valor)} />
      <span>
        <span className="block text-sm font-medium text-fg">{titulo}</span>
        {ayuda && <span className="block text-xs text-fg-muted">{ayuda}</span>}
      </span>
    </label>
  );

  return (
    <>
      <button type="button" className="btn-secondary" onClick={() => setAbierto(true)}
              title="Programación del mes para imprimir o descargar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             className="h-4 w-4 inline -mt-0.5 mr-1.5" aria-hidden>
          <path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="2" />
          <path d="M6 14h12v7H6z" />
        </svg>
        Imprimir programación
      </button>
      <Modal open={abierto} onClose={() => !generando && setAbierto(false)} size="md"
             title={`Programación de ${mesAnio(month).toLowerCase()}`}
             footer={(
               <>
                 <button type="button" className="btn-secondary" disabled={!!generando}
                         onClick={() => descargar('xlsx')}>
                   {generando === 'xlsx' ? 'Generando…' : 'Descargar Excel'}
                 </button>
                 <button type="button" className="btn-primary" disabled={!!generando}
                         onClick={() => descargar('pdf')}>
                   {generando === 'pdf' ? 'Generando PDF…' : 'Descargar PDF'}
                 </button>
               </>
             )}>
        <div className="space-y-4 text-sm">
          <div>
            <div className="label mb-1.5">Contenido del PDF</div>
            <div className="grid gap-2">
              {opcion('completo', contenido, setContenido, 'Resumen y detalle',
                'Una hoja con el calendario del mes y, después, cada jornada con su equipo, servicios y observaciones.')}
              {opcion('resumen', contenido, setContenido, 'Solo el resumen (una hoja)',
                'El calendario del mes en una sola página, para pegar o repartir.')}
            </div>
          </div>
          <div>
            <div className="label mb-1.5">De quién</div>
            <SearchableSelect value={persona} onChange={(v) => setPersona(v || '')}
              placeholder="Todo el equipo"
              aria-label="De quién"
              options={personal.map((p) => ({ value: String(p.id), label: p.nombre_corto || p.nombre_completo }))} />
            <p className="text-xs text-fg-muted mt-1">
              Con una persona, sale solo su agenda del mes, con su nombre resaltado.
            </p>
          </div>
          <div>
            <div className="label mb-1.5">Papel</div>
            <div className="grid grid-cols-2 gap-2">
              {opcion('carta', papel, setPapel, 'Carta', 'Horizontal')}
              {opcion('oficio', papel, setPapel, 'Oficio', 'Horizontal')}
            </div>
          </div>
          <p className="text-xs text-fg-muted">
            Sale con lo que está hoy en la plataforma; la fecha y hora de generación van en el encabezado.
            El Excel trae las mismas columnas de la hoja de coordinación.
          </p>
          {err && <div className="rounded-md border border-danger/40 bg-danger-soft p-2 text-danger">{err}</div>}
        </div>
      </Modal>
    </>
  );
}
