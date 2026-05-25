import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../api/client';

/**
 * Wrapper genérico de fetch sobre axios. Reemplaza el patrón
 * `useEffect → api.get → setData/setErr` repetido en varias páginas.
 *
 * @param {string} path - path del endpoint (ej '/api/charts/serie-diaria-mes')
 * @param {object} params - query params
 * @param {object} options - { enabled, deps, transform }
 */
export function useApi(path, params = {}, { enabled = true, transform } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const reqIdRef = useRef(0);
  const paramsKey = JSON.stringify(params || {});

  const fetcher = useCallback(async () => {
    if (!enabled) return;
    const myId = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const r = await api.get(path, { params });
      if (myId !== reqIdRef.current) return; // race-condition: descartar respuesta vieja
      const out = typeof transform === 'function' ? transform(r.data) : r.data;
      setData(out);
    } catch (e) {
      if (myId !== reqIdRef.current) return;
      const status = e?.response?.status;
      setError(status ? String(status) : (e?.message || 'Error desconocido'));
    } finally {
      if (myId === reqIdRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, paramsKey, enabled]);

  useEffect(() => {
    fetcher();
  }, [fetcher]);

  return { data, error, loading, refetch: fetcher };
}
