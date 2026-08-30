import type { Config } from 'tailwindcss';

/**
 * Design tokens are declared once here and consumed everywhere as semantic
 * names. Rebranding the platform is a change to this file plus
 * `src/config/brand.ts` — no component edits.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef7ff',
          100: '#d9edff',
          200: '#bce0ff',
          300: '#8ecdff',
          400: '#59b0ff',
          500: '#3390fc',
          600: '#1d70f1',
          700: '#1659de',
          800: '#1949b4',
          900: '#1a418e',
          950: '#142956',
        },
        ink: {
          DEFAULT: '#0f172a',
          soft: '#475569',
          muted: '#64748b',
          faint: '#94a3b8',
        },
        line: '#e2e8f0',
        surface: {
          DEFAULT: '#ffffff',
          sunken: '#f8fafc',
          raised: '#ffffff',
        },
        success: '#0e8a5f',
        warning: '#b45309',
        danger: '#c02626',
        gold: '#f59e0b',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
        control: '10px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,.06), 0 4px 16px rgba(15,23,42,.06)',
        pop: '0 8px 32px rgba(15,23,42,.16)',
        bar: '0 -1px 0 #e2e8f0',
      },
      maxWidth: {
        shell: '1180px',
      },
      screens: {
        xs: '400px',
      },
    },
  },
  plugins: [],
};

export default config;
