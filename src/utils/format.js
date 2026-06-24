// Fecha ISO en zona LOCAL del navegador (no UTC). toISOString() convierte a UTC
// y para un usuario en Guatemala (UTC-6) entre 18:00-23:59 devolvía la fecha de
// mañana → "HOY", en-curso y defaults se adelantaban un día.
export const isoLocalDate = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

export const fmtQ = (n) =>
  n == null ? '—' : `Q${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtN = (n) =>
  n == null ? '—' : Number(n).toLocaleString('es-GT');

export const fmtPct = (n) =>
  n == null ? '—' : `${Number(n).toFixed(1)}%`;

// Maps de semáforo del backend → clases Tailwind. Incluye 'naranja' como
// warning separado de 'rojo' (crítico). Los aliases en tailwind.config
// hacen que tanto amarillo como naranja apunten al token warning.
export const SEMAFORO_BG = {
  verde:    'bg-success text-white',
  amarillo: 'bg-warning text-white',
  naranja:  'bg-warning text-white',
  rojo:     'bg-danger text-white',
  azul:     'bg-info text-white',
  gris:     'bg-neutral text-white',
};
export const SEMAFORO_DOT = {
  verde:    'bg-success',
  amarillo: 'bg-warning',
  naranja:  'bg-warning',
  rojo:     'bg-danger',
  azul:     'bg-info',
  gris:     'bg-neutral',
};

export const TIPO_LABEL = {
  SIPRESALUD_JORNADA: 'Jornada SIPRESALUD',
  INAUGURACION: 'Inauguración',
  TALLER: 'Conferencia',
  WEBINAR: 'Webinar',
};

export const ESTADO_LABEL = {
  PROGRAMADA: 'Programada',
  EN_CURSO: 'En curso',
  EJECUTADA: 'Realizada (pendiente cierre)',
  CERRADA: 'Cerrada',
  CANCELADA: 'Cancelada',
  REPROGRAMADA: 'Reprogramada',
};
