import { useEffect, useState } from 'react';

/**
 * Devuelve `value` debounced `delay` ms. Útil para inputs de búsqueda: el
 * estado instantáneo vive en el componente (input responsivo); este hook emite
 * el valor "estable" que dispara el fetch/filtrado real, evitando un request
 * o re-filtrado por cada tecla.
 */
export function useDebounce(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
