import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#05060b',
        neon: {
          cyan: '#22e4ff',
          magenta: '#ff2bd6',
        },
      },
      boxShadow: {
        'glow-cyan': '0 0 0 1px rgba(34,228,255,.65), 0 0 22px -4px rgba(34,228,255,.55)',
        'glow-magenta': '0 0 0 1px rgba(255,43,214,.65), 0 0 22px -4px rgba(255,43,214,.55)',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
