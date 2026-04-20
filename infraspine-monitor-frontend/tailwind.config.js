/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1', /* Primary Indigo */
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        ocean: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6', /* Accent Teal */
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        // Zabbix Specific Severity Colors
        severity: {
          info:     '#3b82f6', // Information - Blue
          warning:  '#facc15', // Warning - Yellow
          average:  '#f97316', // Average - Orange
          high:     '#ef4444', // High - Red
          disaster: '#991b1b', // Disaster - Dark Red
          resolved: '#22c55e', // OK/Resolved - Green
        },
        surface: {
          0: 'color-mix(in srgb, var(--surface-0), transparent calc(100% - <alpha-value> * 100%))',
          1: 'color-mix(in srgb, var(--surface-1), transparent calc(100% - <alpha-value> * 100%))',
          2: 'color-mix(in srgb, var(--surface-2), transparent calc(100% - <alpha-value> * 100%))',
          3: 'color-mix(in srgb, var(--surface-3), transparent calc(100% - <alpha-value> * 100%))',
        },
      },
      textColor: {
        primary:   'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        tertiary:  'var(--text-tertiary)',
      },
      borderColor: {
        DEFAULT: 'color-mix(in srgb, var(--border), transparent calc(100% - <alpha-value> * 100%))',
        border:  'color-mix(in srgb, var(--border), transparent calc(100% - <alpha-value> * 100%))',
        subtle:  'color-mix(in srgb, var(--border-subtle), transparent calc(100% - <alpha-value> * 100%))',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.05)',
        'glass-dark': '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
        'glow-brand': '0 0 20px rgba(99, 102, 241, 0.6)',
        'glow-ocean': '0 0 20px rgba(20, 184, 166, 0.6)',
        'glow-red': '0 0 20px rgba(239, 68, 68, 0.6)',
        'card': '0 4px 15px -3px rgba(0, 0, 0, 0.05), 0 2px 6px -2px rgba(0, 0, 0, 0.03)',
        'card-hover': '0 12px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 100%)',
        'glass-gradient-dark': 'linear-gradient(135deg, rgba(30,41,59,0.7) 0%, rgba(15,23,42,0.8) 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'float': 'float 4s ease-in-out infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(15px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
    },
  },
  plugins: [],
};