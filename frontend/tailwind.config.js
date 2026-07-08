/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // "Console" palette used on authenticated operations dashboards —
        // black + deep red, matching the brand's "Black Swarm" (#000000)
        // and "Embers" (#A00C30) swatches. Kept just off pure black
        // (#0D0D0D) for surfaces so text/borders stay comfortably readable
        // rather than crushing to true black.
        console: {
          bg: '#0D0D0D',
          surface: '#161616',
          surfaceAlt: '#202020',
          border: '#333333',
          mist: '#F2F0EE',
          muted: '#9B9B9B',
        },
        // "Field" palette used on public / citizen-facing pages (landing,
        // login, register). Kept light — unlike the console dashboards,
        // this page's text sits directly on `field.bg` AND inside white
        // cards at the same time, so `field.bg` and `field.surface` can't
        // both go dark without one of those two text contexts breaking.
        // The black+red identity still comes through via the brand-red
        // buttons/links/borders throughout these pages.
        field: {
          bg: '#F7F4EE',
          surface: '#FFFFFF',
          ink: '#1A1A1A',
          muted: '#6B7280',
        },
        // Severity / status colors — kept distinct from the black/red brand
        // palette on purpose, since these need to stay visually different
        // from each other (and from the brand accent) to do their job.
        severity: {
          critical: '#E8462F',
          high: '#F2994A',
          medium: '#F2C94C',
          low: '#2BB673',
          info: '#3E8EDE',
        },
        brand: {
          DEFAULT: '#A00C30', // "Embers"
          dark: '#6E081F',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        pulseBeacon: 'pulseBeacon 1.6s ease-in-out infinite',
      },
      keyframes: {
        pulseBeacon: {
          '0%, 100%': { opacity: 1, transform: 'scale(1)' },
          '50%': { opacity: 0.4, transform: 'scale(1.3)' },
        },
      },
    },
  },
  plugins: [],
};
