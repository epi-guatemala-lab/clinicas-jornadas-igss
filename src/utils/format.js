export const fmtQ = (n) =>
  n == null ? '—' : `Q${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtN = (n) =>
  n == null ? '—' : Number(n).toLocaleString('es-GT');

export const fmtPct = (n) =>
  n == null ? '—' : `${Number(n).toFixed(1)}%`;

export const SEMAFORO_BG = {
  verde:    'bg-semaforo-verde text-white',
  amarillo: 'bg-semaforo-amarillo text-white',
  rojo:     'bg-semaforo-rojo text-white',
  azul:     'bg-semaforo-azul text-white',
  gris:     'bg-semaforo-gris text-white',
};
export const SEMAFORO_DOT = {
  verde:    'bg-semaforo-verde',
  amarillo: 'bg-semaforo-amarillo',
  rojo:     'bg-semaforo-rojo',
  azul:     'bg-semaforo-azul',
  gris:     'bg-semaforo-gris',
};

export const TIPO_LABEL = {
  CE_JORNADA: 'Jornada CE',
  SIPRESALUD_JORNADA: 'Jornada SIPRESALUD',
  INAUGURACION: 'Inauguración',
  TALLER: 'Taller',
  WEBINAR: 'Webinar',
  VISITA_SEGUIMIENTO: 'Visita de seguimiento',
  INFORME_OFICINA: 'Informe / Oficina',
};

export const ESTADO_LABEL = {
  PROGRAMADA: 'Programada',
  EN_CURSO: 'En curso',
  EJECUTADA: 'Ejecutada (pendiente cierre)',
  CERRADA: 'Cerrada',
  CANCELADA: 'Cancelada',
  REPROGRAMADA: 'Reprogramada',
};
