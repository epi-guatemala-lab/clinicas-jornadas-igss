/**
 * Normalización de texto para búsqueda accent + case insensitive.
 * Espejo del backend `text_utils._norm` (mismo criterio → mismo resultado).
 *   'María Núñez' → 'MARIA NUNEZ'; 'BERKIN.SANTOS' → igual.
 */
export function norm(s) {
  if (s == null) return '';
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita marcas diacríticas (tildes) — escapes robustos
    .toUpperCase()
    .trim();
}

/** True si `haystack` contiene `needle` (ambos normalizados). */
export function normIncludes(haystack, needle) {
  const n = norm(needle);
  if (!n) return true;
  return norm(haystack).includes(n);
}
