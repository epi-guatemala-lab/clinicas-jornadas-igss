/**
 * Banner de error con opción de reintento.
 */
export default function ErrorState({ message, retry, className = '' }) {
  return (
    <div className={`rounded-lg border border-danger/30 bg-danger-soft/30 px-3 py-2 text-sm text-danger ${className}`}>
      <div className="flex items-start gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2"
             className="h-5 w-5 flex-shrink-0 mt-0.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3v.008m-9.75-5.508c0-5.108 4.142-9.25 9.25-9.25s9.25 4.142 9.25 9.25-4.142 9.25-9.25 9.25S2.25 17.358 2.25 12z" />
        </svg>
        <div className="flex-1">
          <div className="font-medium">No se pudo cargar</div>
          {message && <div className="opacity-80 text-xs mt-0.5">{message}</div>}
        </div>
        {retry && (
          <button onClick={retry}
            className="text-xs font-semibold underline hover:opacity-80">
            Reintentar
          </button>
        )}
      </div>
    </div>
  );
}
