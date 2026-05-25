import { useEffect, useMemo, useState, useCallback } from 'react';

/**
 * Hook reusable para estado de filtros con persistencia en localStorage.
 * Versionado: si cambia el shape, bump la versión en `key` para invalidar lecturas viejas.
 *
 * @param {string} key - key de localStorage (ej 'dashboard_filters_v1')
 * @param {object} initial - filtros default
 * @returns {object} { filters, setFilter, setFilters, clearFilters, hasActiveFilters, activeCount }
 */
export function useFilters(key, initial = {}) {
  const storageKey = `igss_filters_${key}`;
  const [filters, setFiltersState] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return { ...initial, ...JSON.parse(raw) };
    } catch {}
    return initial;
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(filters));
    } catch {}
  }, [storageKey, filters]);

  const setFilter = useCallback((name, value) => {
    setFiltersState((prev) => ({ ...prev, [name]: value }));
  }, []);

  const setFilters = useCallback((patch) => {
    setFiltersState((prev) => ({ ...prev, ...patch }));
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState(initial);
    try { localStorage.removeItem(storageKey); } catch {}
  }, [initial, storageKey]);

  const activeCount = useMemo(() => {
    let n = 0;
    Object.keys(filters).forEach((k) => {
      const v = filters[k];
      const init = initial[k];
      if (Array.isArray(v)) {
        if (v.length > 0 && JSON.stringify(v) !== JSON.stringify(init)) n++;
      } else if (v && v !== init && v !== '' && v !== false) {
        n++;
      }
    });
    return n;
  }, [filters, initial]);

  return {
    filters,
    setFilter,
    setFilters,
    clearFilters,
    hasActiveFilters: activeCount > 0,
    activeCount,
  };
}
