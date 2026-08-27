import { fmtBytes } from '../../utils/carga';

/**
 * Barra de subida que dice la VERDAD durante un corte de red.
 *
 * La versión anterior solo sabía decir «Subiendo el archivo… 42%». Cuando la
 * red se caía —lo habitual con los 37 MB del análisis de cierre desde la red
 * del IGSS— la barra se quedaba clavada y después aparecía un error seco, sin
 * pista de si algo se había guardado ni de qué hacer.
 *
 * Ahora la subida es reanudable y esta barra lo refleja: mientras reintenta lo
 * dice y muestra cuánto lleva confirmado el SERVIDOR, no lo que el navegador
 * creyó haber mandado. Quien carga puede quedarse mirando y entender que el
 * portal no se colgó, que no perdió lo subido, y que no tiene que hacer nada.
 */
export default function ProgresoSubida({ pct, estado, onCancelar }) {
  const v = Math.max(0, Math.min(100, Number(pct) || 0));
  const fase = estado?.fase;
  const reintentando = fase === 'reintentando';
  const confirmados = estado?.bytesConfirmados;
  const total = estado?.bytesTotal;

  let titulo;
  if (fase === 'preparando') titulo = 'Preparando el archivo…';
  else if (fase === 'reanudando') titulo = 'Retomando la subida donde se había quedado…';
  else if (fase === 'finalizando') titulo = 'Archivo completo. Cerrando la subida…';
  else if (reintentando) {
    const seg = Math.round((estado.esperaMs || 0) / 1000);
    titulo = `Se cortó la conexión. Reintentando en ${seg} s `
      + `(intento ${estado.intento} de ${estado.maxIntentos})…`;
  } else titulo = `Subiendo el archivo… ${v}%`;

  return (
    <div className="space-y-1">
      <div className={`h-2 w-full rounded-full bg-sunken overflow-hidden ${reintentando ? 'opacity-60' : ''}`}
        role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full transition-[width] duration-300 ease-out ${reintentando ? 'bg-warning' : 'bg-accent'}`}
          style={{ width: `${v}%` }} />
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-fg-muted">
        <span aria-live="polite">{titulo}</span>
        {onCancelar && (
          <button type="button" className="text-danger hover:underline shrink-0"
            onClick={onCancelar}>
            Cancelar
          </button>
        )}
      </div>
      {reintentando && (
        // Lo importante durante un corte no es el porcentaje: es saber que lo
        // que ya viajó NO se perdió y que no hay que volver a empezar.
        <p className="text-xs text-fg-muted">
          {Number.isFinite(confirmados) && Number.isFinite(total)
            ? `El servidor ya tiene ${fmtBytes(confirmados)} de ${fmtBytes(total)}. `
            : ''}
          La subida continúa desde ahí; no hace falta volver a empezar.
        </p>
      )}
    </div>
  );
}
