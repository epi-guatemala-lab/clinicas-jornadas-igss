import { apiEstadoCarga } from '../api/endpoints';

/**
 * Comprobación previa a una subida: ¿el servidor está libre para recibirla?
 *
 * El servidor procesa UNA carga por vez. Si se le manda otra mientras trabaja,
 * la rechaza —y ese rechazo, llegando a mitad de una subida de 35 MB, es lo que
 * dejaba la barra de progreso congelada sin ningún mensaje (incidente
 * 2026-08-17): el navegador no le entrega al XHR una respuesta que llega
 * mientras todavía está subiendo, y el proxy corta la conexión 30 segundos
 * después. Preguntar antes de empezar elimina de raíz el caso frecuente.
 *
 * Dos cosas que esto NO es:
 *
 *  1. **No es una garantía.** El carril se puede ocupar entre esta consulta y
 *     el POST. Por eso el servidor sigue comprobándolo, y ahora lo hace después
 *     de recibir el archivo, para que ese rechazo sí llegue como error limpio.
 *  2. **No es un bloqueo.** Si la consulta falla (red, servidor viejo sin este
 *     endpoint, 500), se devuelve `null` y la subida sigue: el que decide es el
 *     servidor, y no vamos a impedir una carga legítima porque una consulta
 *     auxiliar no respondió.
 *
 * @returns {Promise<{titulo:string, detalle:string, sugerencia:string}|null>}
 *          aviso listo para `BannerError`, o `null` si se puede subir.
 */
export async function avisoSiHayCargaEnCurso() {
  let estado;
  try {
    estado = await apiEstadoCarga();
  } catch {
    return null;
  }
  if (!estado?.activa) return null;

  const etapa = estado.etapa
    ? `${estado.etapa}${Number.isFinite(estado.progreso) ? ` · ${estado.progreso}%` : ''}`
    : '';
  return {
    titulo: 'Hay una carga en proceso',
    // `mensaje` lo redacta el servidor y distingue el Excel maestro del
    // análisis de una jornada; si por lo que sea no viene, hay respaldo.
    detalle: estado.mensaje
      || 'El servidor está procesando otra carga y no puede recibir esta hasta terminar.',
    sugerencia: [
      etapa && `Va en: ${etapa}.`,
      'No se subió nada todavía. Esperá a que termine y tocá «Reintentar»: tu archivo sigue elegido.',
    ].filter(Boolean).join(' '),
  };
}
