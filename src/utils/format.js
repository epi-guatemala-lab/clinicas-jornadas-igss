// Fecha ISO en zona LOCAL del navegador (no UTC). toISOString() convierte a UTC
// y para un usuario en Guatemala (UTC-6) entre 18:00-23:59 devolvía la fecha de
// mañana → "HOY", en-curso y defaults se adelantaban un día.
export const isoLocalDate = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

// Fecha ISO ('YYYY-MM-DD') → 'DD/MM' (formato de Guatemala, día antes de mes).
// Único lugar donde se arma este recorte: un slice()/replace() a mano en cada
// pantalla es como apareció el bug de fecha en formato de EE.UU. (MM/DD) en el
// panel de próximas jornadas del Dashboard.
export const fmtFechaCorta = (iso) => {
  if (!iso) return '';
  const [, mm, dd] = String(iso).split('-');
  return mm && dd ? `${dd}/${mm}` : '';
};

// ---------------------------------------------------------------------------
// Fechas en español (día/mes/año). TODAS parsean POR STRING, nunca con Date.
//
// `new Date('2026-08-26')` se interpreta como MEDIANOCHE UTC; en Guatemala
// (UTC-6, sin horario de verano) `toLocaleDateString()` sobre ese objeto
// devuelve el día ANTERIOR — la jornada del 26 se muestra como 25. Es el mismo
// corrimiento que ya obligó a escribir `isoLocalDate` acá arriba. Como el
// backend guarda fechas de calendario ('YYYY-MM-DD', sin hora ni zona), la
// única lectura correcta es tratarlas como texto: cortar y reordenar.
// Para los sellos de tiempo CON hora sí hay que convertir de zona: eso lo hace
// `fmtFechaHora` (más abajo), que es otro problema y no se resuelve así.
// ---------------------------------------------------------------------------

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const MESES_CORTOS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

// Acepta 'YYYY-MM-DD' y también los sellos completos ('YYYY-MM-DD HH:MM:SS',
// ISO con 'T'): solo importan los 10 primeros caracteres.
const partesFechaIso = (iso) => {
  if (!iso) return null;
  const m = String(iso).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? { anio: m[1], mes: m[2], dia: m[3] } : null;
};

/**
 * Fecha ISO → 'DD/MM/AAAA'. Un valor que no sea fecha se devuelve tal cual
 * (en vez de en blanco) para que un dato raro se vea en pantalla y no
 * desaparezca en silencio.
 */
export const fmtFecha = (iso) => {
  if (!iso) return '';
  const p = partesFechaIso(iso);
  return p ? `${p.dia}/${p.mes}/${p.anio}` : String(iso);
};

/** Fecha ISO → '28 de agosto de 2026' (día sin cero a la izquierda). */
export const fmtFechaLarga = (iso) => {
  if (!iso) return '';
  const p = partesFechaIso(iso);
  if (!p) return String(iso);
  const mes = MESES[Number(p.mes) - 1];
  if (!mes) return `${p.dia}/${p.mes}/${p.anio}`;
  return `${Number(p.dia)} de ${mes} de ${p.anio}`;
};

/**
 * Rango de fechas de una actividad: 'DD/MM/AAAA' si es de un solo día
 * (sin fecha de fin, o con fecha de fin igual a la de inicio) y
 * 'DD/MM/AAAA al DD/MM/AAAA' si abarca varios. Evita el «26/08/2026 al
 * 26/08/2026» que aparecía al concatenar a mano en cada pantalla.
 */
export const fmtRangoFechas = (desde, hasta) => {
  const ini = fmtFecha(desde);
  const fin = fmtFecha(hasta);
  if (!ini) return fin;
  if (!fin || fin === ini) return ini;
  return `${ini} al ${fin}`;
};

/** 'YYYY-MM' (o una fecha completa) → 'Ago 2026', para ejes y encabezados. */
export const fmtMesAnio = (ym) => {
  if (!ym) return '';
  const m = String(ym).slice(0, 7).match(/^(\d{4})-(\d{2})$/);
  if (!m) return String(ym);
  const mes = MESES_CORTOS[Number(m[2]) - 1];
  return mes ? `${mes} ${m[1]}` : String(ym);
};

