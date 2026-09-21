/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#e94560', 50: '#fff0f3', 100: '#ffe0e6', 500: '#e94560', 600: '#d63a55', 700: '#b82d45' },
        dark: { DEFAULT: '#1a1a2e', 50: '#f5f5fa', 100: '#eaeaf5', 800: '#16213e', 900: '#0f3460' }
      },
      fontFamily: {
        sans: ['Syne', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      }
    }
  },
  plugins: []
};
