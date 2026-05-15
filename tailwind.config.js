/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        igss: {
          primary: '#0066B3',    // azul IGSS
          dark: '#003F73',
          accent: '#00A99D',
          light: '#E8F2FB',
        },
        semaforo: {
          verde: '#22c55e',
          amarillo: '#eab308',
          rojo: '#ef4444',
          azul: '#3b82f6',
          gris: '#9ca3af',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
