import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGetCarga } from '../api/endpoints';

// Estados finales: al llegar a uno de estos el sondeo se detiene solo.
export const ESTADOS_FINALES = ['OK', 'BLOQUEADA', 'FALLIDA'];
export const esFinal = (estado) => ESTADOS_FINALES.includes(estado);

const INTERVALO_MS = 2000;
const FALLOS_TOLERADOS = 5;   // ~10 s de red intermitente antes de rendirse

/** Errores que no mejoran por reintentar: permiso, no existe, sesión vencida. */
function esDefinitivo(e) {
  const st = e?.response?.status;
  if (!st) return false;                      // sin respuesta = problema de red
  if (st === 408 || st === 429) return false; // tiempo agotado / demasiados intentos
  return st >= 400 && st < 500;
}

/**
 * Sondea `GET /api/cargas/{id}` cada 2 s hasta que la carga termina.
 *
 * - Encadena `setTimeout` (no `setInterval`): nunca se solapan dos consultas
 *   si el servidor tarda, que era lo que dejaba peticiones en cola.
 * - Se detiene solo al llegar a un estado final y limpia el temporizador al
 *   desmontar: no quedan sondeos vivos si el usuario cambia de pantalla.
 * - Tolera cortes breves de red: solo reporta error tras varios fallos
 *   seguidos, para no asustar por un bache de un par de segundos.
 *
 * @param {number|null} cargaId id devuelto por POST /api/cargas
 * @returns {{carga:object|null, error:object|null, sondeando:boolean, refrescar:Function}}
 */
export function useCargaJob(cargaId) {
  const [carga, setCarga] = useState(null);
  const [error, setError] = useState(null);
  const [sondeando, setSondeando] = useState(false);

  const timerRef = useRef(null);
  const vivoRef = useRef(true);
  const fallosRef = useRef(0);

  const limpiar = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const consultar = useCallback(async (id) => {
    try {
      const data = await apiGetCarga(id);
      if (!vivoRef.current) return;
      fallosRef.current = 0;
      setError(null);
      setCarga(data);
      if (esFinal(data?.estado)) {
        setSondeando(false);
        return;                      // fin: no se reprograma
      }
    } catch (e) {
      if (!vivoRef.current) return;
      // Un 403/404 no se arregla reintentando: es «no tenés permiso» o «esa
      // carga no existe». Insistir cinco veces solo deja al usuario diez
      // segundos frente a una pantalla vacía sin saber qué pasó.
      if (esDefinitivo(e)) {
        setError(e);
        setSondeando(false);
        return;
      }
      fallosRef.current += 1;
      if (fallosRef.current >= FALLOS_TOLERADOS) {
        setError(e);
        setSondeando(false);
        return;
      }
    }
    if (!vivoRef.current) return;
    timerRef.current = setTimeout(() => consultar(id), INTERVALO_MS);
  }, []);

  useEffect(() => {
    vivoRef.current = true;
    limpiar();
    fallosRef.current = 0;
    if (!cargaId) {
      setCarga(null);
      setError(null);
      setSondeando(false);
      return undefined;
    }
    setSondeando(true);
    consultar(cargaId);
    return () => {
      vivoRef.current = false;
      limpiar();
    };
  }, [cargaId, consultar, limpiar]);

  // Desmontaje definitivo (por si el efecto de arriba ya corrió su limpieza).
  useEffect(() => () => { vivoRef.current = false; limpiar(); }, [limpiar]);

  const refrescar = useCallback(() => {
    if (!cargaId) return;
    vivoRef.current = true;
    fallosRef.current = 0;
    limpiar();
    setSondeando(true);
    consultar(cargaId);
  }, [cargaId, consultar, limpiar]);

  return { carga, error, sondeando, refrescar };
}
