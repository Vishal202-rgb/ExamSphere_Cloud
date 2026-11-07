/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        background: 'var(--background)',
        surface: {
          DEFAULT: 'var(--surface)',
          secondary: 'var(--surface-secondary)',
        },
        sidebar: 'var(--sidebar)',
        foreground: 'var(--foreground)',
        'secondary-text': 'var(--secondary-text)',
        'muted-text': 'var(--muted-text)',
        border: 'var(--border)',
        'input-border': 'var(--input-border)',
        hover: 'var(--hover)',
        input: 'var(--input-border)',
        ring: 'var(--ring)',
        'deep-navy': '#050B1E',
        'dark-navy': '#0F172A',
        'slate-navy': '#111827',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--primary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--surface-secondary)',
          foreground: 'var(--muted-text)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--primary-foreground)',
        },
        card: {
          DEFAULT: 'var(--surface)',
          foreground: 'var(--foreground)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        subtle: '0 1px 3px 0 rgba(0, 0, 0, 0.35)',
        card: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3)',
        'glow-blue': '0 0 25px -4px rgba(37, 99, 235, 0.45)',
        'glow-purple': '0 0 25px -4px rgba(147, 51, 234, 0.45)',
        'glow-emerald': '0 0 25px -4px rgba(16, 185, 129, 0.45)',
        'glow-cyan': '0 0 25px -4px rgba(6, 182, 212, 0.45)',
        'glow-amber': '0 0 25px -4px rgba(245, 158, 11, 0.45)',
      },
      keyframes: {
        'pulse-slow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
      animation: {
        'pulse-slow': 'pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
