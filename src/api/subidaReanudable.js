import { api } from './client';

/**
 * Subida de archivos grandes que SOBREVIVE a un corte de red.
 *
 * Por qué existe (ago-2026)
 * -------------------------
 * El análisis de cierre pesa ~37 MB y se mandaba en un solo POST. Desde la red
 * institucional del IGSS ese POST se cortaba a los ~15 segundos y el servidor
 * ni se enteraba —no quedaba ni una línea en su log—, así que en la consola
 * aparecía `ERR_HTTP2_PROTOCOL_ERROR` y había que empezar de cero. Otra vez
 * 37 MB, otra vez el corte.
 *
 * Acá el archivo viaja en trozos numerados. El servidor lleva la cuenta de
 * cuánto recibió y este módulo le pregunta «¿por dónde ibas?» cada vez que algo
 * falla. Un corte cuesta un trozo, no la subida.
 *
 * Las tres decisiones que hacen que funcione de verdad
 * ----------------------------------------------------
 * 1. **Cada trozo tiene su propio plazo.** El diseño anterior daba 15 minutos a
 *    la subida entera, así que una conexión colgada se quedaba colgada 15
 *    minutos antes de admitir el fallo. Acá un trozo que no avanza en
 *    `TIMEOUT_TROZO_MS` se da por perdido y se reintenta enseguida.
 * 2. **Antes de reintentar se PREGUNTA.** En una red mala lo habitual no es que
 *    el trozo se pierda, sino que llegue y se pierda la respuesta. Reenviarlo a
 *    ciegas desperdicia el viaje; consultar el estado primero evita eso, y de
 *    paso resincroniza el offset sin adivinar.
 * 3. **Reanudar no depende del navegador.** No se guarda nada en localStorage:
 *    el servidor identifica la subida por el SHA256 del archivo, así que volver
 *    a elegir el MISMO archivo —incluso después de recargar la página o al día
 *    siguiente— retoma donde se quedó.
 */

// Cuánto se le da a UN trozo antes de darlo por perdido. Generoso para una red
// lenta de verdad (2 MB a 30 KB/s son ~70 s) pero acotado: el punto es no
// quedarse esperando a un socket que ya murió.
const TIMEOUT_TROZO_MS = 120 * 1000;
const TIMEOUT_CONTROL_MS = 30 * 1000;      // abrir / estado / finalizar

