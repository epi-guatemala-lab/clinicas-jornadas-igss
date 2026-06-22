// Íconos monocromos (currentColor) por tipo de actividad del calendario.
// SVG inline (NO emoji) para render consistente cross-OS y legible a 14px.
// El ícono es el portador colorblind-safe del TIPO (el color de fondo = estado).

const PATHS = {
  // Jornada CE — maletín
  CE_JORNADA: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </>
  ),
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
  // Taller — birrete de graduación
  TALLER: (
    <>
      <path d="M22 10 12 5 2 10l10 5 10-5Z" />
      <path d="M6 12v5c0 1 2.7 3 6 3s6-2 6-3v-5" />
    </>
  ),
  // Webinar — monitor
  WEBINAR: (
    <>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </>
  ),
  // Visita de seguimiento — lupa
  VISITA_SEGUIMIENTO: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  // Informe / oficina — documento
  INFORME_OFICINA: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
    </>
  ),
};

export default function TipoIcon({ tipo, size = 13, className = '' }) {
  const path = PATHS[tipo] || PATHS.INFORME_OFICINA;
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