// SQLite guarda 'YYYY-MM-DD HH:MM:SS' con datetime('now'), que es SIEMPRE UTC
// aunque la cadena no lleve 'Z'. El backend corre con TZ=America/Guatemala
// (UTC-6), así que reordenar la cadena tal cual —sin convertir— le mostraba a
// Berkin una hora 6 horas adelantada: cargó a la 1pm y el historial decía
// 7pm. Guatemala no tiene horario de verano, así que la conversión es fija.
// Vivía en utils/carga.js, pero los sellos UTC visibles no son solo del
// historial de cargas (material entregado, auditoría), así que es de todos.
const TZ_PORTAL = 'America/Guatemala';

/** Fecha y hora legibles (zona Guatemala) a partir de lo que guarda SQLite. */
export function fmtFechaHora(s) {
  if (!s) return '—';
  const txt = String(s).replace('T', ' ').replace('Z', '');
  const m = txt.match(/^(\d{4})-(\d{2})-(\d{2})[ ]?(\d{2}:\d{2})?(:\d{2})?/);
  if (!m) return txt;
  const [, anio, mes, dia, horaMin] = m;
  if (!horaMin) return `${dia}/${mes}/${anio}`;
  const [hh, mm] = horaMin.split(':');
  const utcMs = Date.UTC(+anio, +mes - 1, +dia, +hh, +mm);
  if (Number.isNaN(utcMs)) return `${dia}/${mes}/${anio} ${horaMin}`;
  try {
    const partes = new Intl.DateTimeFormat('es-GT', {
      timeZone: TZ_PORTAL, day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(new Date(utcMs));
    const val = (t) => partes.find((p) => p.type === t)?.value;
    return `${val('day')}/${val('month')}/${val('year')} ${val('hour')}:${val('minute')}`;
  } catch {
    return `${dia}/${mes}/${anio} ${horaMin}`;   // navegador sin soporte de TZ IANA
  }
}

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

// Cómo se LEE cada tipo de actividad. Tiene que cubrir TODOS los tipos que el
// backend acepta (`config.TIPOS_ACTIVIDAD` / `ETIQUETAS_ACTIVIDAD`), no solo los
// que se pueden crear desde el formulario: el fallback de las pantallas es
// silencioso y una jornada histórica de otro tipo mostraba el token crudo
// («VISITA_SEGUIMIENTO»). Los rótulos son los mismos del servidor a propósito:
// es la misma actividad y no puede llamarse de dos maneras según por dónde entre.
export const TIPO_LABEL = {
  TRASLADO: 'Traslado',
  SIPRESALUD_JORNADA: 'Jornada SIPRESALUD',
  CE_JORNADA: 'Jornada de Clínica de Empresa',
  INAUGURACION: 'Inauguración',
  TALLER: 'Conferencia',
  WEBINAR: 'Webinar',
  VISITA_SEGUIMIENTO: 'Visita de seguimiento',
  INFORME_OFICINA: 'Informe de oficina',
  // Los convenios no son jornadas: entran al calendario como evento propio
  // (stub 'conv-{id}' del backend). Sin esta entrada el chip mostraría el
  // token crudo 'CONVENIO' porque el fallback es silencioso.
  CONVENIO: 'Convenio',
};

// Actividades que SIPRESALUD puede programar, en el orden en que se ofrecen.
// Vivía duplicada como `TIPOS` en JornadaFormModal.jsx y en Jornadas.jsx: dos
// listas que había que recordar tocar juntas cada vez que cambia un rótulo.
// SIPRESALUD nunca hace Clínicas de Empresa (CE) → no existe "Jornada CE"
// (fuente: requerimiento Berkin "seria Jornada SIPRE, Inauguracion, conferencia,
// webinar" + "nunca clínicas de empresa, siempre sipresalud").
// CONVENIO no va acá: no se programa desde el formulario de actividad, se
// captura como fecha de la empresa.
export const TIPOS_ACTIVIDAD_UI = [
  { value: 'SIPRESALUD_JORNADA', label: '💉 Jornada SIPRESALUD' },
  { value: 'INAUGURACION', label: '🎉 Inauguración (deja clínica permanente)' },
  { value: 'TALLER', label: '🎤 Conferencia' },
  { value: 'WEBINAR', label: '💻 Webinar' },
];

export const ESTADO_LABEL = {
  PROGRAMADA: 'Programada',
  EN_CURSO: 'En curso',
  EJECUTADA: 'Realizada (pendiente cierre)',
  CERRADA: 'Cerrada',
  CANCELADA: 'Cancelada',
  REPROGRAMADA: 'Reprogramada',
};
