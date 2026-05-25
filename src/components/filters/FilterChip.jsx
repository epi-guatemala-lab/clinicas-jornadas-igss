/**
 * Pill toggleable para filtros laterales/inline.
 */
export default function FilterChip({ active, onClick, children, count, disabled, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium
                  transition-all duration-150 select-none
                  border ${active
                    ? 'bg-accent/10 border-accent text-accent shadow-glow-accent'
                    : 'bg-surface border-line text-fg-muted hover:border-line-strong hover:text-fg'}
                  ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
                  ${className}`}
    >
      {children}
      {count != null && (
        <span className={`tabular-nums text-[10px] ${active ? 'text-accent' : 'text-fg-subtle'}`}>
          ({count})
        </span>
      )}
    </button>
  );
}
