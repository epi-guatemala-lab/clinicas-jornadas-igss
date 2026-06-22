// Single source of truth de los hex de la paleta.
// Útil para Recharts y cualquier código JS que no pueda leer CSS variables directamente.
// Para componentes React, preferir `useThemedColors()` que se actualiza al togglear tema.

export const lightTokens = {
  bg: {
    canvas: '#F4F7FB',
    surface: '#FFFFFF',
    surfaceElev: '#FAFBFD',
    sunken: '#EDF1F7',
  },
  border: {
    default: '#E4E8F2',
    subtle: '#EEF1F7',
    strong: '#C8D1DE',
  },
  text: {
    primary: '#0F172A',
    secondary: '#475569',
    muted: '#94A3B8',
    inverse: '#FFFFFF',
  },
  accent: {
    primary: '#FF3D7F',        // coral-rosa
    primaryHover: '#DB2777',
    primarySoft: '#FEE2EB',
    secondary: '#14B8A6',      // teal
    secondarySoft: '#CCFBF1',
    tertiary: '#0066B3',       // azul IGSS (para barras progreso diario)
    tertiarySoft: '#DBEAFE',
    tertiaryDark: '#003F73',
  },
  status: {
    success: '#15803D',
    successSoft: '#DCFCE7',
    warning: '#EA580C',        // naranja
    warningSoft: '#FFEDD5',
    danger: '#DC2626',         // rojo crítico
    dangerSoft: '#FEE2E2',
    info: '#2563EB',
    infoSoft: '#DBEAFE',
    neutral: '#64748B',
    neutralSoft: '#F1F5F9',
  },
  chart: {
    grid: '#E5E7EB',
    axis: '#64748B',
    series: [
      '#FF3D7F', // 1 coral
      '#14B8A6', // 2 teal
      '#0066B3', // 3 azul IGSS
      '#EA580C', // 4 naranja
      '#84CC16', // 5 verde lima
      '#CA8A04', // 6 dorado
      '#DB2777', // 7 magenta
    ],
  },
  // ── Calendario (Opción 2: color de fondo = ESTADO/asistencia) ──
  // Espejo de las CSS vars --estado-*-chip / --seccion-* / --alert-inaug-chip
  // en index.css. Texto BLANCO sobre cada fondo (verificado WCAG AA).
  calendar: {
    estado: {
      programada:  '#475569',  // gris — futura
      enCurso:     '#1D4ED8',  // azul — en curso ahora
      ejecutada:   '#92510E',  // ámbar oscuro — falta cierre
      cerradaOk:   '#15803D',  // verde — cerrada, asistencia OK
      cerradaBaja: '#C2410C',  // naranja — cerrada, asistencia baja
      cancelada:   '#DC2626',  // rojo — cancelada
      reprogramada:'#475569',  // gris (se distingue por borde dashed + ↻)
    },
    seccion: { ce: '#0066B3', sip: '#0F766E' },  // borde + cápsula CE/SP
    alertInaug: '#7E22CE',     // morado — inauguración sin jornada
  },
};

export const darkTokens = {
  bg: {
    canvas: '#0A0A0A',
    surface: '#141414',
    surfaceElev: '#1C1C1C',
    sunken: '#050505',
  },
  border: {
    default: '#2A2A2A',
    subtle: '#1E1E1E',
    strong: '#404040',
  },
  text: {
    primary: '#FAFAFA',
    secondary: '#A1A1AA',
    muted: '#71717A',
    inverse: '#0A0A0A',
  },
  accent: {
    primary: '#FF4D88',        // rosa brillante
    primaryHover: '#FB7185',
    primarySoft: '#4C0519',
    secondary: '#2DD4BF',      // teal brillante
    secondarySoft: '#134E4A',
    tertiary: '#22D3EE',       // cyan brillante
    tertiarySoft: '#164E63',
    tertiaryDark: '#0E7490',
  },
  status: {
    success: '#34D399',
    successSoft: '#064E3B',
    warning: '#FB923C',
    warningSoft: '#431407',
    danger: '#F87171',
    dangerSoft: '#450A0A',
    info: '#60A5FA',
    infoSoft: '#1E3A8A',
    neutral: '#94A3B8',
    neutralSoft: '#1E293B',
  },
  chart: {
    grid: '#2A2A2A',
    axis: '#94A3B8',
    series: [
      '#FF4D88', // 1 rosa brillante
      '#2DD4BF', // 2 teal brillante
      '#22D3EE', // 3 cyan brillante
      '#FB923C', // 4 naranja brillante
      '#A3E635', // 5 verde lima
      '#FACC15', // 6 amarillo dorado
      '#F472B6', // 7 rosa claro
    ],
  },
  // ── Calendario dark (mismos significados, ajustados para AA con texto blanco) ──
  calendar: {
    estado: {
      programada:  '#5B6B82',
      enCurso:     '#1E6FB0',
      ejecutada:   '#A8620F',
      cerradaOk:   '#1B8A4A',
      cerradaBaja: '#B45309',
      cancelada:   '#C23434',
      reprogramada:'#5B6B82',
    },
    seccion: { ce: '#3B9EE0', sip: '#2DD4BF' },
    alertInaug: '#8B3FD0',     // morado dark AA (5.65:1 con blanco)
  },
};

export const semaforoTokens = {
  // Map de strings de backend a key de status (consumir tokens del modo activo)
  verde:    'success',
  amarillo: 'warning',  // backend legacy
  naranja:  'warning',
  rojo:     'danger',
  azul:     'info',
  gris:     'neutral',
};