// Reintentos por trozo antes de rendirse, con la espera entre uno y otro. La
// escalera se aplana en 15 s: si a los 15 s no volvió, esperar 60 no ayuda y
// solo hace que quien carga crea que el portal se colgó.
const ESPERAS_MS = [1000, 2000, 4000, 8000, 15000, 15000, 15000, 15000];

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** SHA256 del archivo, en hexadecimal. Es la identidad de la subida. */
async function sha256Hex(file) {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** ¿Este fallo puede mejorar si se reintenta, o es una respuesta definitiva? */
function valeLaPenaReintentar(e) {
  if (e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError') return false;
  const st = e?.response?.status;
  if (st === undefined) return true;         // sin respuesta = corte de red
  if (st === 408 || st === 429) return true;
  return st >= 500;                          // 5xx: el servidor puede recuperarse
}

/**
 * Sube `file` en trozos y devuelve la carga creada.
 *
 * @param {File} file
 * @param {object} opts
 * @param {'MAESTRO'|'CIERRE_JORNADA'} opts.tipo
 * @param {number} [opts.jornadaId]   jornada ancla (solo en CIERRE_JORNADA)
 * @param {'PREVIEW'|'APLICAR'} [opts.modo]
 * @param {(pct:number)=>void} [opts.onProgreso]   0..100
 * @param {(estado:object)=>void} [opts.onEstado]  fase + reintentos, para la UI
 * @param {(subidaId:string)=>void} [opts.onSesion] id de la subida, para poder
 *        descartarla si quien carga cancela
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{id:number, estado:string, mensaje?:string}>}
 */
export async function subirReanudable(file, opts = {}) {
  const { tipo = 'MAESTRO', jornadaId = null, modo = 'PREVIEW',
    onProgreso, onEstado, onSesion, signal } = opts;

  const avisar = (estado) => { try { onEstado?.(estado); } catch { /* la UI no puede tumbar la subida */ } };
  const abortado = () => signal?.aborted;

  avisar({ fase: 'preparando' });
  const sha256 = await sha256Hex(file);
  if (abortado()) throw new DOMException('Subida cancelada', 'AbortError');

  const abrir = () => api.post('/api/subidas', {
    nombre: file.name, bytes_total: file.size, sha256, tipo, jornada_id: jornadaId,
  }, { timeout: TIMEOUT_CONTROL_MS, signal }).then((r) => {
    onSesion?.(r.data?.id);
    return r.data;
  });

  let sesion = await abrir();
  const total = file.size;
  const trozo = sesion.trozo_bytes || 2 * 1024 * 1024;

  // El porcentaje se calcula sobre lo que el SERVIDOR confirma tener, no sobre
  // lo que el navegador dice haber mandado: durante los cortes esos dos números
  // se separan, y enseñar el optimista es mentirle a quien está esperando.
  let confirmados = sesion.bytes_recibidos || 0;
  const reportar = (enVuelo = 0) => onProgreso?.(
    Math.min(100, Math.round(((confirmados + enVuelo) * 100) / Math.max(1, total))),
  );
  reportar();
  if (sesion.reanudada && confirmados > 0) {
    avisar({ fase: 'reanudando', bytesConfirmados: confirmados, bytesTotal: total });
  }

  // Red de seguridad del bucle: si una vuelta entera termina sin que la marca
  // de agua del servidor avance, algo está mal de una forma que reintentar no
  // arregla (por ejemplo, un intermediario que se come todos los trozos). Sin
  // este tope el bucle giraría para siempre sin subir nada y sin decir nada,
  // que es justo el modo de falla que este módulo vino a eliminar.
  const VUELTAS_SIN_AVANCE_MAX = 6;
  let vueltasSinAvance = 0;

  while (confirmados < total) {
    if (abortado()) throw new DOMException('Subida cancelada', 'AbortError');
    const antesDeLaVuelta = confirmados;
    const desde = confirmados;
    const pedazo = file.slice(desde, Math.min(desde + trozo, total));
    let enviado = false;

    for (let intento = 0; intento <= ESPERAS_MS.length && !enviado; intento += 1) {
      if (abortado()) throw new DOMException('Subida cancelada', 'AbortError');
      try {
        const r = await api.put(`/api/subidas/${sesion.id}/trozo`, pedazo, {
          params: { offset: desde },
          headers: { 'Content-Type': 'application/octet-stream' },
          timeout: TIMEOUT_TROZO_MS,
          signal,
          onUploadProgress: (e) => reportar(Math.min(e.loaded || 0, pedazo.size)),
        });
        confirmados = r.data.bytes_recibidos;
        reportar();
        avisar({ fase: 'subiendo', bytesConfirmados: confirmados, bytesTotal: total });
        enviado = true;
      } catch (e) {
        const st = e?.response?.status;

        // 409 no es un fallo: el servidor y este cliente no coinciden en el
        // offset (típicamente porque el trozo SÍ había llegado). Se resincroniza
        // y se sigue desde donde el servidor diga.
        if (st === 409) {
          const estado = await api.get(`/api/subidas/${sesion.id}`,
            { timeout: TIMEOUT_CONTROL_MS, signal }).then((r) => r.data);
          confirmados = estado.bytes_recibidos;
          reportar();
          break;                              // recalcula el trozo con el offset bueno
        }

        // La sesión desapareció (venció, o el servicio se reinició y borró los
        // parciales, que traen DPI en claro). Se abre una nueva y se sigue con
        // lo que el servidor tenga; no se le puede pedir a quien carga que
        // adivine por qué "ya no existe".
        if (st === 404) {
          sesion = await abrir();
          confirmados = sesion.bytes_recibidos || 0;
          reportar();
          avisar({ fase: 'reanudando', bytesConfirmados: confirmados, bytesTotal: total });
          break;
        }

        if (!valeLaPenaReintentar(e) || intento >= ESPERAS_MS.length) throw e;

        const espera = ESPERAS_MS[intento];
        avisar({
          fase: 'reintentando',
          intento: intento + 1,
          maxIntentos: ESPERAS_MS.length,
          esperaMs: espera,
          bytesConfirmados: confirmados,
          bytesTotal: total,
        });
        await dormir(espera);
        if (abortado()) throw new DOMException('Subida cancelada', 'AbortError');

        // Preguntar antes de reenviar: si el trozo había llegado, no se manda
        // dos veces. Si la consulta también falla, se reintenta a ciegas —
        // reenviar un trozo ya recibido es inofensivo en el servidor.
        try {
          const estado = await api.get(`/api/subidas/${sesion.id}`,
            { timeout: TIMEOUT_CONTROL_MS, signal }).then((r) => r.data);
          if (estado.bytes_recibidos > confirmados) {
            confirmados = estado.bytes_recibidos;
            reportar();
            break;
          }
        } catch { /* seguimos con el reintento normal */ }
      }
    }

    if (confirmados > antesDeLaVuelta) {
      vueltasSinAvance = 0;
    } else {
      vueltasSinAvance += 1;
      if (vueltasSinAvance >= VUELTAS_SIN_AVANCE_MAX) {
        throw new Error(
          `La subida dejó de avanzar en el byte ${confirmados} de ${total}. `
          + 'Lo que ya subiste queda guardado unas horas: volvé a elegir el mismo '
          + 'archivo y la subida sigue desde ahí.',
        );
      }
      await dormir(2000);
    }
  }

  avisar({ fase: 'finalizando', bytesConfirmados: total, bytesTotal: total });
  const r = await api.post(`/api/subidas/${sesion.id}/finalizar`, null, {
    params: { modo },
    timeout: TIMEOUT_CONTROL_MS,
    signal,
  });
  reportar();
  return r.data;
}

/**
 * Descarta una subida a medias en el servidor.
 *
 * Se llama cuando quien carga aprieta «Cancelar»: los bytes que ya viajaron son
 * un Excel con DPI en claro y no tienen por qué esperar al vencimiento. Es
 * best-effort a propósito — si falla, el guardián del servidor los barre igual,
 * y no se le puede mostrar un error a alguien que acaba de cancelar.
 */
export async function descartarSubida(subidaId) {
  if (!subidaId) return;
  try {
    await api.delete(`/api/subidas/${subidaId}`, { timeout: TIMEOUT_CONTROL_MS });
  } catch { /* el guardián del servidor lo barre igual */ }
}

export const _soloParaPruebas = { sha256Hex, valeLaPenaReintentar, ESPERAS_MS };
