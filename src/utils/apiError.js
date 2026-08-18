/**
 * Traduce un error de axios a un mensaje ACCIONABLE en español.
 *
 * Existe porque el patrón `e.response?.data?.detail || 'Error'` deja al usuario
 * con un texto genérico que no dice qué hacer: quedaba igual una sesión vencida,
 * un archivo de 200 MB o el servidor caído. Cada situación tiene su causa y su
 * salida, y el que carga el Excel una vez al mes no es técnico.
 */

const LIMITE_MB = 120;   // config.CARGA_MAX_MB del backend

/** Detalle textual que mandó el backend (FastAPI usa `detail`). */
function detalle(e) {
  const d = e?.response?.data?.detail ?? e?.response?.data?.error;
  if (typeof d === 'string' && d.trim()) return d.trim();
  // FastAPI 422 devuelve una lista de errores de validación
  if (Array.isArray(d) && d.length) {
    const primero = d[0];
    if (typeof primero?.msg === 'string') return primero.msg;
  }
  return '';
}

/**
 * @param {Error} e error de axios
 * @param {string} accion qué se estaba haciendo, en infinitivo ("subir el archivo")
 * @returns {{titulo:string, detalle:string, sugerencia:string}}
 */
export function describirError(e, accion = 'completar la operación') {
  const status = e?.response?.status;
  const backend = detalle(e);

  // Cancelado a propósito por el usuario (AbortController)
  if (e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError') {
    return {
      titulo: 'Se canceló la operación',
      detalle: '',
      sugerencia: 'Podés volver a intentarlo cuando quieras.',
    };
  }

  // Sin respuesta del servidor: red caída, VPN, servidor apagado o tiempo agotado
  if (!e?.response) {
    if (e?.code === 'ECONNABORTED') {
      return {
        titulo: 'Se agotó el tiempo de espera',
        detalle: 'El archivo tardó demasiado en subir.',
        sugerencia: 'Revisá tu conexión y volvé a intentarlo. El servidor no llegó a recibir el archivo completo, así que no quedó nada a medias.',
      };
    }
    return {
      titulo: 'No hay conexión con el servidor',
      detalle: e?.message || '',
      sugerencia: 'Verificá tu conexión a la red del IGSS. Nada se guardó; podés reintentar sin riesgo de duplicar.',
    };
  }

  switch (status) {
    case 400:
      return {
        titulo: 'El archivo no es válido',
        detalle: backend,
        sugerencia: 'Asegurate de subir el Excel maestro (.xlsx) completo y sin abrir en otro programa mientras lo subís.',
      };
    case 401:
      return {
        titulo: 'Tu sesión venció',
        detalle: backend,
        sugerencia: 'Volvé a iniciar sesión y repetí la carga. No se aplicó ningún cambio.',
      };
    case 403:
      return {
        titulo: 'No tenés permiso para esta acción',
        detalle: backend,
        sugerencia: 'Tu usuario puede consultar, pero no modificar. Si necesitás hacerlo, pedile a un administrador que te dé permiso de edición.',
      };
    case 404:
      return {
        titulo: 'No se encontró lo que se pidió',
        detalle: backend,
        sugerencia: 'Puede que la carga se haya borrado o que el servidor esté en una versión anterior.',
      };
    case 409:
      // Con el portal preguntando antes de subir (`utils/carrilCarga`), llegar
      // acá significa que el servidor se ocupó ENTRE esa consulta y la subida:
      // el archivo viajó y se descartó, nada quedó a medias. La sugerencia no
      // puede mandar «al historial de abajo»: esta pantalla puede ser la de una
      // jornada, que no lo tiene.
      return {
        titulo: 'Ya hay una carga en proceso',
        detalle: backend,
        sugerencia: 'El servidor atiende una carga por vez y otra se le adelantó por segundos. No se guardó nada: esperá a que termine y volvé a intentarlo.',
      };
    case 413:
      return {
        titulo: 'El archivo es demasiado grande',
        detalle: backend || `El límite del servidor es de ${LIMITE_MB} MB.`,
        sugerencia: 'Confirmá que estás subiendo el Excel maestro y no un respaldo con hojas de más.',
      };
    case 422:
      return {
        titulo: 'Faltan datos o están mal escritos',
        detalle: backend,
        sugerencia: 'Corregí lo señalado y volvé a enviar.',
      };
    case 429:
      return {
        titulo: 'Demasiados intentos seguidos',
        detalle: backend,
        sugerencia: 'Esperá un momento antes de volver a intentar.',
      };
    case 503:
      // Mientras se APLICA una carga, el portal queda en solo lectura: la
      // escritura del Excel toma la base entera durante unos segundos.
      return {
        titulo: 'El portal está en solo lectura unos segundos',
        detalle: backend || 'Se está aplicando una carga del Excel maestro.',
        sugerencia: 'No se guardó tu cambio. Esperá a que termine la carga —son segundos— y volvé a guardar; podés seguir consultando mientras tanto.',
      };
    default:
      if (status >= 500) {
        return {
          titulo: 'El servidor tuvo un problema',
          detalle: backend || `Código ${status}.`,
          sugerencia: `No se pudo ${accion}. Si vuelve a pasar, avisale al equipo técnico con la hora exacta.`,
        };
      }
      return {
        titulo: `No se pudo ${accion}`,
        detalle: backend || `Código ${status}.`,
        sugerencia: '',
      };
  }
}

/** Versión de una sola línea, para toasts y `alert()`. */
export function mensajeDeError(e, accion) {
  const d = describirError(e, accion);
  return [d.titulo, d.detalle].filter(Boolean).join(' — ');
}
