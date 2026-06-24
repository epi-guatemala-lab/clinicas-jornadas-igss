import { useThemedColors } from '../../theme/useThemedColors';
import { mapSemaforoLegacy } from '../../utils/derived';

const TIPO_LABEL_SHORT = {
  SIPRESALUD_JORNADA: 'SIPRES',
  INAUGURACION: 'Inaug',
  TALLER: 'Conferencia',
  WEBINAR: 'Web',
};

/**
 * Row compacta para DataList — fecha + hora + tipo + empresa + lugar + semáforo.
 */
export default function JornadaRow({ jornada, onClick, dense = false }) {
  const t = useThemedColors();
  const sem = mapSemaforoLegacy(jornada.semaforo, jornada);

  const semColor =
    sem === 'verde' ? t.status.success
    : sem === 'amarillo' ? t.status.warning
    : sem === 'naranja' ? t.status.warning
    : sem === 'rojo' ? t.status.danger
    : sem === 'azul' ? t.status.info
    : t.status.neutral;

  const fechaFmt = jornada.fecha_inicio
    ? jornada.fecha_inicio.slice(5).replace('-', '/')
    : '';

  return (
    <button
      onClick={onClick}
      type="button"
      className={`group w-full text-left rounded-lg border border-line-subtle bg-surface hover:bg-surface-elev
                  ${dense ? 'p-2' : 'p-2.5'} transition-all hover:border-line hover:translate-x-0.5`}
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className="flex-shrink-0 mt-1 h-2 w-2 rounded-full transition-transform group-hover:scale-125"
          style={{ background: semColor }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[11px] tabular-nums text-fg-muted">
            <span className="font-semibold">{fechaFmt}</span>
            {jornada.hora_inicio && <span>· {jornada.hora_inicio}</span>}
            {jornada.tipo && (
              <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase bg-surface-elev text-fg-muted">
                {TIPO_LABEL_SHORT[jornada.tipo] || jornada.tipo.slice(0, 6)}
              </span>
            )}
          </div>
          <div className="text-xs text-fg font-medium truncate mt-0.5">
            {jornada.empresa_nombre || jornada.tema || jornada.codigo}
          </div>
          {(jornada.municipio || jornada.departamento) && (
            <div className="text-[10px] text-fg-subtle truncate">
              {[jornada.municipio, jornada.departamento].filter(Boolean).join(', ')}
            </div>
          )}
          {jornada.programados != null && (
            <div className="text-[10px] text-fg-muted tabular-nums mt-0.5">
              {jornada.programados} afiliados proyectados
              {jornada.atendidos != null && ` · ${jornada.atendidos} atendidos`}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
