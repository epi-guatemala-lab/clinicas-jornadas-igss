const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Fecha ISO ('2026-08-26') → '26 ago 2026'. Parsea por texto, sin Date (evita el corrimiento de zona). */
export function fmtFechaMes(iso) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (!m) return String(iso);
  const mes = MESES[Number(m[2]) - 1];
  return mes ? `${Number(m[3])} ${mes} ${m[1]}` : String(iso);
}

/** Motivo (código del servidor) → frase en español. */
export const MOTIVO_PENDIENTE = {
  SIN_CANDIDATA: 'No hay una jornada de esa empresa ese día',
  VARIAS_CANDIDATAS: 'Hay más de una jornada posible',
  JORNADA_YA_TOMADA: 'La jornada de ese día ya quedó con otro tamizaje',
  VARIOS_TAMIZAJES_MISMA_JORNADA: 'Una jornada de varios días tiene un tamizaje por día',
};

export const textoMotivo = (m) => MOTIVO_PENDIENTE[m] || (m ? String(m) : 'Sin motivo informado');
