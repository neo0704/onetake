/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // "white" is the text/border/tint colour; light mode swaps it for dark ink via CSS variables
        white: 'rgb(var(--c-white) / <alpha-value>)',
        primary: {
          DEFAULT: 'rgb(var(--c-primary) / <alpha-value>)',
          50:  'rgb(var(--c-primary-50) / <alpha-value>)',
          100: 'rgb(var(--c-primary-100) / <alpha-value>)',
          500: 'rgb(var(--c-primary) / <alpha-value>)',
          600: 'rgb(var(--c-primary-600) / <alpha-value>)',
          700: 'rgb(var(--c-primary-700) / <alpha-value>)'
        },
        dark: {
          DEFAULT: '#1a1a2e', 50: '#f5f5fa', 100: '#eaeaf5',
          800: 'rgb(var(--c-surface) / <alpha-value>)',
          900: 'rgb(var(--c-surface-2) / <alpha-value>)'
        }
      },
      fontFamily: {
        sans: ['Syne', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      }
    }
  },
  plugins: []
};