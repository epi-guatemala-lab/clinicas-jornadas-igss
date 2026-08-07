/**
 * Input de búsqueda para barras de filtro de tablas. Controlado e instantáneo
 * (la página envuelve con `useDebounce` si quiere debauncir antes de fetchear).
 *
 * Props:
 *  - value, onChange(v)        controlado
 *  - placeholder               default 'Buscar…'
 *  - onClear()                 opcional (default onChange(''))
 *  - className, ariaLabel
 *
 * Estilo: clase base `.input` + icono lupa + botón ✕; `Esc` limpia.
 */
export default function SearchInput({
  value, onChange, placeholder = 'Buscar…', onClear,
  className = '', ariaLabel = 'Buscar',
}) {
  const clear = () => (onClear ? onClear() : onChange(''));
  // Esc dentro del input limpia la búsqueda.
  const onKey = (e) => {
    if (e.key === 'Escape' && value) { e.preventDefault(); clear(); }
  };
  return (
    <div className={`relative ${className}`}>
      {/* icono lupa */}
      <svg viewBox="0 0 24 24" fill="none" aria-hidden
           className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted pointer-events-none">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        type="text"
        role="searchbox"
        aria-label={ariaLabel}
        className="input pl-9 pr-8"
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKey}
      />
      {value ? (
        <button type="button" onClick={clear} aria-label="Limpiar búsqueda"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg text-base leading-none px-1">
          ×
        </button>
      ) : null}
    </div>
  );
}
