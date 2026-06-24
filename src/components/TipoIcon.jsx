// Íconos monocromos (currentColor) por tipo de actividad del calendario.
// SVG inline (NO emoji) para render consistente cross-OS y legible a 14px.
// El ícono es el portador colorblind-safe del TIPO (el color de fondo = estado).

const PATHS = {
  // Jornada SIPRESALUD — pulso/actividad (tamizaje en salud)
  SIPRESALUD_JORNADA: <path d="M3 12h4l2-6 4 12 2-6h6" />,
  // Inauguración — tijera (corte de cinta)
  INAUGURACION: (
    <>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M20 4 8.12 15.88" />
      <path d="M14.47 14.48 20 20" />
      <path d="M8.12 8.12 12 12" />
    </>
  ),
  // Conferencia (antes Taller) — micrófono
  TALLER: (
    <>
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <path d="M12 17v4M8 21h8" />
    </>
  ),
  // Webinar — monitor
  WEBINAR: (
    <>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </>
  ),
};

export default function TipoIcon({ tipo, inaugura = false, size = 13, className = '' }) {
  // C1: una jornada que inaugura una clínica muestra la tijera de inauguración,
  // aunque su tipo sea SIPRESALUD_JORNADA (el flag manda sobre el tipo).
  const key = inaugura ? 'INAUGURACION' : tipo;
  const path = PATHS[key] || PATHS.SIPRESALUD_JORNADA;
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      className={`inline-block flex-shrink-0 ${className}`} aria-hidden="true"
    >
      {path}
    </svg>
  );
}
