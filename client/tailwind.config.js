/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aubergine: {
          50: '#FBF5FA',
          100: '#F3E5F1',
          200: '#E5C9E1',
          300: '#CD9FC6',
          400: '#A7699E',
          500: '#7B3D71',
          600: '#5A1E52',
          700: '#46133F',
          800: '#3A0F34', // Brand Deep Aubergine
          900: '#2A0926',
          950: '#180415',
        },
        silver: {
          50: '#F7FAFC',
          100: '#EFF3F6',
          200: '#E4EAEF',
          300: '#DDE3E8', // Brand Ice Silver
          400: '#C5D0D9',
          500: '#9EAEBD',
          600: '#718494',
          700: '#4E5F6E',
          800: '#313E4A',
          900: '#1B232B',
        },
        marigold: {
          50: '#FEFDF5',
          100: '#FDF9E2',
          200: '#FAF0BA',
          300: '#F6E487',
          400: '#F1D244',
          500: '#EAAA00', // Brand Marigold Flavour
          600: '#C99100',
          700: '#9B6E00',
          800: '#725000',
          900: '#4E3600',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Syne', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'soft-aubergine': '0 10px 25px -5px rgba(58, 15, 52, 0.15), 0 8px 10px -6px rgba(58, 15, 52, 0.1)',
        'glow-marigold': '0 0 20px -3px rgba(234, 170, 0, 0.35)',
        'subtle': '0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.06)',
      },
    },
  },
  plugins: [],
}

