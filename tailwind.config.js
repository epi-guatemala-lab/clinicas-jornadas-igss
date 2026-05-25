/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Tokens semánticos (consumen CSS vars de :root y .dark) ──
        canvas:           'rgb(var(--bg-canvas) / <alpha-value>)',
        surface:          'rgb(var(--bg-surface) / <alpha-value>)',
        'surface-elev':   'rgb(var(--bg-surface-elev) / <alpha-value>)',
        sunken:           'rgb(var(--bg-sunken) / <alpha-value>)',
        // foreground (texto)
        fg:               'rgb(var(--text-primary) / <alpha-value>)',
        'fg-muted':       'rgb(var(--text-secondary) / <alpha-value>)',
        'fg-subtle':      'rgb(var(--text-muted) / <alpha-value>)',
        'fg-inverse':     'rgb(var(--text-inverse) / <alpha-value>)',
        // line (bordes)
        line:             'rgb(var(--border-default) / <alpha-value>)',
        'line-subtle':    'rgb(var(--border-subtle) / <alpha-value>)',
        'line-strong':    'rgb(var(--border-strong) / <alpha-value>)',
        // accent — coral-rosa (primary), teal (secondary), azul IGSS (tertiary)
        accent:           'rgb(var(--accent-primary) / <alpha-value>)',
        'accent-hover':   'rgb(var(--accent-primary-hover) / <alpha-value>)',
        'accent-soft':    'rgb(var(--accent-primary-soft) / <alpha-value>)',
        'accent-2':       'rgb(var(--accent-secondary) / <alpha-value>)',
        'accent-2-soft':  'rgb(var(--accent-secondary-soft) / <alpha-value>)',
        'accent-3':       'rgb(var(--accent-tertiary) / <alpha-value>)',
        'accent-3-soft':  'rgb(var(--accent-tertiary-soft) / <alpha-value>)',
        'accent-3-dark':  'rgb(var(--accent-tertiary-dark) / <alpha-value>)',
        // status
        success:          'rgb(var(--status-success) / <alpha-value>)',
        'success-soft':   'rgb(var(--status-success-soft) / <alpha-value>)',
        warning:          'rgb(var(--status-warning) / <alpha-value>)',
        'warning-soft':   'rgb(var(--status-warning-soft) / <alpha-value>)',
        danger:           'rgb(var(--status-danger) / <alpha-value>)',
        'danger-soft':    'rgb(var(--status-danger-soft) / <alpha-value>)',
        info:             'rgb(var(--status-info) / <alpha-value>)',
        'info-soft':      'rgb(var(--status-info-soft) / <alpha-value>)',
        neutral:          'rgb(var(--status-neutral) / <alpha-value>)',
        'neutral-soft':   'rgb(var(--status-neutral-soft) / <alpha-value>)',

        // ── Aliases LEGACY (re-mapeados a tokens nuevos) ──
        // Mantener para no romper componentes que aún usan bg-igss-* / bg-semaforo-*.
        // Eliminar después de Fase 5.
        igss: {
          primary: 'rgb(var(--accent-tertiary) / <alpha-value>)',
          dark:    'rgb(var(--accent-tertiary-dark) / <alpha-value>)',
          accent:  'rgb(var(--accent-secondary) / <alpha-value>)',
          light:   'rgb(var(--accent-tertiary-soft) / <alpha-value>)',
        },
        semaforo: {
          verde:    'rgb(var(--status-success) / <alpha-value>)',
          amarillo: 'rgb(var(--status-warning) / <alpha-value>)',
          naranja:  'rgb(var(--status-warning) / <alpha-value>)',
          rojo:     'rgb(var(--status-danger) / <alpha-value>)',
          azul:     'rgb(var(--status-info) / <alpha-value>)',
          gris:     'rgb(var(--status-neutral) / <alpha-value>)',
        },
      },
      boxShadow: {
        'glow-accent':    '0 0 0 4px rgb(var(--accent-primary) / 0.25)',
        'glow-accent-lg': '0 0 28px -4px rgb(var(--accent-primary) / 0.45)',
        'glow-cyan':      '0 0 20px -2px rgb(var(--accent-tertiary) / 0.6)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
