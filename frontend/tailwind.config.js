/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#080D12',
          surface: '#0B1118',
          card: '#0F1720',
          elevated: '#121D28',
          border: '#263442',
          subtle: '#1B2732',
          teal: '#25E0BE',
          accent: '#5AF0D1',
          primary: '#F3F7FA',
          secondary: '#A2B0BD',
          muted: '#718190',
          success: '#39DCA5',
          warning: '#F5B94C',
          danger: '#FF6B72',
          info: '#6DAAFB',
        },
        teal: {
          300: '#5AF0D1',
          400: '#25E0BE',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
        }
      }
    },
  },
  plugins: [],
}
