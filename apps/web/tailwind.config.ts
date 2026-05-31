import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        panel: '#071423',
        panelBorder: '#12324f',
        pageBg: '#020912',
        accent: '#3bd5ff',
        accentSoft: '#1d91b2',
        signalHot: '#ff9f43',
      },
      boxShadow: {
        panelGlow: '0 0 0 1px rgba(59, 213, 255, 0.15), 0 12px 40px rgba(2, 9, 18, 0.55)',
      },
      fontFamily: {
        sans: ['Rajdhani', 'Segoe UI', 'Tahoma', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;