/**
 * Empty state — usar cuando una lista/chart no tiene datos para mostrar.
 */
export default function EmptyState({
  icon,
  title = 'Sin datos',
  hint,
  cta,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center p-6 text-fg-muted ${className}`}>
      {icon ? (
        <div className="mb-2 opacity-60">{icon}</div>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="1.5"
          className="h-10 w-10 mb-2 opacity-40"
        >
          <path strokeLinecap="round" strokeLinejoin="round"
                d="M3.75 9a2.25 2.25 0 012.25-2.25h12A2.25 2.25 0 0120.25 9v9.75A2.25 2.25 0 0118 21H6a2.25 2.25 0 01-2.25-2.25V9z" />
          <path strokeLinecap="round" strokeLinejoin="round"
                d="M8.25 14.25h7.5M8.25 17.25h4.5" />
        </svg>
      )}
      <div className="text-sm font-medium text-fg">{title}</div>
      {hint && <div className="text-xs mt-1">{hint}</div>}
      {cta && <div className="mt-3">{cta}</div>}
    </div>
  );
}
