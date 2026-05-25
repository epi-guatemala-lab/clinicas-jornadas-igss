import { useTheme } from './useTheme.js';

/**
 * Botón redondo con morph sol↔luna. Click cicla light↔dark.
 * Shift-click expone 'system' (auto). Tooltip indica el modo actual.
 */
export default function ThemeToggle({ className = '' }) {
  const { mode, isDark, toggle, setMode } = useTheme();

  const handleClick = (e) => {
    if (e.shiftKey) {
      setMode('system');
    } else {
      toggle();
    }
  };

  const label = isDark ? 'Modo oscuro activo' : 'Modo claro activo';
  const tip = mode === 'system' ? `${label} · Auto (sistema)` : label;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
      title={`${tip}\nShift-click: Auto`}
      className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full
                  bg-white/10 hover:bg-white/20 text-white transition
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60
                  ${className}`}
    >
      {/* Sol */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`absolute h-5 w-5 transition-all duration-300 ease-in-out
                    ${isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'}`}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
      {/* Luna */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`absolute h-5 w-5 transition-all duration-300 ease-in-out
                    ${isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'}`}
        aria-hidden="true"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
      {/* Indicador "auto" (punto pequeño abajo) si mode === 'system' */}
      {mode === 'system' && (
        <span className="absolute -bottom-0.5 right-1 h-1.5 w-1.5 rounded-full bg-accent shadow-glow-cyan"></span>
      )}
    </button>
  );
}
