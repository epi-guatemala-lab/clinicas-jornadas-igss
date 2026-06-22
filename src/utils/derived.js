// Funciones puras derivadas — sin estado, fáciles de testear.
// Centralizan la lógica "naranja vs rojo", "EN_CURSO local", severidad de alertas.

/**
 * Mapea el semáforo legacy del backend a la paleta nueva:
 * - rojo `<80%` cuando la jornada NO está cancelada → naranja (warning)
 * - rojo `<80%` cuando la jornada SÍ está cancelada → rojo (crítico)
 * - resto idéntico
 *
 * @param {string} semaforoBackend - 'verde' | 'amarillo' | 'naranja' | 'rojo' | 'azul' | 'gris'
 * @param {object} jornada - jornada completa (necesita .estado y .tipo)
 * @returns {string}
 */
export function mapSemaforoLegacy(semaforoBackend, jornada = {}) {
  // Rojo crítico es SOLO: cancelada, inauguración sin jornada, o cierre tardío severo
  const criticoReal =
    jornada.estado === 'CANCELADA' ||
    (jornada.tipo === 'INAUGURACION' && !jornada.inauguracion_jornada_id) ||
    jornada.sin_jornada_asociada === true;

  if (semaforoBackend === 'rojo' && !criticoReal) return 'naranja';
  // Naranja del backend nuevo: respetar
  if (semaforoBackend === 'naranja') return 'naranja';
  // Amarillo legacy: tratarlo como naranja también para consistencia con la nueva paleta
  if (semaforoBackend === 'amarillo') return 'amarillo';
  return semaforoBackend;
}

/**
 * Determina si una jornada está "en curso AHORA" basándose en fecha+hora locales,
 * NO en el estado de BD. Solo aplica para PROGRAMADA / REPROGRAMADA.
 *
 * Una jornada está en curso si:
 * - fecha_inicio === hoy
 * - hora_inicio <= ahora (si tiene hora; si no, todo el día cuenta)
 * - fecha_fin >= hoy (multi-día; si no hay fecha_fin, asume mismo día)
 * - estado actual es PROGRAMADA / REPROGRAMADA / EN_CURSO
 *
 * @param {object} jornada - debe tener fecha_inicio, fecha_fin?, hora_inicio?, estado
 * @param {Date} now - fecha de referencia (default: ahora)
 * @returns {boolean}
 */
export function isEnCurso(jornada, now = new Date()) {
  if (!jornada || !jornada.fecha_inicio) return false;
  if (jornada.estado === 'CANCELADA' || jornada.estado === 'CERRADA') return false;
  if (!['PROGRAMADA', 'REPROGRAMADA', 'EN_CURSO'].includes(jornada.estado)) return false;

  // Comparación de fechas en zona local (yyyy-mm-dd vs date local)
  const hoyStr = now.toISOString().slice(0, 10);
  const inicio = jornada.fecha_inicio;
  const fin = jornada.fecha_fin || jornada.fecha_inicio;
  if (inicio > hoyStr) return false; // todavía no empezó
  if (fin < hoyStr) return false;    // ya terminó

  // Si tiene hora_inicio, comparar con ahora cuando es el primer día
  if (inicio === hoyStr && jornada.hora_inicio) {
    const [hh, mm] = String(jornada.hora_inicio).split(':').map((n) => parseInt(n, 10));
    if (!Number.isNaN(hh)) {
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const startMin = (hh || 0) * 60 + (mm || 0);
      if (nowMin < startMin) return false; // hoy pero antes del horario
    }
  }
  return true;
}

/**
 * Descriptor visual de un evento del calendario (Opción 2: color de fondo = ESTADO/salud).
 * Centraliza TODA la gramática del chip para que CalendarMonth solo pinte.
 *
 * Devuelve:
 *  - bgVar: nombre de CSS var del fondo del chip (rgb(var(bgVar)))
 *  - seccionPrefijo: 'CE' | 'SP'
 *  - seccionVar: '--seccion-ce' | '--seccion-sip' (color del borde izquierdo + cápsula)
 *  - seccionDashed: bool (SIPRESALUD → borde a guiones)
 *  - esEnCurso, esCancelada, esAlertaInaug, esReprogramada: flags
 *  - leadGlifo: '●' si en curso (antes del texto), null si no
 *  - estadoGlifo: '⧖' (ejecutada) | '↻' (reprogramada) | '✕' (cancelada) | null (tras el texto)
 *  - saludGlifo: '✓' (cerrada OK) | '!' (cerrada baja) | null
 *  - tachado: bool (cancelada → line-through)
 *  - pulseClass: clase de animación ('' / 'jornada-alerta-pulse-inaug' / 'jornada-encurso-pulse')
 *
 * @param {object} e - evento de /calendario (tipo, seccion, estado, semaforo, sin_jornada_asociada…)
 * @param {Date} now
 */
