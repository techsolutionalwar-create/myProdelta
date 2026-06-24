/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          DEFAULT: '#0a0a0f',
          panel: '#10121a',
          raised: '#161924',
          border: '#222530',
        },
        cyan: {
          DEFAULT: '#00d4ff',
          dim: '#0a9bc4',
          glow: 'rgba(0, 212, 255, 0.15)',
        },
        bull: '#1fd67a',
        bear: '#ff4d6a',
        warn: '#ffb020',
        ink: {
          DEFAULT: '#e7e9ee',
          dim: '#8b91a1',
          faint: '#565b6b',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 24px rgba(0, 212, 255, 0.18)',
        'glow-sm': '0 0 12px rgba(0, 212, 255, 0.14)',
      },
      animation: {
        'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.25s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
      },
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(0,212,255,0.5)' },
          '50%': { opacity: '0.7', boxShadow: '0 0 0 6px rgba(0,212,255,0)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(6px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