export function getChipDescriptor(e, now = new Date()) {
  const estado = e.estado;
  const esAlertaInaug = e.sin_jornada_asociada === true;
  const esCancelada = estado === 'CANCELADA';
  const esReprogramada = estado === 'REPROGRAMADA';
  const esEnCurso = !esCancelada && isEnCurso(e, now);

  // Sección (prefijo + borde) con fallback por tipo.
  const sec = e.seccion
    || (e.tipo === 'CE_JORNADA' ? 'CE'
      : e.tipo === 'SIPRESALUD_JORNADA' ? 'SIPRESALUD' : null);
  const esCE = sec === 'CE';
  const seccionPrefijo = esCE ? 'CE' : 'SP';
  const seccionVar = esCE ? '--seccion-ce' : '--seccion-sip';
  const seccionDashed = !esCE; // SIPRESALUD = guiones

  // Salud (solo CERRADA): verde = OK, resto = baja.
  let saludGlifo = null;
  if (estado === 'CERRADA') saludGlifo = e.semaforo === 'verde' ? '✓' : '!';

  // Fondo de chip = ESTADO/salud, con overrides de alerta (orden de prioridad).
  let bgVar;
  if (esAlertaInaug) bgVar = '--alert-inaug-chip';
  else if (esCancelada) bgVar = '--estado-cancelada-chip';
  else if (esEnCurso) bgVar = '--estado-encurso-chip';
  else if (estado === 'EJECUTADA') bgVar = '--estado-ejecutada-chip';
  else if (estado === 'CERRADA') bgVar = e.semaforo === 'verde' ? '--estado-cerrada-ok-chip' : '--estado-cerrada-baja-chip';
  else bgVar = '--estado-programada-chip'; // PROGRAMADA + REPROGRAMADA (gris)

  // Glifo de estado (forma, tras el texto) — refuerzo colorblind.
  let estadoGlifo = null;
  if (esCancelada) estadoGlifo = '✕';
  else if (esReprogramada) estadoGlifo = '↻';
  else if (estado === 'EJECUTADA') estadoGlifo = '⧖';

  const pulseClass = esAlertaInaug ? 'jornada-alerta-pulse-inaug'
    : esEnCurso ? 'jornada-encurso-pulse' : '';

  return {
    bgVar, seccionPrefijo, seccionVar, seccionDashed,
    esEnCurso, esCancelada, esAlertaInaug, esReprogramada,
    leadGlifo: esEnCurso ? '●' : null,
    estadoGlifo, saludGlifo,
    tachado: esCancelada,
    pulseClass,
  };
}

/**
 * Severidad numérica para ordenar alertas (menor = mayor prioridad).
 *
 * @param {object} alerta - { severity: 'critical' | 'warning' | 'info' }
 * @returns {number}
 */
export function severityOf(alerta) {
  const sev = (alerta && alerta.severity) || 'info';
  if (sev === 'critical') return 0;
  if (sev === 'warning') return 1;
  if (sev === 'info') return 2;
  return 99;
}

/**
 * Días restantes del mes en curso (a partir de hoy).
 * @returns {number}
 */
export function diasRestantesDelMes(now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed
  const ultimoDia = new Date(y, m + 1, 0).getDate();
  return Math.max(0, ultimoDia - now.getDate());
}

/**
 * Calcula costo personal con factor "anual + 20% prestaciones / 365":
 * (mensual × 12 × 1.20) / 365 × dias_asignados
 * vs el modelo legacy: mensual / 30 × dias_asignados.
 *
 * El toggle de Metas decide cuál usar.
 *
 * @param {number} compensacionMensual - Q mensuales (renglón 011/022)
 * @param {number} diasAsignados - días de jornada
 * @returns {number}
 */
export function costoPersonalDiarioConPrestaciones(compensacionMensual, diasAsignados = 1) {
  if (!compensacionMensual) return 0;
  return ((compensacionMensual * 12 * 1.20) / 365) * (diasAsignados || 1);
}
